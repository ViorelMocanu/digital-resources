import { dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { normaliseRoot, scratchPath, withoutRepoVariables } from './lib/checkout-root.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SourceType = 'skills' | 'workflows';

/** `folder` mirrors a whole skill folder; `file` mirrors one canonical file per source. */
export type CopyUnit = 'folder' | 'file';

export interface TransformRule {
	find: string;
	replace: string;
}

/** `opsxAlias` writes a thin `opsx-<verb>` alias skill per workflow instead of copying the workflow. */
export type GeneratorName = 'opsxAlias';

/** `human`: invoked by name only; `agent`: model-invoked only; `mixed`: both. */
export type InvocationClass = 'human' | 'agent' | 'mixed';

export interface PlatformMapping {
	/** The canonical source. Only a mapping keyed `skills` may leave it out. */
	source?: SourceType;
	target: string;
	unit: CopyUnit;
	format: string;
	/** A regular expression the source name must match; other sources are skipped. */
	match?: string;
	/** Removed from the start of the source name before it fills `{name}`. */
	stripPrefix?: string;
	/** Frontmatter keys left out of every generated Markdown file, for a tool that reads a key differently (Copilot takes `name` as the slash-command name). */
	dropFrontmatterKeys?: string[];
	generator?: GeneratorName | undefined;
	transforms: string[];
}

export interface ManualOverride {
	path: string;
	reason: string;
}

export interface SyncConfig {
	canonical: string;
	generatedHeader: string;
	/** Required-core guard: every name here MUST be discovered on disk under `.agents/skills/<name>/SKILL.md` or `.agents/workflows/<name>.md`. Sync targets are derived by scanning the canonical directory, not from this list — this is a tripwire against accidental deletion of skills/workflows the project considers essential. */
	include: { skills: string[]; workflows: string[] };
	transforms: Record<string, TransformRule>;
	platforms: Record<string, Record<string, PlatformMapping>>;
	/** Path segments that are runtime caches, never skill content: not walked, copied or reported on either side. */
	skip?: string[];
	/** Former mirror folders that must not exist: `--check` fails while one does, and `--prune` never deletes one. */
	retired?: string[];
	/** The invocation class of each owned canonical skill; unlisted skills get `default`. */
	invocation?: { default: InvocationClass; skills: Record<string, InvocationClass> };
	/** Third-party skills kept byte-identical to upstream: exempt from classes, and each needs its Prettier and markdownlint ignore line. */
	vendored?: string[];
	manual: ManualOverride[];
}

export interface SyncOptions {
	/** Delete orphans and the folders they leave empty, after the link check. */
	prune?: boolean;
	/** Environment for the git call that skips git-ignored orphans; defaults to the process environment. */
	env?: NodeJS.ProcessEnv | undefined;
}

export interface SyncResult {
	/** Files whose bytes changed and were written. */
	written: string[];
	/** Files that already held the planned bytes. */
	unchanged: string[];
	/** Manual overrides that the sync left alone. */
	skipped: string[];
	/** Files in an owned scope that the sync would not write and left in place (empty after a prune). */
	orphans: string[];
	/** Orphans deleted by a prune. */
	pruned: string[];
	/** Retired mirror folders that exist. */
	retired: string[];
	/** Canonical skills whose metadata breaks a rule; reported, never fixed. */
	problems: string[];
}

export interface CheckResult {
	stale: string[];
	fresh: string[];
	missing: string[];
	/** Planned files that exist on disk under another letter case (a case-insensitive file system), by planned path. Each is also in `stale`. */
	caseMismatches: Record<string, string>;
	/** Files in an owned scope that the sync would not write. */
	orphans: string[];
	/** Retired mirror folders that exist. */
	retired: string[];
	/** Canonical skills whose metadata breaks a rule. */
	problems: string[];
}

export interface CliOptions {
	/** Environment for the git calls (`--check --staged`, and the git-ignore filter of every mode); defaults to the process environment. */
	env?: NodeJS.ProcessEnv | undefined;
}

export interface CliResult {
	/** The exit code. */
	code: number;
	stdout: string[];
	stderr: string[];
}

/** Thrown for bad config or canonical input; the CLI prints it as one `ERROR` message and exits 1. */
export class HarnessSyncError extends Error {
	override name = 'HarnessSyncError';
}

const CONFIG_FILE = 'scripts/sync-harness.config.json';

/** Files outside the canonical tree and the owned scopes that the staged check also exports. */
const STAGED_EXTRA_FILES = [CONFIG_FILE, '.prettierignore', '.markdownlintignore'];

/** The tool that reads the canonical skills natively, by the first segment of a retired mirror. */
const RETIRED_READERS: Record<string, string> = { '.codex': 'Codex', '.cursor': 'Cursor', '.github': 'Copilot' };

/** Reserved for generated alias skills: discovery skips these folders, and one without the generated header is an error. */
const ALIAS_PREFIX = 'opsx-';

/** A workflow id that may become an alias skill name (Agent Skills naming: lowercase words joined by single hyphens). */
const ALIAS_ID = /^opsx-[a-z]+(?:-[a-z]+)*$/;

/** The Agent Skills limit for `description`. */
const DESCRIPTION_LIMIT = 1024;

/** An Agent Skills `name`: lowercase letters and digits, words joined by single hyphens, at most `NAME_LIMIT` characters. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The Agent Skills limit for `name`. */
const NAME_LIMIT = 64;

/** The empty blob in SHA-1 and SHA-256 repositories: what `git add -N` (intent to add) puts in the index. */
const EMPTY_BLOBS = new Set(['e69de29bb2d1d6434b8b29ae775ad8c2e48c5391', '473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813']);

/** Most paths an `ERROR` message lists before it summarises the rest. */
const LISTED_PATHS = 20;

const INVOCATION_CLASSES: InvocationClass[] = ['human', 'agent', 'mixed'];

/** Files that must name every vendored skill folder, so no fixer rewrites upstream bytes. */
const IGNORE_FILES = ['.markdownlintignore', '.prettierignore'];

// A leading YAML frontmatter block; an unclosed block does not match.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Normalise path separators to forward slashes, for output and comparisons.
 * @param path A path with OS separators.
 * @returns The same path with forward slashes.
 */
function toSlash(path: string): string {
	return path.replace(/\\/g, '/');
}

/**
 * Apply transforms to content. A transform rewrites command names, not path segments: a match right after a word character, `.`, `/` or `-` (as in `.agents/workflows/opsx-verify.md`) is left alone.
 * @param content The content to transform.
 * @param transformNames The names of the transforms to apply.
 * @param transforms The transforms to apply.
 * @returns The transformed content.
 */
export function applyTransforms(content: string, transformNames: string[], transforms: Record<string, TransformRule>): string {
	let result = content;
	for (const name of transformNames) {
		const rule = transforms[name];
		if (rule) {
			// The pattern comes from the repo-owned config and every regex character is escaped.
			// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
			const find = new RegExp(`(?<![\\w./-])${rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
			result = result.replace(find, () => rule.replace);
		}
	}
	return result;
}

/**
 * Resolve the target path for a given format and name.
 * @param targetDir The target directory.
 * @param format The format to use.
 * @param name The name to use.
 * @returns The resolved target path.
 */
export function resolveTargetPath(targetDir: string, format: string, name: string): string {
	return join(targetDir, format.replace('{name}', name));
}

/**
 * Generate a file with transforms applied and the header inserted. Skill files must start with `---`, so the header goes right after a closing frontmatter fence, then one empty line, then the body. Without frontmatter (or with an unclosed block) the header is the first line. Inserted lines use the source's line ending. A leading byte-order mark is dropped, so the frontmatter still starts the file.
 * @param content The content to generate.
 * @param header The header to insert.
 * @param transformNames The names of the transforms to apply.
 * @param transforms The transforms to apply.
 * @returns The generated file content.
 */
export function generateFile(content: string, header: string, transformNames: string[], transforms: Record<string, TransformRule>): string {
	const body = applyTransforms(content.replace(/^\uFEFF/, ''), transformNames, transforms);
	const match = FRONTMATTER.exec(body);
	if (!match) {
		const eol = /^[^\n]*\r\n/.test(body) ? '\r\n' : '\n';
		return header + eol + eol + body;
	}
	const eol = match[0].includes('\r\n') ? '\r\n' : '\n';
	const frontmatter = match[0].endsWith('\n') ? match[0] : match[0] + eol;
	const rest = body.slice(match[0].length).replace(/^(?:\r?\n)+/, '');
	return frontmatter + header + eol + eol + rest;
}

/**
 * Tell whether a file carries the generated header where `generateFile` puts it.
 * @param content The file text.
 * @param header The generated header.
 * @returns True when the header follows the frontmatter, or opens a file without one.
 */
function hasGeneratedHeader(content: string, header: string): boolean {
	const match = FRONTMATTER.exec(content);
	return (match ? content.slice(match[0].length) : content).startsWith(header);
}

/**
 * Remove whole keys from the first frontmatter block: each `key:` line and the indented lines that continue it. Other lines and the body are kept byte for byte.
 * @param content The file text.
 * @param keys The keys to remove.
 * @returns The text without those keys; unchanged when there is no frontmatter.
 */
function dropFrontmatterKeys(content: string, keys: string[]): string {
	const text = content.replace(/^\uFEFF/, '');
	const match = keys.length > 0 ? FRONTMATTER.exec(text) : null;
	if (!match) {
		return content;
	}
	// Split after each newline, so every kept line keeps its own line ending.
	const lines = match[0].split(/(?<=\n)/);
	let dropping = false;
	const kept = lines.filter((line, index) => {
		if (index === 0 || index === lines.length - 1) {
			return true;
		}
		if (dropping && /^[ \t]/.test(line)) {
			return false;
		}
		dropping = keys.some((key) => line.startsWith(`${key}:`));
		return !dropping;
	});
	return kept.join('') + text.slice(match[0].length);
}

// ─── Alias generator (design D7) ─────────────────────────────────────────────

/**
 * Read one-line `key: value` entries from the first frontmatter block, without a YAML dependency. One pair of matching quotes is removed; block scalars, empty or multi-line values and escapes other than `\"` and `\\` are refused.
 * @param content The workflow text.
 * @param file The workflow path, for error messages.
 * @param keys The keys to read.
 * @returns The values by key.
 */
function readFrontmatterValues(content: string, file: string, keys: string[]): Record<string, string> {
	const match = FRONTMATTER.exec(content);
	if (!match) {
		throw new HarnessSyncError(`${file}: no frontmatter block; the alias needs a one-line id and description`);
	}
	const lines = match[0].split(/\r?\n/).slice(1, -1);
	const values: Record<string, string> = {};
	for (const key of keys) {
		const line = lines.find((candidate) => candidate.startsWith(`${key}:`));
		if (line === undefined) {
			throw new HarnessSyncError(`${file}: frontmatter has no one-line ${key}`);
		}
		const raw = line.slice(key.length + 1).trim();
		if (/^[|>]/.test(raw)) {
			throw new HarnessSyncError(`${file}: ${key} is a block scalar; write it on one line`);
		}
		if (raw === '') {
			throw new HarnessSyncError(`${file}: ${key} is empty or spans several lines; write it on one line`);
		}
		values[key] = unquoteYaml(raw, `${file}: ${key}`);
	}
	return values;
}

/**
 * Remove one pair of matching YAML quotes from a one-line value.
 * @param raw The value as written.
 * @param name The file and key, for error messages.
 * @returns The plain text.
 */
function unquoteYaml(raw: string, name: string): string {
	if (raw.startsWith('"')) {
		const inner = /^"((?:[^"\\]|\\["\\])*)"$/.exec(raw)?.[1];
		if (inner === undefined) {
			throw new HarnessSyncError(`${name} is not a one-line double-quoted value with only \\" and \\\\ escapes`);
		}
		return inner.replace(/\\(["\\])/g, '$1');
	}
	if (raw.startsWith("'")) {
		const inner = /^'((?:[^']|'')*)'$/.exec(raw)?.[1];
		if (inner === undefined) {
			throw new HarnessSyncError(`${name} is not a one-line single-quoted value`);
		}
		return inner.replace(/''/g, "'");
	}
	if (raw.includes(' #')) {
		throw new HarnessSyncError(`${name} contains " #", which YAML reads as a comment; quote the value`);
	}
	return raw;
}

/**
 * Write a value as a YAML double-quoted scalar. Escaping `\` and `"` keeps text such as `"grill me"` from ending the scalar early.
 * @param value The plain text.
 * @returns The quoted scalar.
 */
function yamlQuote(value: string): string {
	return `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

/**
 * The start of every generated alias description. It marks a generated alias without depending on the header text, so a reworded `generatedHeader` still lets the sync regenerate its own aliases.
 * @param name The alias name.
 * @returns The description prefix.
 */
function aliasMarker(name: string): string {
	return `Alias for the ${name} workflow.`;
}

/**
 * Tell whether an `opsx-*` skill was written by the alias generator: it carries the generated header, or the generated description.
 * @param content The `SKILL.md` text.
 * @param name The folder name.
 * @param header The generated header.
 * @returns True for a generated alias.
 */
function isGeneratedAlias(content: string, name: string, header: string): boolean {
	const frontmatter = FRONTMATTER.exec(content)?.[0] ?? '';
	return hasGeneratedHeader(content, header) || frontmatter.split(/\r?\n/).some((line) => line.startsWith(`description: "${aliasMarker(name)}`));
}

/**
 * Build an alias skill for one workflow: frontmatter first, then the header, then a paragraph that hands over to the canonical workflow. No transform is applied, so the workflow path stays intact.
 * @param config The sync config.
 * @param name The workflow name, the file stem.
 * @param content The workflow text.
 * @returns The `SKILL.md` text.
 */
function aliasSkill(config: SyncConfig, name: string, content: string): string {
	const workflow = `${trimSlashes(config.canonical)}/workflows/${name}.md`;
	const { id = '', description = '' } = readFrontmatterValues(content, workflow, ['id', 'description']);
	if (id !== name) {
		throw new HarnessSyncError(`${workflow}: id ${id} must equal the file name ${name}`);
	}
	if (!ALIAS_ID.test(id)) {
		throw new HarnessSyncError(`${workflow}: id ${id} is not a valid alias skill name (opsx- then lowercase words joined by single hyphens)`);
	}
	const aliasDescription = `${aliasMarker(id)} ${description}`;
	const length = [...aliasDescription].length;
	if (length > DESCRIPTION_LIMIT) {
		throw new HarnessSyncError(`${workflow}: the alias description would be ${length} characters, over the ${DESCRIPTION_LIMIT} limit`);
	}
	const frontmatter = [
		'---',
		`name: ${id}`,
		`description: ${yamlQuote(aliasDescription)}`,
		'disable-model-invocation: true',
		'metadata:',
		'    invocation: human',
		'---',
		'',
	].join('\n');
	const body = `Read \`${workflow}\` from the repo root and follow it with the user's arguments unchanged. Resolve every path from the repo root. Where the workflow names another \`/opsx-<verb>\` command, use this host's form of it (in Codex, \`$opsx-<verb>\`). Do not invoke this alias again from inside it.\n`;
	return `${frontmatter}${config.generatedHeader}\n\n${body}`;
}

/**
 * Build the Codex policy file of an alias: implicit invocation off, so only an explicit `$opsx-<verb>` starts the workflow.
 * @param config The sync config, for the header text.
 * @returns The `agents/openai.yaml` text, with two-space indentation.
 */
function aliasPolicy(config: SyncConfig): string {
	const header = config.generatedHeader.replace(/^<!--\s*/, '').replace(/\s*-->$/, '');
	return `# ${header}\npolicy:\n  allow_implicit_invocation: false\n`;
}

/**
 * Load and validate the sync config from the root directory.
 * @param rootDir The root directory.
 * @returns The sync config.
 */
export function loadConfig(rootDir: string): SyncConfig {
	const configPath = join(rootDir, CONFIG_FILE);
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
	} catch (error) {
		throw new HarnessSyncError(`${CONFIG_FILE} could not be read: ${(error as Error).message}`);
	}
	return validateConfig(parsed as SyncConfig);
}

/**
 * Check the config before any source is read. Every mapping needs a copy unit: without one only `SKILL.md` would be mirrored, and the rest of the folder would then count as orphans.
 * @param config The parsed config.
 * @returns The same config.
 */
export function validateConfig(config: SyncConfig): SyncConfig {
	const where = 'sync-harness.config.json';
	if ((config.skip ?? []).includes('.git')) {
		throw new HarnessSyncError(`${where}: skip must not name .git; a nested repository is an error, not a cache`);
	}
	const retired = retiredPaths(config);
	for (const [platform, mappings] of Object.entries(config.platforms)) {
		for (const [key, mapping] of Object.entries(mappings)) {
			validateMapping(config, `${where}: platforms.${platform}.${key}`, key, mapping, retired);
		}
	}
	validateClasses(config, where);
	return config;
}

/**
 * Check one platform mapping.
 * @param config The parsed config.
 * @param name The mapping's config path, for error messages.
 * @param key The mapping key.
 * @param mapping The mapping.
 * @param retired The normalised retired paths.
 */
function validateMapping(config: SyncConfig, name: string, key: string, mapping: PlatformMapping, retired: string[]): void {
	if (mapping.source !== undefined && mapping.source !== 'skills' && mapping.source !== 'workflows') {
		throw new HarnessSyncError(`${name}.source must be skills or workflows`);
	}
	if (mapping.unit !== 'folder' && mapping.unit !== 'file') {
		throw new HarnessSyncError(`${name}.unit must be folder or file`);
	}
	if (mapping.unit === 'folder' && getSourceType(mapping, key, name) !== 'skills') {
		throw new HarnessSyncError(`${name}: unit folder needs source skills`);
	}
	for (const transform of mapping.transforms) {
		if (!config.transforms[transform]) {
			throw new HarnessSyncError(`${name}.transforms names unknown transform ${transform}`);
		}
	}
	if (mapping.match !== undefined) {
		try {
			// Validates a pattern from the repo-owned sync config, which only maintainers edit.
			// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
			new RegExp(mapping.match);
		} catch (error) {
			throw new HarnessSyncError(`${name}.match is not a valid regular expression: ${(error as Error).message}`);
		}
	}
	if (mapping.stripPrefix !== undefined && typeof mapping.stripPrefix !== 'string') {
		throw new HarnessSyncError(`${name}.stripPrefix must be a string`);
	}
	const dropKeys: unknown = mapping.dropFrontmatterKeys;
	if (dropKeys !== undefined && (!Array.isArray(dropKeys) || dropKeys.some((key) => typeof key !== 'string' || !/^[A-Za-z0-9_-]+$/.test(key)))) {
		throw new HarnessSyncError(`${name}.dropFrontmatterKeys must be a list of frontmatter key names`);
	}

	const target = trimSlashes(mapping.target);
	const canonical = trimSlashes(config.canonical);
	if (mapping.generator !== undefined) {
		if (mapping.generator !== 'opsxAlias') {
			throw new HarnessSyncError(`${name}.generator names unknown generator ${String(mapping.generator)}`);
		}
		if (
			mapping.source !== 'workflows' ||
			mapping.unit !== 'file' ||
			mapping.format !== '{name}/SKILL.md' ||
			mapping.transforms.length > 0 ||
			mapping.stripPrefix !== undefined ||
			dropKeys !== undefined ||
			target !== `${canonical}/skills`
		) {
			throw new HarnessSyncError(
				`${name}: generator opsxAlias needs source workflows, unit file, format {name}/SKILL.md, target ${canonical}/skills, no transforms, no stripPrefix and no dropFrontmatterKeys`
			);
		}
	} else if (target === canonical || target.startsWith(`${canonical}/`)) {
		throw new HarnessSyncError(`${name}.target must not be inside the canonical folder ${canonical}; only a generator mapping writes there`);
	}

	const overlap = retired.find((path) => target === path || target.startsWith(`${path}/`) || path.startsWith(`${target}/`));
	if (overlap) {
		throw new HarnessSyncError(`${name}.target overlaps the retired path ${overlap}`);
	}
}

/**
 * Check the invocation classes and the vendored list.
 * @param config The parsed config.
 * @param where The config file name, for error messages.
 */
function validateClasses(config: SyncConfig, where: string): void {
	const vendored = config.vendored ?? [];
	if (!Array.isArray(vendored) || vendored.some((name) => typeof name !== 'string')) {
		throw new HarnessSyncError(`${where}: vendored must be a list of skill names`);
	}
	if (config.invocation === undefined) {
		return;
	}
	if (!INVOCATION_CLASSES.includes(config.invocation.default)) {
		throw new HarnessSyncError(`${where}: invocation.default must be human, agent or mixed`);
	}
	for (const [skill, invocationClass] of Object.entries(config.invocation.skills ?? {})) {
		if (vendored.includes(skill)) {
			throw new HarnessSyncError(`${where}: invocation.skills.${skill}: vendored skills are exempt from invocation classes; remove the entry`);
		}
		if (!INVOCATION_CLASSES.includes(invocationClass)) {
			throw new HarnessSyncError(`${where}: invocation.skills.${skill} must be human, agent or mixed`);
		}
	}
}

/**
 * Normalise a config path: forward slashes and no trailing slash.
 * @param path A path from the config.
 * @returns The normalised path.
 */
function trimSlashes(path: string): string {
	return toSlash(path).replace(/\/+$/, '');
}

/**
 * Read the retired list from the config.
 * @param config The sync config.
 * @returns The retired paths, normalised.
 */
function retiredPaths(config: SyncConfig): string[] {
	if (config.retired !== undefined && (!Array.isArray(config.retired) || config.retired.some((path) => typeof path !== 'string'))) {
		throw new HarnessSyncError('sync-harness.config.json: retired must be a list of paths');
	}
	return (config.retired ?? []).map(trimSlashes);
}

/**
 * Say why a retired mirror must stay gone, naming the tool that reads the canonical skills instead.
 * @param config The sync config.
 * @param path The retired path.
 * @returns The reason, for the `RETIRED` line.
 */
function retiredReason(config: SyncConfig, path: string): string {
	const reader = RETIRED_READERS[path.split('/')[0] ?? ''] ?? 'Every supported tool';
	return `retired mirror: ${reader} reads ${trimSlashes(config.canonical)}/skills natively; delete it by hand, --prune never does`;
}

/**
 * Get the source type for a given mapping. Only `"skills"` is inferred from the mappingKey; any other key MUST declare `source` explicitly so a typo'd key can't silently fall through as `"workflows"`.
 * @param mapping The mapping to get the source type for.
 * @param mappingKey The key of the mapping.
 * @param name The mapping's config path, for the error message.
 * @returns The source type.
 */
function getSourceType(mapping: PlatformMapping, mappingKey: string, name = mappingKey): SourceType {
	if (mapping.source) {
		return mapping.source;
	}
	if (mappingKey === 'skills') {
		return 'skills';
	}
	throw new HarnessSyncError(`${name} must declare a 'source' field; only "skills" is inferred by key.`);
}

// ─── Containment (design D3) ─────────────────────────────────────────────────

/** Collects the link and nested-repository problems of one run, so they are all reported together before anything is written. */
interface Guard {
	/** Absolute repo root. */
	root: string;
	problems: Set<string>;
	/** Absolute paths already known to be real folders or files, shared across checks to avoid repeat `lstat` calls. */
	safe: Set<string>;
}

/**
 * Start a guard for one run.
 * @param root Absolute repo root.
 * @returns An empty guard.
 */
function newGuard(root: string): Guard {
	return { root, problems: new Set(), safe: new Set() };
}

/**
 * Tell whether a path from `relative(base, target)` is the base itself or leaves it.
 * @param rel The relative path.
 * @returns True for the base, a parent, or another drive.
 */
function isOutside(rel: string): boolean {
	return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * Describe a link. The link target is printed so the owner can see where it pointed; the files behind it are never listed.
 * @param guard The run's guard.
 * @param absolute Absolute path of the link.
 * @returns The problem line.
 */
function linkProblem(guard: Guard, absolute: string): string {
	return `${toSlash(relative(guard.root, absolute))} is a symlink to ${toSlash(readlinkSync(absolute))}`;
}

/**
 * Check a path below the root with `lstat`, segment by segment. Links are refused even when they point inside the repo, because generated and canonical folders must be real folders. A file where a parent folder belongs is refused too, so no write later fails half-way.
 * @param guard The run's guard; a problem is added to it.
 * @param pathRelative The path, relative to the root.
 * @returns True when no segment that exists is a link or a misplaced file, and the path stays inside the root.
 */
function checkSegments(guard: Guard, pathRelative: string): boolean {
	const rel = relative(guard.root, resolve(guard.root, pathRelative));
	if (isOutside(rel)) {
		guard.problems.add(`${toSlash(pathRelative)} resolves outside the repo root`);
		return false;
	}
	let current = guard.root;
	const segments = rel.split(sep);
	for (const [index, segment] of segments.entries()) {
		current = join(current, segment);
		if (guard.safe.has(current)) {
			continue;
		}
		const stats = lstatSync(current, { throwIfNoEntry: false });
		if (!stats) {
			return true;
		}
		if (stats.isSymbolicLink()) {
			guard.problems.add(linkProblem(guard, current));
			return false;
		}
		if (!stats.isDirectory()) {
			if (index < segments.length - 1) {
				guard.problems.add(`${toSlash(relative(guard.root, current))} is a file where the sync needs a folder`);
				return false;
			}
			return true;
		}
		guard.safe.add(current);
	}
	return true;
}

/**
 * Build the error that stops a run, naming every problem.
 * @param problems The problem lines.
 * @returns The error to throw.
 */
function containmentError(problems: Iterable<string>): HarnessSyncError {
	return new HarnessSyncError(
		[
			'harness:sync stopped before writing anything. Canonical and generated paths must be real folders inside this repo:',
			...[...problems].map((problem) => `  - ${problem}`),
			'Remove each link (the link only, never what it points to), move each nested repository out of the repo, move each file or folder that sits where the other belongs and rename any hand-made opsx-* skill, then run pnpm harness:sync again.',
		].join('\n')
	);
}

/**
 * List the regular files below a folder. The walk is manual and descends only into real folders, because a recursive `readdirSync` lists the files behind a Windows junction as if they were inside. A link or a `.git` entry is added to the guard and never entered.
 * @param guard The run's guard.
 * @param dirRelative The folder to walk, relative to the root, with forward slashes.
 * @param skip Entry names that are runtime caches.
 * @returns Sorted file paths relative to the folder, with forward slashes.
 */
function walkFiles(guard: Guard, dirRelative: string, skip: Set<string>): string[] {
	const files: string[] = [];
	const visit = (folder: string, prefix: string): void => {
		for (const name of readdirSync(join(guard.root, folder)).sort()) {
			if (skip.has(name)) {
				continue;
			}
			const child = `${folder}/${name}`;
			const rel = prefix ? `${prefix}/${name}` : name;
			if (name === '.git') {
				guard.problems.add(`${child} is a nested git repository; the sync never mirrors or prunes one`);
				continue;
			}
			const stats = lstatSync(join(guard.root, child));
			if (stats.isSymbolicLink()) {
				guard.problems.add(linkProblem(guard, join(guard.root, child)));
			} else if (stats.isDirectory()) {
				visit(child, rel);
			} else if (stats.isFile()) {
				files.push(rel);
			}
		}
	};
	visit(dirRelative, '');
	return files;
}

interface Sources {
	/** Skill name to its files, relative to the skill folder. */
	skills: Map<string, string[]>;
	workflows: string[];
}

/**
 * Discover all canonical skills and workflows on disk under `.agents/`. Skills are subdirectories of `.agents/skills/` that contain a `SKILL.md`; workflows are `.md` files directly under `.agents/workflows/`. A link or a nested repository on the canonical side is added to the guard.
 * @param guard The run's guard.
 * @param config The sync config.
 * @param skip Entry names that are runtime caches.
 * @returns The discovered skills with their files, and the sorted workflow names.
 */
function discoverSources(guard: Guard, config: SyncConfig, skip: Set<string>): Sources {
	const canonical = trimSlashes(config.canonical);
	const skillsDir = `${canonical}/skills`;
	const workflowsDir = `${canonical}/workflows`;
	const skills = new Map<string, string[]>();
	const workflows: string[] = [];

	if (checkSegments(guard, skillsDir) && existsSync(join(guard.root, skillsDir))) {
		for (const name of readdirSync(join(guard.root, skillsDir)).sort()) {
			const folder = join(guard.root, skillsDir, name);
			const stats = lstatSync(folder);
			if (name === '.git') {
				guard.problems.add(`${skillsDir}/.git is a nested git repository; the sync never mirrors or prunes one`);
			} else if (stats.isSymbolicLink()) {
				guard.problems.add(linkProblem(guard, folder));
			} else if (name.startsWith(ALIAS_PREFIX)) {
				// Generated aliases belong to the alias scope, never to discovery, and a hand-made skill must not hide among them.
				const skill = stats.isDirectory() ? readIfExists(join(folder, 'SKILL.md')) : null;
				if (!skill || !isGeneratedAlias(skill.toString('utf-8'), name, config.generatedHeader)) {
					guard.problems.add(
						`${skillsDir}/${name} has no generated SKILL.md (neither the generated header nor the generated alias description); the ${ALIAS_PREFIX} prefix is reserved for generated aliases, so rename a hand-made skill`
					);
				}
			} else if (stats.isDirectory() && existsSync(join(folder, 'SKILL.md'))) {
				skills.set(name, walkFiles(guard, `${skillsDir}/${name}`, skip));
			}
		}
	}

	if (checkSegments(guard, workflowsDir) && existsSync(join(guard.root, workflowsDir))) {
		for (const entry of readdirSync(join(guard.root, workflowsDir), { withFileTypes: true })) {
			if (!entry.name.endsWith('.md')) {
				continue;
			}
			if (entry.isSymbolicLink()) {
				guard.problems.add(linkProblem(guard, join(guard.root, workflowsDir, entry.name)));
			} else if (entry.isFile()) {
				workflows.push(entry.name.replace(/\.md$/, ''));
			}
		}
	}

	return { skills, workflows: sortPaths(workflows) };
}

/**
 * Verify every name in `config.include` was discovered on disk. The include list is a safety guard against accidentally deleting a core skill/workflow — if a required name is missing canonically, fail loudly instead of silently dropping it from downstream platforms.
 * @param config The sync config.
 * @param sources The discovered sources.
 */
function verifyRequiredCore(config: SyncConfig, sources: Sources): void {
	const workflowSet = new Set(sources.workflows);
	const missingSkills = config.include.skills.filter((n) => !sources.skills.has(n));
	const missingWorkflows = config.include.workflows.filter((n) => !workflowSet.has(n));

	if (missingSkills.length === 0 && missingWorkflows.length === 0) {
		return;
	}

	const lines = ['Required core entries are missing from .agents/:'];
	for (const n of missingSkills) lines.push(`  MISSING SKILL    ${n}`);
	for (const n of missingWorkflows) lines.push(`  MISSING WORKFLOW ${n}`);
	throw new HarnessSyncError(lines.join('\n'));
}

// ─── Planning and ownership (design D4) ──────────────────────────────────────

interface TargetEntry {
	/** Target path relative to the root, with forward slashes. */
	target: string;
	/** Absolute canonical file the target is rendered from. */
	sourcePath: string;
	transforms: string[];
	/** Frontmatter keys left out of a Markdown target. */
	dropKeys: string[];
	/** Set for generator output: which alias file to build, and from which workflow name. */
	alias?: { file: 'skill' | 'policy'; name: string };
}

/** A folder the sync owns: every file below `root`, or with `prefix`, only the entries of `root` whose name starts with it. */
interface Scope {
	/** Folder relative to the root, with forward slashes. */
	root: string;
	prefix?: string;
}

interface Plan {
	targets: TargetEntry[];
	skipped: string[];
	/** Sorted orphan paths. */
	orphans: string[];
	/** Each orphan's scope root, where emptied-folder removal stops. */
	orphanScopes: Map<string, string>;
	/** Planned targets that exist on disk under another letter case, by planned path. */
	caseMismatches: Map<string, string>;
	retired: string[];
	problems: string[];
}

/**
 * Compare two strings by code unit, for stable output on every OS.
 * @param a A string.
 * @param b Another string.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` expects.
 */
function byCodeUnit(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Sort paths by code unit, for stable output on every OS.
 * @param paths The paths to sort.
 * @returns A new sorted list.
 */
function sortPaths(paths: Iterable<string>): string[] {
	return [...paths].sort(byCodeUnit);
}

/**
 * List the scopes the sync owns: the target folder of every mapping. A generator writes into the canonical skills folder, so it owns only the folders with the reserved prefix there; owning the whole folder would make every canonical skill an orphan. Manual overrides inside a scope are not owned.
 * @param config The sync config.
 * @returns The scopes, without duplicates.
 */
function ownedScopes(config: SyncConfig): Scope[] {
	const scopes = new Map<string, Scope>();
	for (const mappings of Object.values(config.platforms)) {
		for (const mapping of Object.values(mappings)) {
			const root = trimSlashes(mapping.target);
			const scope: Scope = mapping.generator ? { root, prefix: ALIAS_PREFIX } : { root };
			scopes.set(`${root}::${scope.prefix ?? ''}`, scope);
		}
	}
	return [...scopes.values()];
}

/**
 * Plan the files of one mapping for one source name.
 * @param root Absolute repo root.
 * @param canonical The canonical folder, normalised.
 * @param sources The discovered sources.
 * @param mapping The mapping.
 * @param sourceType The mapping's source type.
 * @param name The source name.
 * @returns The planned files.
 */
function planMapping(root: string, canonical: string, sources: Sources, mapping: PlatformMapping, sourceType: SourceType, name: string): TargetEntry[] {
	const outputName = mapping.stripPrefix && name.startsWith(mapping.stripPrefix) ? name.slice(mapping.stripPrefix.length) : name;
	const primary = toSlash(resolveTargetPath(mapping.target, mapping.format, outputName));
	if (mapping.generator) {
		const sourcePath = join(root, canonical, 'workflows', `${name}.md`);
		return [
			{ target: primary, sourcePath, transforms: [], dropKeys: [], alias: { file: 'skill', name } },
			{ target: `${posix.dirname(primary)}/agents/openai.yaml`, sourcePath, transforms: [], dropKeys: [], alias: { file: 'policy', name } },
		];
	}
	const dropKeys = mapping.dropFrontmatterKeys ?? [];
	if (sourceType === 'skills' && mapping.unit === 'folder') {
		const skillDir = `${canonical}/skills/${name}`;
		return (sources.skills.get(name) ?? []).map((file) => ({
			target: file === 'SKILL.md' ? primary : `${posix.dirname(primary)}/${file}`,
			sourcePath: join(root, skillDir, file),
			transforms: mapping.transforms,
			dropKeys,
		}));
	}
	const sourcePath = sourceType === 'skills' ? join(root, canonical, 'skills', name, 'SKILL.md') : join(root, canonical, 'workflows', `${name}.md`);
	return [{ target: primary, sourcePath, transforms: mapping.transforms, dropKeys }];
}

/**
 * List every file in an owned scope, refusing links and nested repositories.
 * @param guard The run's guard.
 * @param scope The scope.
 * @param skip Entry names that are runtime caches.
 * @returns File paths relative to the root.
 */
function listScope(guard: Guard, scope: Scope, skip: Set<string>): string[] {
	if (!checkSegments(guard, scope.root)) {
		return [];
	}
	const absolute = join(guard.root, scope.root);
	const stats = lstatSync(absolute, { throwIfNoEntry: false });
	if (!stats) {
		return [];
	}
	if (!stats.isDirectory()) {
		guard.problems.add(`${scope.root} is not a folder`);
		return [];
	}
	if (scope.prefix === undefined) {
		return walkFiles(guard, scope.root, skip).map((file) => `${scope.root}/${file}`);
	}
	const files: string[] = [];
	for (const name of readdirSync(absolute).sort()) {
		if (!name.startsWith(scope.prefix)) {
			continue;
		}
		const child = `${scope.root}/${name}`;
		const childStats = lstatSync(join(guard.root, child));
		if (childStats.isSymbolicLink()) {
			guard.problems.add(linkProblem(guard, join(guard.root, child)));
		} else if (childStats.isDirectory()) {
			files.push(...walkFiles(guard, child, skip).map((file) => `${child}/${file}`));
		} else if (childStats.isFile()) {
			files.push(child);
		}
	}
	return files;
}

/**
 * Tell whether a path exists, without following a link at its end.
 * @param absolute Absolute path.
 * @returns True when something is there.
 */
function pathExists(absolute: string): boolean {
	try {
		return lstatSync(absolute, { throwIfNoEntry: false }) !== undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') {
			return false;
		}
		throw error;
	}
}

/**
 * Normalise a `manual` path: trimmed, forward slashes, no leading `./` and no trailing slash, so it compares equal to a planned path.
 * @param path The path as written in the config.
 * @returns The normalised path.
 */
function normaliseManualPath(path: string): string {
	return trimSlashes(posix.normalize(toSlash(path.trim())));
}

/**
 * Plan a run without touching any file: every file the sync would write, the manual overrides it leaves alone, the orphans in its owned scopes and the retired mirrors that exist. Every link and nested repository on either side stops the run here, so all modes fail the same way.
 * @param config The sync config.
 * @param rootDir The root directory.
 * @param env The environment for the git-ignore filter.
 * @returns The plan.
 */
function planSync(config: SyncConfig, rootDir: string, env: NodeJS.ProcessEnv): Plan {
	validateConfig(config);
	const root = resolve(rootDir);
	const guard = newGuard(root);
	const canonical = trimSlashes(config.canonical);
	const skip = new Set(config.skip ?? []);
	const sources = discoverSources(guard, config, skip);

	const manualPaths = new Set(config.manual.map((m) => normaliseManualPath(m.path)));
	const targets: TargetEntry[] = [];
	const skipped: string[] = [];

	for (const mappings of Object.values(config.platforms)) {
		for (const [mappingKey, mapping] of Object.entries(mappings)) {
			const sourceType = getSourceType(mapping, mappingKey);
			const filter = mapping.match === undefined ? null : new RegExp(mapping.match);
			const names = (sourceType === 'skills' ? [...sources.skills.keys()] : sources.workflows).filter((name) => !filter || filter.test(name));

			for (const name of names) {
				for (const file of planMapping(root, canonical, sources, mapping, sourceType, name)) {
					if (manualPaths.has(file.target)) {
						skipped.push(file.target);
					} else {
						targets.push(file);
					}
				}
			}
		}
	}

	for (const entry of targets) {
		if (checkSegments(guard, entry.target) && lstatSync(join(root, entry.target), { throwIfNoEntry: false })?.isDirectory()) {
			guard.problems.add(`${entry.target} is a folder where the sync writes a file`);
		}
	}

	const targetPaths = new Set(targets.map((t) => t.target));
	const planned = new Set([...targetPaths, ...manualPaths]);
	const listed = new Map<string, string>();
	for (const scope of ownedScopes(config)) {
		for (const path of listScope(guard, scope, skip)) {
			if (!listed.has(path)) {
				listed.set(path, scope.root);
			}
		}
	}

	// On a case-insensitive file system (NTFS, APFS) a planned path can exist on disk under another letter case. That
	// file is the planned file itself, not an orphan: pruning it would delete what the same run counted as written.
	const plannedByCase = new Map([...planned].map((path) => [path.toLowerCase(), path]));
	const candidates = new Map<string, string>();
	const caseMismatches = new Map<string, string>();
	for (const [path, scopeRoot] of listed) {
		if (planned.has(path)) {
			continue;
		}
		const twin = plannedByCase.get(path.toLowerCase());
		if (twin !== undefined && !listed.has(twin) && pathExists(join(root, twin))) {
			if (targetPaths.has(twin)) {
				caseMismatches.set(twin, path);
			}
			continue;
		}
		candidates.set(path, scopeRoot);
	}

	if (guard.problems.size > 0) {
		throw containmentError(guard.problems);
	}
	verifyRequiredCore(config, sources);

	const ignored = gitIgnored(root, [...candidates.keys()], env);
	const orphanScopes = new Map([...candidates].filter(([path]) => !ignored.has(path)));
	const retired = retiredPaths(config).filter((path) => pathExists(join(root, path)));
	const manualProblems = [...manualPaths].filter((path) => !pathExists(join(root, path))).map((path) => `manual entry ${path} matches no file; fix the path or remove the entry`);
	const skills = readCanonicalSkills(root, config, sources);
	const problems = sortPaths([...checkFrontmatter(skills), ...checkInvocation(root, config, skills), ...checkVendored(root, config, skills), ...manualProblems]);
	return { targets, skipped, orphans: sortPaths(orphanScopes.keys()), orphanScopes, caseMismatches, retired, problems };
}

// ─── Invocation classes and vendored skills (design D8, D9) ──────────────────

/**
 * Read a YAML scalar as a boolean. Only the literal `true` and `false` count, because tools disagree on `yes`, `on` and `1`.
 * @param raw The value as written, trimmed.
 * @returns The boolean, or the raw text when it is not a literal boolean.
 */
function literalBoolean(raw: string): boolean | string {
	return raw === 'true' ? true : raw === 'false' ? false : raw;
}

/**
 * Read a boolean flag from frontmatter lines, as {@link literalBoolean} reads it.
 * @param lines The frontmatter lines.
 * @param key The flag.
 * @returns The value, undefined when absent, or the raw text when it is not a literal boolean.
 */
function readFlag(lines: string[], key: string): boolean | undefined | string {
	const line = lines.find((candidate) => candidate.startsWith(`${key}:`));
	return line === undefined ? undefined : literalBoolean(line.slice(key.length + 1).trim());
}

/**
 * Read `allow_implicit_invocation` from the `policy:` block of an `agents/openai.yaml`, without a YAML dependency. Blank and comment lines are skipped; the same key under another top-level key does not count.
 * @param text The file text.
 * @returns The value, undefined when absent, or the raw text when it is not a literal boolean.
 */
function readImplicitPolicy(text: string): boolean | undefined | string {
	let inPolicy = false;
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '' || line.trimStart().startsWith('#')) {
			continue;
		}
		if (!/^\s/.test(line)) {
			inPolicy = /^policy:\s*(?:#.*)?$/.test(line);
			continue;
		}
		const raw = inPolicy ? /^\s+allow_implicit_invocation:\s*(.*?)\s*(?:#.*)?$/.exec(line)?.[1] : undefined;
		if (raw !== undefined) {
			return literalBoolean(raw);
		}
	}
	return undefined;
}

/** The canonical skills folder and each skill's `SKILL.md`, read once for all skill checks. */
interface CanonicalSkills {
	/** The skills folder, repo-relative, with forward slashes. */
	dir: string;
	/** Each skill's `SKILL.md` text, by skill name, in discovery order. */
	texts: Map<string, string>;
}

/**
 * Read every canonical skill's `SKILL.md` once, vendored ones included.
 * @param root Absolute repo root.
 * @param config The sync config.
 * @param sources The discovered sources.
 * @returns The skills folder and the texts.
 */
function readCanonicalSkills(root: string, config: SyncConfig, sources: Sources): CanonicalSkills {
	const dir = `${trimSlashes(config.canonical)}/skills`;
	return { dir, texts: new Map([...sources.skills.keys()].map((name) => [name, readFileSync(join(root, dir, name, 'SKILL.md'), 'utf-8')])) };
}

/**
 * Check that every canonical skill, vendored ones included, starts with the frontmatter every tool reads: `---` on line 1 (no byte-order mark), a one-line `name` equal to the folder and valid under the Agent Skills naming rules, and a one-line `description` within the length limit. Tools silently drop or misname a skill that breaks these.
 * @param skills The canonical skills.
 * @returns One problem line per rule broken.
 */
function checkFrontmatter(skills: CanonicalSkills): string[] {
	const problems: string[] = [];
	for (const [name, text] of skills.texts) {
		const path = `${skills.dir}/${name}/SKILL.md`;
		if (text.startsWith('\uFEFF')) {
			problems.push(`${path}: starts with a UTF-8 byte-order mark; save it without one, so --- is the first line`);
			continue;
		}
		if (!FRONTMATTER.test(text)) {
			problems.push(`${path}: has no frontmatter block on line 1, so tools lose the skill's name and description`);
			continue;
		}
		const value = (key: string): string | undefined => {
			try {
				return readFrontmatterValues(text, path, [key])[key];
			} catch (error) {
				if (!(error instanceof HarnessSyncError)) {
					throw error;
				}
				problems.push(error.message);
				return undefined;
			}
		};
		const skillName = value('name');
		if (skillName !== undefined && skillName !== name) {
			problems.push(`${path}: name ${skillName} must equal the folder name ${name}`);
		} else if (skillName !== undefined && (!SKILL_NAME.test(skillName) || skillName.length > NAME_LIMIT)) {
			problems.push(
				`${path}: name ${skillName} breaks the Agent Skills naming rules: at most ${NAME_LIMIT} lowercase letters, digits and single hyphens, with no hyphen at either end`
			);
		}
		const description = value('description');
		const length = description === undefined ? 0 : [...description].length;
		if (length > DESCRIPTION_LIMIT) {
			problems.push(`${path}: description is ${length} characters, over the ${DESCRIPTION_LIMIT} limit`);
		}
	}
	return problems;
}

/**
 * Check each owned canonical skill's flags against its invocation class. Vendored skills are exempt, because their bytes must stay upstream's.
 * @param root Absolute repo root.
 * @param config The sync config.
 * @param skills The canonical skills.
 * @returns One problem line per mismatch.
 */
function checkInvocation(root: string, config: SyncConfig, skills: CanonicalSkills): string[] {
	const problems: string[] = [];
	const vendored = new Set(config.vendored ?? []);
	const classes = config.invocation?.skills ?? {};
	for (const name of Object.keys(classes)) {
		if (!skills.texts.has(name)) {
			problems.push(`invocation.skills.${name} names no canonical skill`);
		}
	}
	for (const [name, text] of skills.texts) {
		if (vendored.has(name)) {
			continue;
		}
		const path = `${skills.dir}/${name}/SKILL.md`;
		const lines = (FRONTMATTER.exec(text)?.[0] ?? '').split(/\r?\n/);
		const noModel = readFlag(lines, 'disable-model-invocation');
		const userInvocable = readFlag(lines, 'user-invocable');
		const literalProblems = [
			['disable-model-invocation', noModel],
			['user-invocable', userInvocable],
		].filter(([, value]) => typeof value === 'string');
		if (literalProblems.length > 0) {
			problems.push(...literalProblems.map(([key, value]) => `${path}: ${String(key)} must be the literal true or false, not ${String(value)}`));
			continue;
		}
		const policyPath = `${skills.dir}/${name}/agents/openai.yaml`;
		const policy = readIfExists(join(root, policyPath));
		const implicit = policy === null ? undefined : readImplicitPolicy(policy.toString('utf-8'));
		if (typeof implicit === 'string') {
			problems.push(`${policyPath}: allow_implicit_invocation must be the literal true or false, not ${implicit}`);
			continue;
		}
		const invocationClass = classes[name] ?? config.invocation?.default ?? 'mixed';
		if (invocationClass === 'human' && (noModel !== true || userInvocable === false || implicit !== false)) {
			problems.push(`${path}: invocation human needs disable-model-invocation: true, no user-invocable: false and agents/openai.yaml with allow_implicit_invocation: false`);
		} else if (invocationClass === 'agent' && (userInvocable !== false || noModel === true)) {
			problems.push(`${path}: invocation agent needs user-invocable: false and no disable-model-invocation: true`);
		} else if (invocationClass === 'mixed' && (noModel === true || userInvocable === false || implicit !== undefined)) {
			problems.push(`${path}: invocation mixed needs no disable-model-invocation: true, no user-invocable: false and no allow_implicit_invocation in agents/openai.yaml`);
		}
	}
	return problems;
}

/**
 * Check that every vendored skill exists and that Prettier and markdownlint ignore its folder; a missing Prettier line is how upstream bytes were reformatted before.
 * @param root Absolute repo root.
 * @param config The sync config.
 * @param skills The canonical skills.
 * @returns One problem line per missing folder or ignore line.
 */
function checkVendored(root: string, config: SyncConfig, skills: CanonicalSkills): string[] {
	const problems: string[] = [];
	const ignoreLines = new Map(IGNORE_FILES.map((file) => [file, new Set((readIfExists(join(root, file))?.toString('utf-8') ?? '').split(/\r?\n/).map((line) => line.trim()))]));
	for (const name of config.vendored ?? []) {
		if (!skills.texts.has(name)) {
			problems.push(`vendored skill ${name} has no canonical folder ${skills.dir}/${name}`);
		}
		const wanted = `${skills.dir}/${name}/`;
		for (const [file, lines] of ignoreLines) {
			if (!lines.has(wanted)) {
				problems.push(`${file} lacks the line ${wanted} for the vendored skill ${name}`);
			}
		}
	}
	return problems;
}

/**
 * Build the bytes for one target. Markdown loses the mapping's dropped frontmatter keys and gets the transforms and the header; every other file is copied byte for byte.
 * @param config The sync config.
 * @param entry The target to render.
 * @param cache Output cache keyed by source, transforms and dropped keys, so a source mirrored to several targets is read once.
 * @returns The bytes to write.
 */
function renderTarget(config: SyncConfig, entry: TargetEntry, cache: Map<string, Buffer>): Buffer {
	const cacheKey = `${entry.sourcePath}::${entry.transforms.join(',')}::${entry.dropKeys.join(',')}::${entry.alias?.file ?? ''}`;
	const cached = cache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const bytes = readFileSync(entry.sourcePath);
	let output: Buffer;
	if (entry.alias) {
		output = Buffer.from(entry.alias.file === 'skill' ? aliasSkill(config, entry.alias.name, bytes.toString('utf-8')) : aliasPolicy(config), 'utf-8');
	} else {
		output =
			extname(entry.sourcePath).toLowerCase() === '.md'
				? Buffer.from(generateFile(dropFrontmatterKeys(bytes.toString('utf-8'), entry.dropKeys), config.generatedHeader, entry.transforms, config.transforms), 'utf-8')
				: bytes;
	}
	cache.set(cacheKey, output);
	return output;
}

/**
 * Read a file, or return null when it does not exist.
 * @param path Absolute path.
 * @returns The bytes, or null for a missing file.
 */
function readIfExists(path: string): Buffer | null {
	try {
		return readFileSync(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

/**
 * Turn a file system error into a one-line `ERROR`, naming the path and what the run had already changed, instead of a stack trace.
 * @param action What failed, for example `write`.
 * @param path The path relative to the root.
 * @param error The caught error; anything that is not a file system error is rethrown.
 * @param done The paths this run changed before the failure.
 * @returns The error to throw.
 */
function fileError(action: string, path: string, error: unknown, done: string[]): HarnessSyncError {
	const code = (error as NodeJS.ErrnoException).code;
	if (typeof code !== 'string') {
		throw error;
	}
	const listed = done.slice(0, LISTED_PATHS).map((changed) => `  - ${changed}`);
	const more = done.length > LISTED_PATHS ? [`  - and ${done.length - LISTED_PATHS} more`] : [];
	const summary = done.length === 0 ? ['Nothing was changed before it.'] : [`This run had already changed ${done.length} files:`, ...listed, ...more];
	return new HarnessSyncError(
		[`could not ${action} ${path} (${code}). Fix the cause (a read-only file, a file another program holds open), then run the command again.`, ...summary].join('\n')
	);
}

/**
 * Give a planned path the letter case the plan expects, segment by segment, where a case-insensitive file system kept an older case. A case-only rename goes through a temporary name, because renaming `a` to `A` directly is not reliable everywhere.
 * @param root Absolute repo root.
 * @param onDisk The path as it exists, relative to the root.
 * @param planned The planned path, equal to `onDisk` apart from letter case.
 */
function fixLetterCase(root: string, onDisk: string, planned: string): void {
	const have = onDisk.split('/');
	let parent = root;
	for (const [index, want] of planned.split('/').entries()) {
		if (have[index] !== want) {
			const names = readdirSync(parent);
			const actual = names.includes(want) ? undefined : names.find((candidate) => candidate.toLowerCase() === want.toLowerCase());
			if (actual !== undefined) {
				const temporary = join(parent, `${want}.harness-sync-case-${process.pid}`);
				renameSync(join(parent, actual), temporary);
				renameSync(temporary, join(parent, want));
			}
		}
		parent = join(parent, want);
	}
}

/**
 * Delete orphans, then each folder they leave empty, up to their scope root. The plan already refused every link, so nothing outside an owned scope is reached.
 * @param root Absolute repo root.
 * @param plan The plan whose orphans are deleted.
 * @param written The paths this run wrote, for the error message.
 * @returns The deleted paths, in orphan order.
 */
function pruneOrphans(root: string, plan: Plan, written: string[]): string[] {
	const pruned: string[] = [];
	for (const orphan of plan.orphans) {
		try {
			rmSync(join(root, orphan));
			const stop = plan.orphanScopes.get(orphan) ?? posix.dirname(orphan);
			let dir = posix.dirname(orphan);
			while (dir.startsWith(`${stop}/`) && readdirSync(join(root, dir)).length === 0) {
				rmdirSync(join(root, dir));
				dir = posix.dirname(dir);
			}
		} catch (error) {
			throw fileError('delete', orphan, error, [...written, ...pruned]);
		}
		pruned.push(orphan);
	}
	return pruned;
}

/**
 * Sync all targets, writing only the files whose bytes changed. A planned file that exists under another letter case is renamed first. With `prune`, orphans are deleted too; a retired folder never is.
 * @param config The sync config.
 * @param rootDir The root directory.
 * @param options Sync options.
 * @returns The sync result.
 */
export function syncAll(config: SyncConfig, rootDir: string, options: SyncOptions = {}): SyncResult {
	const root = resolve(rootDir);
	const plan = planSync(config, root, options.env ?? process.env);
	const cache = new Map<string, Buffer>();
	const written: string[] = [];
	const unchanged: string[] = [];

	// Render everything first: a bad workflow then stops the run before the first write.
	const outputs = plan.targets.map((entry) => ({ entry, output: renderTarget(config, entry, cache) }));
	for (const [planned, onDisk] of [...plan.caseMismatches].sort(([a], [b]) => byCodeUnit(a, b))) {
		try {
			fixLetterCase(root, onDisk, planned);
		} catch (error) {
			throw fileError('rename', `${onDisk} to ${planned}`, error, written);
		}
	}
	for (const { entry, output } of outputs) {
		const targetAbsolute = join(root, entry.target);
		if (readIfExists(targetAbsolute)?.equals(output) && !plan.caseMismatches.has(entry.target)) {
			unchanged.push(entry.target);
			continue;
		}
		try {
			mkdirSync(dirname(targetAbsolute), { recursive: true });
			writeFileSync(targetAbsolute, output);
		} catch (error) {
			throw fileError('write', entry.target, error, written);
		}
		written.push(entry.target);
	}

	const pruned = options.prune ? pruneOrphans(root, plan, written) : [];
	return {
		written: sortPaths(written),
		unchanged: sortPaths(unchanged),
		skipped: sortPaths(plan.skipped),
		orphans: options.prune ? [] : plan.orphans,
		pruned,
		retired: plan.retired,
		problems: plan.problems,
	};
}

/**
 * Check all targets against the bytes the sync would write, plus orphans, retired mirrors and skill metadata. A planned file that exists under another letter case is stale, whatever its bytes.
 * @param config The sync config.
 * @param rootDir The root directory.
 * @param options The environment for the git-ignore filter.
 * @param options.env Defaults to the process environment.
 * @returns The check result.
 */
export function checkAll(config: SyncConfig, rootDir: string, options: { env?: NodeJS.ProcessEnv | undefined } = {}): CheckResult {
	const plan = planSync(config, rootDir, options.env ?? process.env);
	const cache = new Map<string, Buffer>();
	const stale: string[] = [];
	const fresh: string[] = [];
	const missing: string[] = [];

	for (const entry of plan.targets) {
		// Render even a missing target, so a bad workflow fails the check as it fails the sync.
		const output = renderTarget(config, entry, cache);
		const current = readIfExists(join(rootDir, entry.target));
		if (!current) {
			missing.push(entry.target);
		} else if (current.equals(output) && !plan.caseMismatches.has(entry.target)) {
			fresh.push(entry.target);
		} else {
			stale.push(entry.target);
		}
	}

	return {
		stale: sortPaths(stale),
		fresh: sortPaths(fresh),
		missing: sortPaths(missing),
		caseMismatches: Object.fromEntries(plan.caseMismatches),
		orphans: plan.orphans,
		retired: plan.retired,
		problems: plan.problems,
	};
}

// ─── Staged tree check (design D4, D10) ──────────────────────────────────────

interface IndexEntry {
	mode: string;
	sha: string;
	stage: string;
	path: string;
}

/**
 * Run a read-only git command.
 * @param args Git arguments.
 * @param root The working folder.
 * @param env The environment.
 * @param input Bytes for stdin.
 * @returns Stdout.
 */
function runGit(args: string[], root: string, env: NodeJS.ProcessEnv, input?: string): Buffer {
	const result = spawnSync('git', args, { cwd: root, env, input, maxBuffer: 1024 ** 3 });
	if (result.error) {
		throw new HarnessSyncError(`git ${args[0] ?? ''} could not run: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new HarnessSyncError(`git ${args.join(' ')} failed: ${result.stderr.toString('utf-8').trim()}`);
	}
	return result.stdout;
}

/**
 * A path in a form that compares equal across separators and drive-letter case.
 * @param path The path.
 * @returns The comparable form.
 */
function comparablePath(path: string): string {
	let real = resolve(path);
	try {
		real = realpathSync.native(real);
	} catch {
		// A path that does not exist compares as resolved.
	}
	return normaliseRoot(real, process.platform);
}

/**
 * Find the paths git ignores, so tool output that git hides (for example the STL files a vendored skill's own `.gitignore` covers, written next to its mirror) is neither an orphan nor pruned. Git never reports a tracked file as ignored, so a committed orphan stays an orphan. The filter runs only when the root is the top level of its own repository: a test fixture or the staged export inside another checkout is left unfiltered, and the staged index cannot hold an ignored file anyway.
 * @param root Absolute repo root.
 * @param paths Candidate orphans, relative to the root, with forward slashes.
 * @param env The environment; variables that point git at a repository are dropped.
 * @returns The ignored paths.
 */
function gitIgnored(root: string, paths: string[], env: NodeJS.ProcessEnv): Set<string> {
	if (paths.length === 0) {
		return new Set();
	}
	// Without the variables that point git at a repository, so a hook's `GIT_DIR` cannot point the filter at another one.
	const gitEnv = withoutRepoVariables(env);
	if (!isTopLevel(root, gitEnv)) {
		return new Set();
	}
	// Exit 0: some paths are ignored; 1: none is; anything else is an error.
	const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], { cwd: root, env: gitEnv, input: `${paths.join('\0')}\0`, maxBuffer: 1024 ** 3 });
	if (result.error || (result.status !== 0 && result.status !== 1)) {
		throw new HarnessSyncError(`git check-ignore failed: ${result.error?.message ?? result.stderr.toString('utf-8').trim()}`);
	}
	return new Set(nulList(result.stdout));
}

/**
 * Tell whether a folder is the top level of its own git repository.
 * @param root Absolute folder.
 * @param env The environment for git.
 * @returns True when `git rev-parse --show-toplevel` names this folder; false when git fails or names another one.
 */
function isTopLevel(root: string, env: NodeJS.ProcessEnv): boolean {
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, env, encoding: 'utf-8' });
	return result.status === 0 && comparablePath(result.stdout.trim()) === comparablePath(root);
}

/**
 * Split NUL-separated git output (a `-z` option) into its entries.
 * @param output Git's stdout.
 * @returns The non-empty entries.
 */
function nulList(output: Buffer): string[] {
	return output
		.toString('utf-8')
		.split('\0')
		.filter((entry) => entry !== '');
}

/**
 * Refuse to read an index that belongs to another folder: the staged check must run at the top level of its own repository.
 * @param root Absolute folder.
 * @param env The environment.
 */
function assertTopLevel(root: string, env: NodeJS.ProcessEnv): void {
	if (!isTopLevel(root, env)) {
		throw new HarnessSyncError(`--check --staged must run from the top level of a git repository, and ${toSlash(root)} is not one`);
	}
}

/**
 * List the index with `git ls-files --stage -z`, which honours `GIT_INDEX_FILE`.
 * @param root Absolute repo root.
 * @param env The environment.
 * @returns One entry per index record.
 */
function readIndex(root: string, env: NodeJS.ProcessEnv): IndexEntry[] {
	return nulList(runGit(['ls-files', '--stage', '-z'], root, env)).map((record) => {
		const tab = record.indexOf('\t');
		const [mode = '', sha = '', stage = ''] = record.slice(0, tab).split(' ');
		return { mode, sha, stage, path: record.slice(tab + 1) };
	});
}

/**
 * Read blobs with one `git cat-file --batch` call. Each answer is `<sha> <type> <size>`, a newline, the bytes and a newline; an unknown object is `<sha> missing`.
 * @param root Absolute repo root.
 * @param env The environment.
 * @param shas The object names.
 * @returns The bytes by object name.
 */
function readBlobs(root: string, env: NodeJS.ProcessEnv, shas: string[]): Map<string, Buffer> {
	const unique = [...new Set(shas)];
	const blobs = new Map<string, Buffer>();
	if (unique.length === 0) {
		return blobs;
	}
	const output = runGit(['cat-file', '--batch'], root, env, `${unique.join('\n')}\n`);
	let offset = 0;
	for (const sha of unique) {
		const newline = output.indexOf(0x0a, offset);
		const [name, type, size] = output.subarray(offset, newline).toString('utf-8').split(' ');
		if (name !== sha || type !== 'blob' || size === undefined) {
			throw new HarnessSyncError(`git cat-file could not read staged object ${sha} (${type ?? 'no answer'})`);
		}
		offset = newline + 1;
		blobs.set(sha, output.subarray(offset, offset + Number(size)));
		offset += Number(size) + 1;
	}
	return blobs;
}

/**
 * Check the staged tree instead of the working tree: what a commit will contain. The index is listed and its blobs read with read-only git, the canonical tree, owned scopes, retired paths, config and ignore files are exported into a fresh folder under `tmp/`, and the normal check runs there. Intent-to-add entries (`git add -N`) are left out, as a commit leaves them out. The export is removed afterwards, also on failure. The engine is the working tree's `scripts/sync-harness.ts`, not the staged one.
 * @param rootDir The repo root, which must be the top level of its repository.
 * @param options The git environment; `GIT_INDEX_FILE` in it selects the index.
 * @returns The check result for the staged tree.
 */
export function checkStaged(rootDir: string, options: CliOptions = {}): CheckResult {
	return stagedCheck(rootDir, options).result;
}

/**
 * Run the staged check and keep the staged config, which the CLI report needs.
 * @param rootDir The repo root.
 * @param options The git environment.
 * @returns The staged config and the check result.
 */
function stagedCheck(rootDir: string, options: CliOptions): { config: SyncConfig; result: CheckResult } {
	const root = resolve(rootDir);
	const env = options.env ?? process.env;
	assertTopLevel(root, env);
	const entries = readIndex(root, env);

	const configEntry = entries.find((entry) => entry.path === CONFIG_FILE && entry.stage === '0');
	if (!configEntry) {
		throw new HarnessSyncError(`${CONFIG_FILE} is not in the git index; stage it first`);
	}
	let config: SyncConfig;
	try {
		config = JSON.parse((readBlobs(root, env, [configEntry.sha]).get(configEntry.sha) ?? Buffer.alloc(0)).toString('utf-8')) as SyncConfig;
	} catch (error) {
		throw error instanceof HarnessSyncError ? error : new HarnessSyncError(`${CONFIG_FILE} (staged) could not be read: ${(error as Error).message}`);
	}
	try {
		validateConfig(config);
	} catch (error) {
		// The staged config can differ from the working one; say which one failed.
		throw error instanceof HarnessSyncError ? new HarnessSyncError(`staged ${error.message}`) : error;
	}

	const folders = [trimSlashes(config.canonical), ...ownedScopes(config).map((scope) => scope.root), ...retiredPaths(config)];
	const inside = (path: string): boolean => STAGED_EXTRA_FILES.includes(path) || folders.some((folder) => path === folder || path.startsWith(`${folder}/`));
	const above = (path: string): boolean => [...STAGED_EXTRA_FILES, ...folders].some((wanted) => wanted.startsWith(`${path}/`));

	const problems = new Set<string>();
	const exported: IndexEntry[] = [];
	for (const entry of entries) {
		if (!inside(entry.path) && !above(entry.path)) {
			continue;
		}
		if (entry.stage !== '0') {
			problems.add(`${entry.path} has an unresolved merge conflict in the index`);
		} else if (entry.mode === '120000') {
			problems.add(`${entry.path} is staged as a symlink`);
		} else if (entry.mode === '160000') {
			problems.add(`${entry.path} is staged as a nested git repository (gitlink)`);
		} else if (inside(entry.path)) {
			exported.push(entry);
		}
	}
	if (problems.size > 0) {
		throw containmentError(problems);
	}

	// `git add -N` (intent to add) puts an empty blob in the index that a commit does not carry. The unstaged diff
	// lists exactly those entries as added (a tracked file is never "added" against its own index entry).
	const emptyPaths = exported.filter((entry) => EMPTY_BLOBS.has(entry.sha)).map((entry) => entry.path);
	const intentToAdd = new Set(
		emptyPaths.length === 0 ? [] : nulList(runGit(['--literal-pathspecs', 'diff', '--name-only', '-z', '--no-renames', '--diff-filter=A', '--', ...emptyPaths], root, env))
	);
	const committed = exported.filter((entry) => !intentToAdd.has(entry.path));

	const blobs = readBlobs(
		root,
		env,
		committed.map((entry) => entry.sha)
	);
	const scratch = scratchPath(root, process.platform);
	mkdirSync(scratch, { recursive: true });
	const exportDir = mkdtempSync(join(scratch, 'harness-staged-'));
	try {
		for (const entry of committed) {
			const absolute = join(exportDir, entry.path);
			mkdirSync(dirname(absolute), { recursive: true });
			writeFileSync(absolute, blobs.get(entry.sha) ?? Buffer.alloc(0));
		}
		return { config, result: checkAll(config, exportDir, { env }) };
	} finally {
		rmSync(exportDir, { recursive: true, force: true, maxRetries: 3 });
	}
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

type CliMode = 'sync' | 'prune' | 'check' | 'staged' | 'diff';

const CLI_FLAGS = ['--check', '--staged', '--diff', '--prune'];

/**
 * Read the mode from the arguments, refusing unknown flags and combinations that mean two things.
 * @param argv The arguments after the script name.
 * @returns The mode.
 */
function parseMode(argv: string[]): CliMode {
	for (const arg of argv) {
		if (!CLI_FLAGS.includes(arg)) {
			throw new HarnessSyncError(`unknown argument ${arg}; use no flag, --check, --check --staged, --diff or --prune`);
		}
	}
	const modes = ['--check', '--diff', '--prune'].filter((flag) => argv.includes(flag));
	if (modes.length > 1) {
		throw new HarnessSyncError(`${modes.join(' and ')} cannot be combined`);
	}
	if (argv.includes('--staged')) {
		if (!argv.includes('--check')) {
			throw new HarnessSyncError('--staged works only with --check');
		}
		return 'staged';
	}
	return argv.includes('--check') ? 'check' : argv.includes('--diff') ? 'diff' : argv.includes('--prune') ? 'prune' : 'sync';
}

/**
 * Say that a stale file exists under another letter case, for its `STALE` line.
 * @param result The check result.
 * @param path The planned path.
 * @returns The note, or an empty string.
 */
function caseNote(result: CheckResult, path: string): string {
	const onDisk = result.caseMismatches[path];
	return onDisk === undefined ? '' : ` (letter case differs: ${onDisk} on disk)`;
}

/**
 * Report a check run.
 * @param config The sync config, for the retired reasons.
 * @param result The check result.
 * @param staged Whether the staged tree was checked.
 * @param out Lines for stdout.
 * @param err Lines for stderr.
 * @returns The exit code.
 */
function reportCheck(config: SyncConfig, result: CheckResult, staged: boolean, out: string[], err: string[]): number {
	const { stale, missing, orphans, retired, problems } = result;
	if (stale.length + missing.length + orphans.length + retired.length + problems.length === 0) {
		out.push(`All ${result.fresh.length} generated files are fresh${staged ? ' in the staged tree' : ''}.`);
		return 0;
	}
	err.push(
		`STALE: ${stale.length}, MISSING: ${missing.length}, ORPHAN: ${orphans.length}, RETIRED: ${retired.length}, PROBLEM: ${problems.length}${staged ? ' (staged tree)' : ''}`
	);
	for (const path of stale) {
		const stagedHint = result.caseMismatches[path] ? ' (staged: stage the rename, for example with git mv)' : ' (staged: stage the regenerated file)';
		err.push(`  STALE   ${path}${caseNote(result, path)}${staged ? stagedHint : ''}`);
	}
	for (const path of missing) err.push(`  MISSING ${path}${staged ? ' (staged: stage the new file)' : ''}`);
	for (const path of orphans) err.push(`  ORPHAN  ${path}  (${staged ? 'staged: ' : ''}delete with pnpm harness:sync --prune${staged ? ' and stage the deletion' : ''})`);
	for (const path of retired) err.push(`  RETIRED ${path}  (${staged ? 'staged: ' : ''}${retiredReason(config, path)})`);
	for (const problem of problems) err.push(`  PROBLEM ${problem}`);
	err.push(
		staged
			? 'The commit would not match a fresh sync. Run pnpm harness:sync and stage the listed files, or run pnpm harness:sync --prune and stage the deletions. Edit .agents/, never a mirror.'
			: 'Run pnpm harness:sync to regenerate (edit .agents/, never a mirror). Orphans need pnpm harness:sync --prune; retired folders are deleted by hand.'
	);
	return 1;
}

/**
 * Run the CLI against a repo root and collect its output, so tests can drive every mode without a child process.
 * @param argv The arguments after the script name.
 * @param rootDir The repo root.
 * @param options The git environment for `--check --staged`.
 * @returns The exit code and output lines.
 */
export function runCli(argv: string[], rootDir: string, options: CliOptions = {}): CliResult {
	const out: string[] = [];
	const err: string[] = [];
	try {
		const mode = parseMode(argv);
		if (mode === 'staged') {
			const { config, result } = stagedCheck(rootDir, options);
			return { code: reportCheck(config, result, true, out, err), stdout: out, stderr: err };
		}
		const config = loadConfig(rootDir);
		if (mode === 'check') {
			return { code: reportCheck(config, checkAll(config, rootDir, options), false, out, err), stdout: out, stderr: err };
		}
		if (mode === 'diff') {
			const result = checkAll(config, rootDir, options);
			for (const path of result.stale) out.push(`STALE   ${path}${caseNote(result, path)}`);
			for (const path of result.missing) out.push(`MISSING ${path}`);
			for (const path of result.orphans) out.push(`ORPHAN  ${path}`);
			for (const path of result.retired) out.push(`RETIRED ${path}  (${retiredReason(config, path)})`);
			for (const problem of result.problems) out.push(`PROBLEM ${problem}`);
			for (const path of result.fresh) out.push(`SKIP    ${path}`);
			return { code: 0, stdout: out, stderr: err };
		}
		const result = syncAll(config, rootDir, { prune: mode === 'prune', env: options.env });
		out.push(
			`Synced ${result.written.length} changed files (${result.unchanged.length} unchanged), skipped ${result.skipped.length} manual overrides${mode === 'prune' ? `, pruned ${result.pruned.length} orphans` : ''}.`
		);
		for (const path of result.written) out.push(`  WRITE   ${path}`);
		for (const path of result.skipped) out.push(`  SKIP    ${path}`);
		for (const path of result.pruned) out.push(`  PRUNE   ${path}`);
		for (const path of result.orphans) err.push(`WARNING ORPHAN  ${path}  (delete with pnpm harness:sync --prune)`);
		for (const path of result.retired) err.push(`WARNING RETIRED ${path}  (${retiredReason(config, path)})`);
		for (const problem of result.problems) err.push(`WARNING PROBLEM ${problem}`);
		return { code: 0, stdout: out, stderr: err };
	} catch (error) {
		if (!(error instanceof HarnessSyncError)) {
			throw error;
		}
		const [first, ...rest] = error.message.split('\n');
		return { code: 1, stdout: [], stderr: [`ERROR ${first ?? ''}`, ...rest] };
	}
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Main entry point: run the CLI on this repo, print its output and set the exit code.
 */
function main(): void {
	const result = runCli(process.argv.slice(2), resolve(import.meta.dirname, '..'));
	for (const line of result.stdout) console.log(line);
	for (const line of result.stderr) console.error(line);
	process.exitCode = result.code;
}

if (import.meta.main) {
	main();
}
