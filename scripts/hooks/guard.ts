/**
 * The PreToolUse command guard (OpenSpec change harness-guardrails, design D3 "The git rules", D4 "Failure modes",
 * D5 "The block message", D7 "The OpenSpec guard" and D8 "Env deny rules per tool"; spec harness--guards).
 *
 * One process per hook call: `node scripts/hooks/guard.ts <host>` reads the host's payload on stdin (`hook-io.ts`),
 * reads a shell command with both dialects (`shell-parse.ts`) and applies every rule to every command either reading
 * found:
 * - git: `push`; `reset --hard`; `clean` unless a pure dry run; `branch -D` or a forced delete; `checkout` with a
 *   force flag or a folder pathspec; `restore` of a folder into the worktree. The missing pathspecs of a call are
 *   resolved with one read-only `git cat-file --batch-check`, so a deleted folder blocks and a deleted `LICENSE` passes.
 * - OpenSpec: `openspec update` and `init` aimed at this checkout outside `<root>/tmp/`, through every launcher. The
 *   owner's override is `RESURSE_GUARD_ALLOW=openspec` in the guard's own environment, never in the command text;
 *   each use is logged to `<root>/tmp/agent-state/guard-overrides.log`.
 * - Env files: a command word, argument or redirect that names `.env`, a `.env.*` other than `.env.example`,
 *   `.dev.vars` or a `.dev.vars.*`, except listing commands, `git check-ignore`/`ls-files`/`status`, Node's
 *   `--env-file` and the pattern of a search. File tools are scanned for such a path in every string value.
 * - The lock gate (D17): while another process holds this checkout's lock (`scripts/checkout-lock.ts`), the pnpm
 *   commands that change `node_modules` or the lockfile, the raw `astro build`, `playwright test`, `serve dist…` and
 *   `node scripts/sync-harness.ts`, and repo-wide fixers (no path, `.`, a folder or a glob). The checkout is the one
 *   the command runs in: the payload's folder, a literal `cd` earlier in the call, or pnpm's `-C`. The holder is read
 *   only for a command on that list, and any error in reading it allows.
 *
 * A text that no reading completes, or that holds a dynamic command, also gets the raw-text suspicion check (D4).
 * A block prints the three-line D5 message; an allow prints nothing that skips the host's own prompt.
 *
 * Uses only `node:` built-ins, its sibling modules and `scripts/lib/`; the lock's holder comes from
 * `scripts/lib/lock-holder.ts`, so a guard call loads neither `node:net` nor `node:crypto` (design D1). No side
 * effects on import.
 */

import {
	type Decision,
	type HookContext,
	type HookHandlers,
	type Host,
	MAX_LOG_LINE_CHARS,
	agentStateFile,
	appendCapped,
	asciiLine,
	clip,
	hookRoot,
	localIso,
	patchHeaders,
	safeMain,
} from './hook-io.ts';
import { type Env, isInside, pathFor, placeWord, scratchPath, withoutRepoVariables } from '../lib/checkout-root.ts';
import { type Holder, TOKEN_VARIABLE, describeHolder, readHolderSync } from '../lib/lock-holder.ts';
import { NODE_VALUED, PNPM_GLOBAL_VALUED, type ParseOptions, type ParseResult, type SimpleCommand, type Word, commandName, parseCommand, readGitCall } from './shell-parse.ts';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Which rule set a block comes from. */
export type RuleKind = 'git' | 'openspec' | 'env' | 'suspicion' | 'lock';

/** A rule set whose rules a command can break; a suspicion block stands for one of them. */
type RuleSet = Exclude<RuleKind, 'suspicion'>;

/** A blocked command: the rule and the part of the command that matched. */
export interface Block {
	kind: RuleKind;
	/** The rule, such as `git push`. */
	rule: string;
	/** The matching part of the command, one ASCII line. */
	match: string;
	/** For a suspicion block, the rule set whose rule the text looked like it breaks. */
	suspected?: RuleSet;
	/** A reason that replaces the rule set's usual `Why:` line: the lock's holder. */
	why?: string;
}

/**
 * Asks git what `<rev>:<path>` names in a folder: `tree`, `blob`, or null when git does not know it. A probe with
 * `batch` answers several specs, in their order, in one git process; the guard asks through it when it is there.
 */
export interface GitProbe {
	(dir: string, spec: string): string | null;
	batch?: (dir: string, specs: readonly string[]) => (string | null)[];
}

/** What the guard reads from the outside world; injectable for tests. */
/**
 * Which git calls the guard blocks: `read-only` blocks every call that is not a read, because this checkout's owner
 * makes every git write; `destructive-only` blocks only the publishing and work-losing forms.
 */
export type GitPolicy = 'read-only' | 'destructive-only';

export interface GuardDeps {
	/** The git policy of this checkout. */
	gitPolicy: GitPolicy;
	/** Tells whether a path is a folder, a file, or missing. */
	stat: (path: string) => 'dir' | 'file' | null;
	/** Tells whether a path exists (the walk up to a checkout root). */
	exists: (path: string) => boolean;
	/** Asks git what pathspecs name, from {@link makeGitProbe}. */
	gitProbe: GitProbe;
	/** The shell parser. */
	parse: (text: string, options: ParseOptions) => ParseResult;
	/** The lock gate of design D17, from {@link makeLockGate}. */
	lockGate: (commands: readonly SimpleCommand[], scope: GuardScope) => Block | null;
	/** Appends one line to a log, best effort. */
	log: (file: string, line: string) => boolean;
}

/** Where a command runs, and what the guard may use to judge it. */
export interface GuardScope {
	platform: NodeJS.Platform;
	/** The guard's own environment, which carries the owner's override. */
	env: Env;
	/** The folder the call runs in, or null. */
	cwd: string | null;
	/** The checkout root found from it, or null. */
	root: string | null;
	host: Host;
	now: () => Date;
	deps: GuardDeps;
	/** The override uses already logged for this tool call, so that two readings of one command log it once. */
	overridesLogged?: Set<string>;
}

/** How long one `git cat-file --batch-check` may take. */
const PROBE_TIMEOUT_MS = 2000;

/** How deep `-c alias.x=…` bodies are followed. */
const MAX_ALIAS_DEPTH = 3;

/** The longest `match` in a block message. */
const MAX_MATCH_CHARS = 120;

// ─── Dependencies ────────────────────────────────────────────────────────────

/**
 * Tell what a path is.
 * @param path The path.
 * @returns `dir`, `file`, or null when it does not exist.
 */
function statKind(path: string): 'dir' | 'file' | null {
	try {
		return statSync(path).isDirectory() ? 'dir' : 'file';
	} catch {
		return null;
	}
}

/**
 * A git probe from its batch form; the single form asks a batch of one.
 * @param batch Answers several specs in one call, in their order.
 * @returns The probe.
 */
function fromBatch(batch: NonNullable<GitProbe['batch']>): GitProbe {
	return Object.assign((dir: string, spec: string): string | null => batch(dir, [spec])[0] ?? null, { batch });
}

/**
 * Ask a probe about several specs: in one batch when it has one, else one at a time.
 * @param probe The probe.
 * @param dir The folder git runs in.
 * @param specs The `<rev>:<path>` specs.
 * @returns The answers, in the specs' order.
 */
function probeAll(probe: GitProbe, dir: string, specs: readonly string[]): (string | null)[] {
	return probe.batch?.(dir, specs) ?? specs.map((spec) => probe(dir, spec));
}

/**
 * Build the read-only git probe: one `git -C <dir> cat-file --batch-check` per batch, with the specs on stdin, without
 * a shell, with a 2 s timeout, and without the variables that would aim git at another repository. Git answers each
 * line with `<oid> <type> <size>` or `<spec> missing` (verified, git 2.55); a fatal error (a path outside the
 * repository) ends its output early, and the specs it did not answer stay unknown. A spec with a line break would
 * split on stdin, so it is not asked and stays unknown.
 * @param env The environment to run git with.
 * @returns The probe: each answer is the object type, or null when git does not know the spec or fails.
 */
export function makeGitProbe(env: Env): GitProbe {
	const clean = withoutRepoVariables(env);
	return fromBatch((dir, specs) => {
		const asked = specs.filter((spec) => !/[\r\n]/.test(spec));
		const types = new Map<string, string | null>();
		if (asked.length > 0) {
			const result = spawnSync('git', ['-C', dir, 'cat-file', '--batch-check'], {
				env: clean,
				input: asked.map((spec) => `${spec}\n`).join(''),
				encoding: 'utf-8',
				timeout: PROBE_TIMEOUT_MS,
				windowsHide: true,
			});
			const lines = (result.stdout ?? '').split(/\r?\n/);
			for (const [index, spec] of asked.entries()) types.set(spec, /^[0-9a-f]{40,64} (\S+) \d+$/.exec(lines[index] ?? '')?.[1] ?? null);
		}
		return specs.map((spec) => types.get(spec) ?? null);
	});
}

/**
 * The guard's real dependencies.
 * @param env The environment for the git probe.
 * @returns The dependencies.
 */
export function defaultGuardDeps(env: Env = process.env): GuardDeps {
	return {
		gitPolicy: 'read-only',
		stat: statKind,
		exists: existsSync,
		gitProbe: makeGitProbe(env),
		parse: parseCommand,
		lockGate: makeLockGate(),
		log: (file, line) => appendCapped(file, line),
	};
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Show a command's words as one short ASCII line.
 * @param words The words.
 * @returns The line.
 */
function shown(words: readonly Word[]): string {
	return clip(asciiLine(words.map((word) => word.value).join(' ')), MAX_MATCH_CHARS);
}

/**
 * The last path segment of a value, splitting on both slashes, `=` and `:`.
 * @param value The value.
 * @returns The segment.
 */
function lastSegment(value: string): string {
	return (value.split(/[\\/=:]/).at(-1) ?? '').trim();
}

// ─── Env files (D8) ──────────────────────────────────────────────────────────

/**
 * Whether a file name is a denied env file: `.env`, any `.env.*` but `.env.example`, `.dev.vars` or any
 * `.dev.vars.*`, in any letter case.
 * @param name A file name, without folders.
 * @returns True when the guard denies it.
 */
export function isDeniedEnvName(name: string): boolean {
	const base = name.toLowerCase();
	if (base === '.env.example') return false;
	return base === '.env' || base.startsWith('.env.') || base === '.dev.vars' || base.startsWith('.dev.vars.');
}

/**
 * The denied env file a value names, if any: each comma-separated part's last segment, or a glob that starts with an
 * env name (`.env*`). A segment with whitespace inside is a sentence, not a file name (`echo ".env.local holds…"`).
 * @param value A word, or a single-line string of a file tool.
 * @returns The name, or null.
 */
function envHit(value: string): string | null {
	for (const part of value.split(',')) {
		const base = lastSegment(part);
		if (/\s/.test(base)) continue;
		if (isDeniedEnvName(base) || /^\.(?:env|dev\.vars)[*?[]/i.test(base)) return base;
	}
	return null;
}

/**
 * The denied env file a patch's headers name, if any; a `Delete File` header counts too.
 * @param text A multi-line string.
 * @returns The name, or null.
 */
function patchHit(text: string): string | null {
	for (const { path } of patchHeaders(text)) {
		const hit = envHit(path);
		if (hit !== null) return hit;
	}
	return null;
}

/**
 * A block of the env rule.
 * @param name The denied name.
 * @returns The block.
 */
function envBlock(name: string): Block {
	return { kind: 'env', rule: 'env file', match: clip(asciiLine(name), MAX_MATCH_CHARS) };
}

/** Commands that only test for or list a file (design D8). */
const LISTERS = new Set(['ls', 'dir', 'gci', 'get-childitem', 'test-path', 'test', '[', '[[', 'stat']);

/** Listers whose output, piped on, carries the files themselves in PowerShell. */
const OBJECT_LISTERS = new Set(['ls', 'dir', 'gci', 'get-childitem']);

/** Git subcommands that only test for or list a file. */
const GIT_LISTERS = new Set(['check-ignore', 'ls-files', 'status']);

/** A search tool's options: the short letters and long names that take a value. */
interface SearchOptions {
	short: string;
	long: ReadonlySet<string>;
}

/** grep's options that take a value. */
const GREP_OPTIONS: SearchOptions = {
	short: 'efmABCdD',
	long: new Set([
		'file',
		'max-count',
		'after-context',
		'before-context',
		'context',
		'devices',
		'directories',
		'include',
		'exclude',
		'exclude-dir',
		'exclude-from',
		'label',
		'binary-files',
		'group-separator',
	]),
};

/** ripgrep's options that take a value; `-g` values are still checked as paths. */
const RG_OPTIONS: SearchOptions = {
	short: 'efgtTmABCjMEr',
	long: new Set([
		'file',
		'glob',
		'iglob',
		'type',
		'type-not',
		'max-count',
		'after-context',
		'before-context',
		'context',
		'threads',
		'max-columns',
		'encoding',
		'replace',
		'type-add',
		'type-clear',
		'max-depth',
		'max-filesize',
		'path-separator',
		'sort',
		'sortr',
		'colors',
		'context-separator',
		'field-match-separator',
		'field-context-separator',
		'engine',
		'pre',
		'pre-glob',
		'dfa-size-limit',
		'regex-size-limit',
		'ignore-file',
		'hostname-bin',
		'hyperlink-format',
	]),
};

/** git grep's options that take a value. */
const GIT_GREP_OPTIONS: SearchOptions = {
	short: 'efABCm',
	long: new Set(['file', 'after-context', 'before-context', 'context', 'max-count', 'max-depth', 'threads', 'open-files-in-pager']),
};

/**
 * The indexes of a search's pattern words: the `-e`/`--regexp` values, or else the first positional.
 * @param words The command's words.
 * @param start The index of the first argument.
 * @param options The tool's options that take a value.
 * @returns The indexes.
 */
function searchPatterns(words: readonly Word[], start: number, options: SearchOptions): Set<number> {
	const patterns = new Set<number>();
	let explicit = false;
	let first = -1;
	for (let index = start; index < words.length; index++) {
		const value = words[index]?.value ?? '';
		if (value === '--') {
			if (first === -1 && index + 1 < words.length) first = index + 1;
			break;
		}
		if (value.startsWith('--') && value.length > 2) {
			const equals = value.indexOf('=');
			const name = value.slice(2, equals === -1 ? undefined : equals);
			if (name === 'regexp') {
				explicit = true;
				if (equals !== -1) patterns.add(index);
				else patterns.add(++index);
			} else if (options.long.has(name) && equals === -1) index++;
			continue;
		}
		if (value.startsWith('-') && value.length > 1) {
			for (let at = 1; at < value.length; at++) {
				const letter = value[at] ?? '';
				if (!options.short.includes(letter)) continue;
				const attached = value.length > at + 1;
				if (letter === 'e') {
					explicit = true;
					patterns.add(attached ? index : index + 1);
				}
				if (!attached) index++;
				break;
			}
			continue;
		}
		if (first === -1) first = index;
	}
	if (!explicit && first !== -1) patterns.add(first);
	return patterns;
}

/** `Select-String` parameters that take a value. */
const SELECT_STRING_VALUED = ['pattern', 'path', 'literalpath', 'include', 'exclude', 'encoding', 'context', 'culture', 'inputobject'];

/**
 * The indexes of a `Select-String` pattern: the `-Pattern` value, or else the first positional.
 * @param words The command's words.
 * @returns The indexes.
 */
function selectStringPatterns(words: readonly Word[]): Set<number> {
	const patterns = new Set<number>();
	let explicit = false;
	let first = -1;
	for (let index = 1; index < words.length; index++) {
		const value = words[index]?.value ?? '';
		if (!/^-[A-Za-z]/.test(value)) {
			if (first === -1) first = index;
			continue;
		}
		const colon = value.indexOf(':');
		const name = value.slice(1, colon === -1 ? undefined : colon).toLowerCase();
		if (name.length >= 4 && 'pattern'.startsWith(name)) {
			explicit = true;
			patterns.add(colon === -1 ? ++index : index);
		} else if (colon === -1 && SELECT_STRING_VALUED.some((parameter) => parameter.startsWith(name))) index++;
	}
	if (!explicit && first !== -1) patterns.add(first);
	return patterns;
}

/**
 * The indexes of a `findstr` pattern: a `/c:` string, or else the first positional.
 * @param words The command's words.
 * @returns The indexes.
 */
function findstrPatterns(words: readonly Word[]): Set<number> {
	const patterns = new Set<number>();
	let explicit = false;
	let first = -1;
	for (let index = 1; index < words.length; index++) {
		const value = words[index]?.value ?? '';
		if (value.startsWith('/')) {
			if (/^\/c:/i.test(value)) {
				explicit = true;
				patterns.add(index);
			}
		} else if (first === -1) first = index;
	}
	if (!explicit && first !== -1) patterns.add(first);
	return patterns;
}

/**
 * The indexes of Node's `--env-file` and `--env-file-if-exists` values, which Node loads itself.
 * @param words The command's words.
 * @returns The indexes.
 */
function nodeEnvFiles(words: readonly Word[]): Set<number> {
	const exempt = new Set<number>();
	for (let index = 1; index < words.length; index++) {
		const value = words[index]?.value ?? '';
		if (value === '--env-file' || value === '--env-file-if-exists') exempt.add(index + 1);
		else if (value.startsWith('--env-file=') || value.startsWith('--env-file-if-exists=')) exempt.add(index);
	}
	return exempt;
}

/**
 * The env rule for one command (design D8).
 * @param command The command.
 * @param next The command after it in the same reading, to see whether its output is piped on.
 * @param platform The platform whose path rules name the command.
 * @returns The block, or null.
 */
function envRule(command: SimpleCommand, next: SimpleCommand | undefined, platform: NodeJS.Platform): Block | null {
	const { words } = command;
	const name = words[0] === undefined ? '' : commandName(words[0].value, platform);
	const pipedOn = next?.piped === true;
	let skipWords = false;
	let exempt = new Set<number>();
	if (LISTERS.has(name)) skipWords = !(pipedOn && OBJECT_LISTERS.has(name));
	else if (name === 'git') {
		const call = readGitCall(words);
		const sub = call.sub === -1 ? '' : (words[call.sub]?.value.toLowerCase() ?? '');
		if (GIT_LISTERS.has(sub)) skipWords = !pipedOn;
		else if (sub === 'grep') exempt = searchPatterns(words, call.sub + 1, GIT_GREP_OPTIONS);
	} else if (name === 'grep' || name === 'egrep' || name === 'fgrep') exempt = searchPatterns(words, 1, GREP_OPTIONS);
	else if (name === 'rg') exempt = searchPatterns(words, 1, RG_OPTIONS);
	else if (name === 'select-string' || name === 'sls') exempt = selectStringPatterns(words);
	else if (name === 'findstr') exempt = findstrPatterns(words);
	else if (name === 'node' || name === 'nodejs') exempt = nodeEnvFiles(words);
	if (!skipWords) {
		for (const [index, word] of words.entries()) {
			if (exempt.has(index)) continue;
			const hit = word.value.includes('\n') ? patchHit(word.value) : envHit(word.value);
			if (hit !== null) return envBlock(hit);
		}
	}
	for (const redirect of command.redirects) {
		const hit = envHit(redirect.value);
		if (hit !== null) return envBlock(hit);
	}
	return null;
}

/**
 * The argument names whose values are text to write, replace or describe, never a path, compared in lower case without
 * `_` or `-`: Claude Code's and Grok's `old_string`/`new_string`, `str_replace`'s `old_str`/`new_str`, Antigravity's
 * `CodeContent`, `TargetContent`, `ReplacementContent`, `Instruction` and `Description`, and a plain `content`.
 */
const CONTENT_KEYS = new Set([
	'oldstring',
	'newstring',
	'oldstr',
	'newstr',
	'content',
	'contents',
	'codecontent',
	'targetcontent',
	'replacementcontent',
	'instruction',
	'description',
	'text',
]);

/** One string value of a tool input. */
interface ToolString {
	value: string;
	/** It sits under a {@link CONTENT_KEYS} name. */
	content: boolean;
}

/**
 * Collect the string values of a tool input, depth-first, up to a limit.
 * @param value The value.
 * @param out The strings found so far.
 * @param depth The nesting depth.
 * @param content Whether the value sits under a content name.
 */
function collectStrings(value: unknown, out: ToolString[], depth: number, content = false): void {
	if (out.length >= 1000 || depth > 8) return;
	if (typeof value === 'string') out.push({ value, content });
	else if (Array.isArray(value)) for (const item of value) collectStrings(item, out, depth + 1, content);
	else if (typeof value === 'object' && value !== null) {
		for (const [key, item] of Object.entries(value)) collectStrings(item, out, depth + 1, content || CONTENT_KEYS.has(key.toLowerCase().replace(/[_-]/g, '')));
	}
}

/**
 * The env rule for a file tool (design D8): every single-line string value outside the content names is read as a
 * path, so unknown argument names still work, and multi-line ones (file content, a Codex patch) only through their
 * patch headers. A single line of replacement text that names an env file (`.env.*` added to `.gitignore`) is not a
 * read of it.
 * @param input The tool's input.
 * @returns The block, or null.
 */
export function checkFileTool(input: Record<string, unknown>): Block | null {
	const strings: ToolString[] = [];
	collectStrings(input, strings, 0);
	for (const { value, content } of strings) {
		const hit = value.includes('\n') ? patchHit(value) : content ? null : envHit(value);
		if (hit !== null) return envBlock(hit);
	}
	return null;
}

// ─── Git (D3) ────────────────────────────────────────────────────────────────

/** A git subcommand's arguments, read with its value-taking options. */
interface GitArgs {
	/** Every short option letter seen. */
	shorts: Set<string>;
	/** Every long option name seen, lowercased, without `--` or a value. */
	longs: string[];
	/** The values of the value-taking options, by short letter or long name. */
	values: Map<string, Word[]>;
	/** Positional words before `--`. */
	positionals: Word[];
	/** Words after `--`. */
	pathspecs: Word[];
	/** `-h` or `--help` appeared. */
	help: boolean;
}

/**
 * Read a git subcommand's arguments, as git's option parser does: short clusters, long options in any unambiguous
 * prefix, and values attached or separate.
 * @param args The words after the subcommand.
 * @param shortValued The short letters that take a value.
 * @param longValued The long names that take a value.
 * @returns The arguments.
 */
function readGitArgs(args: readonly Word[], shortValued: string, longValued: readonly string[]): GitArgs {
	const out: GitArgs = { shorts: new Set(), longs: [], values: new Map(), positionals: [], pathspecs: [], help: false };
	const put = (key: string, word: Word | undefined): void => {
		if (word !== undefined) out.values.set(key, [...(out.values.get(key) ?? []), word]);
	};
	for (let index = 0; index < args.length; index++) {
		const word = args[index];
		if (word === undefined) break;
		const value = word.value;
		if (value === '--') {
			out.pathspecs.push(...args.slice(index + 1));
			break;
		}
		if (value === '-h' || value === '--help') {
			out.help = true;
			continue;
		}
		if (value.startsWith('--') && value.length > 2) {
			const equals = value.indexOf('=');
			const name = value.slice(2, equals === -1 ? undefined : equals).toLowerCase();
			out.longs.push(name);
			const canonical = longValued.find((option) => option.startsWith(name));
			if (canonical !== undefined) {
				if (equals !== -1) put(canonical, { ...word, value: value.slice(equals + 1) });
				else put(canonical, args[++index]);
			}
			continue;
		}
		if (value.startsWith('-') && value.length > 1 && word.literal) {
			for (let at = 1; at < value.length; at++) {
				const letter = value[at] ?? '';
				out.shorts.add(letter);
				if (!shortValued.includes(letter)) continue;
				if (value.length > at + 1) put(letter, { ...word, value: value.slice(at + 1) });
				else put(letter, args[++index]);
				break;
			}
			continue;
		}
		out.positionals.push(word);
	}
	return out;
}

/**
 * Whether a long option, in any prefix git accepts, appeared.
 * @param longs The long names seen.
 * @param option The full option name.
 * @returns True when one of them abbreviates it.
 */
function hasLong(longs: readonly string[], option: string): boolean {
	return longs.some((name) => name !== '' && option.startsWith(name));
}

/**
 * Whether a pathspec names a folder or the whole tree by its form alone (design D3): `.`, `..`, pathspec magic, a
 * glob, or a trailing slash.
 * @param value The pathspec.
 * @returns True for a folder-like form.
 */
function folderLike(value: string): boolean {
	return value === '.' || value === '..' || value === './' || value === '.\\' || value.startsWith(':') || /[*?[]/.test(value) || /[\\/]$/.test(value);
}

/**
 * Whether the first `checkout` positional, which names a branch or commit unless it looks like a folder, is a
 * folder; git is never asked about it.
 * @param word The word.
 * @param dir The effective folder, or null.
 * @param scope The guard scope.
 * @returns True for a folder.
 */
function branchIsFolder(word: Word, dir: string | null, scope: GuardScope): boolean {
	if (!word.literal) return false;
	if (folderLike(word.value)) return true;
	return dir !== null && scope.deps.stat(pathFor(scope.platform).resolve(dir, word.value)) === 'dir';
}

/**
 * Whether any pathspec is a folder (design D3): by form, as an existing folder, or, for the names that exist neither
 * as a file nor as a folder, by one git probe for all of them (`<rev>:<path>`), where only `blob` passes. A pathspec
 * that cannot be placed counts as a folder.
 * @param specs The pathspecs.
 * @param dir The effective folder, or null.
 * @param rev The source revision; empty for the index.
 * @param scope The guard scope.
 * @returns True when one of them is a folder.
 */
function anyFolder(specs: readonly Word[], dir: string | null, rev: string, scope: GuardScope): boolean {
	if (dir === null) return specs.length > 0;
	const path = pathFor(scope.platform);
	const unknown: string[] = [];
	for (const spec of specs) {
		if (!spec.literal || folderLike(spec.value)) return true;
		const full = path.resolve(dir, spec.value);
		const kind = scope.deps.stat(full);
		if (kind === 'dir') return true;
		if (kind !== null) continue;
		const relative = path.relative(dir, full).replace(/\\/g, '/');
		unknown.push(`${rev}:${relative.startsWith('..') ? relative : `./${relative}`}`);
	}
	return unknown.length > 0 && probeAll(scope.deps.gitProbe, dir, unknown).some((type) => type !== 'blob');
}

/**
 * A block of the git rules.
 * @param rule The rule.
 * @param command The command.
 * @returns The block.
 */
function gitBlock(rule: string, command: SimpleCommand): Block {
	return { kind: 'git', rule, match: shown(command.words) };
}

/** Git subcommands that only read, whatever their arguments. */
const GIT_READ_ONLY = new Set([
	'annotate',
	'blame',
	'cat-file',
	'check-attr',
	'check-ignore',
	'check-mailmap',
	'check-ref-format',
	'cherry',
	'count-objects',
	'describe',
	'diff',
	'diff-files',
	'diff-index',
	'diff-tree',
	'for-each-ref',
	'grep',
	'help',
	'log',
	'ls-files',
	'ls-remote',
	'ls-tree',
	'merge-base',
	'name-rev',
	'range-diff',
	'rev-list',
	'rev-parse',
	'shortlog',
	'show',
	'show-branch',
	'show-ref',
	'status',
	'var',
	'verify-commit',
	'verify-tag',
	'version',
	'whatchanged',
]);

/**
 * Whether a git subcommand with these arguments only reads. Subcommands outside {@link GIT_READ_ONLY} pass in their
 * listing forms alone (`branch --list`, `stash list`, `config --get`, `clean -n`, `apply --check`); a subcommand this
 * function does not know counts as a write.
 * @param sub The subcommand, lowercased.
 * @param args The words after it.
 * @returns True when the call changes nothing.
 */
function gitOnlyReads(sub: string, args: readonly Word[]): boolean {
	if (GIT_READ_ONLY.has(sub)) return true;
	const values = args.map((word) => word.value);
	const options = values.filter((value) => value.startsWith('-'));
	const positional = values.filter((value) => !value.startsWith('-'));
	const first = positional[0] ?? '';
	const long = (names: readonly string[]): boolean => options.some((option) => names.includes(option.split('=')[0] ?? ''));
	const short = (letters: string): boolean => options.some((option) => /^-[a-zA-Z]+$/.test(option) && [...letters].some((letter) => option.includes(letter)));
	switch (sub) {
		case 'branch': {
			const writes =
				long(['--delete', '--move', '--copy', '--force', '--set-upstream-to', '--unset-upstream', '--edit-description', '--track', '--no-track', '--create-reflog']) ||
				short('dDmMcCfut');
			const lists = long(['--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at']) || short('l');
			return !writes && (positional.length === 0 || lists);
		}
		case 'tag': {
			const writes = long(['--delete', '--annotate', '--sign', '--force', '--message', '--file', '--local-user', '--edit']) || short('dasfmFue');
			const lists =
				long(['--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--verify']) ||
				short('lv') ||
				options.some((option) => /^-n\d*$/.test(option));
			return !writes && (positional.length === 0 || lists);
		}
		case 'stash':
			return first === 'list' || first === 'show';
		case 'remote':
			return first === '' || first === 'show' || first === 'get-url';
		case 'config': {
			const writes = long(['--add', '--unset', '--unset-all', '--replace-all', '--rename-section', '--remove-section', '--edit']) || short('e');
			const reads = long(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list']) || short('l') || first === 'get' || first === 'list';
			const sets = ['set', 'unset', 'rename-section', 'remove-section', 'edit'].includes(first) || (!reads && positional.length > 1);
			return !writes && !sets;
		}
		case 'worktree':
		case 'sparse-checkout':
			return first === 'list';
		case 'notes':
			return first === '' || first === 'list' || first === 'show';
		case 'submodule':
			return first === '' || first === 'status' || first === 'summary';
		case 'reflog':
			return !['expire', 'delete', 'drop'].includes(first);
		case 'symbolic-ref':
			return positional.length <= 1 && !long(['--delete']) && !short('dm');
		case 'lfs':
			return ['ls-files', 'status', 'env', 'version'].includes(first);
		case 'clean':
			return long(['--dry-run']) || short('n');
		case 'apply':
			return long(['--check', '--stat', '--numstat', '--summary']) && !long(['--apply', '--index', '--cached']);
		default:
			return false;
	}
}

/**
 * The git rules for one `git` invocation: the destructive forms always, and under the `read-only` policy every call
 * that is not a read.
 * @param command The command; its first word is `git`.
 * @param scope The guard scope.
 * @param depth How deep in alias bodies this is.
 * @returns The block, or null.
 */
function gitRule(command: SimpleCommand, scope: GuardScope, depth: number): Block | null {
	const destructive = destructiveGitRule(command, scope, depth);
	if (destructive !== null || scope.deps.gitPolicy !== 'read-only') return destructive;
	const call = readGitCall(command.words);
	if (call.sub === -1) return null;
	const sub = command.words[call.sub]?.value.toLowerCase() ?? '';
	return gitOnlyReads(sub, command.words.slice(call.sub + 1)) ? null : gitBlock(`git ${sub} (only read-only git is allowed here)`, command);
}

/**
 * The destructive git forms of one `git` invocation (design D3), its `-c alias.*` bodies included.
 * @param command The command; its first word is `git`.
 * @param scope The guard scope.
 * @param depth How deep in alias bodies this is.
 * @returns The block, or null.
 */
function destructiveGitRule(command: SimpleCommand, scope: GuardScope, depth: number): Block | null {
	const { words } = command;
	const call = readGitCall(words);
	let dir = scope.cwd;
	for (const each of call.dirs) dir = each.literal ? placeWord(each.value, dir, scope.platform) : null;
	for (const config of call.configs) {
		const alias = /^alias\.[^=]+=([\s\S]*)$/i.exec(config.value);
		if (alias === null || depth >= MAX_ALIAS_DEPTH) continue;
		const body = (alias[1] ?? '').trim();
		const block = checkShell(body.startsWith('!') ? body.slice(1) : `git ${body}`, { ...scope, cwd: dir }, depth + 1);
		if (block !== null) return block;
	}
	if (call.sub === -1) return null;
	const sub = words[call.sub]?.value.toLowerCase() ?? '';
	const args = words.slice(call.sub + 1);
	switch (sub) {
		case 'push':
			return args.some((word) => word.value === '-h' || word.value === '--help') ? null : gitBlock('git push', command);
		case 'reset': {
			const read = readGitArgs(args, '', ['pathspec-from-file']);
			return !read.help && hasLong(read.longs, 'hard') ? gitBlock('git reset --hard', command) : null;
		}
		case 'clean': {
			const read = readGitArgs(args, 'e', ['exclude']);
			if (read.help) return null;
			const force = read.shorts.has('f') || hasLong(read.longs, 'force');
			const interactive = read.shorts.has('i') || hasLong(read.longs, 'interactive');
			const dryRun = read.shorts.has('n') || hasLong(read.longs, 'dry-run');
			const unforced = call.configs.some((config) => /^clean\.requireforce=(?:false|no|off|0)$/i.test(config.value.trim()));
			return force || interactive || unforced || !dryRun ? gitBlock('git clean', command) : null;
		}
		case 'branch': {
			const read = readGitArgs(args, 'u', ['set-upstream-to', 'contains', 'no-contains', 'merged', 'no-merged', 'points-at', 'format', 'sort']);
			if (read.shorts.has('D')) return gitBlock('git branch -D', command);
			const remove = read.shorts.has('d') || hasLong(read.longs, 'delete');
			const force = read.shorts.has('f') || hasLong(read.longs, 'force');
			return remove && force ? gitBlock('git branch --delete --force', command) : null;
		}
		case 'checkout': {
			const read = readGitArgs(args, 'bB', ['orphan', 'conflict', 'pathspec-from-file']);
			if (read.help) return null;
			if (read.shorts.has('f') || hasLong(read.longs, 'force')) return gitBlock('git checkout --force', command);
			if (hasLong(read.longs, 'pathspec-from-file')) return gitBlock('git checkout --pathspec-from-file', command);
			const [first, ...later] = read.positionals;
			let rev = '';
			if (first !== undefined) {
				if (branchIsFolder(first, dir, scope)) return gitBlock('git checkout of a folder', command);
				if (first.literal) rev = first.value;
			}
			return anyFolder([...later, ...read.pathspecs], dir, rev, scope) ? gitBlock('git checkout of a folder', command) : null;
		}
		case 'restore': {
			const read = readGitArgs(args, 's', ['source', 'pathspec-from-file', 'conflict']);
			if (read.help) return null;
			if (hasLong(read.longs, 'pathspec-from-file')) return gitBlock('git restore --pathspec-from-file', command);
			const staged = read.shorts.has('S') || hasLong(read.longs, 'staged');
			const worktree = read.shorts.has('W') || hasLong(read.longs, 'worktree');
			if (staged && !worktree) return null;
			const source = read.values.get('s')?.[0] ?? read.values.get('source')?.[0];
			const rev = source?.literal === true ? source.value : '';
			return anyFolder([...read.positionals, ...read.pathspecs], dir, rev, scope) ? gitBlock('git restore of a folder', command) : null;
		}
		default:
			return null;
	}
}

// ─── OpenSpec (D7) ───────────────────────────────────────────────────────────

/** `openspec update` and `init` options that take a value (verified, `openspec init --help`, 1.3.1). */
const OPENSPEC_VALUED = new Set(['--tools', '--profile']);

/** The value that turns the owner's override on, in the guard's own environment. */
const OVERRIDE_VALUE = 'openspec';

/**
 * The arguments of an OpenSpec invocation: after `openspec` (any launcher, after D2's unwrapping), or after a
 * `node <path>/openspec.js` or `node <path>/bin/openspec` script.
 * @param command The command.
 * @param platform The platform whose path rules name the command.
 * @returns The arguments, or null when the command is not OpenSpec.
 */
function openspecArgs(command: SimpleCommand, platform: NodeJS.Platform): Word[] | null {
	const [head, ...rest] = command.words;
	if (head === undefined) return null;
	const name = commandName(head.value, platform);
	if (name === 'openspec') return rest;
	if (name !== 'node' && name !== 'nodejs') return null;
	let index = 0;
	while (index < rest.length && (rest[index]?.value ?? '').startsWith('-')) index += NODE_VALUED.has(rest[index]?.value ?? '') ? 2 : 1;
	const script = rest[index];
	if (script === undefined) return null;
	const base = (script.value.split(/[\\/]/).at(-1) ?? '').toLowerCase();
	return /^openspec(?:\.[cm]?js)?$/.test(base) ? rest.slice(index + 1) : null;
}

/**
 * The OpenSpec rule for one command (design D7): `update` and `init` are blocked when their target is inside the
 * checkout and outside its `tmp/`, or cannot be placed at all, unless the owner's override is set in the guard's own
 * environment.
 * @param command The command.
 * @param scope The guard scope.
 * @returns The block, or null.
 */
function openspecRule(command: SimpleCommand, scope: GuardScope): Block | null {
	const args = openspecArgs(command, scope.platform);
	if (args === null) return null;
	const subIndex = args.findIndex((word) => !word.value.startsWith('-'));
	const sub = args[subIndex]?.value.toLowerCase();
	if (sub !== 'update' && sub !== 'init') return null;
	if (args.some((word) => word.value === '-h' || word.value === '--help')) return null;
	const rest = args.slice(subIndex + 1);
	let target: Word | undefined;
	for (let index = 0; index < rest.length; index++) {
		const value = rest[index]?.value ?? '';
		if (value === '--') {
			target = rest[index + 1];
			break;
		}
		if (value.startsWith('-')) {
			if (OPENSPEC_VALUED.has(value)) index++;
			continue;
		}
		target = rest[index];
		break;
	}
	const { platform } = scope;
	// A Git Bash drive path (`/g/x`) names its own drive, as Git Bash would pass it (`placeWord`).
	const targetPath = target === undefined ? scope.cwd : target.literal ? placeWord(target.value, scope.cwd, platform) : null;
	const checkout = hookRoot(scope.cwd, scope.env, platform, scope.deps.exists) ?? hookRoot(targetPath, scope.env, platform, scope.deps.exists);
	// A target the guard cannot place (no cwd to resolve it from) is blocked, as `git restore .` is; a placed one is
	// blocked only inside a checkout and outside its tmp/.
	if (target?.literal !== false && targetPath !== null) {
		if (checkout === null) return null;
		if (!isInside(targetPath, checkout, platform) || isInside(targetPath, scratchPath(checkout, platform), platform)) return null;
	}
	if (scope.env.RESURSE_GUARD_ALLOW === OVERRIDE_VALUE) {
		const logRoot = checkout ?? scope.root;
		const use = `openspec ${sub} ${targetPath ?? '(unplaced target)'}`;
		if (logRoot !== null && scope.overridesLogged?.has(use) !== true) {
			scope.overridesLogged?.add(use);
			scope.deps.log(
				agentStateFile(logRoot, platform, 'guard-overrides.log'),
				clip(asciiLine(`${localIso(scope.now())} ${scope.host} override allowed ${use}`), MAX_LOG_LINE_CHARS)
			);
		}
		return null;
	}
	return { kind: 'openspec', rule: `openspec ${sub}`, match: shown(command.words) };
}

// ─── Suspicion (D4) ──────────────────────────────────────────────────────────

/** A `git` word in raw text. */
const GIT_WORD = /\bgit(?:\.exe)?\b/i;

/** The raw-text shapes that look dangerous, checked only on text that could not be read safely; `git` shapes are looked for after a `git` word. */
const SUSPICIOUS: readonly { rule: string; kind: 'git' | 'openspec'; pattern: RegExp }[] = [
	{ rule: 'git push', kind: 'git', pattern: /\bpush\b/i },
	{ rule: 'git reset --hard', kind: 'git', pattern: /\breset\b[\s\S]*?--hard\b/i },
	{ rule: 'git clean', kind: 'git', pattern: /\bclean\b/i },
	{
		rule: 'git branch -D',
		kind: 'git',
		pattern: /\bbranch\b[\s\S]*?(?:\s-[A-Za-z]*D|\s--delete\b[\s\S]*--force|\s--force\b[\s\S]*--delete|\s-[A-Za-z]*(?:d[A-Za-z]*f|f[A-Za-z]*d))/,
	},
	{
		rule: 'git checkout or restore of a folder',
		kind: 'git',
		pattern:
			/\b(?:checkout|restore)\b[^\n;|&]*?(?:\s(?:\.{1,2}[\\/]?|:[/(!^]\S*)(?=$|[\s"'`;|&)])|\s-[A-Za-z]*f\b|\s--force\b|--pathspec-from-file|[*?]|[\\/](?=$|[\s"'`;|&)]))/i,
	},
	{ rule: 'openspec update or init', kind: 'openspec', pattern: /\bopenspec\b[\s\S]*?\b(?:update|init)\b/i },
];

/** Under the `read-only` git policy, the write subcommands looked for in text that could not be read safely. */
const SUSPICIOUS_WRITE = {
	rule: 'git write',
	kind: 'git',
	pattern: /\b(?:add|am|apply|cherry-pick|clone|commit|fetch|gc|init|merge|mv|pull|rebase|reset|restore|revert|rm|stash|switch|checkout|update-index|update-ref|worktree)\b/i,
} as const;

/** An env file name in raw text. */
const ENV_MENTION = /(?:^|[\s"'`=:/\\<>|;&(),{}[\]])(\.(?:env|dev\.vars)(?:\.[\w.-]*)?)(?=$|[\s"'`/\\<>|;&(),{}[\]*])/gi;

/**
 * The raw-text suspicion check (design D4), for text that no reading completes or that holds a dynamic command:
 * a `git` word followed later by a blocked subcommand, `openspec` with `update` or `init` (unless the owner's
 * override is set), or a denied env name outside Node's `--env-file`.
 * @param text The command text.
 * @param env The guard's own environment.
 * @param orderFree Look for the subcommand anywhere, not only after the `git` word: for a git call whose subcommand
 *   is a variable set earlier in the text (`sub=push; git $sub`), and after a parser error.
 * @param gitPolicy The git policy; `read-only` also looks for any write subcommand.
 * @returns The block, or null.
 */
export function suspicion(text: string, env: Env, orderFree = false, gitPolicy: GitPolicy = 'destructive-only'): Block | null {
	const gitAt = text.search(GIT_WORD);
	for (const { rule, kind, pattern } of gitPolicy === 'read-only' ? [...SUSPICIOUS, SUSPICIOUS_WRITE] : SUSPICIOUS) {
		const git = kind === 'git';
		if (git && gitAt === -1) continue;
		if (kind === 'openspec' && env.RESURSE_GUARD_ALLOW === OVERRIDE_VALUE) continue;
		const from = git && !orderFree ? gitAt : 0;
		const match = pattern.exec(text.slice(from));
		if (match === null) continue;
		const shownFrom = git && !orderFree ? 0 : match.index;
		return { kind: 'suspicion', suspected: kind, rule, match: clip(asciiLine(text.slice(from + shownFrom, from + match.index + match[0].length)), MAX_MATCH_CHARS) };
	}
	const stripped = text.replace(/--env-file(?:-if-exists)?(?:=|\s+)\S+/gi, ' ');
	for (const match of stripped.matchAll(ENV_MENTION)) {
		const name = match[1] ?? '';
		if (name.toLowerCase() !== '.env.example') return { kind: 'suspicion', suspected: 'env', rule: 'env file', match: clip(asciiLine(name), MAX_MATCH_CHARS) };
	}
	return null;
}

// ─── The lock gate (D17) ─────────────────────────────────────────────────────

/** pnpm commands that change `node_modules` or the lockfile, with their aliases (verified, `pnpm help -a`, 10.34.6). */
const PNPM_LOCKED = new Set([
	'install',
	'i',
	'install-test',
	'it',
	'add',
	'remove',
	'rm',
	'uninstall',
	'un',
	'uni',
	'update',
	'up',
	'upgrade',
	'dedupe',
	'rebuild',
	'rb',
	'prune',
	'link',
	'ln',
	'unlink',
	'dislink',
	'import',
	'fetch',
]);

/** `astro` options that take a value. */
const ASTRO_VALUED = new Set(['--root', '--config', '--mode', '--site', '--base', '--outDir', '--host', '--port']);

/** How a fixer's command line turns fixing on and which of its words are files (verified, each tool's `--help`). */
interface Fixer {
	/** Whether a word turns fixing on. */
	fixes: (value: string) => boolean;
	/** Options that take the next word as their value. */
	valued: ReadonlySet<string>;
	/** Options that take every word up to the next option (markdownlint `--enable MD013 MD041`). */
	variadic?: ReadonlySet<string>;
	/** Values that a bare fix option may take as its next word (stylelint `--fix strict`). */
	fixModes?: ReadonlySet<string>;
}

/** The fixers whose repo-wide runs the gate refuses. */
const FIXERS = new Map<string, Fixer>([
	[
		'prettier',
		{
			fixes: (value) => value === '--write' || value === '-w',
			valued: new Set([
				'--arrow-parens',
				'--embedded-language-formatting',
				'--end-of-line',
				'--experimental-operator-position',
				'--html-whitespace-sensitivity',
				'--object-wrap',
				'--parser',
				'--print-width',
				'--prose-wrap',
				'--quote-props',
				'--tab-width',
				'--trailing-comma',
				'--config',
				'--config-precedence',
				'--find-config-path',
				'--ignore-path',
				'--plugin',
				'--cursor-offset',
				'--range-end',
				'--range-start',
				'--cache-location',
				'--cache-strategy',
				'--file-info',
				'--log-level',
				'--stdin-filepath',
			]),
		},
	],
	[
		'eslint',
		{
			fixes: (value) => value === '--fix',
			valued: new Set([
				'-c',
				'--config',
				'--ext',
				'--global',
				'--parser',
				'--plugin',
				'--rule',
				'--fix-type',
				'--ignore-pattern',
				'--stdin-filename',
				'--max-warnings',
				'-o',
				'--output-file',
				'-f',
				'--format',
				'--report-unused-disable-directives-severity',
				'--report-unused-inline-configs',
				'--cache-file',
				'--cache-location',
				'--cache-strategy',
				'--suppress-rule',
				'--suppressions-location',
				'--print-config',
				'--flag',
				'--concurrency',
			]),
		},
	],
	[
		'stylelint',
		{
			fixes: (value) => value === '--fix' || value.startsWith('--fix='),
			valued: new Set([
				'-c',
				'--config',
				'--config-basedir',
				'-i',
				'--ignore-path',
				'--ip',
				'--ignore-pattern',
				'--custom-syntax',
				'--stdin-filename',
				'--cache-location',
				'--cache-strategy',
				'-f',
				'--formatter',
				'--custom-formatter',
				'--mw',
				'--max-warnings',
				'-o',
				'--output-file',
				'--suppress-location',
				'--go',
				'--globby-options',
			]),
			fixModes: new Set(['strict', 'lax']),
		},
	],
	[
		'markdownlint',
		{
			fixes: (value) => value === '--fix' || value === '-f',
			valued: new Set(['-c', '--config', '--configPointer', '-i', '--ignore', '-o', '--output', '-p', '--ignore-path', '-r', '--rules']),
			variadic: new Set(['--enable', '--disable']),
		},
	],
]);

/** A command the gate refuses while another process holds the lock: its rule, and the checkout whose lock counts. */
interface Gated {
	rule: string;
	/** The checkout root, or null when the command runs outside any checkout. */
	root: string | null;
}

/**
 * The positional words of a command's arguments, skipping options and the values of valued ones.
 * @param args The words after the command name.
 * @param valued The options that take the next word as their value.
 * @returns The positionals.
 */
function positionals(args: readonly Word[], valued: ReadonlySet<string>): Word[] {
	const found: Word[] = [];
	for (let index = 0; index < args.length; index++) {
		const word = args[index] as Word;
		if (word.value === '--') return [...found, ...args.slice(index + 1)];
		if (word.value.startsWith('-') && word.value !== '-') {
			if (valued.has(word.value)) index++;
			continue;
		}
		found.push(word);
	}
	return found;
}

/**
 * Whether a fixer's run is repo-wide: it fixes, and it names no path, `.`, a folder, a glob or a word that expands.
 * @param fixer How the fixer reads its arguments.
 * @param args The words after the fixer's name.
 * @param scope The guard scope, for the folder check.
 * @returns True for a repo-wide fix.
 */
function repoWideFix(fixer: Fixer, args: readonly Word[], scope: GuardScope): boolean {
	let fixes = false;
	const targets: Word[] = [];
	for (let index = 0; index < args.length; index++) {
		const word = args[index] as Word;
		const { value } = word;
		if (value === '--') {
			targets.push(...args.slice(index + 1));
			break;
		}
		if (!value.startsWith('-') || value === '-') {
			targets.push(word);
			continue;
		}
		if (fixer.fixes(value)) {
			fixes = true;
			if (fixer.fixModes?.has(args[index + 1]?.value ?? '') === true) index++;
		} else if (fixer.valued.has(value)) index++;
		else if (fixer.variadic?.has(value) === true) {
			while (index + 1 < args.length && !(args[index + 1]?.value ?? '-').startsWith('-')) index++;
		}
	}
	if (!fixes) return false;
	if (targets.length === 0) return true;
	const path = pathFor(scope.platform);
	return targets.some(({ value, literal }) => {
		if (!literal || /[*?[\]{}]/.test(value) || value === '.' || value === './' || value === '.\\') return true;
		const base = scope.cwd ?? scope.root;
		return base !== null && scope.deps.stat(path.resolve(base, value)) === 'dir';
	});
}

/** The commands that move the working folder of the commands after them. */
const CD_COMMANDS = new Set(['cd', 'chdir', 'pushd', 'set-location', 'sl', 'push-location']);

/**
 * Where a `cd`-like command moves the commands after it.
 * @param command The command.
 * @param cwd The folder it runs in, or null when unknown.
 * @param platform The platform whose path rules apply.
 * @returns The folder; null when it cannot be read (`cd "$dir"`, `cd -`, a bare `cd`); undefined for any other command.
 */
function movedTo(command: SimpleCommand, cwd: string | null, platform: NodeJS.Platform): string | null | undefined {
	const [head, ...args] = command.words;
	if (head === undefined || !head.literal || !CD_COMMANDS.has(commandName(head.value, platform))) return undefined;
	const target = args.filter((word) => !word.value.startsWith('-') || word.value === '-').at(-1);
	if (target === undefined || !target.literal || target.value === '-' || target.value.startsWith('~')) return null;
	return placeWord(target.value, cwd, platform);
}

/**
 * The checkout a pnpm builtin works on: its `-C`/`--dir` folder's checkout, or the scope's.
 * @param args The words after `pnpm`.
 * @param scope The guard scope.
 * @returns The root, or null when the folder is in no checkout.
 */
function pnpmRoot(args: readonly Word[], scope: GuardScope): string | null {
	let dir: Word | undefined;
	for (const [index, word] of args.entries()) {
		if (word.value === '-C' || word.value === '--dir') dir = args[index + 1];
		else if (word.value.startsWith('--dir=')) dir = { ...word, value: word.value.slice('--dir='.length) };
	}
	if (dir === undefined || !dir.literal) return scope.root;
	return hookRoot(placeWord(dir.value, scope.cwd ?? scope.root, scope.platform), scope.env, scope.platform, scope.deps.exists);
}

/**
 * Whether the lock gate judges a command (design D17), after the parser unwrapped its runners (`pnpm exec`, `pnpm
 * dlx`, `npx`, `pnpm <bin>`), and for which checkout. A `--help` or `-h` anywhere passes.
 * @param command The command.
 * @param scope The guard scope.
 * @returns The rule and the root, or null when the gate lets it pass whoever holds the lock.
 */
function gatedCommand(command: SimpleCommand, scope: GuardScope): Gated | null {
	const [head, ...args] = command.words;
	if (head === undefined || !head.literal) return null;
	if (args.some((word) => word.value === '--help' || word.value === '-h')) return null;
	const name = commandName(head.value, scope.platform);
	if (name === 'pnpm') {
		const sub = positionals(args, PNPM_GLOBAL_VALUED)[0]?.value.toLowerCase();
		if (sub === undefined || !PNPM_LOCKED.has(sub)) return null;
		if (sub === 'dedupe' && args.some((word) => word.value === '--check')) return null;
		return { rule: `pnpm ${sub}`, root: pnpmRoot(args, scope) };
	}
	if (name === 'astro') return positionals(args, ASTRO_VALUED)[0]?.value === 'build' ? { rule: 'astro build', root: scope.root } : null;
	if (name === 'playwright') return positionals(args, new Set())[0]?.value === 'test' ? { rule: 'playwright test', root: scope.root } : null;
	if (name === 'serve') return args.some((word) => /^(?:\.[\\/])?dist(?:[\\/]|$)/i.test(word.value)) ? { rule: 'serve dist', root: scope.root } : null;
	if (name === 'node' || name === 'nodejs') {
		const script = positionals(args, NODE_VALUED)[0];
		if (script === undefined || !/^sync-harness\.[cm]?[jt]s$/i.test(script.value.split(/[\\/]/).at(-1) ?? '')) return null;
		return args.some((word) => word.value === '--check' || word.value === '--diff') ? null : { rule: 'node scripts/sync-harness.ts', root: scope.root };
	}
	const fixer = FIXERS.get(name);
	return fixer !== undefined && repoWideFix(fixer, args, scope) ? { rule: `${name} fixing a folder`, root: scope.root } : null;
}

/**
 * Build the lock gate of design D17: it blocks a gated command while a process other than the caller's own run holds
 * the lock of the command's checkout, and names the holder. The holder is read once per checkout and call, only for
 * a gated command; a free lock, the caller's own token (`RESURSE_CHECKOUT_LOCK` in the guard's environment) or any
 * error in the check allows.
 * @param readHolder Reads a checkout's holder: {@link readHolderSync}, or a fake in tests.
 * @returns The gate.
 */
export function makeLockGate(readHolder: (root: string, platform: NodeJS.Platform) => Holder | null = readHolderSync): GuardDeps['lockGate'] {
	return (commands, scope) => {
		try {
			const holders = new Map<string, Holder | null>();
			const { platform } = scope;
			// A literal cd moves the commands after it, at its depth or deeper, in the same reading of the line.
			let moved: { cwd: string; root: string | null; depth: number; dialect: string } | null = null;
			for (const command of commands) {
				if (moved !== null && (command.depth < moved.depth || command.dialect !== moved.dialect)) moved = null;
				const to = movedTo(command, moved?.cwd ?? scope.cwd ?? scope.root, platform);
				if (to !== undefined) {
					moved = to === null ? null : { cwd: to, root: hookRoot(to, scope.env, platform, scope.deps.exists), depth: command.depth, dialect: command.dialect };
					continue;
				}
				const gated = gatedCommand(command, moved === null ? scope : { ...scope, cwd: moved.cwd, root: moved.root });
				if (gated === null || gated.root === null) continue;
				if (!holders.has(gated.root)) holders.set(gated.root, readHolder(gated.root, scope.platform));
				const holder = holders.get(gated.root) ?? null;
				if (holder === null || holder.token === scope.env[TOKEN_VARIABLE]) continue;
				return { kind: 'lock', rule: gated.rule, match: shown(command.words), why: `${describeHolder(holder, scope.now())}.` };
			}
		} catch {
			// Design D17: any error in the check allows.
		}
		return null;
	};
}

// ─── Judging a call ──────────────────────────────────────────────────────────

/**
 * Give a scope its per-call state: a git probe that asks git once per folder and spec, the specs it does not know yet
 * in one batch, and a fresh set of logged override uses.
 * @param scope The scope.
 * @returns A copy for one tool call.
 */
function perCall(scope: GuardScope): GuardScope {
	const cache = new Map<string, string | null>();
	const probe = scope.deps.gitProbe;
	const cached = fromBatch((dir, specs) => {
		const key = (spec: string): string => JSON.stringify([dir, spec]);
		const unasked = [...new Set(specs)].filter((spec) => !cache.has(key(spec)));
		if (unasked.length > 0) {
			const answers = probeAll(probe, dir, unasked);
			for (const [index, spec] of unasked.entries()) cache.set(key(spec), answers[index] ?? null);
		}
		return specs.map((spec) => cache.get(key(spec)) ?? null);
	});
	return { ...scope, deps: { ...scope.deps, gitProbe: cached }, overridesLogged: new Set() };
}

/**
 * Whether a command is a git call whose subcommand cannot be read (`git $sub`).
 * @param command The command.
 * @param platform The platform whose path rules name the command.
 * @returns True for a dynamic git subcommand.
 */
function dynamicGit(command: SimpleCommand, platform: NodeJS.Platform): boolean {
	const head = command.words[0];
	return head !== undefined && commandName(head.value, platform) === 'git' && readGitCall(command.words).dynamic;
}

/**
 * Apply every rule to one command.
 * @param command The command.
 * @param next The command after it in the same reading.
 * @param scope The guard scope.
 * @param depth How deep in git alias bodies this is.
 * @returns The block, or null.
 */
function checkCommand(command: SimpleCommand, next: SimpleCommand | undefined, scope: GuardScope, depth: number): Block | null {
	const env = envRule(command, next, scope.platform);
	if (env !== null) return env;
	const head = command.words[0];
	if (head !== undefined && commandName(head.value, scope.platform) === 'git') {
		const git = gitRule(command, scope, depth);
		if (git !== null) return git;
	}
	return openspecRule(command, scope);
}

/**
 * Judge a shell command (design D2-D4, D7, D8): every rule on every command that either reading found, then the
 * lock gate, then the suspicion check when no reading is complete or a command is dynamic.
 * @param text The command text.
 * @param scope Where it runs, and the guard's dependencies.
 * @param depth How deep in git alias bodies this is; 0 for a tool call.
 * @returns The block, or null when the command may run.
 */
export function checkShell(text: string, scope: GuardScope, depth = 0): Block | null {
	const guarded = depth === 0 ? perCall(scope) : scope;
	const parsed = guarded.deps.parse(text, { platform: guarded.platform });
	const seen = new Set<string>();
	for (const reading of parsed.readings) {
		for (const [index, command] of reading.commands.entries()) {
			const next = reading.commands[index + 1];
			const key = JSON.stringify([command.words, command.redirects, next?.piped === true]);
			if (seen.has(key)) continue;
			seen.add(key);
			const block = checkCommand(command, next, guarded, depth);
			if (block !== null) return block;
		}
	}
	const patch = text.includes('*** ') ? patchHit(text) : null;
	if (patch !== null) return envBlock(patch);
	const lock = guarded.deps.lockGate(parsed.commands, guarded);
	if (lock !== null) return lock;
	if (parsed.complete && !parsed.dynamic) return null;
	return suspicion(
		text,
		guarded.env,
		parsed.commands.some((command) => dynamicGit(command, guarded.platform)),
		guarded.deps.gitPolicy
	);
}

/** The second line of each rule's message. */
const WHY: Record<RuleSet, string> = {
	git: 'AGENTS.md, Never 1: the owner makes every git write.',
	openspec: "it rewrites this checkout's tool trees; see docs/agent/harness-sync.md.",
	env: 'AGENTS.md, Never 3: never read, print or copy the values in env files.',
	lock: "another process holds this checkout's lock.",
};

/**
 * Build the three-line block message (design D5): what was blocked, why, and the safe path, in ASCII and at most
 * 600 characters, naming `docs/agent/guardrails.md`.
 * @param block The block.
 * @param root The checkout root, for the absolute `<root>/tmp/<task>/` path, or null.
 * @param platform The platform whose path rules build that path.
 * @returns The message.
 */
export function blockMessage(block: Block, root: string | null, platform: NodeJS.Platform): string {
	const kind = block.kind === 'suspicion' ? (block.suspected ?? 'env') : block.kind;
	const task = root === null ? '<root>/tmp/<task>/' : `${scratchPath(root, platform, '<task>')}${platform === 'win32' ? '\\' : '/'}`;
	const instead: Record<RuleSet, string> = {
		git: `give the owner the exact command to run; read-only git still works; a destructive step in a throwaway repo goes in a script under ${task}.`,
		openspec: 'ask the owner to run it in their own terminal, following the upgrade procedure in docs/agent/harness-sync.md.',
		env: 'read .env.example for the key names.',
		lock: 'wait for it to finish and run your command again, or ask the owner for a worktree; never stop a process you did not start.',
	};
	const what = block.kind === 'suspicion' ? `${block.rule}, and the command could not be read safely` : block.rule;
	const advice = block.kind === 'suspicion' ? `rephrase it as a plain command, or ${instead[kind]}` : instead[kind];
	const lines = [
		`resurse guard blocked: ${what} (${clip(block.match, MAX_MATCH_CHARS)})`,
		`Why: ${block.why ?? WHY[kind]}`,
		`Do instead: ${advice} See docs/agent/guardrails.md.`,
	];
	return lines.map(asciiLine).join('\n');
}

/**
 * Judge one tool call: a shell command with {@link checkShell}, any other tool with {@link checkFileTool}.
 * @param context The hook's context.
 * @param deps The guard's dependencies.
 * @returns The decision; an allow with a note when a shell tool sent no command.
 */
export function judgeCall(context: HookContext, deps: GuardDeps): Decision {
	const { call } = context;
	let block: Block | null;
	if (call.shell) {
		if (call.command === null) return call.toolName.toLowerCase() === 'monitor' ? { allow: true } : { allow: true, note: 'payload has no command; allowed' };
		block = checkShell(call.command, { platform: context.platform, env: context.env, cwd: context.cwd, root: context.root, host: context.host, now: context.now, deps });
	} else {
		block = checkFileTool(call.input);
	}
	return block === null ? { allow: true } : { allow: false, message: blockMessage(block, context.root, context.platform) };
}

/**
 * The guard's handlers for `safeMain` and `runHook`.
 * @param overrides Dependencies to replace, for tests.
 * @returns The judgement and the suspicion check.
 */
export function guardHandlers(overrides: Partial<GuardDeps> = {}): HookHandlers {
	return {
		judge: (context) => judgeCall(context, { ...defaultGuardDeps(context.env), ...overrides }),
		suspicion: (text, context) => {
			const block = suspicion(text, context.env, true, overrides.gitPolicy ?? defaultGuardDeps(context.env).gitPolicy);
			return block === null ? null : blockMessage(block, context.root, context.platform);
		},
	};
}

/**
 * The guard's whole entry point: read the payload, judge the call, print the host's output and exit 0 or 2.
 * @param argv The hook command's arguments, the host hint first.
 * @returns Never: the process exits.
 */
export function guardMain(argv: readonly string[] = process.argv.slice(2)): Promise<never> {
	return safeMain(guardHandlers(), argv);
}

if (import.meta.main) {
	await guardMain();
}
