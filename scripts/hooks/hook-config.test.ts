import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// The committed hook files of the agent tools other than Claude Code (OpenSpec change harness-h1b). Each command must
// name a script that exists and the host hint the guard expects, and the guard launchers must deny a git write in the
// host's own output format when run through the platform shell, as the tool runs them.

const repoRoot = resolve(import.meta.dirname, '..', '..');

/** A command handler as the hook files write it. */
interface Handler {
	type?: string;
	command: string;
	timeout?: number;
}

/**
 * Every command handler in a parsed hook file, wherever it sits.
 * @param node The parsed JSON.
 * @returns The handlers.
 */
function handlers(node: unknown): Handler[] {
	if (Array.isArray(node)) return node.flatMap(handlers);
	if (typeof node !== 'object' || node === null) return [];
	const record = node as Record<string, unknown>;
	if (typeof record['command'] === 'string') return [record as unknown as Handler];
	return Object.values(record).flatMap(handlers);
}

/**
 * Read a committed hook file.
 * @param path The path from the repository root.
 * @returns Its handlers.
 */
function read(path: string): Handler[] {
	return handlers(JSON.parse(readFileSync(join(repoRoot, path), 'utf-8')));
}

/** The `node -e` launcher's code, and the script and arguments it is given. */
const LAUNCHER = /^node -e "(.*)" ([a-z -]+)$/;

/** The files with launchers, and the host each must name. */
const LAUNCHED: [string, string][] = [
	['.codex/hooks.json', 'codex'],
	['.agents/hooks.json', 'antigravity'],
];

describe('the launcher hook files', () => {
	it.each(LAUNCHED)('%s: every command is a launcher for an existing script, given the host %s', (path, host) => {
		const found = read(path);
		expect(found.length).toBeGreaterThan(0);
		for (const handler of found) {
			const match = LAUNCHER.exec(handler.command);
			expect(match, handler.command).not.toBeNull();
			const [, code = '', args = ''] = match ?? [];
			expect(args).toBe(host);
			// Codex and Antigravity run the command through cmd.exe on Windows and sh elsewhere: none of these may appear.
			expect(code).not.toMatch(/["$%!^`\\]/);
			const script = /p\.join\(d,'scripts','hooks','([\w.-]+)'\)/.exec(code)?.[1] ?? '';
			expect(existsSync(join(repoRoot, 'scripts', 'hooks', script)), script).toBe(true);
			expect(handler.timeout).toBeGreaterThan(0);
		}
	});

	it('Grok: every command runs an existing script from the workspace root, given the host grok', () => {
		const found = read('.grok/hooks/guards.json');
		expect(found.length).toBeGreaterThan(0);
		for (const handler of found) {
			const match = /^node "\$\{GROK_WORKSPACE_ROOT\}\/(scripts\/hooks\/[\w.-]+)" grok$/.exec(handler.command);
			expect(match, handler.command).not.toBeNull();
			expect(existsSync(join(repoRoot, match?.[1] ?? '')), match?.[1]).toBe(true);
		}
	});
});

describe('the guard launchers, run as the tools run them', () => {
	const shell = process.platform === 'win32' ? (process.env['ComSpec'] ?? 'cmd.exe') : '/bin/sh';

	/**
	 * Run a launcher with a payload, from the repository root.
	 * @param command The hook command.
	 * @param payload The payload.
	 * @returns The exit code and stdout.
	 */
	function run(command: string, payload: unknown): { status: number | null; stdout: string } {
		const result = spawnSync(command, { shell, cwd: repoRoot, input: JSON.stringify(payload), encoding: 'utf-8', timeout: 20_000 });
		return { status: result.status, stdout: result.stdout };
	}

	const guardOf = (path: string): string => read(path).find((handler) => handler.command.includes("'guard.ts'"))?.command ?? '';

	it('Codex: a git write is denied with exit 0 and the permission decision, a read passes silently', () => {
		const base = {
			session_id: 's',
			turn_id: 't',
			tool_use_id: 'u',
			cwd: repoRoot,
			model: 'm',
			permission_mode: 'default',
			transcript_path: null,
			hook_event_name: 'PreToolUse',
			tool_name: 'Bash',
		};
		const denied = run(guardOf('.codex/hooks.json'), { ...base, tool_input: { command: 'git push' } });
		expect(denied.status).toBe(0);
		const output = JSON.parse(denied.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
		expect(output.hookSpecificOutput.permissionDecision).toBe('deny');
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain('resurse guard blocked: git push');
		expect(run(guardOf('.codex/hooks.json'), { ...base, tool_input: { command: 'git status' } })).toEqual({ status: 0, stdout: '' });
	});

	// The documented shape: `toolCall` with the tool's `name` and `args` (Antigravity hooks page, read 2026-11-14).
	const antigravity = (name: string, args: Record<string, unknown>): unknown => ({ conversationId: 'c', workspacePaths: [repoRoot], stepIdx: 1, toolCall: { name, args } });

	it('Antigravity: a git write is denied with the decision JSON', () => {
		const denied = run(guardOf('.agents/hooks.json'), antigravity('run_command', { CommandLine: 'git push', Cwd: repoRoot }));
		expect(denied.status).toBe(0);
		expect(JSON.parse(denied.stdout)).toMatchObject({ decision: 'deny' });
	});

	// The guard judges every tool that is not a shell by its arguments, whatever its name; the names here are the
	// tools that carry each shape.
	it.each([
		['grep_search', { SearchPath: join(repoRoot, 'tmp', '.env.probe'), Query: 'PROBE' }],
		['create_file', { path: 'tmp/.env.probe2', content: 'A=1' }],
		['view_file', { AbsolutePath: pathToFileURL(join(repoRoot, 'tmp', '.env.probe')).href }],
	])('Antigravity: a %s call that names an env file is denied with the decision JSON', (name, args) => {
		const denied = run(guardOf('.agents/hooks.json'), antigravity(name, args));
		expect(denied.status).toBe(0);
		expect(JSON.parse(denied.stdout)).toMatchObject({ decision: 'deny' });
	});

	it('Antigravity: a search for the text of an env file name runs', () => {
		expect(run(guardOf('.agents/hooks.json'), antigravity('grep_search', { SearchPath: join(repoRoot, 'src'), Query: '.env.local' }))).toEqual({ status: 0, stdout: '' });
	});
});

// Antigravity's tool names, read 2026-11-20: its hooks page names run_command, view_file, write_to_file,
// replace_file_content, multi_replace_file_content and grep_search; read_file and write_file are its permission rule
// names, kept in case a hook ever receives them; its SDK says create_file, edit_file, find_file and search_directory.
// find_file only lists names, but `.*file.*` sends it to the guard too, which denies a pattern naming an env file.
// Whether Antigravity anchors the matcher is not documented, so each name is tried both ways (owner decision Q1 A,
// 2026-11-20).
const GUARDED_TOOLS = [
	'run_command',
	'view_file',
	'read_file',
	'write_file',
	'create_file',
	'edit_file',
	'find_file',
	'write_to_file',
	'replace_file_content',
	'multi_replace_file_content',
	'grep_search',
	'search_directory',
];
const UNGUARDED_TOOLS = ['search_web', 'ask_question', 'generate_image', 'read_url_content', 'invoke_subagent'];

describe('the Antigravity matcher', () => {
	const file = JSON.parse(readFileSync(join(repoRoot, '.agents', 'hooks.json'), 'utf-8')) as { 'resurse-guards': { PreToolUse: { matcher: string }[] } };
	const matcher = file['resurse-guards'].PreToolUse[0]?.matcher ?? '';
	const matches = (name: string): boolean[] => [new RegExp(`^(?:${matcher})$`).test(name), new RegExp(matcher).test(name)];

	it.each(GUARDED_TOOLS)('sends %s to the guard, anchored or not', (name) => {
		expect(matches(name)).toEqual([true, true]);
	});

	it.each(UNGUARDED_TOOLS)('leaves %s to the tool, anchored or not', (name) => {
		expect(matches(name)).toEqual([false, false]);
	});
});
