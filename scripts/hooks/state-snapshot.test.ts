/**
 * Black-box tests for the state-snapshot hook. Each test runs the script the way Claude Code does: a JSON object on
 * stdin, the result in the exit code and stdout. Projects and transcripts are built in this repository's own
 * gitignored tmp/ folder, never in the system temp folder and never in a tracked folder.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeScratchDir, removeScratchDir } from '../lib/scratch-git.ts';
import { spawnSync } from 'node:child_process';

const HOOK = resolve(import.meta.dirname, 'state-snapshot.mjs');
const sandbox = makeScratchDir('state-hook-test-');
afterAll(() => removeScratchDir(sandbox));

interface Session {
	project: string;
	transcript: string;
}

interface Result {
	status: number | null;
	stdout: string;
}

/**
 * Run the hook with `input` on stdin.
 * @param mode The hook mode.
 * @param input The payload, or raw text.
 * @param projectDir The project folder the hook sees.
 * @returns The exit code and stdout.
 */
function run(mode: string, input: unknown, projectDir: string = sandbox): Result {
	// The project folder is always inside the sandbox, so a test can never write into the real docs/state/.
	const env = { ...process.env, GROK_HOOK_EVENT: '', CLAUDE_PROJECT_DIR: projectDir };
	const result = spawnSync(process.execPath, [HOOK, mode], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', env });
	return { status: result.status, stdout: result.stdout };
}

/**
 * A project folder with a transcript whose last assistant entry reports `tokens` of context.
 * @param name The folder name.
 * @param tokens The context size.
 * @param options `snapshot` adds a state file the session wrote two minutes ago.
 * @param options.snapshot Whether to add that state file.
 * @returns The project and its transcript.
 */
function session(name: string, tokens: number, options: { snapshot?: boolean } = {}): Session {
	const project = join(sandbox, name);
	mkdirSync(join(project, 'docs', 'state'), { recursive: true });
	const at = (minutesAgo: number): string => new Date(Date.now() - minutesAgo * 60000).toISOString();
	const lines: Record<string, unknown>[] = [
		{ type: 'user', timestamp: at(30), message: { content: 'Build the harness. Token: ghp_abcdefghijklmnopqrstuvwxyz0123' } },
		{ type: 'assistant', timestamp: at(29), message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'AGENTS.md' } }], usage: { input_tokens: 3000 } } },
	];
	if (options.snapshot === true) {
		writeFileSync(join(project, 'docs', 'state', '2026-11-11-0700-demo-task.md'), '# demo\n');
		lines.push({
			type: 'assistant',
			timestamp: at(2),
			message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'docs/state/2026-11-11-0700-demo-task.md' } }] },
		});
	}
	lines.push({
		type: 'assistant',
		timestamp: at(1),
		message: { content: [{ type: 'text', text: 'Done so far.' }], usage: { input_tokens: 10, cache_read_input_tokens: tokens - 30, output_tokens: 20 } },
	});
	const transcript = join(project, 'transcript.jsonl');
	writeFileSync(transcript, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
	return { project, transcript };
}

const state = (mode: string, s: Session, extra: Record<string, unknown> = {}): Result => run(mode, { session_id: 's1', transcript_path: s.transcript, ...extra }, s.project);
const grow = (s: Session, tokens: number): Session => Object.assign(s, { transcript: session(s.project.split(/[\\/]/).at(-1) ?? '', tokens).transcript });
const scratchOf = (s: Session): string => join(s.project, 'tmp', 'compact-summaries');

describe('state-snapshot hook', () => {
	it('stays silent below 350,000 tokens and warns at the line', () => {
		const s = session('pressure', 349000);
		expect(state('pressure', s)).toMatchObject({ status: 0, stdout: '' });
		const warned = state('pressure', grow(s, 350500), { hook_event_name: 'PostToolUse' });
		const output = JSON.parse(warned.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
		expect(output.hookSpecificOutput.hookEventName).toBe('PostToolUse');
		expect(output.hookSpecificOutput.additionalContext).toContain('350,500 tokens');
		expect(output.hookSpecificOutput.additionalContext).toContain('trigger: pause-point');
	});

	it('warns again only after 40,000 more tokens, and only while no snapshot is current', () => {
		const s = session('rewarn', 351000);
		expect(state('pressure', s).stdout).not.toBe('');
		expect(state('pressure', grow(s, 385000)).stdout).toBe('');
		expect(state('pressure', grow(s, 391500)).stdout).toContain('supersedes');
		const covered = session('rewarn-covered', 351000);
		expect(state('pressure', covered).stdout).not.toBe('');
		covered.transcript = session('rewarn-covered', 395000, { snapshot: true }).transcript;
		expect(state('pressure', covered).stdout).toBe('');
	});

	it('ignores subagent calls and fails open without a transcript', () => {
		const s = session('subagent', 430000);
		expect(state('pressure', s, { agent_id: 'a1' })).toMatchObject({ status: 0, stdout: '' });
		expect(run('pressure', '')).toMatchObject({ status: 0, stdout: '' });
		expect(run('pressure', { transcript_path: join(sandbox, 'missing.jsonl') })).toMatchObject({ status: 0, stdout: '' });
		expect(run('no-such-mode', {}).status).toBe(0);
	});

	it('never blocks a compaction, prints nothing on stdout and keeps the capture out of tracked folders', () => {
		const s = session('compact', 425000);
		expect(state('pre-compact', s, { trigger: 'manual', custom_instructions: null })).toMatchObject({ status: 0, stdout: '' });
		expect(state('post-compact', s, { trigger: 'manual', compact_summary: 'Summary of the session.' })).toMatchObject({ status: 0, stdout: '' });
		const capture = readdirSync(scratchOf(s)).find((name) => name.includes('-capture-'));
		expect(capture).toBeDefined();
		const text = readFileSync(join(scratchOf(s), capture ?? ''), 'utf8');
		expect(text).toContain('Build the harness.');
		expect(text).toContain('[secret removed by the hook]');
		expect(text).not.toContain('ghp_');
		expect(readdirSync(scratchOf(s)).some((name) => name.includes('-manual-'))).toBe(true);
		expect(readdirSync(join(s.project, 'docs', 'state'))).toEqual([]);
	});

	it('skips the capture on /compact no-state', () => {
		const s = session('bypass', 425000);
		expect(state('pre-compact', s, { trigger: 'manual', custom_instructions: 'no-state' }).status).toBe(0);
		expect(readdirSync(scratchOf(s)).some((name) => name.includes('-capture-'))).toBe(false);
	});

	it('records the size of an automatic compaction', () => {
		const s = session('auto', 441000);
		state('pre-compact', s, { trigger: 'auto', custom_instructions: null });
		const points = JSON.parse(readFileSync(join(scratchOf(s), '.auto-compact-points.json'), 'utf8')) as { tokens: number; session: string }[];
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ tokens: 441000, session: 's1' });
	});

	it('tells the agent after compaction whether a snapshot covers the session', () => {
		const open = session('resume-open', 425000);
		state('pre-compact', open, { trigger: 'manual', custom_instructions: null });
		const asked = state('session-start', open).stdout;
		expect(asked).toContain('no state snapshot covered');
		expect(asked).toContain('trigger: manual-compact');
		expect(asked).toContain('tmp/compact-summaries/');
		const covered = session('resume-covered', 425000, { snapshot: true });
		state('pre-compact', covered, { trigger: 'auto', custom_instructions: null });
		const told = state('session-start', covered).stdout;
		expect(told).toContain('docs/state/2026-11-11-0700-demo-task.md');
		expect(told).toContain('without waiting to be asked');
		expect(existsSync(join(covered.project, 'docs', 'state', 'README.md'))).toBe(false);
	});
});
