import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

	it('Antigravity: a git write is denied with the decision JSON', () => {
		// The documented shape: `toolCall` with the tool's `name` and `args` (Antigravity hooks page, read 2026-11-14).
		const payload = { conversationId: 'c', workspacePaths: [repoRoot], stepIdx: 1, toolCall: { name: 'run_command', args: { CommandLine: 'git push', Cwd: repoRoot } } };
		const denied = run(guardOf('.agents/hooks.json'), payload);
		expect(denied.status).toBe(0);
		expect(JSON.parse(denied.stdout)).toMatchObject({ decision: 'deny' });
	});
});
