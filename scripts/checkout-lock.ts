/**
 * The checkout lock (OpenSpec change harness-guardrails, design D15 "The checkout lock: primitive and lifecycle" and
 * D16 "which commands, CI, the second thread, pre-commit and the gaps"; spec harness--agent-workflow).
 *
 * Usage: `node scripts/checkout-lock.ts [--no-hold] <label> "<command>" [extra args...]`. The wrapper takes this
 * checkout's lock, runs the command through the platform shell with the extra arguments quoted for it, holds the lock
 * until the command exits and then exits with its code. Builds, E2E runs and repo-wide fixers take turns this way:
 * a second run in the same checkout exits 75 at once with the holder's label, pid and start time.
 *
 * - The primitive is a named pipe on Windows (`\\.\pipe\resurse-<12 hex>-checkout`, from the normalised root), which
 *   frees itself when its holder dies, and a Unix socket at `<root>/tmp/.checkout-lock.sock` elsewhere. Each checkout
 *   and worktree has its own lock; the root is this script's own checkout. A socket left by a killed holder is
 *   removed by one contender at a time, under an `O_EXCL` marker, and only while a fresh probe still finds it stale.
 * - Each connection gets one JSON line, `{pid, label, command, started, token}`. The holder gives its children the
 *   token in `RESURSE_CHECKOUT_LOCK`, so a nested run (Playwright's `pnpm build`, `verify:fix`'s `pnpm lint:fix`)
 *   runs inside its parent's lock, and a leftover token from a finished run is ignored.
 * - `--no-hold` (the owner's `preview:static`, Open Question 5) refuses while the lock is held and otherwise runs
 *   without holding it.
 * - `--probe [root]` prints the holder's JSON line, or nothing when the lock is free; the guard uses it on POSIX.
 * - In CI (`CI` truthy, or `GITHUB_ACTIONS`, `CF_PAGES` or `WORKERS_CI` set) it does nothing, silently. When the
 *   platform refuses the primitive (`EACCES`, `EPERM`, `ENOTSUP`, or any listen error other than `EADDRINUSE`), it
 *   warns and runs unlocked (Open Question 4).
 * - Children get `NO_UPDATE_CHECK=1` (design D18). On SIGINT, SIGTERM or SIGHUP the child's whole tree is stopped.
 *
 * The lock's address, the handshake and the synchronous holder read live in `scripts/lib/lock-holder.ts`, which the
 * guard imports without loading `node:net` or `node:crypto` (design D1); this module re-exports them.
 *
 * Runs through Node type stripping and uses only `node:` built-ins and the shared modules; no side effects on import.
 */

import { type Holder, MAX_HANDSHAKE_BYTES, PROBE_TIMEOUT_MS, TOKEN_VARIABLE, describeHolder, lockAddress, parseHandshake, readHolderSync } from './lib/lock-holder.ts';
import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { killTree, ownGroup, treeKillPlan } from './lib/child-tree.ts';
import { connect, createServer } from 'node:net';
import { type Env } from './lib/checkout-root.ts';
import { errorCode, localIso } from './hooks/hook-io.ts';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { Holder };
export { TOKEN_VARIABLE, describeHolder, lockAddress, parseHandshake, readHolderSync };

/** What a connection to the lock found: nobody, a holder (null when it did not say who it is), or an error. */
export type Probe = { state: 'free' } | { state: 'held'; holder: Holder | null } | { state: 'error'; code: string };

/** What listening on the lock gave: the lock, a holder already there, or a platform that refuses the primitive. */
export type Listen = { state: 'ok' } | { state: 'in-use' } | { state: 'refused'; code: string };

/** What the wrapper knows so far; {@link decide} turns it into the next step. */
export interface LockFacts {
	/** A CI variable is set. */
	ci: boolean;
	/** `hold` takes the lock; `no-hold` only checks it. */
	mode: 'hold' | 'no-hold';
	/** The inherited `RESURSE_CHECKOUT_LOCK`, or undefined. */
	token: string | undefined;
	/** The probe before listening (with a token, or under `--no-hold`). */
	before?: Probe;
	listen?: Listen | undefined;
	/** The probe after listening found the lock in use. */
	after?: Probe | undefined;
	/** Listening was retried once already. */
	retried: boolean;
}

/** The wrapper's next step. */
export type LockAction =
	| { kind: 'probe-before' }
	| { kind: 'listen' }
	| { kind: 'probe-after' }
	| { kind: 'retry' }
	| { kind: 'run'; lock: 'ci' | 'nested' | 'held' | 'unchecked' }
	| { kind: 'run'; lock: 'unavailable'; code: string }
	| { kind: 'busy'; holder: Holder | null };

/** The lock primitive's operations; injectable for tests. */
export interface LockAdapter {
	/** Connect and read the holder's handshake. */
	probe: (address: string) => Promise<Probe>;
	/** Listen on the lock, answering each connection with `answer()`; `release` gives it up. */
	listen: (address: string, answer: () => string) => Promise<{ result: Listen; release: () => Promise<void> }>;
	/** Remove a stale lock file before a retry (POSIX); nothing on Windows. */
	clear: (address: string) => void | Promise<void>;
}

/** A started command. */
export interface RunningChild {
	/** Settles with the exit code, or with the signal that ended it. */
	exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
	/** Stop the command's whole tree. */
	stop: () => void;
}

/** Where signals come from; `process` in real use. */
export interface SignalSource {
	on: (signal: NodeJS.Signals, listener: () => void) => unknown;
	off: (signal: NodeJS.Signals, listener: () => void) => unknown;
}

/** Everything the wrapper reads from the outside world. */
export interface LockDeps {
	/** The checkout root whose lock this is. */
	root: string;
	platform: NodeJS.Platform;
	env: Env;
	/** The folder the command runs in. */
	cwd: string;
	adapter: LockAdapter;
	/** Start a command line through the platform shell. */
	start: (line: string, env: Env, cwd: string, platform: NodeJS.Platform) => RunningChild;
	signals: SignalSource;
	stdout: (line: string) => void;
	stderr: (line: string) => void;
	now: () => Date;
	pid: number;
	/** A new 16-hex token. */
	newToken: () => string;
}

/** The parsed command line. */
export type LockArgs = { mode: 'hold' | 'no-hold'; label: string; command: string; extra: string[] } | { mode: 'probe'; root: string | null };

/** An argument that the platform shell cannot carry safely. */
export class LockUsageError extends Error {
	override name = 'LockUsageError';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** The busy exit code, `EX_TEMPFAIL`: distinct from a failed build. */
export const BUSY_EXIT = 75;

/** The exit code for bad arguments. */
export const USAGE_EXIT = 2;

/** Variables whose presence means CI, besides a truthy `CI` (design D16). */
const CI_VARIABLES = ['GITHUB_ACTIONS', 'CF_PAGES', 'WORKERS_CI'];

/** The longest Unix socket path that every POSIX platform accepts (macOS: 104 bytes with the NUL). */
const MAX_SOCKET_BYTES = 103;

/** How long a contender waits for another one's stale-socket clear (POSIX): one probe, with room to spare. */
const CLEAR_WAIT_MS = 2000;

/** A clearing marker older than this was left by a contender killed mid-clear. */
const CLEAR_STALE_MS = 5000;

/** The exit code after each signal the wrapper handles. */
const SIGNAL_EXIT: Partial<Record<NodeJS.Signals, number>> = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };

/** The command line, for the usage error. */
const USAGE = 'node scripts/checkout-lock.ts [--no-hold] <label> "<command>" [extra args...] | --probe [root]';

// ─── CI and quoting ──────────────────────────────────────────────────────────

/**
 * Whether the environment is CI: `CI` set to anything but empty, `0` or `false`, or `GITHUB_ACTIONS`, `CF_PAGES` or
 * `WORKERS_CI` set.
 * @param env The environment.
 * @returns True in CI.
 */
export function isCi(env: Env): boolean {
	const ci = env.CI?.trim().toLowerCase();
	if (ci !== undefined && ci !== '' && ci !== '0' && ci !== 'false') return true;
	return CI_VARIABLES.some((name) => (env[name] ?? '') !== '');
}

/**
 * Quote one extra argument for the shell that runs the command: single quotes for `sh`, double quotes for `cmd.exe`
 * (with a trailing backslash doubled, so it cannot escape the closing quote). A plain word stays as it is.
 * @param arg The argument.
 * @param platform The platform: `win32` means `cmd.exe`.
 * @returns The quoted argument.
 * @throws {LockUsageError} On Windows, for a double quote, a percent sign or a line break, which `cmd.exe` would
 *   read itself.
 */
export function quoteArg(arg: string, platform: NodeJS.Platform): string {
	if (platform === 'win32') {
		if (/["%\r\n]/.test(arg))
			throw new LockUsageError(`cannot pass ${JSON.stringify(arg)} through cmd.exe safely; pass the value through an environment variable or a config file`);
		if (/^[\w+=.,:/\\@-]+$/.test(arg)) return arg;
		return `"${arg.replace(/(\\+)$/, '$1$1')}"`;
	}
	if (/^[\w+=.,:/@%-]+$/.test(arg)) return arg;
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * The command line the shell runs: the command, then the quoted extra arguments.
 * @param command The command string, as written in `package.json`.
 * @param extra The extra arguments.
 * @param platform The platform whose shell runs it.
 * @returns The line.
 * @throws {LockUsageError} When an argument cannot be quoted.
 */
export function commandLine(command: string, extra: readonly string[], platform: NodeJS.Platform): string {
	return [command, ...extra.map((arg) => quoteArg(arg, platform))].join(' ');
}

// ─── The handshake and the messages ──────────────────────────────────────────

/**
 * Write the holder's handshake line.
 * @param holder The holder.
 * @returns One JSON line.
 */
export function handshake(holder: Holder): string {
	return `${JSON.stringify(holder)}\n`;
}

/**
 * The three-line busy message (design D16, "What a second thread sees").
 * @param holder The holder, or null.
 * @param now The current time.
 * @returns The lines.
 */
export function busyMessage(holder: Holder | null, now: Date): string[] {
	return [
		`ERROR checkout busy: ${describeHolder(holder, now)}.`,
		'Builds, E2E runs and repo-wide fixers take turns in one checkout (docs/agent/t3-code.md).',
		'Wait for it to finish and run your command again, or ask the owner for a worktree. Never stop a process you did not start.',
	];
}

// ─── The decision table ──────────────────────────────────────────────────────

/**
 * The wrapper's next step from what it knows (design D15, "Re-entrancy"; D16, "No-op in CI"; Open Questions 4, 5).
 * @param facts What the wrapper knows so far.
 * @returns The next step.
 */
export function decide(facts: LockFacts): LockAction {
	if (facts.ci) return { kind: 'run', lock: 'ci' };
	const ownHolder = (probe: Probe | undefined): LockAction | null => {
		if (probe?.state !== 'held') return null;
		if (probe.holder !== null && facts.token !== undefined && probe.holder.token === facts.token) return { kind: 'run', lock: 'nested' };
		return { kind: 'busy', holder: probe.holder };
	};
	if ((facts.token !== undefined || facts.mode === 'no-hold') && facts.before === undefined) return { kind: 'probe-before' };
	const first = ownHolder(facts.before);
	if (first !== null) return first;
	if (facts.mode === 'no-hold') return { kind: 'run', lock: 'unchecked' };
	if (facts.listen === undefined) return { kind: 'listen' };
	if (facts.listen.state === 'ok') return { kind: 'run', lock: 'held' };
	if (facts.listen.state === 'refused') return { kind: 'run', lock: 'unavailable', code: facts.listen.code };
	if (facts.after === undefined) return { kind: 'probe-after' };
	const second = ownHolder(facts.after);
	if (second !== null) return second;
	return facts.retried ? { kind: 'busy', holder: null } : { kind: 'retry' };
}

// ─── The primitive ───────────────────────────────────────────────────────────

/**
 * Wait a little, without blocking the event loop.
 * @param ms How long.
 * @returns When it is over.
 */
function pause(ms: number): Promise<void> {
	return new Promise((resolvePause) => setTimeout(resolvePause, ms));
}

/**
 * Remove a stale Unix socket, one contender at a time (POSIX). Two contenders that both found the socket stale must
 * not both remove it: the second would remove the first one's fresh socket, and both would hold the lock. So the
 * clear takes `<socket>.clearing` with `O_EXCL`, probes again and removes the socket only while it is still stale.
 * A contender that finds the marker waits for it to go (at most 2 s) and removes nothing; its retry then listens. A
 * marker older than 5 s was left by a contender killed mid-clear and is taken over.
 * @param address The socket path.
 * @param probe The adapter's probe.
 * @returns When the socket is gone, or another contender cleared it, or the wait ran out.
 */
async function clearStaleSocket(address: string, probe: (address: string) => Promise<Probe>): Promise<void> {
	const marker = `${address}.clearing`;
	for (let attempt = 0; attempt < 2; attempt++) {
		let fd: number;
		try {
			fd = openSync(marker, 'wx');
		} catch (error) {
			if (errorCode(error, 'UNKNOWN') !== 'EEXIST') return;
			const until = Date.now() + CLEAR_WAIT_MS;
			while (existsSync(marker) && Date.now() < until && !markerIsStale(marker)) await pause(25);
			if (!existsSync(marker)) return;
			if (!markerIsStale(marker)) return;
			rmSync(marker, { force: true });
			continue;
		}
		try {
			closeSync(fd);
			if ((await probe(address)).state === 'free') rmSync(address, { force: true });
		} finally {
			rmSync(marker, { force: true });
		}
		return;
	}
}

/**
 * Whether a clearing marker was left by a contender killed mid-clear.
 * @param marker The marker path.
 * @returns True when it is older than 5 s; false when it is newer or gone.
 */
function markerIsStale(marker: string): boolean {
	try {
		return Date.now() - statSync(marker).mtimeMs > CLEAR_STALE_MS;
	} catch {
		return false;
	}
}

/**
 * The real primitive: `node:net` on a named pipe or a Unix socket.
 * @param platform The platform.
 * @returns The adapter.
 */
export function nodeAdapter(platform: NodeJS.Platform): LockAdapter {
	const adapter: LockAdapter = {
		probe: (address) =>
			new Promise((resolveProbe) => {
				let text = '';
				let connected = false;
				const socket = connect(address);
				const finish = (probe: Probe): void => {
					socket.destroy();
					resolveProbe(probe);
				};
				socket.setTimeout(PROBE_TIMEOUT_MS, () => finish({ state: 'held', holder: parseHandshake(text) }));
				socket.once('connect', () => (connected = true));
				socket.on('data', (chunk: Buffer) => {
					text += chunk.toString('utf-8');
					if (text.includes('\n') || text.length > MAX_HANDSHAKE_BYTES) finish({ state: 'held', holder: parseHandshake(text) });
				});
				socket.once('end', () => finish({ state: 'held', holder: parseHandshake(text) }));
				socket.once('error', (error) => {
					const code = errorCode(error, 'UNKNOWN');
					if (connected) finish({ state: 'held', holder: parseHandshake(text) });
					else finish(code === 'ENOENT' || code === 'ECONNREFUSED' ? { state: 'free' } : { state: 'error', code });
				});
			}),
		listen: (address, answer) =>
			new Promise((resolveListen) => {
				const none = (): Promise<void> => Promise.resolve();
				if (platform !== 'win32') {
					if (Buffer.byteLength(address) > MAX_SOCKET_BYTES) {
						resolveListen({ result: { state: 'refused', code: 'ENAMETOOLONG' }, release: none });
						return;
					}
					try {
						mkdirSync(dirname(address), { recursive: true });
					} catch (error) {
						resolveListen({ result: { state: 'refused', code: errorCode(error, 'UNKNOWN') }, release: none });
						return;
					}
				}
				const server = createServer((socket) => {
					socket.on('error', () => undefined);
					socket.end(answer());
				});
				server.once('error', (error) => {
					const code = errorCode(error, 'UNKNOWN');
					resolveListen({ result: code === 'EADDRINUSE' ? { state: 'in-use' } : { state: 'refused', code }, release: none });
				});
				server.listen(address, () => {
					server.on('error', () => undefined);
					const release = (): Promise<void> =>
						new Promise((resolveRelease) => {
							server.close(() => {
								if (platform !== 'win32') rmSync(address, { force: true });
								resolveRelease();
							});
						});
					resolveListen({ result: { state: 'ok' }, release });
				});
			}),
		clear: (address) => (platform === 'win32' ? undefined : clearStaleSocket(address, adapter.probe)),
	};
	return adapter;
}

// ─── Running the command ─────────────────────────────────────────────────────

/**
 * Start a command line through the platform shell (`shell: true` with one string, so `.cmd` shims run and DEP0190
 * does not apply), with the wrapper's stdio. On POSIX the child leads its own process group, so `SIGTERM` reaches the
 * whole tree; on Windows the tree is stopped with `taskkill /T /F` (`scripts/lib/child-tree.ts`).
 * @param line The command line.
 * @param env The child's environment.
 * @param cwd The child's folder.
 * @param platform The platform.
 * @returns The running child.
 */
export function startShell(line: string, env: Env, cwd: string, platform: NodeJS.Platform): RunningChild {
	// The lock runs one command string through the platform shell by design (design D15); the line is the owner's own script.
	// nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true, javascript.lang.security.detect-child-process.detect-child-process
	const child = spawn(line, { shell: true, stdio: 'inherit', env, cwd, detached: ownGroup(platform) });
	const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit, rejectExit) => {
		child.once('error', rejectExit);
		child.once('exit', (code, signal) => resolveExit({ code, signal }));
	});
	const stop = (): void => {
		if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
		const plan = treeKillPlan(platform, child.pid, 'SIGTERM');
		// A group the child no longer leads: signal the child itself.
		if (!killTree(plan) && plan.kind === 'group-signal') child.kill('SIGTERM');
	};
	return { exit, stop };
}

/**
 * Run the command and wait for it, stopping its tree when a signal arrives or the wait fails.
 * @param line The command line.
 * @param env The child's environment.
 * @param deps The wrapper's dependencies.
 * @returns The child's exit code, 128 plus the signal number after a signal, or 1 when it could not start.
 */
async function supervise(line: string, env: Env, deps: LockDeps): Promise<number> {
	let child: RunningChild;
	try {
		child = deps.start(line, env, deps.cwd, deps.platform);
	} catch (error) {
		deps.stderr(`ERROR could not start the command: ${error instanceof Error ? error.message : String(error)}`);
		return 1;
	}
	let signalled: number | null = null;
	const handlers = (Object.keys(SIGNAL_EXIT) as NodeJS.Signals[]).map((signal): [NodeJS.Signals, () => void] => [
		signal,
		() => {
			signalled = SIGNAL_EXIT[signal] ?? 1;
			child.stop();
		},
	]);
	for (const [signal, handler] of handlers) deps.signals.on(signal, handler);
	try {
		const { code, signal } = await child.exit;
		if (signalled !== null) return signalled;
		if (code !== null) return code;
		return (signal !== null ? SIGNAL_EXIT[signal] : undefined) ?? 1;
	} catch (error) {
		child.stop();
		deps.stderr(`ERROR the command failed to run: ${error instanceof Error ? error.message : String(error)}`);
		return 1;
	} finally {
		for (const [signal, handler] of handlers) deps.signals.off(signal, handler);
	}
}

/**
 * Take the lock (or check it, under `--no-hold`), run the command and give the lock back.
 * @param args The label, the command, the extra arguments and the mode.
 * @param deps The wrapper's dependencies.
 * @returns The exit code: the command's, 75 when busy, or 2 for an argument the shell cannot carry.
 */
export async function runLock(args: Extract<LockArgs, { mode: 'hold' | 'no-hold' }>, deps: LockDeps): Promise<number> {
	let line: string;
	try {
		line = commandLine(args.command, args.extra, deps.platform);
	} catch (error) {
		if (!(error instanceof LockUsageError)) throw error;
		deps.stderr(`ERROR ${error.message}`);
		return USAGE_EXIT;
	}
	const address = lockAddress(deps.root, deps.platform);
	const inherited = deps.env[TOKEN_VARIABLE];
	const token = deps.newToken();
	const answer = handshake({ pid: deps.pid, label: args.label, command: args.command, started: localIso(deps.now()), token });
	let facts: LockFacts = { ci: isCi(deps.env), mode: args.mode, token: inherited === undefined || inherited === '' ? undefined : inherited, retried: false };
	let release: (() => Promise<void>) | null = null;
	for (let step = 0; step < 16; step++) {
		const action = decide(facts);
		if (action.kind === 'probe-before') {
			facts = { ...facts, before: await deps.adapter.probe(address) };
		} else if (action.kind === 'probe-after') {
			facts = { ...facts, after: await deps.adapter.probe(address) };
		} else if (action.kind === 'listen') {
			const listened = await deps.adapter.listen(address, () => answer);
			if (listened.result.state === 'ok') release = listened.release;
			facts = { ...facts, listen: listened.result };
		} else if (action.kind === 'retry') {
			await deps.adapter.clear(address);
			facts = { ...facts, retried: true, listen: undefined, after: undefined };
		} else if (action.kind === 'busy') {
			for (const message of busyMessage(action.holder, deps.now())) deps.stderr(message);
			return BUSY_EXIT;
		} else {
			if (action.lock === 'unavailable') deps.stderr(`WARNING checkout lock unavailable (${action.code}); running unlocked`);
			const env: Env = { ...deps.env, NO_UPDATE_CHECK: '1' };
			if (action.lock === 'held') env[TOKEN_VARIABLE] = token;
			try {
				return await supervise(line, env, deps);
			} finally {
				if (release !== null) await release();
			}
		}
	}
	throw new Error("the checkout lock's decision did not settle");
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

/**
 * Read the command line.
 * @param argv The arguments after the script.
 * @returns The parsed arguments, or an error to print.
 */
export function parseArgs(argv: readonly string[]): LockArgs | { error: string } {
	const [first, ...rest] = argv;
	if (first === '--probe') {
		if (rest.length > 1) return { error: '--probe takes at most one root' };
		return { mode: 'probe', root: rest[0] ?? null };
	}
	const mode = first === '--no-hold' ? 'no-hold' : 'hold';
	const [label, command, ...extra] = mode === 'no-hold' ? rest : argv;
	if (label === undefined || label === '' || label.startsWith('-')) return { error: 'a label comes first, such as build' };
	if (command === undefined || command.trim() === '') return { error: 'a command string follows the label' };
	return { mode, label, command, extra };
}

/**
 * The real dependencies, with this script's own checkout as the root.
 * @returns The dependencies.
 */
function defaultDeps(): LockDeps {
	return {
		root: resolve(import.meta.dirname, '..'),
		platform: process.platform,
		env: process.env,
		cwd: process.cwd(),
		adapter: nodeAdapter(process.platform),
		start: startShell,
		signals: process,
		stdout: (line) => console.log(line),
		stderr: (line) => console.error(line),
		now: () => new Date(),
		pid: process.pid,
		newToken: () => randomBytes(8).toString('hex'),
	};
}

/**
 * Run the CLI.
 * @param argv The arguments after the script.
 * @param overrides Dependencies to replace, for tests.
 * @returns The exit code.
 */
export async function cli(argv: readonly string[], overrides: Partial<LockDeps> = {}): Promise<number> {
	const deps: LockDeps = { ...defaultDeps(), ...overrides };
	if (overrides.platform !== undefined && overrides.adapter === undefined) deps.adapter = nodeAdapter(deps.platform);
	const args = parseArgs(argv);
	if ('error' in args) {
		deps.stderr(`ERROR ${args.error}`);
		deps.stderr(`ERROR usage: ${USAGE}`);
		return USAGE_EXIT;
	}
	if (args.mode === 'probe') {
		const probe = await deps.adapter.probe(lockAddress(args.root ?? deps.root, deps.platform));
		if (probe.state === 'held' && probe.holder !== null) deps.stdout(handshake(probe.holder).trimEnd());
		return 0;
	}
	return runLock(args, deps);
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (import.meta.main) {
	process.exitCode = await cli(process.argv.slice(2));
}
