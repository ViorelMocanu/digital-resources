import {
	BUSY_EXIT,
	type Holder,
	type LockAdapter,
	type LockFacts,
	TOKEN_VARIABLE,
	busyMessage,
	cli,
	commandLine,
	decide,
	describeHolder,
	handshake,
	isCi,
	lockAddress,
	nodeAdapter,
	parseArgs,
	parseHandshake,
	quoteArg,
	readHolderSync,
} from './checkout-lock.ts';
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { findSh, isAlive, makeScratchDir, removeScratchDir, scrubbedEnv, waitFor } from './lib/scratch-git.ts';
import { join, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// The checkout lock (OpenSpec change harness-h1b). The pure cases pass the platform, so the `win32` names are checked
// on the Linux CI runner too. The real-primitive cases use the host's own primitive (a named pipe on Windows, a Unix
// socket elsewhere) on roots under the repository's `tmp/`, and spawn every contender with an environment that has no
// CI variable, so they test the lock and not its CI no-op. Scratch names stay short: on the runner the checkout is
// `/home/runner/work/digital-resources/digital-resources`, and a socket path over 103 bytes is refused.

const repoRoot = resolve(import.meta.dirname, '..');
const LOCK = resolve(import.meta.dirname, 'checkout-lock.ts');
const isWindows = process.platform === 'win32';

/** A holder as the handshake carries it. */
const HOLDER: Holder = { pid: 12345, label: 'build', command: 'astro build', started: '2026-10-25T14:02:10+03:00', token: '0123456789abcdef' };

/** Where the GitHub runner checks this repository out; every socket of this file lives under its `tmp/`. */
const RUNNER_ROOT = '/home/runner/work/digital-resources/digital-resources';

// ─── Names ───────────────────────────────────────────────────────────────────

describe('lockAddress', () => {
	it('names a Windows pipe from the first 12 hex of the sha256 of the normalised root', () => {
		const hex = createHash('sha256').update('g:/work/site').digest('hex').slice(0, 12);
		expect(lockAddress('G:\\Work\\Site', 'win32')).toBe(`\\\\.\\pipe\\resurse-${hex}-checkout`);
	});

	it('gives one checkout one name, whatever its slashes, letter case or trailing separator', () => {
		const name = lockAddress('G:\\Work\\Site', 'win32');
		expect(lockAddress('g:/work/site/', 'win32')).toBe(name);
		expect(lockAddress('G:\\Work\\Site\\', 'win32')).toBe(name);
	});

	it('gives a worktree its own lock', () => {
		expect(lockAddress('C:\\Users\\dev\\.t3\\worktrees\\site\\t3-0a1b2c3d', 'win32')).not.toBe(lockAddress('G:\\Work\\Site', 'win32'));
	});

	it('puts the POSIX socket at <root>/tmp/.checkout-lock.sock for an injected root, whatever the working directory', () => {
		const before = process.cwd();
		const elsewhere = makeScratchDir('cl-cwd-');
		try {
			expect(lockAddress('/srv/repo', 'linux')).toBe('/srv/repo/tmp/.checkout-lock.sock');
			expect(lockAddress('/srv/repo/', 'linux')).toBe('/srv/repo/tmp/.checkout-lock.sock');
			process.chdir(elsewhere);
			expect(lockAddress('/srv/repo', 'linux')).toBe('/srv/repo/tmp/.checkout-lock.sock');
			expect(lockAddress('/srv/repo', 'darwin')).toBe('/srv/repo/tmp/.checkout-lock.sock');
		} finally {
			process.chdir(before);
			removeScratchDir(elsewhere);
		}
	});

	it("keeps this file's own scratch sockets within 103 bytes on the runner", () => {
		for (const root of [`${RUNNER_ROOT}/tmp/cl-XXXXXX/r99`, `${RUNNER_ROOT}/tmp/cli-XXXXXX/rs`]) {
			expect(Buffer.byteLength(lockAddress(root, 'linux')), root).toBeLessThanOrEqual(103);
		}
	});
});

// ─── CI ──────────────────────────────────────────────────────────────────────

describe('isCi', () => {
	it.each([[{ CI: 'true' }], [{ CI: '1' }], [{ CI: 'TRUE' }], [{ GITHUB_ACTIONS: 'true' }], [{ VERCEL: '1' }]])('is on for %o', (env) => {
		expect(isCi(env)).toBe(true);
	});

	it.each([[{}], [{ CI: '' }], [{ CI: '0' }], [{ CI: 'false' }], [{ CI: 'False' }], [{ GITHUB_ACTIONS: '' }], [{ VERCEL: '' }]])('is off for %o', (env) => {
		expect(isCi(env)).toBe(false);
	});
});

// ─── Quoting ─────────────────────────────────────────────────────────────────

describe('quoteArg and commandLine', () => {
	it('leaves plain words alone in both shells', () => {
		for (const platform of ['win32', 'linux'] as const) {
			for (const arg of ['-g', '--project=chromium', 'e2e/smoke.spec.ts', 'a,b', '@scope/pkg']) {
				expect(quoteArg(arg, platform), `${platform} ${arg}`).toBe(arg);
			}
		}
		// A backslash is a path separator to cmd.exe but an escape to sh, so only cmd.exe leaves it bare.
		expect(quoteArg('G:\\x\\y.ts', 'win32')).toBe('G:\\x\\y.ts');
		expect(quoteArg('G:\\x\\y.ts', 'linux')).toBe("'G:\\x\\y.ts'");
	});

	it('single-quotes for sh, with an embedded single quote closed and reopened', () => {
		expect(quoteArg('home page', 'linux')).toBe("'home page'");
		expect(quoteArg('a&b|c;d', 'linux')).toBe("'a&b|c;d'");
		expect(quoteArg("it's", 'linux')).toBe("'it'\\''s'");
		expect(quoteArg('$HOME', 'linux')).toBe("'$HOME'");
		expect(quoteArg('', 'linux')).toBe("''");
	});

	it('double-quotes for cmd.exe, doubling a trailing backslash', () => {
		expect(quoteArg('home page', 'win32')).toBe('"home page"');
		expect(quoteArg('a&b|c', 'win32')).toBe('"a&b|c"');
		expect(quoteArg('C:\\a b\\', 'win32')).toBe('"C:\\a b\\\\"');
		expect(quoteArg('', 'win32')).toBe('""');
	});

	it('refuses what cmd.exe cannot carry safely: a double quote, a percent sign or a line break', () => {
		for (const arg of ['say "hi"', '100%', '%PATH%', 'a\nb', 'a\rb']) {
			expect(() => quoteArg(arg, 'win32'), arg).toThrow(/cmd\.exe/);
		}
		// The advice keeps the lock: running the command without the wrapper would not.
		expect(() => quoteArg('100%', 'win32')).toThrow(/through an environment variable or a config file$/);
	});

	it('appends the extra arguments to the command, quoted for the platform shell', () => {
		expect(commandLine('playwright test', ['-g', 'home page'], 'win32')).toBe('playwright test -g "home page"');
		expect(commandLine('playwright test', ['-g', 'home page'], 'linux')).toBe("playwright test -g 'home page'");
		expect(commandLine('astro build', [], 'win32')).toBe('astro build');
	});
});

// ─── The handshake and the messages ──────────────────────────────────────────

describe('parseHandshake', () => {
	it("reads the holder's JSON line", () => {
		expect(parseHandshake(`${JSON.stringify(HOLDER)}\n`)).toEqual(HOLDER);
	});

	it.each([
		'',
		'not json',
		'[]',
		JSON.stringify({ ...HOLDER, pid: '1' }),
		JSON.stringify({ ...HOLDER, token: 'short' }),
		JSON.stringify({ ...HOLDER, label: 3 }),
		JSON.stringify({ pid: 1 }),
	])('rejects %s', (text) => {
		expect(parseHandshake(text)).toBeNull();
	});
});

describe('busyMessage', () => {
	it("names the holder's label, pid, start time and age, then where the rules are and the never-stop rule", () => {
		const lines = busyMessage(HOLDER, new Date('2026-10-25T14:05:40+03:00'));
		expect(lines).toEqual([
			'ERROR checkout busy: "build" is running in this checkout (pid 12345, started 2026-10-25 14:02 +03:00, 3 min ago).',
			'Builds, browser tests, the skill sync and repo-wide fixers take turns in one checkout (docs/agent/guardrails.md).',
			'Wait for it to finish and run your command again, or ask the owner for a worktree. Never stop a process you did not start.',
		]);
	});

	it('says under 1 min for a fresh holder, and still blocks when the holder did not say who it is', () => {
		expect(describeHolder(HOLDER, new Date('2026-10-25T14:02:30+03:00'))).toContain('under 1 min ago');
		expect(busyMessage(null, new Date())[0]).toBe("ERROR checkout busy: another process holds this checkout's lock.");
	});

	it("keeps a holder's label to one ASCII line", () => {
		expect(describeHolder({ ...HOLDER, label: 'bu\nild\u00e9' }, new Date('2026-10-25T14:02:30+03:00'))).toMatch(/^"bu ild\?" is running/);
	});

	it('names a guide that exists', () => {
		const guide = /\(([^)]+\.md)\)/.exec(busyMessage(HOLDER, new Date())[1] ?? '')?.[1] ?? '';
		expect(existsSync(join(repoRoot, guide)), guide).toBe(true);
	});
});

// ─── The decision table ──────────────────────────────────────────────────────

describe('decide', () => {
	const base: LockFacts = { ci: false, mode: 'hold', token: undefined, retried: false };
	const other: Holder = { ...HOLDER, token: 'fedcba9876543210' };
	const rows: [string, LockFacts, ReturnType<typeof decide>][] = [
		['CI runs the command, silently', { ...base, ci: true, token: '0123456789abcdef' }, { kind: 'run', lock: 'ci' }],
		['CI also skips the preview check', { ...base, ci: true, mode: 'no-hold' }, { kind: 'run', lock: 'ci' }],
		['no token: listen first', base, { kind: 'listen' }],
		['a token: ask the holder first', { ...base, token: HOLDER.token }, { kind: 'probe-before' }],
		['--no-hold: ask the holder first', { ...base, mode: 'no-hold' }, { kind: 'probe-before' }],
		["the caller's own token: run inside the parent's lock", { ...base, token: HOLDER.token, before: { state: 'held', holder: HOLDER } }, { kind: 'run', lock: 'nested' }],
		["another holder's token: busy", { ...base, token: HOLDER.token, before: { state: 'held', holder: other } }, { kind: 'busy', holder: other }],
		['a holder that did not say who it is: busy', { ...base, token: HOLDER.token, before: { state: 'held', holder: null } }, { kind: 'busy', holder: null }],
		['a leftover token: take the lock normally', { ...base, token: HOLDER.token, before: { state: 'free' } }, { kind: 'listen' }],
		['an unreadable holder with a token: take the lock normally', { ...base, token: HOLDER.token, before: { state: 'error', code: 'ETIMEDOUT' } }, { kind: 'listen' }],
		['--no-hold while held: busy', { ...base, mode: 'no-hold', before: { state: 'held', holder: HOLDER } }, { kind: 'busy', holder: HOLDER }],
		['--no-hold while free: run without holding', { ...base, mode: 'no-hold', before: { state: 'free' } }, { kind: 'run', lock: 'unchecked' }],
		[
			"--no-hold inside the caller's own lock: run",
			{ ...base, mode: 'no-hold', token: HOLDER.token, before: { state: 'held', holder: HOLDER } },
			{ kind: 'run', lock: 'nested' },
		],
		['listening: hold the lock', { ...base, listen: { state: 'ok' } }, { kind: 'run', lock: 'held' }],
		['a refused primitive: warn and run unlocked', { ...base, listen: { state: 'refused', code: 'EPERM' } }, { kind: 'run', lock: 'unavailable', code: 'EPERM' }],
		['in use: ask who holds it', { ...base, listen: { state: 'in-use' } }, { kind: 'probe-after' }],
		['in use by a holder: busy', { ...base, listen: { state: 'in-use' }, after: { state: 'held', holder: other } }, { kind: 'busy', holder: other }],
		['in use, holder gone: retry once', { ...base, listen: { state: 'in-use' }, after: { state: 'free' } }, { kind: 'retry' }],
		['in use again after the retry: busy', { ...base, retried: true, listen: { state: 'in-use' }, after: { state: 'free' } }, { kind: 'busy', holder: null }],
	];
	it.each(rows)('%s', (_name, facts, action) => {
		expect(decide(facts)).toEqual(action);
	});
});

// ─── Arguments ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {
	it('reads the label, the command and the extra arguments', () => {
		expect(parseArgs(['build', 'astro build'])).toEqual({ mode: 'hold', label: 'build', command: 'astro build', extra: [] });
		expect(parseArgs(['test:e2e', 'playwright test', '-g', 'home page'])).toEqual({ mode: 'hold', label: 'test:e2e', command: 'playwright test', extra: ['-g', 'home page'] });
		expect(parseArgs(['--no-hold', 'preview', 'node scripts/serve-static.ts'])).toEqual({
			mode: 'no-hold',
			label: 'preview',
			command: 'node scripts/serve-static.ts',
			extra: [],
		});
		expect(parseArgs(['--probe'])).toEqual({ mode: 'probe', root: null });
		expect(parseArgs(['--probe', '/srv/repo'])).toEqual({ mode: 'probe', root: '/srv/repo' });
	});

	it.each([[[]], [['build']], [['build', '']], [['--bogus', 'x', 'y']], [['-x', 'astro build']], [['--no-hold']], [['--probe', 'a', 'b']]])('refuses %o', (argv) => {
		expect(parseArgs(argv)).toHaveProperty('error');
	});
});

// ─── The real primitive on this OS ───────────────────────────────────────────

/** The per-file scratch folder: helper scripts and one root per test. */
let scratch = '';
/** The spawned entry point that runs the real CLI on an injected root. */
let entry = '';
/** How many roots were handed out. */
let roots = 0;
/**
 * The contenders this file started, so the cleanup can stop any that a failed test left running. Only a child that
 * Node still sees running is stopped: a pid read from a helper's pid file, or one whose process already exited, may
 * belong to someone else by then.
 */
const leftovers: ChildProcess[] = [];

/** A finished or running CLI process. */
interface Contender {
	child: ChildProcess;
	done: Promise<{ status: number | null; stdout: string; stderr: string }>;
}

/**
 * A fresh lock root under the scratch folder.
 * @returns The absolute root.
 */
function newRoot(): string {
	const root = join(scratch, `r${++roots}`);
	mkdirSync(root, { recursive: true });
	return root;
}

/**
 * The test process's environment without the CI variables, the token and the update-check switch, plus the given ones.
 * @param extra Variables to set.
 * @returns The environment.
 */
function lockEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	return scrubbedEnv({ names: ['CI', 'GITHUB_ACTIONS', 'VERCEL', TOKEN_VARIABLE, 'NO_UPDATE_CHECK'] }, extra);
}

/**
 * Start the real CLI on a root, in the scratch folder.
 * @param root The lock root.
 * @param args The CLI arguments.
 * @param extra More environment variables.
 * @returns The running contender.
 */
function start(root: string, args: readonly string[], extra: Record<string, string> = {}): Contender {
	const child = spawn(process.execPath, [entry, ...args], { cwd: scratch, env: lockEnv({ LOCK_TEST_ROOT: root, ...extra }), stdio: ['ignore', 'pipe', 'pipe'] });
	leftovers.push(child);
	let stdout = '';
	let stderr = '';
	child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
	child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
	const done = new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveDone) => {
		child.on('close', (status) => resolveDone({ status, stdout, stderr }));
	});
	return { child, done };
}

/**
 * Whether Node still sees a child running, so its pid is still the child's.
 * @param child The child.
 * @returns True until it exits.
 */
function running(child: ChildProcess): boolean {
	return child.pid !== undefined && child.exitCode === null && child.signalCode === null;
}

/**
 * Kill a running contender at once, as `taskkill /F` or `Stop-Process -Force` does: the wrapper cannot catch it.
 * @param child The contender's process.
 * @param tree Also kill its descendants (Windows `/T`); on POSIX only the wrapper is killed.
 */
function forceKill(child: ChildProcess, tree = false): void {
	if (!running(child)) return;
	if (isWindows) spawnSync('taskkill', ['/PID', String(child.pid), ...(tree ? ['/T'] : []), '/F'], { stdio: 'ignore', windowsHide: true, timeout: 10_000 });
	else child.kill('SIGKILL');
}

/**
 * Stop a running contender and its command: its whole tree on Windows, and on POSIX a SIGTERM, which the wrapper
 * passes on to its child's process group.
 * @param child The contender's process.
 */
function stopTree(child: ChildProcess): void {
	if (!running(child)) return;
	if (isWindows) forceKill(child, true);
	else child.kill('SIGTERM');
}

/**
 * A pid written by a helper script.
 * @param file The pid file.
 * @returns The pids in it.
 */
function pidsIn(file: string): number[] {
	return readFileSync(file, 'utf-8').trim().split(/\s+/).map(Number);
}

/**
 * A command that writes its pid and sleeps until {@link release} or the time runs out, then exits 0.
 * @param ms The longest it sleeps.
 * @param pidFile Where it writes its pid.
 * @returns The command, relative to the scratch folder.
 */
function sleepCommand(ms: number, pidFile: string): string {
	return `node sleep.mjs ${ms} ${pidFile}`;
}

/**
 * End a {@link sleepCommand} early, once a test has checked what it needed while the command ran.
 * @param pidFile The pid file the command was given.
 */
function release(pidFile: string): void {
	writeFileSync(`${pidFile}.go`, '');
}

/**
 * Leave a stale Unix socket at an address, as a holder killed with SIGKILL does: a child listens on it and is killed
 * before it can close the server, which would remove the file.
 * @param address The socket path.
 */
async function staleSocket(address: string): Promise<void> {
	mkdirSync(resolve(address, '..'), { recursive: true });
	const child = spawn(process.execPath, [join(scratch, 'listen.mjs'), address], { stdio: 'ignore' });
	leftovers.push(child);
	await waitFor(() => existsSync(address), 'the socket file');
	child.kill('SIGKILL');
	await waitFor(() => !running(child), 'the listener to die');
}

describe("the lock on this OS's primitive", { timeout: 60_000 }, () => {
	beforeAll(() => {
		scratch = makeScratchDir('cl-');
		entry = join(scratch, 'entry.mjs');
		writeFileSync(
			entry,
			`import { cli } from ${JSON.stringify(pathToFileURL(LOCK).href)};\nprocess.exitCode = await cli(process.argv.slice(2), { root: process.env.LOCK_TEST_ROOT });\n`
		);
		writeFileSync(
			join(scratch, 'sleep.mjs'),
			'import { existsSync, writeFileSync } from "node:fs";\nconst [ms, pidFile] = process.argv.slice(2);\nif (pidFile) writeFileSync(pidFile, String(process.pid));\nconst end = Date.now() + Number(ms);\nconst timer = setInterval(() => {\n\tif (Date.now() >= end || (pidFile && existsSync(pidFile + ".go"))) clearInterval(timer);\n}, 25);\n'
		);
		writeFileSync(join(scratch, 'exit.mjs'), 'process.exit(Number(process.argv[2]));\n');
		writeFileSync(join(scratch, 'listen.mjs'), 'import { createServer } from "node:net";\ncreateServer().listen(process.argv[2]);\n');
		writeFileSync(join(scratch, 'argv.mjs'), 'import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)));\n');
		writeFileSync(
			join(scratch, 'env.mjs'),
			`import { writeFileSync } from "node:fs";\nwriteFileSync(process.argv[2], JSON.stringify({ token: process.env[${JSON.stringify(TOKEN_VARIABLE)}] ?? null, update: process.env.NO_UPDATE_CHECK ?? null }));\n`
		);
	});

	afterAll(() => {
		for (const child of leftovers) stopTree(child);
		removeScratchDir(scratch);
	}, 30_000);

	it('lets one of two contenders run and refuses the other at once with exit 75', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'race.pid');
		const one = start(root, ['one', sleepCommand(2000, pidFile)]);
		const two = start(root, ['two', sleepCommand(2000, pidFile)]);
		// The loser is refused at once, while the winner's command sleeps until released.
		await Promise.race([one.done, two.done]);
		release(pidFile);
		const results = await Promise.all([one.done, two.done]);
		expect(results.map((result) => result.status).sort()).toEqual([0, BUSY_EXIT]);
		const loser = results.find((result) => result.status === BUSY_EXIT);
		const winner = results[0]?.status === 0 ? one : two;
		const winnerLabel = winner === one ? 'one' : 'two';
		expect(loser?.stderr).toContain(`ERROR checkout busy: "${winnerLabel}" is running in this checkout (pid ${winner.child.pid}, started `);
		expect(loser?.stderr).toContain('Never stop a process you did not start.');
	});

	it("answers each connection with the holder's handshake", async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'handshake.pid');
		const holder = start(root, ['build', sleepCommand(5000, pidFile)]);
		await waitFor(() => existsSync(pidFile), "the holder's child");
		const probe = await nodeAdapter(process.platform).probe(lockAddress(root, process.platform));
		expect(probe.state).toBe('held');
		const held = probe.state === 'held' ? probe.holder : null;
		expect(held).toMatchObject({ pid: holder.child.pid, label: 'build', command: sleepCommand(5000, pidFile) });
		expect(held?.token).toMatch(/^[0-9a-f]{16}$/);
		expect(held?.started).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
		expect(readHolderSync(root, process.platform)).toEqual(held);
		const cliProbe = start(root, ['--probe']);
		expect(parseHandshake((await cliProbe.done).stdout)).toEqual(held);
		release(pidFile);
		expect((await holder.done).status).toBe(0);
		expect(readHolderSync(root, process.platform)).toBeNull();
	});

	it('frees the lock when the holder is force-killed, so the next run takes it with no cleanup step', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'killed.pid');
		const holder = start(root, ['build', sleepCommand(8000, pidFile)]);
		await waitFor(() => existsSync(pidFile), "the holder's child");
		forceKill(holder.child, true);
		// On POSIX only the wrapper dies, and its child keeps the wrapper's pipes open until it ends, so `close` waits
		// for it: released here, it ends at once instead of sleeping out its few seconds.
		release(pidFile);
		await holder.done;
		const startedAt = Date.now();
		const next = await start(root, ['build', 'node exit.mjs 0']).done;
		expect(next.status).toBe(0);
		expect(next.stderr).toBe('');
		expect(Date.now() - startedAt).toBeLessThan(10_000);
	});

	it('frees the lock when only the holder is killed while its child runs, and the child keeps running unlocked', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'orphan.pid');
		const holder = start(root, ['build', sleepCommand(8000, pidFile)]);
		await waitFor(() => existsSync(pidFile), "the holder's child");
		const [orphan] = pidsIn(pidFile);
		forceKill(holder.child);
		// Wait for the wrapper's exit, not its `close`: the orphan keeps the inherited pipes open until it ends, so
		// waiting for `close` would wait out its sleep.
		await waitFor(() => !running(holder.child), 'the holder to die');
		const next = await start(root, ['build', 'node exit.mjs 0']).done;
		expect(next.status).toBe(0);
		expect(orphan).toBeGreaterThan(0);
		// Accepted gap, on every OS: the killed wrapper could not stop its child. On Windows the shell's child is outside
		// the wrapper's job object too.
		expect(isAlive(orphan as number)).toBe(true);
		process.kill(orphan as number);
	});

	it.skipIf(isWindows)('clears a stale socket only while it is still stale, one contender at a time', async () => {
		const adapter = nodeAdapter(process.platform);
		// A live holder's socket stays, though a contender that saw it stale a moment ago asks to clear it.
		const live = lockAddress(newRoot(), process.platform);
		const held = await adapter.listen(live, () => handshake(HOLDER));
		expect(held.result.state).toBe('ok');
		await adapter.clear(live);
		expect((await adapter.probe(live)).state).toBe('held');
		await held.release();
		// A stale socket, left by a killed holder, goes, and so does the clearing marker.
		const stale = lockAddress(newRoot(), process.platform);
		await staleSocket(stale);
		await adapter.clear(stale);
		expect(existsSync(stale)).toBe(false);
		expect(existsSync(`${stale}.clearing`)).toBe(false);
		// While another contender's marker is fresh, clear waits for it and removes nothing itself.
		await staleSocket(stale);
		writeFileSync(`${stale}.clearing`, '');
		setTimeout(() => rmSync(`${stale}.clearing`, { force: true }), 300);
		const startedAt = Date.now();
		await adapter.clear(stale);
		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(250);
		expect(existsSync(stale)).toBe(true);
		// A marker left by a contender killed mid-clear goes stale after a few seconds.
		writeFileSync(`${stale}.clearing`, '');
		const old = new Date(Date.now() - 60_000);
		utimesSync(`${stale}.clearing`, old, old);
		await adapter.clear(stale);
		expect(existsSync(stale)).toBe(false);
		expect(existsSync(`${stale}.clearing`)).toBe(false);
	});

	it("passes a nested run through the parent's lock by its token, and gives children the token and NO_UPDATE_CHECK", async () => {
		const root = newRoot();
		const envFile = join(scratch, 'nested-env.json');
		const nested = await start(root, ['outer', `node entry.mjs inner "node env.mjs ${envFile}"`]).done;
		expect(nested.status).toBe(0);
		expect(nested.stderr).toBe('');
		const seen = JSON.parse(readFileSync(envFile, 'utf-8')) as { token: string | null; update: string | null };
		expect(seen.token).toMatch(/^[0-9a-f]{16}$/);
		expect(seen.update).toBe('1');
		const code = await start(root, ['outer', 'node entry.mjs inner "node exit.mjs 5"']).done;
		expect(code.status).toBe(5);
	});

	it('ignores a leftover token from a run that ended, and takes the lock normally', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'leftover.pid');
		const stale = start(root, ['build', sleepCommand(5000, pidFile)], { [TOKEN_VARIABLE]: '0123456789abcdef' });
		await waitFor(() => existsSync(pidFile), "the holder's child");
		const second = await start(root, ['second', 'node exit.mjs 0']).done;
		expect(second.status).toBe(BUSY_EXIT);
		expect(second.stderr).toContain('"build" is running');
		release(pidFile);
		expect((await stale.done).status).toBe(0);
	});

	it('does nothing, silently, under each CI variable, and still locks when CI is false or 0', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'ci.pid');
		const holder = start(root, ['build', sleepCommand(20_000, pidFile)]);
		try {
			await waitFor(() => existsSync(pidFile), "the holder's child");
			for (const env of [{ CI: 'true' }, { CI: '1' }, { GITHUB_ACTIONS: 'true' }, { VERCEL: '1' }] as Record<string, string>[]) {
				const run = await start(root, ['ci', 'node exit.mjs 0'], env).done;
				expect(run, JSON.stringify(env)).toEqual({ status: 0, stdout: '', stderr: '' });
			}
			for (const env of [{ CI: 'false' }, { CI: '0' }]) {
				expect((await start(root, ['ci', 'node exit.mjs 0'], env).done).status, JSON.stringify(env)).toBe(BUSY_EXIT);
			}
			expect(running(holder.child)).toBe(true);
		} finally {
			stopTree(holder.child);
			await holder.done;
		}
	});

	it('--no-hold refuses while the lock is held, and does not hold it while it runs', async () => {
		const root = newRoot();
		const pidFile = join(scratch, 'nohold-holder.pid');
		const holder = start(root, ['build', sleepCommand(5000, pidFile)]);
		await waitFor(() => existsSync(pidFile), "the holder's child");
		const refused = await start(root, ['--no-hold', 'preview', 'node exit.mjs 0']).done;
		expect(refused.status).toBe(BUSY_EXIT);
		expect(refused.stderr).toContain('"build" is running');
		release(pidFile);
		expect((await holder.done).status).toBe(0);

		const previewPid = join(scratch, 'nohold-preview.pid');
		const preview = start(root, ['--no-hold', 'preview', sleepCommand(5000, previewPid)]);
		await waitFor(() => existsSync(previewPid), "the preview's child");
		const build = await start(root, ['build', 'node exit.mjs 0']).done;
		expect(build.status).toBe(0);
		release(previewPid);
		expect((await preview.done).status).toBe(0);
	});

	it("passes the child's exit code through", async () => {
		expect((await start(newRoot(), ['build', 'node exit.mjs 7']).done).status).toBe(7);
	});

	it('appends the extra arguments quoted for the platform shell, so a spaced or special argument arrives whole', async () => {
		const out = join(scratch, 'argv.json');
		const run = await start(newRoot(), ['test:e2e', `node argv.mjs ${out}`, '-g', 'home page', 'a&b|c', "it's", '--project=chromium']).done;
		expect(run.status).toBe(0);
		expect(JSON.parse(readFileSync(out, 'utf-8'))).toEqual(['-g', 'home page', 'a&b|c', "it's", '--project=chromium']);
	});

	it('refuses bad arguments with exit 2 and the usage line', async () => {
		const run = await start(newRoot(), ['build']).done;
		expect(run.status).toBe(2);
		expect(run.stderr).toMatch(/usage: node scripts\/checkout-lock\.ts/);
	});
});

describe('the lock with injected parts', { timeout: 60_000 }, () => {
	let dir = '';

	beforeAll(() => {
		dir = makeScratchDir('cli-');
		writeFileSync(join(dir, 'exit.mjs'), 'process.exit(Number(process.argv[2]));\n');
		writeFileSync(join(dir, 'sleep.mjs'), 'setTimeout(() => {}, Number(process.argv[2]));\n');
		writeFileSync(
			join(dir, 'tree.mjs'),
			'import { spawn } from "node:child_process";\nimport { writeFileSync } from "node:fs";\nconst child = spawn(process.execPath, ["sleep.mjs", "15000"], { stdio: "ignore" });\nwriteFileSync(process.argv[2], `${process.pid} ${child.pid}`);\nsetTimeout(() => {}, 15000);\n'
		);
	});

	afterAll(() => {
		removeScratchDir(dir);
	}, 30_000);

	it('warns and runs unlocked when the platform refuses the primitive', async () => {
		const lines: string[] = [];
		const refusing: LockAdapter = {
			probe: () => Promise.resolve({ state: 'free' }),
			listen: () => Promise.resolve({ result: { state: 'refused', code: 'EPERM' }, release: () => Promise.resolve() }),
			clear: () => undefined,
		};
		const code = await cli(['build', 'node exit.mjs 3'], { root: join(dir, 'r'), cwd: dir, env: lockEnv(), adapter: refusing, stderr: (line) => lines.push(line) });
		expect(code).toBe(3);
		expect(lines).toEqual(['WARNING checkout lock unavailable (EPERM); running unlocked']);
	});

	it("stops the child's whole tree on SIGINT and exits 130", async () => {
		const signals = new EventEmitter();
		const pidFile = join(dir, 'tree.pid');
		const result = cli(['build', `node tree.mjs ${pidFile}`], { root: join(dir, 'rs'), cwd: dir, env: lockEnv(), signals, stderr: () => undefined });
		await waitFor(() => existsSync(pidFile) && readFileSync(pidFile, 'utf-8').includes(' '), 'the child tree');
		const pids = pidsIn(pidFile);
		expect(pids.every(isAlive)).toBe(true);
		signals.emit('SIGINT');
		expect(await result).toBe(130);
		await waitFor(() => !pids.some(isAlive), 'the child tree to stop', 10_000);
		expect(signals.listenerCount('SIGINT')).toBe(0);
	});
});

// ─── The wrapped package.json scripts ────────────────────────────────────────

/** The scripts that take the lock: each writes something another run reads (the build output, the skill trees, files). */
const WRAPPED = ['build', 'test:e2e', 'verify:fix', 'format:fix', 'lint:fix', 'harness:sync', 'openspec:port'];

/** The read-only scripts, which never take it: the pre-push hook runs `verify`, so it never meets a busy lock. */
const READ_ONLY = ['verify', 'format', 'lint', 'typecheck', 'test', 'test:unit', 'harness:sync:check', 'harness:sync:diff'];

/** The start of a wrapped body. */
const WRAPPER = 'node scripts/checkout-lock.ts ';

/**
 * Read a wrapped body the way both shells should: its flags, its label and its one double-quoted command, in which
 * `\"` stands for `"`.
 * @param body The script body.
 * @returns The argv the wrapper should receive.
 */
function expectedArgv(body: string): string[] {
	const match = /^node scripts\/checkout-lock\.ts((?: --no-hold)?) ([\w:.-]+) "((?:[^"\\]|\\.)*)"$/.exec(body);
	if (match === null) throw new Error(`not a wrapped body: ${body}`);
	return [...(match[1] === '' ? [] : ['--no-hold']), match[2] ?? '', (match[3] ?? '').replace(/\\(["\\])/g, '$1')];
}

/**
 * The characters `cmd.exe` reads outside double quotes, where `&`, `|`, `<`, `>` and `^` are its own operators.
 * `cmd.exe` has no escape inside quotes, so each `"` toggles the state, `\"` included.
 * @param line The command line.
 * @returns The unquoted characters.
 */
function cmdUnquoted(line: string): string {
	let quoted = false;
	let outside = '';
	for (const char of line) {
		if (char === '"') quoted = !quoted;
		else if (!quoted) outside += char;
	}
	return outside;
}

/**
 * A wrapped body with a stub in the wrapper's place, after the checks that keep a real command from running: the
 * body must be in the wrapped form, `sh` must find no expansion in it, and `cmd.exe` no operator outside its quotes
 * and no `%`. A body that fails throws here, before any shell starts.
 * @param body The script body.
 * @param stub The stub script that prints its argv.
 * @returns The line to run.
 */
function stubbed(body: string, stub: string): string {
	expectedArgv(body);
	if (/[$`%]/.test(body)) throw new Error(`a shell would expand part of this body: ${body}`);
	if (/[&|<>^]/.test(cmdUnquoted(body))) throw new Error(`cmd.exe would read an operator in this body: ${body}`);
	return `node ${stub} ${body.slice(WRAPPER.length)}`;
}

describe('the wrapped package.json scripts', () => {
	const scripts = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8')) as { scripts: Record<string, string> }).scripts;
	let dir = '';
	let stub = '';

	beforeAll(() => {
		dir = makeScratchDir('clq-');
		stub = join(dir, 'stub.mjs').replace(/\\/g, '/');
		writeFileSync(stub, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));\n');
		// A sandbox package, so a pnpm call that slipped through could never reach the repository's own scripts.
		writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: 'checkout-lock-quoting-sandbox', private: true, scripts: {} })}\n`);
	});

	afterAll(() => {
		removeScratchDir(dir);
	}, 30_000);

	/**
	 * How the stubbed lines run: in the sandbox, with a time limit and no inherited lock token.
	 * @returns The spawnSync options for one stubbed line.
	 */
	const shellOptions = (): { cwd: string; encoding: 'utf-8'; timeout: number; env: NodeJS.ProcessEnv } => ({ cwd: dir, encoding: 'utf-8', timeout: 20_000, env: lockEnv() });

	it('wraps every listed script, and only those', () => {
		for (const name of WRAPPED) expect(scripts[name], name).toMatch(/^node scripts\/checkout-lock\.ts /);
		for (const name of READ_ONLY) expect(scripts[name], name).toBeDefined();
		const wrapped = Object.keys(scripts).filter((name) => scripts[name]?.includes('checkout-lock.ts'));
		expect(wrapped.sort()).toEqual([...WRAPPED].sort());
	});

	it('leaves no unlocked twin: no other script runs a wrapped command', () => {
		const inner = new Set(WRAPPED.map((name) => expectedArgv(scripts[name] ?? '').at(-1)));
		for (const [name, body] of Object.entries(scripts)) {
			if (!WRAPPED.includes(name)) expect(inner.has(body), name).toBe(false);
		}
	});

	it("keeps the format:fix body's inner quotes and the lint:fix body's && in the command string", () => {
		expect(expectedArgv(scripts['format:fix'] ?? '')).toEqual([
			'format:fix',
			'prettier --write "./**/*.{html,css,js,cjs,ts,astro,md,json,yaml}" --plugin=prettier-plugin-astro',
		]);
		expect(expectedArgv(scripts['lint:fix'] ?? '')).toEqual(['lint:fix', 'pnpm lint:js --fix && pnpm lint:md --fix && pnpm lint:css --fix']);
		expect(expectedArgv(scripts['build'] ?? '')).toEqual(['build', 'astro build']);
	});

	it('refuses to run a body that is not in the wrapped form, or that a shell would read itself', () => {
		expect(() => stubbed('pnpm lint:fix && pnpm format:fix', stub)).toThrow(/not a wrapped body/);
		expect(() => stubbed('node scripts/checkout-lock.ts x "a" && pnpm install', stub)).toThrow(/not a wrapped body/);
		expect(() => stubbed('node scripts/checkout-lock.ts x "a \\"b && c\\" d"', stub)).toThrow(/cmd\.exe would read/);
		expect(() => stubbed('node scripts/checkout-lock.ts x "echo $(id)"', stub)).toThrow(/expand/);
	});

	it.each(WRAPPED)('%s reaches the wrapper whole through sh -c', (name) => {
		const body = scripts[name] ?? '';
		const result = spawnSync(findSh(), ['-c', stubbed(body, stub)], shellOptions());
		expect(result.status, result.stderr).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual(expectedArgv(body));
	});

	it.skipIf(!isWindows).each(WRAPPED)('%s reaches the wrapper whole through cmd.exe /d /s /c, bare and quoted', (name) => {
		const body = scripts[name] ?? '';
		const line = stubbed(body, stub);
		for (const form of [line, `"${line}"`]) {
			const result = spawnSync('cmd.exe', ['/d', '/s', '/c', form], { ...shellOptions(), windowsVerbatimArguments: true });
			expect(result.status, result.stderr).toBe(0);
			expect(JSON.parse(result.stdout)).toEqual(expectedArgv(body));
		}
	});
});
