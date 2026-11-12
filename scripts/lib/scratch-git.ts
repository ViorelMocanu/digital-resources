/**
 * Test support for real git in throwaway repos (spec harness--pre-commit, test isolation), and for tests that spawn
 * real processes: a scrubbed environment, a POSIX `sh`, waiting on a condition and checking a pid. Not a
 * `*.test.ts` file, so Vitest does not collect it.
 *
 * Scratch folders live under this repo's `tmp/`, never the OS temp folder. Every git call gets an environment
 * without inherited `GIT_*` variables (a hook context such as `GIT_DIR` in pre-push would point it at the real
 * repo), a global config file of its own that sets only `core.autocrlf=false`, and no system config, so the
 * owner's settings cannot change what a test sees. A new repo is checked with `git rev-parse --show-toplevel`
 * before anything else is written in it.
 */

import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROJECT_DIR_VARIABLES } from '../hooks/hook-io.ts';
import { TOKEN_VARIABLE } from './lock-holder.ts';
import { normaliseRoot } from './checkout-root.ts';
import { spawnSync } from 'node:child_process';

/** The repo's own `tmp/` folder. */
const TMP = resolve(import.meta.dirname, '..', '..', 'tmp');

/** The author and committer of every scratch commit, with signing off. */
const IDENTITY = ['-c', 'user.name=Scratch Test', '-c', 'user.email=scratch-test@example.invalid', '-c', 'commit.gpgsign=false'];

/**
 * Create a per-test folder under the repo's `tmp/`.
 * @param prefix The start of the folder name, such as `setup-worktree-`.
 * @returns The absolute path.
 */
export function makeScratchDir(prefix: string): string {
	mkdirSync(TMP, { recursive: true });
	return mkdtempSync(join(TMP, prefix));
}

/**
 * Remove a scratch folder, retrying while Windows still holds a handle in it.
 * @param dir The folder.
 */
export function removeScratchDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

/** The inherited variables {@link scrubbedEnv} removes; both lists match in any letter case. */
export interface EnvScrub {
	/** Whole names, such as `CI`. */
	names?: readonly string[];
	/** Name prefixes, such as `GIT_`. */
	prefixes?: readonly string[];
}

/**
 * The variables that steer the hooks in `scripts/hooks/`: the project-folder variables, every `GROK_*` and
 * `CURSOR_*` one (host detection reads `GROK_HOOK_EVENT` and `CURSOR_VERSION`), the guard's override, the checkout
 * lock's token and git's ceiling list. A spawned hook sees only the ones its test sets.
 */
export const HOOK_ENV: Readonly<EnvScrub> = { names: [...PROJECT_DIR_VARIABLES, 'RESURSE_GUARD_ALLOW', TOKEN_VARIABLE, 'GIT_CEILING_DIRECTORIES'], prefixes: ['GROK_', 'CURSOR_'] };

/**
 * The test process's environment without some inherited variables, plus the given ones.
 * @param scrub The names and prefixes to remove, in any letter case.
 * @param extra Variables to set afterwards.
 * @returns The environment.
 */
export function scrubbedEnv(scrub: EnvScrub, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	const names = new Set(scrub.names?.map((name) => name.toUpperCase()));
	const prefixes = scrub.prefixes?.map((prefix) => prefix.toUpperCase()) ?? [];
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		const upper = key.toUpperCase();
		if (!names.has(upper) && !prefixes.some((prefix) => upper.startsWith(prefix))) env[key] = value;
	}
	return { ...env, ...extra };
}

/**
 * Build the isolated environment for git: the inherited variables minus every name that starts with `GIT_` or
 * another given prefix (in any letter case), a global config file in `dir`, and no system config.
 * @param dir The scratch folder that receives the global config file.
 * @param scrubPrefixes More variable prefixes to remove, such as `T3CODE_`.
 * @returns The environment.
 */
export function isolatedGitEnv(dir: string, scrubPrefixes: readonly string[] = []): NodeJS.ProcessEnv {
	const globalConfig = join(dir, 'gitconfig-global');
	writeFileSync(globalConfig, '[core]\n\tautocrlf = false\n');
	return scrubbedEnv({ prefixes: ['GIT_', ...scrubPrefixes] }, { GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' });
}

/**
 * Run git without a shell, as the scratch identity, and fail on a non-zero exit.
 * @param cwd The folder.
 * @param env The environment, from {@link isolatedGitEnv}.
 * @param args Git arguments.
 * @param input Text for stdin.
 * @returns Stdout.
 * @throws {Error} When git exits non-zero, with its stderr.
 */
export function scratchGit(cwd: string, env: NodeJS.ProcessEnv, args: readonly string[], input?: string): string {
	const result = spawnSync('git', [...IDENTITY, ...args], { cwd, env, encoding: 'utf-8', input });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
	}
	return result.stdout;
}

/**
 * Put an existing path in a form that compares equal across separators and drive-letter case.
 * @param path The path.
 * @returns The comparable form.
 */
export function comparable(path: string): string {
	return normaliseRoot(realpathSync.native(resolve(path)), process.platform);
}

/**
 * Create a repo whose first branch is `main`, and check, before anything is written in it, that git now acts on
 * this repo and not on the one around it.
 * @param root An existing empty folder under the repo's `tmp/`.
 * @param env The environment, from {@link isolatedGitEnv}.
 * @throws {Error} When `git rev-parse --show-toplevel` names another folder.
 */
export function initScratchRepo(root: string, env: NodeJS.ProcessEnv): void {
	scratchGit(root, env, ['-c', 'init.defaultBranch=main', 'init', '-q']);
	const top = scratchGit(root, env, ['rev-parse', '--show-toplevel']).trim();
	if (comparable(top) !== comparable(root)) {
		throw new Error(`refusing to write: git resolves ${root} to the repository at ${top}`);
	}
}

// ─── Spawned processes ───────────────────────────────────────────────────────

/** The `sh` that {@link findSh} found, kept for the rest of the run. */
let foundSh: string | undefined;

/**
 * Find a POSIX `sh`: the one on the path, or on Windows Git for Windows' `bin/sh.exe`, three levels up from
 * `git --exec-path`. Node started from PowerShell finds no `sh` on the path. The search runs once per test file.
 * @returns The command to spawn.
 * @throws {Error} When neither exists.
 */
export function findSh(): string {
	if (foundSh !== undefined) return foundSh;
	if (!spawnSync('sh', ['-c', 'exit 0']).error) {
		foundSh = 'sh';
		return foundSh;
	}
	if (process.platform === 'win32') {
		const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf-8' }).stdout.trim();
		const candidate = resolve(execPath, '..', '..', '..', 'bin', 'sh.exe');
		if (existsSync(candidate)) {
			foundSh = candidate;
			return foundSh;
		}
	}
	throw new Error('No POSIX sh found: install Git for Windows, or put sh on PATH.');
}

/**
 * Wait until a condition holds, checking every 25 ms.
 * @param check The condition.
 * @param what What is awaited, for the timeout message.
 * @param timeoutMs How long to wait.
 * @throws {Error} When the condition still fails after the timeout.
 */
export async function waitFor(check: () => boolean, what: string, timeoutMs = 15_000): Promise<void> {
	const until = Date.now() + timeoutMs;
	while (!check()) {
		if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
		await new Promise((resolveWait) => setTimeout(resolveWait, 25));
	}
}

/**
 * Whether a process is alive. Signal 0 only checks: `ESRCH` means no such process, while `EPERM` means one exists
 * that this process may not signal.
 * @param pid The process id.
 * @returns True while it runs.
 */
export function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}
