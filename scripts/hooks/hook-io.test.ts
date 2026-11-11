import {
	CURSOR_ALLOW_OUTPUT,
	type HookInput,
	agentStateFile,
	appendCapped,
	asObject,
	cleanStdin,
	detectHost,
	errorCode,
	errorLine,
	firstString,
	hookRoot,
	hostActs,
	jsonOutput,
	localIso,
	nonEmptyString,
	parseHint,
	parsePayload,
	patchHeaders,
	readHookCall,
	readStdin,
	readToolCall,
	renderOutput,
	runHook,
	walkStart,
} from './hook-io.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { makeScratchDir, removeScratchDir } from '../lib/scratch-git.ts';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';

// Hook input and output (OpenSpec change harness-guardrails, design D1, D4, D5). Pure cases inject the platform and
// the existence check; the log cases write under the repo's tmp/.

describe('hosts (D1)', () => {
	it('reads the hint, defaulting to claude', () => {
		expect(parseHint('cursor')).toBe('cursor');
		expect(parseHint('GROK')).toBe('grok');
		expect(parseHint(undefined)).toBe('claude');
		expect(parseHint('nonsense')).toBe('claude');
	});

	it('corrects the hint from the environment and the payload shape', () => {
		const claudePayload = { session_id: 's', tool_name: 'Bash', tool_input: { command: 'x' } };
		expect(detectHost('claude', {}, claudePayload)).toBe('claude');
		expect(detectHost('claude', { GROK_HOOK_EVENT: 'PreToolUse' }, claudePayload)).toBe('grok');
		expect(detectHost('claude', {}, { toolName: 'Bash', toolInput: {} })).toBe('grok');
		expect(detectHost('claude', { CURSOR_VERSION: '3.24.9' }, { conversation_id: 'k', tool_name: 'Shell', tool_input: {} })).toBe('cursor');
		expect(detectHost('claude', { CURSOR_VERSION: '3.24.9' }, claudePayload)).toBe('claude');
		expect(detectHost('claude', {}, { sessionId: 'p', toolName: 'bash', toolArgs: '{}' })).toBe('copilot');
		expect(detectHost('cursor', {}, { command: 'x' })).toBe('cursor');
		expect(detectHost('cursor', { GROK_HOOK_EVENT: 'PreToolUse' }, { command: 'x' })).toBe('grok');
		expect(detectHost('codex', { GROK_HOOK_EVENT: 'x' }, claudePayload)).toBe('codex');
		expect(detectHost('antigravity', {}, { toolCall: {} })).toBe('antigravity');
	});

	it('acts only for the host the entry belongs to; the Claude file also serves Copilot', () => {
		expect(hostActs('claude', 'claude')).toBe(true);
		expect(hostActs('claude', 'copilot')).toBe(true);
		expect(hostActs('claude', 'cursor')).toBe(false);
		expect(hostActs('claude', 'grok')).toBe(false);
		expect(hostActs('cursor', 'grok')).toBe(false);
		expect(hostActs('grok', 'grok')).toBe(true);
	});
});

describe('readToolCall', () => {
	it("reads every host's shape", () => {
		expect(readToolCall('claude', { cwd: '/r', tool_name: 'Bash', tool_input: { command: 'git status' } })).toMatchObject({ shell: true, command: 'git status', cwd: '/r' });
		expect(readToolCall('codex', { cwd: '/r', tool_name: 'Bash', tool_input: { command: ['bash', '-lc', 'git push origin'] } }).command).toBe("bash -lc 'git push origin'");
		expect(readToolCall('cursor', { command: 'ls', workspace_roots: ['/w'] })).toMatchObject({ shell: true, command: 'ls', cwd: '/w' });
		expect(readToolCall('grok', { workspaceRoot: '/g', toolName: 'run_terminal_command', toolInput: { command: 'ls' } })).toMatchObject({
			shell: true,
			command: 'ls',
			cwd: '/g',
		});
		expect(readToolCall('grok', { toolName: 'read_file', toolInput: { target_file: 'a' } })).toMatchObject({ shell: false, command: null });
		expect(readToolCall('antigravity', { workspacePaths: ['/a'], toolCall: { name: 'run_command', args: { CommandLine: 'ls', Cwd: '/c' } } })).toMatchObject({
			shell: true,
			command: 'ls',
			cwd: '/c',
		});
		expect(readToolCall('copilot', { cwd: '/p', toolName: 'powershell', toolArgs: '{"command":"Get-Date"}' })).toMatchObject({ shell: true, command: 'Get-Date' });
		expect(readToolCall('claude', { tool_name: 'Monitor', tool_input: { ws: 'wss://x' } })).toMatchObject({ shell: true, command: null });
		expect(readToolCall('claude', { tool_name: 'Read', tool_input: { file_path: 'a' } })).toMatchObject({ shell: false });
	});

	it('narrows objects and strings, and reads error codes', () => {
		expect(asObject({ a: 1 })).toEqual({ a: 1 });
		expect(asObject([1])).toEqual({});
		expect(nonEmptyString('a')).toBe('a');
		expect(nonEmptyString('')).toBeNull();
		expect(nonEmptyString(['a'])).toBeNull();
		expect(firstString(['a', 'b'])).toBe('a');
		expect(firstString([''])).toBeNull();
		expect(errorCode(Object.assign(new Error('x'), { code: 'EBUSY' }))).toBe('EBUSY');
		expect(errorCode(new Error('x'))).toBe('');
		expect(errorCode(null, 'UNKNOWN')).toBe('UNKNOWN');
	});

	it("reads a Codex patch's headers with their verbs", () => {
		const patch = '*** Begin Patch\n*** Add File: docs/a.md\n+x\n*** Update File: b.ts\n*** Move to: c.ts\n*** Delete File: d.ts \n*** End Patch';
		expect(patchHeaders(patch)).toEqual([
			{ verb: 'Add File', path: 'docs/a.md' },
			{ verb: 'Update File', path: 'b.ts' },
			{ verb: 'Move to', path: 'c.ts' },
			{ verb: 'Delete File', path: 'd.ts' },
		]);
		expect(patchHeaders('no headers')).toEqual([]);
	});
});

describe('readHookCall (D1)', () => {
	const exists = (path: string): boolean => path === 'G:\\repo\\.git';
	const input = (hint: string, stdin: string | null, env: HookInput['env'] = {}): HookInput => ({ hint, stdin, env, platform: 'win32', exists });

	it('says why it skips: an open stdin, a payload that is not an object, or a host the entry does not act for', () => {
		expect(readHookCall(input('claude', null))).toEqual({ ok: false, reason: 'stdin', host: 'claude' });
		expect(readHookCall(input('cursor', 'nope'))).toEqual({ ok: false, reason: 'payload', host: 'cursor' });
		expect(readHookCall(input('claude', '{"session_id":"s"}', { GROK_HOOK_EVENT: 'PostToolUse' }))).toEqual({ ok: false, reason: 'host', host: 'grok' });
	});

	it('reads the payload, the call, its folder and the checkout root above it', () => {
		const payload = { session_id: 's', cwd: 'G:\\repo\\scripts', tool_name: 'Bash', tool_input: { command: 'ls' } };
		const read = readHookCall(input('claude', `${String.fromCharCode(0xfeff)}${JSON.stringify(payload)}\r\n`));
		expect(read).toMatchObject({
			ok: true,
			host: 'claude',
			payload,
			cwd: 'G:\\repo\\scripts',
			root: 'G:\\repo',
			raw: JSON.stringify(payload),
			call: { shell: true, command: 'ls' },
		});
		expect(readHookCall(input('claude', JSON.stringify({ ...payload, cwd: 'G:\\elsewhere' })))).toMatchObject({ ok: true, root: null });
	});
});

describe('roots and scratch paths (D1)', () => {
	const exists = (path: string): boolean => path === 'G:\\repo\\.git';

	it('starts from the payload cwd, then a project-folder variable, never the process folder', () => {
		expect(walkStart('G:\\repo\\scripts', { CLAUDE_PROJECT_DIR: 'G:\\other' }, 'win32')).toBe('G:\\repo\\scripts');
		expect(walkStart(null, { GROK_WORKSPACE_ROOT: 'G:\\repo' }, 'win32')).toBe('G:\\repo');
		expect(walkStart('relative', {}, 'win32')).toBeNull();
		expect(walkStart(null, {}, 'win32')).toBeNull();
	});

	it('finds the root above a subfolder, and builds every state path under <root>/tmp/agent-state/', () => {
		const root = hookRoot('G:\\repo\\scripts', {}, 'win32', exists);
		expect(root).toBe('G:\\repo');
		expect(agentStateFile(root as string, 'win32', 'hook-errors.log')).toBe('G:\\repo\\tmp\\agent-state\\hook-errors.log');
		expect(agentStateFile(root as string, 'win32', 'sessions', 'k.json')).toBe('G:\\repo\\tmp\\agent-state\\sessions\\k.json');
		expect(agentStateFile(root as string, 'win32')).toBe('G:\\repo\\tmp\\agent-state');
		expect(hookRoot('G:\\elsewhere', {}, 'win32', exists)).toBeNull();
		expect(hookRoot('G:\\repo\\tmp\\x', { GIT_CEILING_DIRECTORIES: 'G:\\repo\\tmp' }, 'win32', exists)).toBeNull();
		expect(hookRoot(null, {}, 'win32', exists)).toBeNull();
	});
});

describe('output per host (D5)', () => {
	const deny = { allow: false as const, message: 'resurse guard blocked: git push (git push)' };

	it('allows without a decision, Cursor with its provisional form', () => {
		for (const host of ['claude', 'codex', 'grok', 'copilot', 'antigravity'] as const) {
			expect(renderOutput(host, { allow: true })).toEqual({ stdout: '', stderr: '', exitCode: 0 });
		}
		expect(renderOutput('cursor', { allow: true })).toEqual({ stdout: `${CURSOR_ALLOW_OUTPUT}\n`, stderr: '', exitCode: 0 });
	});

	it('denies Claude Code and Copilot with exit 2 and stderr, which no shell sits between', () => {
		for (const host of ['claude', 'copilot'] as const) expect(renderOutput(host, deny)).toEqual({ stdout: '', stderr: `${deny.message}\n`, exitCode: 2 });
	});

	it('denies Cursor and Codex with exit 0 and their JSON, because PowerShell turns an exit 2 into 1, which they run', () => {
		const cursor = renderOutput('cursor', deny);
		expect(cursor.exitCode).toBe(0);
		expect(JSON.parse(cursor.stdout)).toEqual({ permission: 'deny', user_message: deny.message, agent_message: deny.message });
		const codex = renderOutput('codex', deny);
		expect(codex.exitCode).toBe(0);
		expect(JSON.parse(codex.stdout)).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: deny.message } });
	});

	it('denies Grok with exit 2 and also its JSON, which it honours whatever the exit code', () => {
		const grok = renderOutput('grok', deny);
		expect(grok.exitCode).toBe(2);
		expect(grok.stderr).toBe(`${deny.message}\n`);
		expect(JSON.parse(grok.stdout)).toEqual({ decision: 'deny', reason: deny.message });
	});

	it('denies Antigravity with its JSON and exit 0', () => {
		const antigravity = renderOutput('antigravity', deny);
		expect(antigravity.exitCode).toBe(0);
		expect(JSON.parse(antigravity.stdout)).toEqual({ decision: 'deny', reason: deny.message });
	});

	it('caps the message at 600 characters', () => {
		expect(renderOutput('claude', { allow: false, message: 'x'.repeat(900) }).stderr.trimEnd()).toHaveLength(600);
	});

	it('prints one JSON object with its exit code', () => {
		expect(jsonOutput({ a: 1 })).toEqual({ stdout: '{"a":1}\n', stderr: '', exitCode: 0 });
		expect(jsonOutput({}, 2).exitCode).toBe(2);
	});
});

describe('stdin (D4)', () => {
	it('strips a BOM and CRLF and parses only JSON objects', () => {
		expect(cleanStdin(`${String.fromCharCode(0xfeff)}{"a":1}\r\n`)).toBe('{"a":1}');
		expect(parsePayload('{"a":1}')).toEqual({ a: 1 });
		expect(parsePayload('[1]')).toBeNull();
		expect(parsePayload('not json')).toBeNull();
	});

	it('reads to the end, or gives up after the timeout', async () => {
		const ended = new PassThrough();
		const reading = readStdin(ended, 500);
		ended.end('{"x":1}');
		expect(await reading).toBe('{"x":1}');
		const open = new PassThrough();
		const started = Date.now();
		expect(await readStdin(open, 100)).toBeNull();
		expect(Date.now() - started).toBeGreaterThanOrEqual(90);
	});
});

describe('the error log (D4)', () => {
	let scratch = '';

	beforeAll(() => {
		scratch = makeScratchDir('hook-io-');
		mkdirSync(join(scratch, 'repo', '.git'), { recursive: true });
	});

	afterAll(() => {
		removeScratchDir(scratch);
	});

	it('formats one short ASCII line with a local offset, and blanks quoted text', () => {
		expect(localIso(new Date(2026, 9, 25, 9, 5, 7))).toMatch(/^2026-10-25T09:05:07[+-]\d\d:\d\d$/);
		const line = errorLine(new Date(2026, 9, 25), 'claude', new TypeError(`bad 'git push --force' value ${'z'.repeat(400)}\nsecond`));
		expect(line).toMatch(/^2026-10-25T00:00:00[+-]\d\d:\d\d claude TypeError: bad '\.\.\.' value z+\.\.\.$/);
		expect(line.length).toBeLessThanOrEqual(200);
		expect(line).not.toContain('git push');
		expect(errorLine(new Date(2026, 9, 25), 'claude', new Error("boom 'x'"), 'state record')).toMatch(/ claude state record Error: boom '\.\.\.'$/);
	});

	it('appends under the cap and stops at it', () => {
		const file = join(scratch, 'logs', 'x.log');
		expect(appendCapped(file, 'one', 8)).toBe(true);
		expect(appendCapped(file, 'two', 8)).toBe(true);
		expect(appendCapped(file, 'three', 8)).toBe(false);
		expect(readFileSync(file, 'utf8')).toBe('one\ntwo\n');
	});

	it('runHook allows and logs on an open stdin or a bad payload, and writes nothing without a root', () => {
		const handlers = {
			judge: (): never => {
				throw new Error('unreachable');
			},
			suspicion: (): null => null,
		};
		const env = { CLAUDE_PROJECT_DIR: join(scratch, 'repo') };
		expect(runHook({ hint: 'claude', stdin: null, env, platform: process.platform }, handlers)).toEqual({ stdout: '', stderr: '', exitCode: 0 });
		expect(runHook({ hint: 'cursor', stdin: 'nope', env, platform: process.platform }, handlers)).toEqual({ stdout: `${CURSOR_ALLOW_OUTPUT}\n`, stderr: '', exitCode: 0 });
		const log = readFileSync(join(scratch, 'repo', 'tmp', 'agent-state', 'hook-errors.log'), 'utf8');
		expect(log).toContain('stdin stayed open');
		expect(log).toContain('not a JSON object');
		const lonely = join(scratch, 'lonely');
		expect(runHook({ hint: 'claude', stdin: null, env: { CLAUDE_PROJECT_DIR: lonely, GIT_CEILING_DIRECTORIES: scratch }, platform: process.platform }, handlers).exitCode).toBe(
			0
		);
		expect(existsSync(join(lonely, 'tmp'))).toBe(false);
		expect(existsSync(join(scratch, 'tmp'))).toBe(false);
	});
});
