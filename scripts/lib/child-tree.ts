/**
 * Stopping a child's whole process tree (OpenSpec change harness-guardrails, design D15 "Child cleanup" and D23
 * "a bounded wrapper").
 *
 * The checkout lock and the Semgrep wrapper both start a child that may start more processes, and both must stop all
 * of them: `taskkill /PID <pid> /T /F` on Windows, and elsewhere a signal to the child's process group, which exists
 * only because the child was spawned detached ({@link ownGroup}). The lock sends `SIGTERM`, the Semgrep time limit
 * `SIGKILL`.
 *
 * Uses only `node:` built-ins; no side effects on import.
 */

import { spawnSync } from 'node:child_process';

/** How to stop a process and every process it started: a command to run, or a signal to its process group. */
export type TreeKillPlan = { kind: 'command'; file: string; args: string[] } | { kind: 'group-signal'; pid: number; signal: NodeJS.Signals };

/**
 * Whether a child should be spawned `detached`, so that it leads its own process group and {@link treeKillPlan} can
 * reach the whole tree: off Windows only, where `detached` would open a new console instead.
 * @param platform The platform, such as `process.platform`.
 * @returns True off Windows.
 */
export function ownGroup(platform: NodeJS.Platform): boolean {
	return platform !== 'win32';
}

/**
 * How to stop a child's whole process tree on a platform.
 * @param platform The platform, such as `process.platform`.
 * @param pid The child's process id.
 * @param signal The signal for the process group off Windows; `taskkill /F` on Windows has no signal.
 * @returns The plan {@link killTree} carries out.
 */
export function treeKillPlan(platform: NodeJS.Platform, pid: number, signal: NodeJS.Signals = 'SIGKILL'): TreeKillPlan {
	if (platform === 'win32') return { kind: 'command', file: 'taskkill', args: ['/PID', String(pid), '/T', '/F'] };
	// The child runs detached (ownGroup), so it leads its own process group and a negative pid reaches all of it.
	return { kind: 'group-signal', pid: -pid, signal };
}

/**
 * Carry out a tree-kill plan, synchronously and without throwing.
 * @param plan From {@link treeKillPlan}.
 * @returns True when `taskkill` succeeded or the signal was sent; false when the tree was already gone or could not
 *   be reached.
 */
export function killTree(plan: TreeKillPlan): boolean {
	try {
		// The only command plan is taskkill with a process id; no shell.
		// nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
		if (plan.kind === 'command') return spawnSync(plan.file, plan.args, { stdio: 'ignore', windowsHide: true }).status === 0;
		process.kill(plan.pid, plan.signal);
		return true;
	} catch {
		return false;
	}
}
