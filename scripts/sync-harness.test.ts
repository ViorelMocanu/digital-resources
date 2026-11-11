import {
	type CliResult,
	type PlatformMapping,
	type SyncConfig,
	type TransformRule,
	applyTransforms,
	checkAll,
	checkStaged,
	generateFile,
	loadConfig,
	resolveTargetPath,
	runCli,
	syncAll,
	validateConfig,
} from './sync-harness.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { initScratchRepo, isolatedGitEnv, makeScratchDir, removeScratchDir, scratchGit } from './lib/scratch-git.ts';

const repoRoot = resolve(import.meta.dirname, '..');
const HEADER = '<!-- GENERATED -->';

const transforms: Record<string, TransformRule> = {
	commandSyntax: { find: '/opsx-', replace: '/opsx:' },
};

// ─── Per-test fixture folders (repo tmp/ only, never the OS temp folder) ────

/** The per-test folder under the repo's `tmp/`, removed after each test. */
let runDir = '';
/** The fixture repo root each test syncs. */
let fixtureDir = '';
/** A folder next to the fixture root, still under `tmp/`, that links can point at as "outside the repo". */
let outsideDir = '';

beforeEach(() => {
	runDir = makeScratchDir('sync-harness-');
	fixtureDir = join(runDir, 'repo');
	outsideDir = join(runDir, 'outside');
	mkdirSync(fixtureDir);
	mkdirSync(outsideDir);
});

afterEach(() => {
	removeScratchDir(runDir);
});

/**
 * Write a fixture file, creating its folders.
 * @param path Path relative to the fixture root.
 * @param content The file content.
 */
function put(path: string, content: string | Buffer): void {
	const absolute = join(fixtureDir, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content);
}

/**
 * Read a fixture file as text.
 * @param path Path relative to the fixture root.
 * @returns The file content.
 */
function read(path: string): string {
	return readFileSync(join(fixtureDir, path), 'utf-8');
}

/**
 * Tell whether a fixture path exists.
 * @param path Path relative to the fixture root.
 * @returns True when the file or folder exists.
 */
function has(path: string): boolean {
	return existsSync(join(fixtureDir, path));
}

/**
 * List every file below a fixture folder without following links.
 * @param dir Folder relative to the fixture root.
 * @returns Sorted paths relative to that folder, with forward slashes.
 */
function listFiles(dir: string): string[] {
	const found: string[] = [];
	const walk = (absolute: string, prefix: string): void => {
		for (const entry of readdirSync(absolute, { withFileTypes: true })) {
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				walk(join(absolute, entry.name), rel);
			} else {
				found.push(rel);
			}
		}
	};
	if (has(dir)) {
		walk(join(fixtureDir, dir), '');
	}
	return found.sort();
}

/**
 * Create a directory link: a junction on Windows (no admin rights needed), a symlink elsewhere.
 * @param target Absolute path the link points to.
 * @param linkPath Path of the link, relative to the fixture root.
 */
function linkDir(target: string, linkPath: string): void {
	const absolute = join(fixtureDir, linkPath);
	mkdirSync(dirname(absolute), { recursive: true });
	symlinkSync(target, absolute, 'junction');
}

/**
 * Write the config into the fixture, as the CLI reads it, and run the CLI there.
 * @param args CLI arguments.
 * @param config The config to write first; the file on disk is used when omitted.
 * @param env Environment for git calls (staged mode).
 * @returns The exit code and output lines.
 */
function cli(args: string[], config?: SyncConfig, env?: NodeJS.ProcessEnv): CliResult {
	if (config) {
		put('scripts/sync-harness.config.json', JSON.stringify(config, null, '\t') + '\n');
	}
	return runCli(args, fixtureDir, env ? { env } : {});
}

/**
 * The Claude skill mirror mapping, as in the real config.
 * @returns A fresh mapping.
 */
function claudeSkills(): PlatformMapping {
	return { target: '.claude/skills', unit: 'folder', format: '{name}/SKILL.md', transforms: ['commandSyntax'] };
}

/**
 * Build a fixture config around the given platforms.
 * @param platforms The platform mappings.
 * @param extra Top-level keys to add or override.
 * @returns The config.
 */
function makeConfig(platforms: SyncConfig['platforms'], extra: Partial<SyncConfig> = {}): SyncConfig {
	return { canonical: '.agents', generatedHeader: HEADER, include: { skills: [], workflows: [] }, transforms: { ...transforms }, platforms, manual: [], ...extra };
}

/**
 * A config with only the Claude skill mirror.
 * @param extra Top-level keys to add or override.
 * @returns The config.
 */
function skillsOnly(extra: Partial<SyncConfig> = {}): SyncConfig {
	return makeConfig({ claude: { skills: claudeSkills() } }, extra);
}

/**
 * A canonical `SKILL.md` with frontmatter.
 * @param name The skill name.
 * @param fields Extra frontmatter lines.
 * @param body The Markdown body.
 * @returns The file text.
 */
function skillFile(name: string, fields: string[] = [], body = `# ${name}\n`): string {
	return ['---', `name: ${name}`, `description: The ${name} skill.`, ...fields, '---', '', body].join('\n');
}

// ─── Transforms and header (design D1, D5) ───────────────────────────────────

describe('applyTransforms', () => {
	it('replaces /opsx- with /opsx: when commandSyntax transform is active', () => {
		const content = 'Run /opsx-explore and then /opsx-new';
		const result = applyTransforms(content, ['commandSyntax'], transforms);
		expect(result).toBe('Run /opsx:explore and then /opsx:new');
	});

	it('rewrites command names but leaves paths that name a workflow file unchanged', () => {
		const content = 'Run /opsx-apply, then read .agents/workflows/opsx-verify.md and ../../workflows/opsx-apply.md.';
		const result = applyTransforms(content, ['commandSyntax'], transforms);
		expect(result).toBe('Run /opsx:apply, then read .agents/workflows/opsx-verify.md and ../../workflows/opsx-apply.md.');
	});

	it('rewrites a command after punctuation but not after a word character, dot, slash or hyphen', () => {
		const content = 'Run `/opsx-verify` (/opsx-new); not ./opsx-x, a-/opsx-y or x/opsx-z.';
		const result = applyTransforms(content, ['commandSyntax'], transforms);
		expect(result).toBe('Run `/opsx:verify` (/opsx:new); not ./opsx-x, a-/opsx-y or x/opsx-z.');
	});

	it('returns content unchanged when no transforms specified', () => {
		const content = 'Run /opsx-explore';
		const result = applyTransforms(content, [], transforms);
		expect(result).toBe('Run /opsx-explore');
	});

	it('applies multiple transforms in order', () => {
		const multiTransforms: Record<string, TransformRule> = {
			commandSyntax: { find: '/opsx-', replace: '/opsx:' },
			upperCase: { find: 'hello', replace: 'HELLO' },
		};
		const content = 'hello /opsx-explore';
		const result = applyTransforms(content, ['commandSyntax', 'upperCase'], multiTransforms);
		expect(result).toBe('HELLO /opsx:explore');
	});
});

describe('resolveTargetPath', () => {
	it('resolves skill format {name}/SKILL.md', () => {
		const result = resolveTargetPath('/root/.claude/skills', '{name}/SKILL.md', 'openspec-explore');
		expect(result).toBe(join('/root/.claude/skills', 'openspec-explore/SKILL.md'));
	});

	it('resolves prompt format {name}.prompt.md', () => {
		const result = resolveTargetPath('/root/.github/prompts', '{name}.prompt.md', 'opsx-explore');
		expect(result).toBe(join('/root/.github/prompts', 'opsx-explore.prompt.md'));
	});

	it('resolves command format {name}.md', () => {
		const result = resolveTargetPath('/root/.cursor/commands', '{name}.md', 'opsx-explore');
		expect(result).toBe(join('/root/.cursor/commands', 'opsx-explore.md'));
	});
});

describe('generateFile', () => {
	it('puts the header first, then a blank line, when the file has no frontmatter', () => {
		const result = generateFile('Use /opsx-explore', HEADER, ['commandSyntax'], transforms);
		expect(result).toBe('<!-- GENERATED -->\n\nUse /opsx:explore');
	});

	it('works with no transforms (header still first without frontmatter)', () => {
		const result = generateFile('Some content', HEADER, [], transforms);
		expect(result).toBe('<!-- GENERATED -->\n\nSome content');
	});

	it('keeps the frontmatter on line 1 and puts the header after the closing ---', () => {
		const content = '---\nname: demo\ndescription: Run /opsx-explore\n---\n\n# Demo\n';
		const result = generateFile(content, HEADER, ['commandSyntax'], transforms);
		expect(result).toBe('---\nname: demo\ndescription: Run /opsx:explore\n---\n<!-- GENERATED -->\n\n# Demo\n');
	});

	it('drops extra blank lines between the frontmatter and the body', () => {
		const result = generateFile('---\nname: demo\n---\n\n\n\nBody\n', HEADER, [], transforms);
		expect(result).toBe('---\nname: demo\n---\n<!-- GENERATED -->\n\nBody\n');
	});

	it('keeps CRLF line endings, including for the inserted lines', () => {
		const result = generateFile('---\r\nname: demo\r\n---\r\n\r\n# Demo\r\n', HEADER, [], transforms);
		expect(result).toBe('---\r\nname: demo\r\n---\r\n<!-- GENERATED -->\r\n\r\n# Demo\r\n');
	});

	it('uses CRLF for the inserted lines of a CRLF file without frontmatter', () => {
		const result = generateFile('# Demo\r\nText\r\n', HEADER, [], transforms);
		expect(result).toBe('<!-- GENERATED -->\r\n\r\n# Demo\r\nText\r\n');
	});

	it('treats an unclosed frontmatter block as plain content and puts the header first', () => {
		const content = '---\nname: demo\n# no closing fence';
		const result = generateFile(content, HEADER, [], transforms);
		expect(result).toBe('<!-- GENERATED -->\n\n' + content);
	});

	it('drops a leading byte-order mark, so the frontmatter still starts the file', () => {
		const result = generateFile('\uFEFF---\nname: x\n---\n\nBody\n', HEADER, [], transforms);
		expect(result).toBe('---\nname: x\n---\n<!-- GENERATED -->\n\nBody\n');
	});
});

// ─── Basic sync behaviour (kept from the first version) ──────────────────────

describe('syncAll (integration)', () => {
	beforeEach(() => {
		put('.agents/skills/openspec-explore/SKILL.md', '# OpenSpec Explore\n\nRun /opsx-explore to start.');
		put('.agents/workflows/opsx-explore.md', '# Workflow\n\nUse /opsx-explore here.');
	});

	/**
	 * Make a config for testing.
	 * @returns A sync config for testing.
	 */
	function makeIntegrationConfig(): SyncConfig {
		return makeConfig(
			{
				claude: { skills: claudeSkills() },
				cursor: {
					skills: { target: '.cursor/skills', unit: 'folder', format: '{name}/SKILL.md', transforms: ['commandSyntax'] },
					commands: { source: 'workflows', target: '.cursor/commands', unit: 'file', format: '{name}.md', transforms: ['commandSyntax'] },
				},
				github: {
					skills: { target: '.github/skills', unit: 'folder', format: '{name}/SKILL.md', transforms: ['commandSyntax'] },
					prompts: { source: 'workflows', target: '.github/prompts', unit: 'file', format: '{name}.prompt.md', transforms: ['commandSyntax'] },
				},
			},
			{ include: { skills: ['openspec-explore'], workflows: ['opsx-explore'] } }
		);
	}

	it('writes correct number of files with headers and transforms applied', () => {
		const result = syncAll(makeIntegrationConfig(), fixtureDir);

		// 3 platforms x skills(openspec-explore) + cursor commands(opsx-explore) + github prompts(opsx-explore) = 5
		expect(result.written.length).toBe(5);
		expect(result.skipped.length).toBe(0);

		// No frontmatter in this fixture, so the header is the first line
		const claudeSkill = read('.claude/skills/openspec-explore/SKILL.md');
		expect(claudeSkill.startsWith('<!-- GENERATED -->')).toBe(true);

		// Check transform applied
		expect(claudeSkill).toContain('/opsx:explore');
		expect(claudeSkill).not.toContain('/opsx-explore');
	});

	it('creates missing directories', () => {
		syncAll(makeIntegrationConfig(), fixtureDir);

		expect(has('.claude/skills/openspec-explore')).toBe(true);
		expect(has('.cursor/commands')).toBe(true);
		expect(has('.github/prompts')).toBe(true);
	});

	it('reports written paths with forward slashes', () => {
		const result = syncAll(makeIntegrationConfig(), fixtureDir);
		expect(result.written).toContain('.github/prompts/opsx-explore.prompt.md');
		expect(result.written.some((path) => path.includes('\\'))).toBe(false);
	});
});

describe('checkAll (integration)', () => {
	beforeEach(() => {
		put('.agents/skills/openspec-explore/SKILL.md', '# OpenSpec Explore\n\nRun /opsx-explore to start.');
	});

	/**
	 * Make a config for testing.
	 * @returns A sync config for testing.
	 */
	function makeCheckConfig(): SyncConfig {
		return skillsOnly({ include: { skills: ['openspec-explore'], workflows: [] } });
	}

	it('reports stale file when content differs', () => {
		put('.claude/skills/openspec-explore/SKILL.md', 'old stale content');

		const result = checkAll(makeCheckConfig(), fixtureDir);
		expect(result.stale).toEqual(['.claude/skills/openspec-explore/SKILL.md']);
		expect(result.fresh.length).toBe(0);
	});

	it('reports a file that does not exist yet as missing', () => {
		const result = checkAll(makeCheckConfig(), fixtureDir);
		expect(result.missing).toEqual(['.claude/skills/openspec-explore/SKILL.md']);
	});

	it('reports fresh after syncAll', () => {
		const config = makeCheckConfig();
		syncAll(config, fixtureDir);
		const result = checkAll(config, fixtureDir);
		expect(result.stale.length).toBe(0);
		expect(result.fresh.length).toBe(1);
		expect(result.missing.length).toBe(0);
	});
});

describe('directory scanning', () => {
	beforeEach(() => {
		// Core skill (will appear in include list)
		put('.agents/skills/openspec-explore/SKILL.md', '# Core skill');
		// Non-core skill (NOT in include list) — must still be synced
		put('.agents/skills/handoff/SKILL.md', '# Handoff');
	});

	/**
	 * Make a config for testing.
	 * @returns A sync config for testing.
	 */
	function makeScanConfig(): SyncConfig {
		return makeConfig({ claude: { skills: { ...claudeSkills(), transforms: [] } } }, { include: { skills: ['openspec-explore'], workflows: [] }, transforms: {} });
	}

	it('syncs skills discovered on disk even if not in the include list', () => {
		const result = syncAll(makeScanConfig(), fixtureDir);
		expect(result.written).toContain('.claude/skills/openspec-explore/SKILL.md');
		expect(result.written).toContain('.claude/skills/handoff/SKILL.md');
		expect(has('.claude/skills/handoff/SKILL.md')).toBe(true);
	});

	it('throws when a required core skill is missing from disk', () => {
		const config = makeScanConfig();
		config.include.skills = ['openspec-explore', 'nonexistent-skill'];
		expect(() => syncAll(config, fixtureDir)).toThrow(/MISSING SKILL.*nonexistent-skill/s);
	});

	it('ignores directories without a SKILL.md', () => {
		mkdirSync(join(fixtureDir, '.agents/skills/empty-dir'), { recursive: true });
		const result = syncAll(makeScanConfig(), fixtureDir);
		expect(result.written.some((p) => p.includes('empty-dir'))).toBe(false);
	});
});

describe('manual overrides', () => {
	beforeEach(() => {
		put('.agents/skills/perplexity-search/SKILL.md', '# Perplexity Search canonical');
	});

	it('does not overwrite manual override files', () => {
		const config = skillsOnly({
			include: { skills: ['perplexity-search'], workflows: [] },
			manual: [{ path: '.claude/skills/perplexity-search/SKILL.md', reason: 'Claude-specific rewrite' }],
		});

		// Create the manual override file
		put('.claude/skills/perplexity-search/SKILL.md', '# Manual override content');

		const result = syncAll(config, fixtureDir);

		// Should be skipped
		expect(result.skipped.length).toBe(1);
		expect(result.written.length).toBe(0);

		// Content should be unchanged
		expect(read('.claude/skills/perplexity-search/SKILL.md')).toBe('# Manual override content');
	});
});

// ─── Config validation (design D2, D12) ──────────────────────────────────────

describe('config validation', () => {
	/**
	 * A config whose only mapping is the given object.
	 * @param mapping The raw mapping under platforms.claude.skills.
	 * @returns The config.
	 */
	const withMapping = (mapping: Record<string, unknown>): SyncConfig => makeConfig({ claude: { skills: mapping as unknown as PlatformMapping } });

	it('rejects a mapping without a copy unit, naming the mapping', () => {
		expect(() => validateConfig(withMapping({ target: '.claude/skills', format: '{name}/SKILL.md', transforms: [] }))).toThrow(
			/platforms\.claude\.skills\.unit must be folder or file/
		);
	});

	it('rejects a folder unit for workflows', () => {
		expect(() => validateConfig(withMapping({ source: 'workflows', target: '.claude/x', unit: 'folder', format: '{name}.md', transforms: [] }))).toThrow(
			/platforms\.claude\.skills: unit folder needs source skills/
		);
	});

	it('rejects an unknown source', () => {
		expect(() => validateConfig(withMapping({ source: 'agents', target: '.claude/x', unit: 'file', format: '{name}.md', transforms: [] }))).toThrow(
			/platforms\.claude\.skills\.source must be skills or workflows/
		);
	});

	it('rejects a transform name that the config does not define', () => {
		expect(() => validateConfig(withMapping({ target: '.claude/skills', unit: 'folder', format: '{name}/SKILL.md', transforms: ['nope'] }))).toThrow(/unknown transform nope/);
	});

	it('refuses a mapping without a unit before reading any source', () => {
		// No .agents folder exists in this fixture: the unit error must come first.
		expect(() => syncAll(withMapping({ target: '.claude/skills', format: '{name}/SKILL.md', transforms: [] }), fixtureDir)).toThrow(/unit must be folder or file/);
		expect(() => checkAll(withMapping({ target: '.claude/skills', format: '{name}/SKILL.md', transforms: [] }), fixtureDir)).toThrow(/unit must be folder or file/);
	});
});

// ─── Whole-folder copy (design D2) ───────────────────────────────────────────

describe('whole-folder skill mirroring', () => {
	const bytes = Buffer.from([0, 255, 10, 13, 128, 7]);

	beforeEach(() => {
		put('.agents/skills/frontend-design/SKILL.md', skillFile('frontend-design', [], '# FD\n\nSee reference/typography.md, then run /opsx-explore.\n'));
		put('.agents/skills/frontend-design/reference/typography.md', '---\ntitle: Type\n---\n\n# Type\n\nRun /opsx-explore.\n');
		put('.agents/skills/frontend-design/reference/deep/note.md', 'deep note\n');
		put('.agents/skills/frontend-design/reference/asset.bin', bytes);
		put('.agents/skills/frontend-design/scripts/tool.py', "print('/opsx-explore')\n");
		put('.agents/skills/frontend-design/LICENSE', 'Licence text /opsx-explore\n');
	});

	it('mirrors every file of the skill folder, nested folders included', () => {
		const result = syncAll(skillsOnly(), fixtureDir);
		expect(result.written.length).toBe(6);
		expect(listFiles('.claude/skills/frontend-design')).toEqual([
			'LICENSE',
			'SKILL.md',
			'reference/asset.bin',
			'reference/deep/note.md',
			'reference/typography.md',
			'scripts/tool.py',
		]);
	});

	it('gives nested Markdown the transforms and the header after its frontmatter', () => {
		syncAll(skillsOnly(), fixtureDir);
		expect(read('.claude/skills/frontend-design/reference/typography.md')).toBe('---\ntitle: Type\n---\n<!-- GENERATED -->\n\n# Type\n\nRun /opsx:explore.\n');
		expect(read('.claude/skills/frontend-design/reference/deep/note.md')).toBe('<!-- GENERATED -->\n\ndeep note\n');
		expect(read('.claude/skills/frontend-design/SKILL.md').startsWith('---\nname: frontend-design\n')).toBe(true);
	});

	it('copies non-Markdown files byte for byte, with no header and no transforms', () => {
		syncAll(skillsOnly(), fixtureDir);
		expect(readFileSync(join(fixtureDir, '.claude/skills/frontend-design/reference/asset.bin')).equals(bytes)).toBe(true);
		expect(read('.claude/skills/frontend-design/scripts/tool.py')).toBe("print('/opsx-explore')\n");
		expect(read('.claude/skills/frontend-design/LICENSE')).toBe('Licence text /opsx-explore\n');
	});

	it('reports a changed extra file as stale and a deleted one as missing', () => {
		syncAll(skillsOnly(), fixtureDir);
		put('.claude/skills/frontend-design/reference/typography.md', 'edited by hand');
		rmSync(join(fixtureDir, '.claude/skills/frontend-design/reference/asset.bin'));

		const result = checkAll(skillsOnly(), fixtureDir);
		expect(result.stale).toEqual(['.claude/skills/frontend-design/reference/typography.md']);
		expect(result.missing).toEqual(['.claude/skills/frontend-design/reference/asset.bin']);
		expect(result.fresh.length).toBe(4);
	});

	it('does not rewrite a file whose bytes already match', () => {
		syncAll(skillsOnly(), fixtureDir);
		const target = join(fixtureDir, '.claude/skills/frontend-design/SKILL.md');
		const past = new Date('2020-01-01T00:00:00Z');
		utimesSync(target, past, past);

		const second = syncAll(skillsOnly(), fixtureDir);
		expect(second.written).toEqual([]);
		expect(second.unchanged.length).toBe(6);
		expect(statSync(target).mtimeMs).toBe(past.getTime());
	});

	it('rewrites only the file that changed', () => {
		syncAll(skillsOnly(), fixtureDir);
		put('.claude/skills/frontend-design/reference/deep/note.md', 'edited');
		expect(syncAll(skillsOnly(), fixtureDir).written).toEqual(['.claude/skills/frontend-design/reference/deep/note.md']);
	});

	it('neither mirrors nor reports runtime caches named in skip', () => {
		const config = skillsOnly({ skip: ['__pycache__', '.DS_Store'] });
		put('.agents/skills/frontend-design/scripts/__pycache__/tool.cpython-312.pyc', 'cache');
		put('.agents/skills/frontend-design/.DS_Store', 'finder');
		syncAll(config, fixtureDir);
		expect(has('.claude/skills/frontend-design/scripts/__pycache__')).toBe(false);
		expect(has('.claude/skills/frontend-design/.DS_Store')).toBe(false);

		// Running the skill's script from the mirror creates a cache there: not an orphan.
		put('.claude/skills/frontend-design/scripts/__pycache__/mesh_io.cpython-312.pyc', 'cache');
		put('.claude/skills/frontend-design/.DS_Store', 'finder');
		const result = checkAll(config, fixtureDir);
		expect(result.orphans).toEqual([]);
		expect(result.stale).toEqual([]);
		expect(result.missing).toEqual([]);
	});
});

// ─── Links and nested repositories (design D3) ───────────────────────────────

/** Every CLI mode that plans a run: plain sync, check, diff and prune. */
const MODES: string[][] = [[], ['--check'], ['--diff'], ['--prune']];

/**
 * Assert that every mode stops with one ERROR message that matches, and prints nothing on stdout.
 * @param config The config to run with.
 * @param pattern What the error must say.
 */
function expectRefusedInEveryMode(config: SyncConfig, pattern: RegExp): void {
	for (const args of MODES) {
		const result = cli(args, config);
		const mode = args.join(' ') || 'sync';
		expect(result.code, mode).toBe(1);
		expect(result.stderr[0], mode).toMatch(/^ERROR /);
		expect(result.stderr.join('\n'), mode).toMatch(pattern);
		expect(result.stdout, mode).toEqual([]);
	}
}

describe('links and nested repositories are refused, never followed', () => {
	beforeEach(() => {
		put('.agents/skills/adapt/SKILL.md', skillFile('adapt'));
		put('.agents/skills/zeta/SKILL.md', skillFile('zeta'));
		writeFileSync(join(outsideDir, 'SKILL.md'), 'outside original');
	});

	it('refuses a target skill folder that is a junction to a folder outside the repo, and writes nothing', () => {
		linkDir(outsideDir, '.claude/skills/adapt');
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills\/adapt is a symlink to .*outside/);
		expect(readFileSync(join(outsideDir, 'SKILL.md'), 'utf-8')).toBe('outside original');
		expect(has('.claude/skills/zeta')).toBe(false);
	});

	it('also refuses a junction that points inside the repo', () => {
		mkdirSync(join(fixtureDir, 'elsewhere'));
		linkDir(join(fixtureDir, 'elsewhere'), '.claude/skills/adapt');
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills\/adapt is a symlink/);
		expect(listFiles('elsewhere')).toEqual([]);
	});

	it('refuses a junction as the mirror root', () => {
		linkDir(outsideDir, '.claude/skills');
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills is a symlink/);
		expect(readdirSync(outsideDir)).toEqual(['SKILL.md']);
	});

	it('refuses a junction inside a canonical skill and never lists the files behind it', () => {
		mkdirSync(join(outsideDir, 'ref'));
		writeFileSync(join(outsideDir, 'ref/secret-notes.md'), 'behind the link');
		linkDir(join(outsideDir, 'ref'), '.agents/skills/adapt/reference');
		expectRefusedInEveryMode(skillsOnly(), /\.agents\/skills\/adapt\/reference is a symlink/);
		for (const args of MODES) {
			expect(cli(args).stderr.join('\n')).not.toContain('secret-notes');
		}
		expect(has('.claude')).toBe(false);
	});

	it('refuses a canonical skill folder that is itself a junction', () => {
		mkdirSync(join(outsideDir, 'linked'));
		writeFileSync(join(outsideDir, 'linked/SKILL.md'), skillFile('linked'));
		linkDir(join(outsideDir, 'linked'), '.agents/skills/linked');
		expectRefusedInEveryMode(skillsOnly(), /\.agents\/skills\/linked is a symlink/);
		expect(has('.claude')).toBe(false);
	});

	it('refuses a canonical skill that contains a repository', () => {
		put('.agents/skills/zeta/.git/HEAD', 'ref: refs/heads/main\n');
		expectRefusedInEveryMode(skillsOnly(), /\.agents\/skills\/zeta\/\.git is a nested git repository/);
		expect(has('.claude')).toBe(false);
	});

	it('refuses a repository at the top of the canonical skills folder', () => {
		put('.agents/skills/.git/HEAD', 'ref: refs/heads/main\n');
		expectRefusedInEveryMode(skillsOnly(), /\.agents\/skills\/\.git is a nested git repository/);
		expect(has('.claude')).toBe(false);
	});

	it('refuses a repository cloned into a mirror, and prune deletes nothing', () => {
		syncAll(skillsOnly(), fixtureDir);
		put('.claude/skills/some-skill/.git/HEAD', 'ref: refs/heads/main\n');
		put('.claude/skills/some-skill/SKILL.md', 'cloned');
		put('.claude/skills/retired-skill/SKILL.md', 'an orphan prune would otherwise delete');
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills\/some-skill\/\.git is a nested git repository/);
		expect(has('.claude/skills/some-skill/.git/HEAD')).toBe(true);
		expect(has('.claude/skills/some-skill/SKILL.md')).toBe(true);
		expect(has('.claude/skills/retired-skill/SKILL.md')).toBe(true);
	});

	it('names every problem in one message', () => {
		put('.agents/skills/zeta/.git/HEAD', 'x');
		linkDir(outsideDir, '.claude/skills/adapt');
		const message = cli(['--check'], skillsOnly()).stderr.join('\n');
		expect(message).toMatch(/\.agents\/skills\/zeta\/\.git/);
		expect(message).toMatch(/\.claude\/skills\/adapt is a symlink/);
	});

	it('rejects a target format that escapes the repo root', () => {
		const config = makeConfig({ claude: { skills: { ...claudeSkills(), format: '../../../outside/{name}/SKILL.md' } } });
		expectRefusedInEveryMode(config, /resolves outside the repo root/);
		expect(readdirSync(outsideDir)).toEqual(['SKILL.md']);
	});

	it('syncs normally when no path contains a link', () => {
		const result = cli([], skillsOnly());
		expect(result.code).toBe(0);
		expect(read('.claude/skills/adapt/SKILL.md').startsWith('---\nname: adapt\n')).toBe(true);
	});
});

// ─── File system errors ──────────────────────────────────────────────────────

describe('file system errors', () => {
	beforeEach(() => {
		put('.agents/skills/adapt/SKILL.md', skillFile('adapt'));
		put('.agents/skills/zeta/SKILL.md', skillFile('zeta'));
	});

	it('refuses a file where the sync needs a folder, in every mode, before writing anything', () => {
		put('.claude/skills/adapt', 'a file where the skill folder belongs');
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills\/adapt is a file where the sync needs a folder/);
		expect(has('.claude/skills/zeta')).toBe(false);
		expect(read('.claude/skills/adapt')).toBe('a file where the skill folder belongs');
	});

	it('refuses a folder where the sync writes a file', () => {
		mkdirSync(join(fixtureDir, '.claude/skills/adapt/SKILL.md'), { recursive: true });
		expectRefusedInEveryMode(skillsOnly(), /\.claude\/skills\/adapt\/SKILL\.md is a folder where the sync writes a file/);
	});

	// A root user can write to a read-only file, so the error cannot happen there.
	it.skipIf(process.getuid?.() === 0)('turns a write error into one ERROR line that names the file', () => {
		syncAll(skillsOnly(), fixtureDir);
		put('.claude/skills/adapt/SKILL.md', 'stale');
		const target = join(fixtureDir, '.claude/skills/adapt/SKILL.md');
		chmodSync(target, 0o444);
		try {
			const result = cli([], skillsOnly());
			expect(result.code).toBe(1);
			expect(result.stderr[0]).toMatch(/^ERROR could not write \.claude\/skills\/adapt\/SKILL\.md \((EPERM|EACCES)\)/);
			expect(result.stderr.join('\n')).not.toMatch(/node:fs|\n\s+at /);
		} finally {
			chmodSync(target, 0o644);
		}
	});
});

// ─── Letter case (NTFS and APFS fold case by default) ────────────────────────

/** Whether the file system under the repo's `tmp/` folds letter case, probed once. */
const caseInsensitive = ((): boolean => {
	const probe = makeScratchDir('sync-harness-case-');
	try {
		writeFileSync(join(probe, 'Probe'), '');
		return existsSync(join(probe, 'probe'));
	} finally {
		removeScratchDir(probe);
	}
})();

describe.runIf(caseInsensitive)('letter case on a case-insensitive file system', () => {
	beforeEach(() => {
		put('.agents/skills/critique/SKILL.md', skillFile('critique'));
		put('.agents/skills/critique/reference/personas.md', '# Personas\n');
		put('.agents/skills/critique/reference/heuristics.md', '# Heuristics\n');
		syncAll(skillsOnly(), fixtureDir);
	});

	/**
	 * Rename a fixture path to another letter case, through a temporary name.
	 * @param from The current path, relative to the fixture root.
	 * @param to The new path.
	 */
	const renameCase = (from: string, to: string): void => {
		renameSync(join(fixtureDir, from), join(fixtureDir, `${to}.tmp`));
		renameSync(join(fixtureDir, `${to}.tmp`), join(fixtureDir, to));
	};

	it('reports a case-only rename of a canonical file as stale, not as an orphan, and a plain sync fixes the mirror', () => {
		renameCase('.agents/skills/critique/reference/personas.md', '.agents/skills/critique/reference/Personas.md');
		const check = checkAll(skillsOnly(), fixtureDir);
		expect(check.orphans).toEqual([]);
		expect(check.stale).toEqual(['.claude/skills/critique/reference/Personas.md']);
		expect(check.caseMismatches).toEqual({ '.claude/skills/critique/reference/Personas.md': '.claude/skills/critique/reference/personas.md' });
		const result = cli(['--check'], skillsOnly());
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('  STALE   .claude/skills/critique/reference/Personas.md (letter case differs: .claude/skills/critique/reference/personas.md on disk)');

		expect(cli([]).code).toBe(0);
		expect(readdirSync(join(fixtureDir, '.claude/skills/critique/reference')).sort()).toEqual(['Personas.md', 'heuristics.md']);
		expect(cli(['--check']).code).toBe(0);
	});

	it('never prunes a file whose planned path differs only in letter case', () => {
		renameCase('.agents/skills/critique/reference/personas.md', '.agents/skills/critique/reference/Personas.md');
		const prune = cli(['--prune'], skillsOnly());
		expect(prune.code).toBe(0);
		expect(prune.stdout.some((line) => line.startsWith('  PRUNE'))).toBe(false);
		expect(readdirSync(join(fixtureDir, '.claude/skills/critique/reference')).sort()).toEqual(['Personas.md', 'heuristics.md']);
		expect(cli(['--check']).code).toBe(0);
	});

	it('fixes the letter case of a renamed folder', () => {
		renameCase('.agents/skills/critique/reference', '.agents/skills/critique/Reference');
		const check = checkAll(skillsOnly(), fixtureDir);
		expect(check.orphans).toEqual([]);
		expect(check.stale).toEqual(['.claude/skills/critique/Reference/heuristics.md', '.claude/skills/critique/Reference/personas.md']);
		expect(cli([], skillsOnly()).code).toBe(0);
		expect(readdirSync(join(fixtureDir, '.claude/skills/critique')).sort()).toEqual(['Reference', 'SKILL.md']);
		expect(cli(['--check']).code).toBe(0);
	});
});

// ─── Ownership, orphans and prune (design D4) ────────────────────────────────

describe('orphans and --prune', () => {
	/**
	 * Claude skills plus Cursor commands, so two owned folders exist.
	 * @returns The config.
	 */
	const orphanConfig = (): SyncConfig =>
		makeConfig({
			claude: { skills: claudeSkills() },
			cursor: { commands: { source: 'workflows', target: '.cursor/commands', unit: 'file', format: '{name}.md', transforms: [] } },
		});

	const orphans = ['.claude/skills/source-command-opsx-apply/SKILL.md', '.claude/skills/source-command-opsx-apply/reference/notes.md', '.cursor/commands/opsx-old.md'];

	beforeEach(() => {
		put('.agents/skills/tdd/SKILL.md', skillFile('tdd'));
		put('.agents/workflows/opsx-apply.md', '---\nid: opsx-apply\n---\n\nApply.\n');
		syncAll(orphanConfig(), fixtureDir);
		// A retired skill: its canonical folder is gone, the mirror remains.
		put('.claude/skills/source-command-opsx-apply/SKILL.md', 'old');
		put('.claude/skills/source-command-opsx-apply/reference/notes.md', 'old');
		put('.cursor/commands/opsx-old.md', 'old');
		// Hand-made files next to the owned folders.
		put('.cursor/rules/perplexity-search.mdc', 'rule');
		put('.claude/settings.json', '{}');
		put('.claude/hooks/guard.mjs', '// hook');
	});

	it('lists every file in an owned folder that the sync would not write', () => {
		expect(checkAll(orphanConfig(), fixtureDir).orphans).toEqual(orphans);
	});

	it('fails --check with one ORPHAN line per file', () => {
		const result = cli(['--check'], orphanConfig());
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('  ORPHAN  .cursor/commands/opsx-old.md  (delete with pnpm harness:sync --prune)');
		expect(result.stderr.filter((line) => line.startsWith('  ORPHAN  ')).length).toBe(3);
	});

	it('warns about orphans on a plain sync, keeps them and exits 0', () => {
		const result = cli([], orphanConfig());
		expect(result.code).toBe(0);
		expect(result.stderr).toContain('WARNING ORPHAN  .cursor/commands/opsx-old.md  (delete with pnpm harness:sync --prune)');
		expect(has('.claude/skills/source-command-opsx-apply/SKILL.md')).toBe(true);
	});

	it('deletes only orphans and the folders they empty with --prune, printing PRUNE lines', () => {
		const result = cli(['--prune'], orphanConfig());
		expect(result.code).toBe(0);
		expect(result.stdout.filter((line) => line.startsWith('  PRUNE   '))).toEqual(orphans.map((path) => `  PRUNE   ${path}`));
		expect(has('.claude/skills/source-command-opsx-apply')).toBe(false);
		expect(has('.claude/skills/tdd/SKILL.md')).toBe(true);
		expect(has('.cursor/commands/opsx-apply.md')).toBe(true);
		expect(has('.claude/skills')).toBe(true);
		expect(cli(['--check']).code).toBe(0);
	});

	it('never reports or deletes hand-made files outside the owned folders', () => {
		cli(['--prune'], orphanConfig());
		expect(read('.cursor/rules/perplexity-search.mdc')).toBe('rule');
		expect(read('.claude/settings.json')).toBe('{}');
		expect(read('.claude/hooks/guard.mjs')).toBe('// hook');
		expect(checkAll(orphanConfig(), fixtureDir).orphans).toEqual([]);
	});

	it('does not count a manual override as an orphan', () => {
		const config = orphanConfig();
		config.manual = [{ path: '.cursor/commands/opsx-old.md', reason: 'kept by hand' }];
		expect(checkAll(config, fixtureDir).orphans).not.toContain('.cursor/commands/opsx-old.md');
	});

	it('normalises manual paths and reports an entry that matches no file', () => {
		const config = orphanConfig();
		config.manual = [
			{ path: ' ./.cursor/commands/opsx-old.md ', reason: 'kept by hand' },
			{ path: '.\\.claude\\skills\\source-command-opsx-apply\\SKILL.md', reason: 'kept by hand' },
			{ path: '.github/prompts/gone.prompt.md', reason: 'a stale entry' },
		];
		const result = checkAll(config, fixtureDir);
		expect(result.orphans).toEqual(['.claude/skills/source-command-opsx-apply/reference/notes.md']);
		expect(result.problems).toEqual(['manual entry .github/prompts/gone.prompt.md matches no file; fix the path or remove the entry']);
	});
});

// ─── Retired mirrors (design D4) ─────────────────────────────────────────────

describe('retired mirrors', () => {
	const retired = ['.cursor/skills', '.github/skills', '.codex/skills'];

	beforeEach(() => {
		put('.agents/skills/tdd/SKILL.md', skillFile('tdd'));
	});

	it('fails --check when a retired folder reappears, naming it and the tool that reads .agents/skills', () => {
		put('.codex/skills/openspec-apply-change/SKILL.md', 'installer copy');
		const config = skillsOnly({ retired });
		syncAll(config, fixtureDir);
		expect(checkAll(config, fixtureDir).retired).toEqual(['.codex/skills']);
		const result = cli(['--check'], config);
		expect(result.code).toBe(1);
		expect(result.stderr.some((line) => line.startsWith('  RETIRED .codex/skills') && line.includes('Codex reads .agents/skills'))).toBe(true);
	});

	it('warns on a plain sync, and --prune leaves the retired folder in place', () => {
		put('.cursor/skills/tdd/SKILL.md', 'old mirror');
		const config = skillsOnly({ retired });
		const sync = cli([], config);
		expect(sync.code).toBe(0);
		expect(sync.stderr.some((line) => line.startsWith('WARNING RETIRED .cursor/skills'))).toBe(true);
		expect(cli(['--prune']).code).toBe(0);
		expect(read('.cursor/skills/tdd/SKILL.md')).toBe('old mirror');
	});

	it('reports nothing about .codex when only .codex/config.toml exists', () => {
		put('.codex/config.toml', '[mcp]\n');
		const config = skillsOnly({ retired });
		syncAll(config, fixtureDir);
		expect(checkAll(config, fixtureDir).retired).toEqual([]);
		const result = cli(['--check'], config);
		expect(result.code).toBe(0);
		expect([...result.stdout, ...result.stderr].join('\n')).not.toContain('.codex');
	});

	it('refuses a config whose mapping writes into a retired folder', () => {
		const config = makeConfig({ cursor: { skills: { target: '.cursor/skills', unit: 'folder', format: '{name}/SKILL.md', transforms: [] } } }, { retired });
		expect(() => validateConfig(config)).toThrow(/platforms\.cursor\.skills\.target overlaps the retired path \.cursor\/skills/);
	});
});

// ─── CLI output (spec "Sync output and fixtures are portable") ───────────────

describe('CLI output', () => {
	beforeEach(() => {
		put('.agents/skills/adapt/SKILL.md', skillFile('adapt'));
	});

	it('labels a file that does not exist yet as MISSING, with forward slashes, in the summary and the per-file line', () => {
		const result = cli(['--check'], skillsOnly());
		expect(result.code).toBe(1);
		expect(result.stderr[0]).toMatch(/MISSING: 1/);
		expect(result.stderr).toContain('  MISSING .claude/skills/adapt/SKILL.md');
		expect([...result.stdout, ...result.stderr].some((line) => line.includes('\\'))).toBe(false);
	});

	it('lists stale, missing, orphan and retired files with --diff and exits 0', () => {
		put('.agents/skills/zeta/SKILL.md', skillFile('zeta'));
		syncAll(skillsOnly(), fixtureDir);
		put('.claude/skills/adapt/SKILL.md', 'edited');
		rmSync(join(fixtureDir, '.claude/skills/zeta/SKILL.md'));
		put('.claude/skills/gone/SKILL.md', 'orphan');
		put('.github/skills/adapt/SKILL.md', 'retired copy');
		const result = cli(['--diff'], skillsOnly({ retired: ['.github/skills'] }));
		expect(result.code).toBe(0);
		expect(result.stdout).toEqual(
			expect.arrayContaining(['STALE   .claude/skills/adapt/SKILL.md', 'MISSING .claude/skills/zeta/SKILL.md', 'ORPHAN  .claude/skills/gone/SKILL.md'])
		);
		expect(result.stdout.some((line) => line.startsWith('RETIRED .github/skills'))).toBe(true);
	});

	it('passes --check and says how many files are fresh', () => {
		syncAll(skillsOnly(), fixtureDir);
		const result = cli(['--check'], skillsOnly());
		expect(result.code).toBe(0);
		expect(result.stdout).toEqual(['All 1 generated files are fresh.']);
	});

	it('refuses an unknown flag, --staged without --check, and --prune with --check', () => {
		put('scripts/sync-harness.config.json', JSON.stringify(skillsOnly()));
		for (const args of [['--prun'], ['--staged'], ['--check', '--prune']]) {
			const result = cli(args);
			expect(result.code, args.join(' ')).toBe(1);
			expect(result.stderr[0], args.join(' ')).toMatch(/^ERROR /);
		}
		expect(has('.claude')).toBe(false);
	});

	it('reports an unreadable config as one ERROR line', () => {
		put('scripts/sync-harness.config.json', '{ not json');
		const result = cli(['--check']);
		expect(result.code).toBe(1);
		expect(result.stderr[0]).toMatch(/^ERROR scripts\/sync-harness\.config\.json could not be read/);
	});
});

// ─── Staged tree check (design D4, D10; spec harness--pre-commit isolation) ──

describe('staged tree check (--check --staged)', { timeout: 60_000 }, () => {
	/** Child env for git: inherited GIT_* removed, the owner's global and system config kept out. */
	let env: NodeJS.ProcessEnv = {};

	/**
	 * Run git in the scratch repo and fail the test on a git error.
	 * @param args Git arguments.
	 * @param options Stdin input and extra environment variables.
	 * @param options.input Text for stdin.
	 * @param options.extraEnv Variables added to the isolated environment.
	 * @returns Stdout.
	 */
	function git(args: string[], options: { input?: string; extraEnv?: NodeJS.ProcessEnv } = {}): string {
		return scratchGit(fixtureDir, { ...env, ...options.extraEnv }, args, options.input);
	}

	/**
	 * The staged-check config.
	 * @param extra Top-level keys to add or override.
	 * @returns The config.
	 */
	function stagedConfig(extra: Partial<SyncConfig> = {}): SyncConfig {
		return skillsOnly(extra);
	}

	/**
	 * Create the scratch repo, sync it and commit everything, so the index starts consistent.
	 * @param config The config to stage.
	 */
	function initRepo(config: SyncConfig): void {
		env = isolatedGitEnv(runDir);
		initScratchRepo(fixtureDir, env);
		put('.gitignore', 'tmp/\n');
		put('.prettierignore', '');
		put('.markdownlintignore', '');
		put('scripts/sync-harness.config.json', JSON.stringify(config, null, '\t') + '\n');
		put('.agents/skills/polish/SKILL.md', skillFile('polish', [], '# Polish\n\nRun /opsx-apply.\n'));
		syncAll(config, fixtureDir);
		git(['add', '-A']);
		git(['commit', '-q', '-m', 'init']);
	}

	/**
	 * List leftover export folders.
	 * @returns Names under the fixture's tmp/ that look like staged exports.
	 */
	function exportFolders(): string[] {
		return has('tmp') ? readdirSync(join(fixtureDir, 'tmp')).filter((name) => name.startsWith('harness-staged-')) : [];
	}

	it('fails on a staged canonical edit whose regenerated mirror is left unstaged', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/polish/SKILL.md', skillFile('polish', [], '# Polish v2\n'));
		git(['add', '.agents/skills/polish/SKILL.md']);
		syncAll(config, fixtureDir); // what verify:fix does: the mirror is regenerated but not staged
		expect(checkAll(config, fixtureDir).stale).toEqual([]); // the working tree looks fine

		expect(checkStaged(fixtureDir, { env }).stale).toEqual(['.claude/skills/polish/SKILL.md']);
		const result = cli(['--check', '--staged'], undefined, env);
		expect(result.code).toBe(1);
		expect(result.stderr.some((line) => line.startsWith('  STALE   .claude/skills/polish/SKILL.md (staged'))).toBe(true);
		expect(exportFolders()).toEqual([]);
	});

	it('lists a generated file that exists only as an untracked file as MISSING', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/handoff/SKILL.md', skillFile('handoff'));
		syncAll(config, fixtureDir);
		git(['add', '.agents/skills/handoff/SKILL.md']);
		expect(has('.claude/skills/handoff/SKILL.md')).toBe(true); // on disk, untracked

		expect(checkStaged(fixtureDir, { env }).missing).toEqual(['.claude/skills/handoff/SKILL.md']);
		const result = cli(['--check', '--staged'], undefined, env);
		expect(result.stderr.some((line) => line.startsWith('  MISSING .claude/skills/handoff/SKILL.md (staged'))).toBe(true);
	});

	it('lists a generated alias that is still untracked as MISSING', () => {
		const config = aliasConfig();
		initRepo(config);
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-verify'));
		syncAll(config, fixtureDir);
		git(['add', '.agents/workflows/opsx-verify.md']);
		expect(has('.agents/skills/opsx-verify/SKILL.md')).toBe(true); // on disk, untracked

		expect(checkStaged(fixtureDir, { env }).missing).toEqual(['.agents/skills/opsx-verify/SKILL.md', '.agents/skills/opsx-verify/agents/openai.yaml']);
		git(['add', '.agents/skills/opsx-verify']);
		expect(cli(['--check', '--staged'], undefined, env).code).toBe(0);
	});

	it('passes when an unstaged canonical edit and its unstaged mirror stay out of the commit', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/polish/SKILL.md', skillFile('polish', [], '# Work in progress\n'));
		syncAll(config, fixtureDir);

		const result = checkStaged(fixtureDir, { env });
		expect([result.stale, result.missing, result.orphans, result.retired, result.problems]).toEqual([[], [], [], [], []]);
		expect(cli(['--check', '--staged'], undefined, env).code).toBe(0);
	});

	it('fails on a tracked orphan and on a retired folder in the index, and passes once their deletions are staged', () => {
		const config = stagedConfig({ retired: ['.codex/skills'] });
		initRepo(config);
		put('.claude/skills/old/SKILL.md', 'orphan');
		put('.codex/skills/x/SKILL.md', 'retired copy');
		git(['add', '-A']);
		const before = checkStaged(fixtureDir, { env });
		expect(before.orphans).toEqual(['.claude/skills/old/SKILL.md']);
		expect(before.retired).toEqual(['.codex/skills']);

		git(['rm', '-q', '--cached', '.claude/skills/old/SKILL.md', '.codex/skills/x/SKILL.md']);
		const after = checkStaged(fixtureDir, { env });
		expect([after.orphans, after.retired]).toEqual([[], []]);
	});

	it('refuses a staged symlink and still removes its export folder', () => {
		initRepo(stagedConfig());
		const blob = git(['hash-object', '-w', '--stdin'], { input: '../elsewhere' }).trim();
		git(['update-index', '--add', '--cacheinfo', `120000,${blob},.claude/skills/linked`]);

		expect(() => checkStaged(fixtureDir, { env })).toThrow(/\.claude\/skills\/linked is staged as a symlink/);
		const result = cli(['--check', '--staged'], undefined, env);
		expect(result.code).toBe(1);
		expect(result.stderr[0]).toMatch(/^ERROR /);
		expect(exportFolders()).toEqual([]);
	});

	it('honours GIT_INDEX_FILE, so a partial commit is checked as it will be committed', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/polish/SKILL.md', skillFile('polish', [], '# Polish v3\n'));
		syncAll(config, fixtureDir);
		const partialIndex = join(runDir, 'partial-index');
		copyFileSync(join(fixtureDir, '.git/index'), partialIndex);
		git(['add', '.agents/skills/polish/SKILL.md'], { extraEnv: { GIT_INDEX_FILE: partialIndex } });

		expect(checkStaged(fixtureDir, { env }).stale).toEqual([]);
		expect(checkStaged(fixtureDir, { env: { ...env, GIT_INDEX_FILE: partialIndex } }).stale).toEqual(['.claude/skills/polish/SKILL.md']);
	});

	it('leaves the index, HEAD and working tree unchanged', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/polish/SKILL.md', skillFile('polish', [], '# Polish v4\n'));
		git(['add', '.agents/skills/polish/SKILL.md']);
		put('.claude/skills/polish/notes.md', 'untracked work in progress');
		const status = git(['status', '--porcelain']);
		const head = git(['rev-parse', 'HEAD']);
		const index = readFileSync(join(fixtureDir, '.git/index'));

		checkStaged(fixtureDir, { env });

		expect(readFileSync(join(fixtureDir, '.git/index')).equals(index)).toBe(true);
		expect(git(['rev-parse', 'HEAD'])).toBe(head);
		expect(git(['status', '--porcelain'])).toBe(status);
		expect(read('.claude/skills/polish/notes.md')).toBe('untracked work in progress');
		expect(exportFolders()).toEqual([]);
	});

	it('refuses to run in a folder that is not the top level of a repository', () => {
		// The fixture sits inside this checkout but is not a repository itself: reading the outer index would be wrong.
		env = isolatedGitEnv(runDir);
		put('scripts/sync-harness.config.json', JSON.stringify(stagedConfig()));
		expect(() => checkStaged(fixtureDir, { env })).toThrow(/top level of a git repository/);
	});

	it('treats an intent-to-add canonical file as absent, so its staged mirror is an orphan', () => {
		const config = stagedConfig();
		initRepo(config);
		put('.agents/skills/polish/new-ref.md', '# New reference\n');
		syncAll(config, fixtureDir);
		git(['add', '-N', '.agents/skills/polish/new-ref.md']);
		git(['add', '.claude/skills/polish/new-ref.md']);

		const result = checkStaged(fixtureDir, { env });
		expect(result.stale).toEqual([]);
		expect(result.orphans).toEqual(['.claude/skills/polish/new-ref.md']);
	});

	it('leaves files git ignores inside a mirror alone, but still reports a tracked one as an orphan', () => {
		const config = stagedConfig();
		initRepo(config);
		// The mirror gets the canonical .gitignore, as a vendored skill's own one does.
		put('.agents/skills/polish/.gitignore', '*.stl\npress/\n');
		syncAll(config, fixtureDir);
		git(['add', '-A']);
		git(['commit', '-q', '-m', 'ignore rules']);
		// Tool output that the skill writes next to itself, in the mirror Claude runs it from.
		put('.claude/skills/polish/bracket.stl', 'solid');
		put('.claude/skills/polish/press/out.3mf', '3mf');
		put('.claude/skills/polish/forced.stl', 'tracked anyway');
		git(['add', '-f', '.claude/skills/polish/forced.stl']);

		expect(checkAll(config, fixtureDir, { env }).orphans).toEqual(['.claude/skills/polish/forced.stl']);
		const prune = cli(['--prune'], undefined, env);
		expect(prune.stdout.filter((line) => line.startsWith('  PRUNE'))).toEqual(['  PRUNE   .claude/skills/polish/forced.stl']);
		expect(read('.claude/skills/polish/bracket.stl')).toBe('solid');
		expect(read('.claude/skills/polish/press/out.3mf')).toBe('3mf');
	});
});

// ─── Name filters (design D5) ────────────────────────────────────────────────

/**
 * A workflow file with one-line frontmatter values.
 * @param id The workflow id, also the file stem unless a test says otherwise.
 * @param description The raw description value, written as is.
 * @param body The Markdown body.
 * @returns The file text.
 */
function workflowFile(id: string, description = `The ${id} workflow`, body = `Run /opsx-apply first.\n`): string {
	return ['---', `name: /${id}`, `id: ${id}`, 'category: Workflow', `description: ${description}`, '---', '', body].join('\n');
}

/**
 * The Claude command mapping, as in the real config.
 * @returns A fresh mapping.
 */
function claudeCommands(): PlatformMapping {
	return { source: 'workflows', target: '.claude/commands/opsx', unit: 'file', format: '{name}.md', match: '^opsx-', stripPrefix: 'opsx-', transforms: ['commandSyntax'] };
}

/**
 * The alias generator mapping, as in the real config.
 * @returns A fresh mapping.
 */
function aliasMapping(): PlatformMapping {
	return { source: 'workflows', target: '.agents/skills', unit: 'file', format: '{name}/SKILL.md', match: '^opsx-', generator: 'opsxAlias', transforms: [] };
}

/**
 * Claude skills plus the alias generator.
 * @param extra Top-level keys to add or override.
 * @returns The config.
 */
function aliasConfig(extra: Partial<SyncConfig> = {}): SyncConfig {
	return makeConfig({ claude: { skills: claudeSkills() }, codex: { aliases: aliasMapping() } }, extra);
}

describe('name filters', () => {
	beforeEach(() => {
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-verify'));
		put('.agents/workflows/whisperx-transcribe.md', workflowFile('whisperx-transcribe'));
	});

	it('skips a workflow that does not match and strips the prefix from the file name', () => {
		syncAll(makeConfig({ claude: { commands: claudeCommands() } }), fixtureDir);
		expect(listFiles('.claude/commands/opsx')).toEqual(['verify.md']);
		expect(read('.claude/commands/opsx/verify.md')).toContain('Run /opsx:apply first.');
	});

	it('keeps every workflow in a mapping without a filter', () => {
		syncAll(makeConfig({ cursor: { commands: { source: 'workflows', target: '.cursor/commands', unit: 'file', format: '{name}.md', transforms: [] } } }), fixtureDir);
		expect(listFiles('.cursor/commands')).toEqual(['opsx-verify.md', 'whisperx-transcribe.md']);
		expect(read('.cursor/commands/opsx-verify.md')).toContain('Run /opsx-apply first.');
	});

	it('rejects a match that is not a valid regular expression', () => {
		const config = makeConfig({ claude: { commands: { ...claudeCommands(), match: '([' } } });
		expect(() => validateConfig(config)).toThrow(/platforms\.claude\.commands\.match is not a valid regular expression/);
	});
});

// ─── Frontmatter keys per target (Copilot reads name as the slash name) ─────

describe('dropFrontmatterKeys', () => {
	/**
	 * The Copilot prompt mapping with keys to drop.
	 * @param keys The keys.
	 * @returns A fresh mapping.
	 */
	const prompts = (keys: unknown): PlatformMapping => ({
		source: 'workflows',
		target: '.github/prompts',
		unit: 'file',
		format: '{name}.prompt.md',
		dropFrontmatterKeys: keys as string[],
		transforms: [],
	});

	it('drops the named keys, their continuation lines included, and keeps the rest', () => {
		put(
			'.agents/workflows/opsx-verify.md',
			['---', 'name: /opsx-verify', 'id: opsx-verify', 'category: Workflow', 'description: Verify it', 'tags:', '    - one', '---', '', 'Run /opsx-apply first.', ''].join(
				'\n'
			)
		);
		syncAll(makeConfig({ github: { prompts: prompts(['name', 'id', 'category', 'tags']) } }), fixtureDir);
		expect(read('.github/prompts/opsx-verify.prompt.md')).toBe(['---', 'description: Verify it', '---', HEADER, '', 'Run /opsx-apply first.', ''].join('\n'));
	});

	it('leaves a file without frontmatter unchanged apart from the header', () => {
		put('.agents/workflows/notes.md', 'name: not frontmatter\n');
		syncAll(makeConfig({ github: { prompts: prompts(['name']) } }), fixtureDir);
		expect(read('.github/prompts/notes.prompt.md')).toBe(`${HEADER}\n\nname: not frontmatter\n`);
	});

	it('rejects a value that is not a list of key names, and the key on the alias generator', () => {
		expect(() => validateConfig(makeConfig({ github: { prompts: prompts('name') } }))).toThrow(
			/platforms\.github\.prompts\.dropFrontmatterKeys must be a list of frontmatter key names/
		);
		expect(() => validateConfig(makeConfig({ github: { prompts: prompts(['na me']) } }))).toThrow(/dropFrontmatterKeys must be a list of frontmatter key names/);
		expect(() => validateConfig(makeConfig({ codex: { aliases: { ...aliasMapping(), dropFrontmatterKeys: ['name'] } } }))).toThrow(
			/platforms\.codex\.aliases: generator opsxAlias needs/
		);
	});
});

// ─── Generated opsx-<verb> aliases (design D7) ───────────────────────────────

describe('opsx alias generator', () => {
	beforeEach(() => {
		put('.agents/skills/tdd/SKILL.md', skillFile('tdd'));
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-verify', 'Verify implementation matches change artifacts before archiving'));
		put('.agents/workflows/whisperx-transcribe.md', workflowFile('whisperx-transcribe'));
	});

	it('writes SKILL.md with the frontmatter first, then the header, then a body that names the workflow', () => {
		syncAll(aliasConfig(), fixtureDir);
		const text = read('.agents/skills/opsx-verify/SKILL.md');
		expect(
			text.startsWith(
				[
					'---',
					'name: opsx-verify',
					'description: "Alias for the opsx-verify workflow. Verify implementation matches change artifacts before archiving"',
					'disable-model-invocation: true',
					'metadata:',
					'    invocation: human',
					'---',
					HEADER,
					'',
					'',
				].join('\n')
			)
		).toBe(true);
		expect(text).toContain('`.agents/workflows/opsx-verify.md`');
		expect(text).not.toContain('/opsx:');
	});

	it('writes agents/openai.yaml with a comment header and implicit invocation off', () => {
		syncAll(aliasConfig(), fixtureDir);
		expect(read('.agents/skills/opsx-verify/agents/openai.yaml')).toBe('# GENERATED\npolicy:\n  allow_implicit_invocation: false\n');
	});

	it('gives a workflow outside the filter no alias', () => {
		syncAll(aliasConfig(), fixtureDir);
		expect(listFiles('.agents/skills')).toEqual(['opsx-verify/SKILL.md', 'opsx-verify/agents/openai.yaml', 'tdd/SKILL.md']);
	});

	it('never mirrors an alias to .claude/skills and stays fresh on the next run', () => {
		syncAll(aliasConfig(), fixtureDir);
		const second = syncAll(aliasConfig(), fixtureDir);
		expect(second.written).toEqual([]);
		expect(listFiles('.claude/skills')).toEqual(['tdd/SKILL.md']);
		const check = checkAll(aliasConfig(), fixtureDir);
		expect([check.stale, check.missing, check.orphans, check.problems]).toEqual([[], [], [], []]);
	});

	it('never lists a canonical skill as an orphan of the alias scope, and prune keeps them', () => {
		syncAll(aliasConfig(), fixtureDir);
		expect(checkAll(aliasConfig(), fixtureDir).orphans).toEqual([]);
		expect(cli(['--prune'], aliasConfig()).code).toBe(0);
		expect(read('.agents/skills/tdd/SKILL.md')).toBe(skillFile('tdd'));
		expect(has('.agents/workflows/opsx-verify.md')).toBe(true);
	});

	it('treats an alias left behind by a deleted workflow as an orphan, not as a skill', () => {
		syncAll(aliasConfig(), fixtureDir);
		put('.agents/workflows/opsx-old.md', workflowFile('opsx-old'));
		syncAll(aliasConfig(), fixtureDir);
		rmSync(join(fixtureDir, '.agents/workflows/opsx-old.md'));

		expect(checkAll(aliasConfig(), fixtureDir).orphans).toEqual(['.agents/skills/opsx-old/SKILL.md', '.agents/skills/opsx-old/agents/openai.yaml']);
		syncAll(aliasConfig(), fixtureDir);
		expect(has('.claude/skills/opsx-old')).toBe(false);

		const prune = cli(['--prune'], aliasConfig());
		expect(prune.stdout).toEqual(expect.arrayContaining(['  PRUNE   .agents/skills/opsx-old/SKILL.md', '  PRUNE   .agents/skills/opsx-old/agents/openai.yaml']));
		expect(has('.agents/skills/opsx-old')).toBe(false);
		expect(has('.agents/skills/opsx-verify/SKILL.md')).toBe(true);
		expect(has('.agents/skills/tdd/SKILL.md')).toBe(true);
	});

	it('refuses a hand-made opsx-* skill without the generated header, in every mode', () => {
		put('.agents/skills/opsx-mine/SKILL.md', skillFile('opsx-mine'));
		expectRefusedInEveryMode(aliasConfig(), /\.agents\/skills\/opsx-mine .*reserved/);
		expect(read('.agents/skills/opsx-mine/SKILL.md')).toBe(skillFile('opsx-mine'));
		expect(has('.claude/skills/opsx-mine')).toBe(false);
	});

	it('refuses the opsx- prefix even when no alias mapping is configured', () => {
		put('.agents/skills/opsx-mine/SKILL.md', skillFile('opsx-mine'));
		expect(() => checkAll(skillsOnly(), fixtureDir)).toThrow(/opsx-mine .*reserved/);
	});

	it('still recognises its aliases after the header text changes, and regenerates them', () => {
		syncAll(aliasConfig(), fixtureDir);
		const changed = aliasConfig({ generatedHeader: '<!-- GENERATED, new wording -->' });
		expect(checkAll(changed, fixtureDir).stale).toEqual(expect.arrayContaining(['.agents/skills/opsx-verify/SKILL.md', '.agents/skills/opsx-verify/agents/openai.yaml']));
		expect(cli([], changed).code).toBe(0);
		expect(read('.agents/skills/opsx-verify/SKILL.md')).toContain('---\n<!-- GENERATED, new wording -->\n');
		expect(cli(['--check']).code).toBe(0);
	});

	it('refuses an id that differs from the file name', () => {
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-check'));
		expect(() => syncAll(aliasConfig(), fixtureDir)).toThrow(/\.agents\/workflows\/opsx-verify\.md: id opsx-check must equal the file name opsx-verify/);
		expect(has('.agents/skills/opsx-verify')).toBe(false);
		expect(has('.claude/skills/tdd')).toBe(false);
	});

	it('refuses a description that would pass 1024 characters', () => {
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-verify', 'x'.repeat(1000)));
		expect(() => checkAll(aliasConfig(), fixtureDir)).toThrow(/opsx-verify\.md: the alias description would be 1036 characters, over the 1024 limit/);
	});

	it('writes a description with quotes and a colon as a double-quoted scalar that keeps the text', () => {
		const description = 'Interview the user. Use when they say "grill me": one question at a time, C:\\path kept.';
		put('.agents/workflows/opsx-grill-me.md', workflowFile('opsx-grill-me', description));
		syncAll(aliasConfig(), fixtureDir);
		const line = read('.agents/skills/opsx-grill-me/SKILL.md').split('\n')[2] ?? '';
		expect(line.startsWith('description: "')).toBe(true);
		// A YAML double-quoted scalar that escapes only backslash and quote is also a JSON string.
		expect(JSON.parse(line.slice('description: '.length))).toBe(`Alias for the opsx-grill-me workflow. ${description}`);
	});

	it('unquotes a quoted source description', () => {
		put('.agents/workflows/opsx-verify.md', workflowFile('opsx-verify', '"Say \\"hi\\": now"'));
		put('.agents/workflows/opsx-new.md', workflowFile('opsx-new', "'It''s new'"));
		syncAll(aliasConfig(), fixtureDir);
		expect(read('.agents/skills/opsx-verify/SKILL.md')).toContain('description: "Alias for the opsx-verify workflow. Say \\"hi\\": now"\n');
		expect(read('.agents/skills/opsx-new/SKILL.md')).toContain('description: "Alias for the opsx-new workflow. It\'s new"\n');
	});

	it('refuses a block-scalar description and names the file', () => {
		put('.agents/workflows/opsx-verify.md', ['---', 'id: opsx-verify', 'description: >', '    Folded text.', '---', '', 'Body.', ''].join('\n'));
		expect(() => checkAll(aliasConfig(), fixtureDir)).toThrow(/\.agents\/workflows\/opsx-verify\.md: description is a block scalar/);
	});

	it('refuses a workflow without a one-line id', () => {
		put('.agents/workflows/opsx-verify.md', '---\ndescription: No id here\n---\n\nBody.\n');
		expect(() => checkAll(aliasConfig(), fixtureDir)).toThrow(/\.agents\/workflows\/opsx-verify\.md: frontmatter has no one-line id/);
	});

	it('rejects a generator mapping that is not shaped like the alias mapping', () => {
		const variants: Partial<PlatformMapping>[] = [
			{ transforms: ['commandSyntax'] },
			{ source: 'skills' },
			{ format: '{name}.md' },
			{ target: '.codex/aliases' },
			{ stripPrefix: 'opsx-' },
		];
		for (const variant of variants) {
			const config = makeConfig({ codex: { aliases: { ...aliasMapping(), ...variant } } });
			expect(() => validateConfig(config), JSON.stringify(variant)).toThrow(/platforms\.codex\.aliases: generator opsxAlias needs/);
		}
	});

	it('rejects an unknown generator, and a plain mapping that writes into the canonical folder', () => {
		expect(() => validateConfig(makeConfig({ codex: { aliases: { ...aliasMapping(), generator: 'other' as unknown as PlatformMapping['generator'] } } }))).toThrow(
			/platforms\.codex\.aliases\.generator names unknown generator other/
		);
		const plain = aliasMapping();
		delete plain.generator;
		expect(() => validateConfig(makeConfig({ codex: { aliases: plain } }))).toThrow(/platforms\.codex\.aliases\.target must not be inside the canonical folder \.agents/);
	});
});

// ─── Invocation classes (design D8) ──────────────────────────────────────────

describe('invocation classes', () => {
	/**
	 * Put a canonical skill with extra frontmatter lines.
	 * @param fields The extra lines.
	 */
	const putHandoff = (fields: string[]): void => {
		put('.agents/skills/handoff/SKILL.md', skillFile('handoff', fields));
	};

	it('treats every skill as mixed by default, with or without the invocation key', () => {
		putHandoff([]);
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([]);
		expect(checkAll(skillsOnly({ invocation: { default: 'mixed', skills: {} } }), fixtureDir).problems).toEqual([]);
	});

	it('accepts user-invocable: true as mixed', () => {
		putHandoff(['user-invocable: true']);
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([]);
	});

	it('fails --check when a flag does not match the class, and only warns on a plain sync', () => {
		putHandoff(['disable-model-invocation: true']);
		const config = skillsOnly({ invocation: { default: 'mixed', skills: {} } });
		expect(checkAll(config, fixtureDir).problems).toEqual([
			'.agents/skills/handoff/SKILL.md: invocation mixed needs no disable-model-invocation: true, no user-invocable: false and no allow_implicit_invocation in agents/openai.yaml',
		]);
		const check = cli(['--check'], config);
		expect(check.code).toBe(1);
		expect(check.stderr.some((line) => line.startsWith('  PROBLEM .agents/skills/handoff/SKILL.md: invocation mixed'))).toBe(true);
		const sync = cli([], config);
		expect(sync.code).toBe(0);
		expect(sync.stderr.some((line) => line.startsWith('WARNING PROBLEM .agents/skills/handoff/SKILL.md'))).toBe(true);
	});

	it('checks the human class, including agents/openai.yaml', () => {
		const config = skillsOnly({ invocation: { default: 'mixed', skills: { handoff: 'human' } } });
		putHandoff(['disable-model-invocation: true']);
		expect(checkAll(config, fixtureDir).problems).toEqual([
			'.agents/skills/handoff/SKILL.md: invocation human needs disable-model-invocation: true, no user-invocable: false and agents/openai.yaml with allow_implicit_invocation: false',
		]);
		put('.agents/skills/handoff/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: false\n');
		expect(checkAll(config, fixtureDir).problems).toEqual([]);
	});

	it('checks the agent class', () => {
		const config = skillsOnly({ invocation: { default: 'mixed', skills: { handoff: 'agent' } } });
		putHandoff(['user-invocable: false']);
		expect(checkAll(config, fixtureDir).problems).toEqual([]);
		putHandoff(['user-invocable: false', 'disable-model-invocation: true']);
		expect(checkAll(config, fixtureDir).problems).toEqual([
			'.agents/skills/handoff/SKILL.md: invocation agent needs user-invocable: false and no disable-model-invocation: true',
		]);
	});

	it('accepts only the literal true and false', () => {
		putHandoff(['disable-model-invocation: yes']);
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual(['.agents/skills/handoff/SKILL.md: disable-model-invocation must be the literal true or false, not yes']);
		putHandoff([]);
		put('.agents/skills/handoff/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: no\n');
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([
			'.agents/skills/handoff/agents/openai.yaml: allow_implicit_invocation must be the literal true or false, not no',
		]);
	});

	it('refuses any implicit-invocation block on a mixed skill, and reads the key only under policy', () => {
		putHandoff([]);
		const mixed =
			'.agents/skills/handoff/SKILL.md: invocation mixed needs no disable-model-invocation: true, no user-invocable: false and no allow_implicit_invocation in agents/openai.yaml';
		put('.agents/skills/handoff/agents/openai.yaml', 'policy:\n  allow_implicit_invocation: true\n');
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([mixed]);
		put('.agents/skills/handoff/agents/openai.yaml', 'interface:\n  allow_implicit_invocation: false\n');
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([]);
	});

	it('finds the human policy under policy:, past comments', () => {
		const config = skillsOnly({ invocation: { default: 'mixed', skills: { handoff: 'human' } } });
		putHandoff(['disable-model-invocation: true']);
		put('.agents/skills/handoff/agents/openai.yaml', 'interface:\n  allow_implicit_invocation: false\n');
		expect(checkAll(config, fixtureDir).problems).toEqual([
			'.agents/skills/handoff/SKILL.md: invocation human needs disable-model-invocation: true, no user-invocable: false and agents/openai.yaml with allow_implicit_invocation: false',
		]);
		put('.agents/skills/handoff/agents/openai.yaml', '# why\npolicy:\n# the only key\n  allow_implicit_invocation: false # explicit only\n');
		expect(checkAll(config, fixtureDir).problems).toEqual([]);
	});

	it('reports a class for a skill that does not exist', () => {
		putHandoff([]);
		expect(checkAll(skillsOnly({ invocation: { default: 'mixed', skills: { ghost: 'human' } } }), fixtureDir).problems).toEqual([
			'invocation.skills.ghost names no canonical skill',
		]);
	});

	it('rejects an unknown class name', () => {
		expect(() => validateConfig(skillsOnly({ invocation: { default: 'mixed', skills: { handoff: 'robot' as unknown as 'human' } } }))).toThrow(
			/invocation\.skills\.handoff must be human, agent or mixed/
		);
		expect(() => validateConfig(skillsOnly({ invocation: { default: 'auto' as unknown as 'mixed', skills: {} } }))).toThrow(
			/invocation\.default must be human, agent or mixed/
		);
	});

	it('rejects a class for a vendored skill', () => {
		expect(() => validateConfig(skillsOnly({ vendored: ['third'], invocation: { default: 'mixed', skills: { third: 'mixed' } } }))).toThrow(
			/invocation\.skills\.third: vendored skills are exempt from invocation classes/
		);
	});
});

// ─── Vendored skills (design D8, D9) ─────────────────────────────────────────

describe('vendored skills', () => {
	beforeEach(() => {
		put('.agents/skills/third/SKILL.md', skillFile('third', ['disable-model-invocation: yes']));
	});

	it('exempts a vendored skill from the class check when its ignore lines exist', () => {
		put('.prettierignore', 'dist\n.agents/skills/third/\n');
		put('.markdownlintignore', '# vendored\n.agents/skills/third/\n');
		expect(checkAll(skillsOnly({ vendored: ['third'] }), fixtureDir).problems).toEqual([]);
	});

	it('fails when a vendored name has no canonical folder', () => {
		put('.prettierignore', '.agents/skills/third/\n.agents/skills/ghost/\n');
		put('.markdownlintignore', '.agents/skills/third/\n.agents/skills/ghost/\n');
		const config = skillsOnly({ vendored: ['third', 'ghost'] });
		expect(checkAll(config, fixtureDir).problems).toEqual(['vendored skill ghost has no canonical folder .agents/skills/ghost']);
		expect(cli(['--check'], config).code).toBe(1);
	});

	it('fails when an ignore line is missing, naming the file', () => {
		put('.prettierignore', '.agents/skills/third\n');
		const result = checkAll(skillsOnly({ vendored: ['third'] }), fixtureDir);
		expect(result.problems).toEqual([
			'.markdownlintignore lacks the line .agents/skills/third/ for the vendored skill third',
			'.prettierignore lacks the line .agents/skills/third/ for the vendored skill third',
		]);
	});

	it("still checks a vendored skill's frontmatter, which every tool needs", () => {
		put('.agents/skills/third/SKILL.md', '---\nname: third\n---\n\nNo description.\n');
		put('.prettierignore', '.agents/skills/third/\n');
		put('.markdownlintignore', '.agents/skills/third/\n');
		expect(checkAll(skillsOnly({ vendored: ['third'] }), fixtureDir).problems).toEqual(['.agents/skills/third/SKILL.md: frontmatter has no one-line description']);
	});
});

// ─── Canonical skill frontmatter (Agent Skills spec) ─────────────────────────

describe('canonical skill frontmatter', () => {
	it('accepts a well-formed skill', () => {
		put('.agents/skills/adapt/SKILL.md', skillFile('adapt'));
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([]);
	});

	it('reports a skill without frontmatter, without a description, or with a name that is not its folder', () => {
		put('.agents/skills/nofm/SKILL.md', '# No frontmatter\n');
		put('.agents/skills/nodesc/SKILL.md', '---\nname: nodesc\n---\n\nBody.\n');
		put('.agents/skills/badname/SKILL.md', skillFile('Wrong_Name'));
		syncAll(skillsOnly(), fixtureDir);
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([
			'.agents/skills/badname/SKILL.md: name Wrong_Name must equal the folder name badname',
			'.agents/skills/nodesc/SKILL.md: frontmatter has no one-line description',
			".agents/skills/nofm/SKILL.md: has no frontmatter block on line 1, so tools lose the skill's name and description",
		]);
		const result = cli(['--check'], skillsOnly());
		expect(result.code).toBe(1);
		expect(result.stderr.filter((line) => line.startsWith('  PROBLEM ')).length).toBe(3);
	});

	it('reports a name that breaks the Agent Skills naming rules', () => {
		put('.agents/skills/Bad--Name/SKILL.md', skillFile('Bad--Name'));
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([
			'.agents/skills/Bad--Name/SKILL.md: name Bad--Name breaks the Agent Skills naming rules: at most 64 lowercase letters, digits and single hyphens, with no hyphen at either end',
		]);
	});

	it('reports a description over 1024 characters', () => {
		put('.agents/skills/adapt/SKILL.md', ['---', 'name: adapt', `description: ${'x'.repeat(1025)}`, '---', '', 'Body.', ''].join('\n'));
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual(['.agents/skills/adapt/SKILL.md: description is 1025 characters, over the 1024 limit']);
	});

	it('reports a leading byte-order mark, and the mirror still starts with its frontmatter', () => {
		put('.agents/skills/bomskill/SKILL.md', `\uFEFF${skillFile('bomskill')}`);
		syncAll(skillsOnly(), fixtureDir);
		expect(checkAll(skillsOnly(), fixtureDir).problems).toEqual([
			'.agents/skills/bomskill/SKILL.md: starts with a UTF-8 byte-order mark; save it without one, so --- is the first line',
		]);
		expect(readFileSync(join(fixtureDir, '.claude/skills/bomskill/SKILL.md')).subarray(0, 4).toString('utf-8')).toBe('---\n');
	});
});

// ─── The real config (design D5, D12) ────────────────────────────────────────

describe('the repo config', () => {
	it("has the Claude target set and the skip list; other vendors' targets arrive with the second harness part", () => {
		const config = loadConfig(repoRoot);
		const targets = Object.entries(config.platforms).flatMap(([platform, mappings]) =>
			Object.entries(mappings).map(
				([key, mapping]) => `${platform}.${key} ${mapping.target} ${mapping.unit} ${mapping.transforms.join(',') || '-'}${mapping.generator ? ` ${mapping.generator}` : ''}`
			)
		);
		expect(targets.sort()).toEqual(['claude.commands .claude/commands/opsx file commandSyntax', 'claude.skills .claude/skills folder commandSyntax']);
		expect(config.retired).toEqual([]);
		expect(config.invocation).toEqual({ default: 'mixed', skills: {} });
		expect(config.vendored).toEqual([]);
		expect(config.skip).toEqual(['__pycache__', '.pytest_cache', '.venv', 'node_modules', '.DS_Store', 'Thumbs.db']);
	});
});
