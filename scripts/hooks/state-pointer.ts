/**
 * The state pointer for the agent tools other than Claude Code (OpenSpec change harness-h1b).
 *
 * `node scripts/hooks/state-pointer.ts <vendor>` runs at the start of a session (and, in Codex, after a compaction).
 * It reads the hook payload on stdin, finds the checkout from the payload's `cwd` (else the process's own folder) by
 * walking up to the folder that holds `.git`, and points the agent at the state trail: `AGENTS.md`, then the index in
 * `docs/state/README.md` and the snapshot in its top row. It writes nothing and never blocks; every error exits 0.
 *
 * Output per vendor: Codex adds plain stdout of a SessionStart hook to the model's context; Antigravity takes one
 * injected step as JSON. Grok shows a SessionStart hook's output to nobody, and Claude Code has its own state hook
 * (`state-snapshot.mjs`), so both get nothing here.
 *
 * Uses only `node:` built-ins; no side effects on import.
 */

import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

/** The longest pointer, as the guard keeps its block messages: one short paragraph. */
const MAX_POINTER_CHARS = 600;

/** How far up the walk to the checkout goes. */
const MAX_DEPTH = 64;

/** The index heading in docs/state/README.md. */
const INDEX_HEADING = '## Index (newest first)';

/**
 * The file in the top row of the snapshot index.
 * @param readme The text of docs/state/README.md.
 * @returns The file name, or null when the index has no row.
 */
export function newestSnapshot(readme: string): string | null {
	const at = readme.indexOf(INDEX_HEADING);
	if (at === -1) return null;
	const row = /^\| \[([^\]]+\.md)\]/m.exec(readme.slice(at));
	return row?.[1] ?? null;
}

/**
 * The pointer text.
 * @param newest The newest snapshot's file name, or null.
 * @param compacted Whether the session was just compacted.
 * @returns At most {@link MAX_POINTER_CHARS} characters.
 */
export function pointerText(newest: string | null, compacted: boolean): string {
	const now = newest === null ? '' : ` (now docs/state/${newest})`;
	const lines = [
		`resurse.dev state: read AGENTS.md first. Then open docs/state/README.md: take the top row of its index${now}, or the newest row with your task's slug, and read its frontmatter and section 1. Write a new snapshot at each trigger that file lists.`,
	];
	if (compacted)
		lines.push('This session was just compacted: if no snapshot covers the latest work, write one now with trigger: auto-compact, and open your reply with "Resuming:".');
	return lines.join(' ').slice(0, MAX_POINTER_CHARS);
}

/**
 * The hook output for one vendor.
 * @param vendor The vendor argument.
 * @param text The pointer text.
 * @returns What to print on stdout; empty for a vendor that shows a session-start hook's output to nobody.
 */
export function renderPointer(vendor: string, text: string): { stdout: string } {
	if (vendor === 'codex') return { stdout: `${text}\n` };
	if (vendor === 'antigravity') return { stdout: `${JSON.stringify({ injectSteps: [{ userMessage: text }] })}\n` };
	return { stdout: '' };
}

/**
 * The checkout that holds a folder: the nearest folder up the tree with a `.git` entry.
 * @param start The folder to start from.
 * @returns The checkout root, or null.
 */
export function findCheckout(start: string): string | null {
	let dir = start;
	for (let depth = 0; depth < MAX_DEPTH; depth++) {
		if (existsSync(join(dir, '.git'))) return dir;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

/**
 * Read the hook payload: one JSON object on stdin, or an empty object.
 * @returns The payload.
 */
function readPayload(): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(readFileSync(0, 'utf-8'));
		return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/**
 * The hook's entry point. Always exits 0.
 * @param argv The arguments after the script: the vendor.
 */
export function pointerMain(argv: readonly string[] = process.argv.slice(2)): void {
	try {
		const vendor = (argv[0] ?? '').toLowerCase();
		const payload = readPayload();
		// Codex sends `cwd`; Antigravity names its workspace folders instead.
		const workspace = Array.isArray(payload['workspacePaths']) ? payload['workspacePaths'][0] : undefined;
		const cwd = typeof payload['cwd'] === 'string' ? payload['cwd'] : typeof workspace === 'string' ? workspace : process.cwd();
		const root = findCheckout(cwd);
		if (root === null) return;
		const readmePath = join(root, 'docs', 'state', 'README.md');
		const newest = existsSync(readmePath) ? newestSnapshot(readFileSync(readmePath, 'utf-8')) : null;
		const { stdout } = renderPointer(vendor, pointerText(newest, payload['source'] === 'compact'));
		if (stdout !== '') process.stdout.write(stdout);
	} catch {
		// Fails open: a pointer that cannot be built is no pointer.
	} finally {
		process.exitCode = 0;
	}
}

if (import.meta.main) pointerMain();
