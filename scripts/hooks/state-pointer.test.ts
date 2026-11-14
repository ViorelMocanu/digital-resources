import { describe, expect, it } from 'vitest';
import { findCheckout, newestSnapshot, pointerText, renderPointer } from './state-pointer.ts';
import { makeScratchDir, removeScratchDir } from '../lib/scratch-git.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// The state pointer for the tools other than Claude Code (OpenSpec change harness-h1b). Expected texts are written
// by hand from docs/state/README.md, "Reading state at the start of a session".

const README = [
	'# State snapshots',
	'',
	'## Index (newest first)',
	'',
	'| File | Trigger | What it holds |',
	'| --- | --- | --- |',
	'| [2026-11-14-1721-content-decisions.md](2026-11-14-1721-content-decisions.md) | pause-point | The answers |',
	'| [2026-11-14-1650-phase-4-pipeline.md](2026-11-14-1650-phase-4-pipeline.md) | pause-point | Phase 4 |',
	'',
].join('\n');

describe('newestSnapshot', () => {
	it('reads the file of the top row under the index heading', () => {
		expect(newestSnapshot(README)).toBe('2026-11-14-1721-content-decisions.md');
	});

	it('ignores a table above the index heading', () => {
		const above = ['| Mode | Runs on |', '| --- | --- |', '| [2020-01-01-0000-old.md](x) | y |', '', README].join('\n');
		expect(newestSnapshot(above)).toBe('2026-11-14-1721-content-decisions.md');
	});

	it.each(['', '# State snapshots\n\nNo index yet.\n', '## Index (newest first)\n\n| File |\n| --- |\n'])('gives null when there is no row: %j', (text) => {
		expect(newestSnapshot(text)).toBeNull();
	});
});

describe('pointerText', () => {
	it('names the contract, the index and the newest snapshot', () => {
		expect(pointerText('2026-11-14-1721-content-decisions.md', false)).toBe(
			"resurse.dev state: read AGENTS.md first. Then open docs/state/README.md: take the top row of its index (now docs/state/2026-11-14-1721-content-decisions.md), or the newest row with your task's slug, and read its frontmatter and section 1. Write a new snapshot at each trigger that file lists."
		);
	});

	it('still points at the index when no snapshot could be read', () => {
		expect(pointerText(null, false)).toBe(
			"resurse.dev state: read AGENTS.md first. Then open docs/state/README.md: take the top row of its index, or the newest row with your task's slug, and read its frontmatter and section 1. Write a new snapshot at each trigger that file lists."
		);
	});

	it('after a compaction, asks for a snapshot and the Resuming opening', () => {
		const text = pointerText(null, true);
		expect(text).toContain(
			'This session was just compacted: if no snapshot covers the latest work, write one now with trigger: auto-compact, and open your reply with "Resuming:".'
		);
	});

	it('stays within 600 characters, the limit the guard keeps for its messages', () => {
		expect(pointerText('2026-11-14-1721-a-very-long-task-slug-for-the-longest-case.md', true).length).toBeLessThanOrEqual(600);
	});
});

describe('renderPointer', () => {
	it('gives Codex plain text, which it adds as developer context', () => {
		expect(renderPointer('codex', 'hello')).toEqual({ stdout: 'hello\n' });
	});

	it('gives Antigravity one injected step', () => {
		expect(JSON.parse(renderPointer('antigravity', 'hello').stdout)).toEqual({ injectSteps: [{ userMessage: 'hello' }] });
	});

	it.each(['grok', 'cursor', 'claude', 'unknown', ''])('prints nothing for %j', (vendor) => {
		expect(renderPointer(vendor, 'hello')).toEqual({ stdout: '' });
	});
});

describe('findCheckout', () => {
	it('walks up to the folder that holds .git, and gives null outside any checkout', () => {
		const scratch = makeScratchDir('sp-');
		try {
			const root = join(scratch, 'repo');
			mkdirSync(join(root, '.git'), { recursive: true });
			mkdirSync(join(root, 'src', 'deep'), { recursive: true });
			expect(findCheckout(join(root, 'src', 'deep'))).toBe(root);
			expect(findCheckout(root)).toBe(root);
			mkdirSync(join(scratch, 'loose'), { recursive: true });
			expect(findCheckout(join(scratch, 'loose'))).not.toBe(join(scratch, 'loose'));
		} finally {
			removeScratchDir(scratch);
		}
	});
});

describe('the entry point', () => {
	/**
	 * Run the module as a hook, with a payload on stdin.
	 * @param vendor The vendor argument.
	 * @param payload The hook payload.
	 * @returns The exit code and output.
	 */
	function run(vendor: string, payload: unknown): { status: number | null; stdout: string; stderr: string } {
		const result = spawnSync(process.execPath, [join(import.meta.dirname, 'state-pointer.ts'), vendor], { input: JSON.stringify(payload), encoding: 'utf-8', timeout: 20_000 });
		return { status: result.status, stdout: result.stdout, stderr: result.stderr };
	}

	it('points Codex at the newest snapshot of the checkout in the payload, and adds the compaction line on a compact source', () => {
		const scratch = makeScratchDir('sp-');
		try {
			const root = join(scratch, 'repo');
			mkdirSync(join(root, '.git'), { recursive: true });
			mkdirSync(join(root, 'docs', 'state'), { recursive: true });
			writeFileSync(join(root, 'docs', 'state', 'README.md'), README);
			const start = run('codex', { hook_event_name: 'SessionStart', source: 'startup', cwd: root });
			expect(start.status).toBe(0);
			expect(start.stdout).toContain('(now docs/state/2026-11-14-1721-content-decisions.md)');
			expect(start.stdout).not.toContain('just compacted');
			expect(run('codex', { hook_event_name: 'SessionStart', source: 'compact', cwd: root }).stdout).toContain('just compacted');
			// Antigravity names its workspace folders instead of a cwd.
			const step = JSON.parse(run('antigravity', { conversationId: 'c', workspacePaths: [root] }).stdout) as { injectSteps: { userMessage: string }[] };
			expect(step.injectSteps[0]?.userMessage).toContain('(now docs/state/2026-11-14-1721-content-decisions.md)');
			const elsewhere = run('antigravity', { conversationId: 'c', workspacePaths: [join(scratch, 'none')] });
			expect(elsewhere.stdout).not.toContain('2026-11-14-1721-content-decisions.md');
		} finally {
			removeScratchDir(scratch);
		}
	});

	it('fails open: exit 0 and no output on a broken payload or outside a checkout', () => {
		expect(run('codex', 'not an object')).toMatchObject({ status: 0 });
		const broken = spawnSync(process.execPath, [join(import.meta.dirname, 'state-pointer.ts'), 'codex'], { input: '{broken', encoding: 'utf-8', timeout: 20_000 });
		expect(broken.status).toBe(0);
		expect(broken.stderr).toBe('');
	});
});
