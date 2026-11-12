#!/usr/bin/env node
/**
 * Claude Code hook for the state-snapshot convention (docs/state/README.md).
 * This docblock is the single description of the hook's behaviour; other documents point here.
 * The variant that never blocks, with one deliberate property described under "Public repository" below.
 *
 * It never blocks anything: no tool call, no prompt, no compaction. T3 Code's own auto-compaction reaches
 * Claude Code as a manual compaction, so a hook that paused a manual /compact made T3's compaction fail and the
 * session ran on into a lossy automatic one. A hook also cannot give the agent a turn. So instead:
 *   1. The pressure warning keeps an agent-written snapshot close to current: it fires HEADROOM tokens before the
 *      compaction point and repeats every REWARN_TOKENS of growth while the session has worked since its snapshot.
 *   2. Pre-compact saves a word-for-word capture from the transcript (owner messages since the last compaction,
 *      files written or edited, agent replies since the last snapshot) to the gitignored scratch folder.
 *   3. After the compaction, session-start tells the agent which snapshot covers the session, or asks it to
 *      write one from the compaction summary and the capture.
 *
 * Numbers: T3 Code "Auto-compact after" is 450,000 tokens for the Claude providers. DEFAULT_POINT is 440,000
 * (compaction fires a little before the setting) and HEADROOM is 90,000, because the owner asked for an early first
 * warning: it comes at 350,000, and the next ones at 390,000 and 430,000 (REWARN_TOKENS is 40,000). Once automatic
 * compactions have been recorded, their median replaces DEFAULT_POINT.
 *
 * Public repository: this repository is public, and the chat may hold things that must not be published. The
 * hook therefore writes only to the gitignored tmp/compact-summaries/ and never to docs/state/. The tracked
 * snapshot is always written by the agent, which applies the content rules of docs/state/README.md.
 *
 * "Current" (snapshotIsCurrent): the session's snapshot was written at most GRACE_MINUTES before its last
 * main-thread tool call. The write time is the newest of (a) the last main-thread Write or Edit to a file in
 * docs/state/ whose name starts with a date, and (b) the modification time of the newest state file for the
 * session's task slug (the slug of the last state path any main-thread tool call named), which covers files
 * written through a shell. Age alone never matters, so an idle conversation needs no new snapshot. Without a
 * readable transcript, a newest state file younger than FRESH_MINUTES counts as current.
 *
 * Per-session files: the trigger and capture records are keyed by session_id, because SessionStart can fire
 * before PostCompact and would otherwise read another session's record.
 *
 * Modes (first CLI argument):
 *   pressure       PostToolUse (all tools) and UserPromptSubmit. The context size is the token sum of the last
 *                  main-thread assistant usage entry in the transcript's tail. Within HEADROOM of the compaction
 *                  point it adds one message to the agent's context asking for a pause-point snapshot. The marker
 *                  .pressure-<session_id> keeps the size at the last warning; after every further REWARN_TOKENS
 *                  it warns again, unless the snapshot is current (then it only moves the marker). Below the line
 *                  the marker is removed and the next cycle starts. Subagent calls (agent_id) are skipped.
 *   pre-compact    PreCompact, manual and automatic. Records the trigger in .last-trigger-<session_id>, writes
 *                  the capture (<stamp>-capture-<session>.md) and its name in .capture-<session_id>, and on "auto" records
 *                  { tokens, session, at } in .auto-compact-points.json (newest KEEP_POINTS). It prints nothing
 *                  on stdout, because Claude Code would use that text as instructions for the summary.
 *                  `/compact no-state` skips the capture.
 *   post-compact   PostCompact, manual and automatic. Saves a non-empty compact_summary to
 *                  <stamp>-<trigger>-<session>.md, keeping the newest KEEP_SUMMARIES files, and on "auto" adds the size
 *                  after compaction to the newest record of the same session.
 *   session-start  SessionStart, matcher "compact". Prints a reminder that Claude Code puts into the agent's
 *                  context in the first turn after compaction: the snapshot that covers the session, or a
 *                  request to write one now, with the paths of the summary and the capture. Either way the
 *                  agent's reply opens with "Resuming:" (original request, snapshot path, next step).
 *
 * Every mode fails open: any error exits 0. Tests: scripts/hooks/state-snapshot.test.ts.
 */

import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_POINT = 440000;
const HEADROOM = 90000;
const REWARN_TOKENS = 40000;
// Compaction points recorded before this date belong to another setting and are ignored.
const POINTS_SINCE = '2026-11-11';
const KEEP_POINTS = 5;
const FRESH_MINUTES = 30;
const GRACE_MINUTES = 5;
const KEEP_SUMMARIES = 20; // A summary and a capture per compaction: the last 10 compactions.
const BYPASS_WORD = 'no-state';
const STATE_DIR = 'docs/state';
const SCRATCH_DIR = 'tmp/compact-summaries';
// A state file name: a date, an optional HHMM time (worker progress files have none), then the task slug.
const STATE_NAME = String.raw`\d{4}-\d{2}-\d{2}(?:-\d{4})?-`;
const STATE_PATH_RE = new RegExp(String.raw`docs[\\/]+state[\\/]+${STATE_NAME}[^"\\/]+\.md`);
const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?-.+\.md$/;
const CAPTURE_MESSAGE_CHARS = 4000;
const CAPTURE_OWNER_CHARS = 60000;
const CAPTURE_REPLIES_CHARS = 40000;
const SECRET_RE =
	/\b(?:hf_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|pplx-[A-Za-z0-9]{20,})\b/g;
const TAIL_START_BYTES = 256 * 1024;
const TAIL_MAX_BYTES = 8 * 1024 * 1024;

const mode = process.argv[2];
const input = parseInput(readStdin());
// Grok CLI runs the hooks in .claude/settings.json once the folder is trusted. Its transcripts hold no Claude
// usage entries, and it must not move the compaction point learned for Claude Code.
const foreign = Boolean(process.env.GROK_HOOK_EVENT);
const trigger = typeof input.trigger === 'string' ? input.trigger : 'unknown';
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const stateDir = join(root, STATE_DIR);
const scratchDir = join(root, SCRATCH_DIR);
const sessionKey = String(input.session_id ?? 'unknown').replace(/[^\w-]/g, '_');
// Parallel sessions can compact in the same minute, so every file name carries the start of the session id.
const sessionTag = sessionKey.slice(0, 8);
const triggerFile = join(scratchDir, `.last-trigger-${sessionKey}`);
const capturePointer = join(scratchDir, `.capture-${sessionKey}`);
const pointsFile = join(scratchDir, '.auto-compact-points.json');

/**
 * All of stdin, or an empty string when it cannot be read.
 * @returns {string}
 */
function readStdin() {
	try {
		return readFileSync(0, 'utf8');
	} catch {
		return '';
	}
}

/**
 * The hook input object, or an empty one when stdin is empty or not a JSON object (fail open).
 * @param {string} raw
 * @returns {Record<string, any>}
 */
function parseInput(raw) {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * The newest automatic compactions, oldest first: `{ tokens, session, at, after? }`. Empty when unreadable.
 * @returns {{ tokens: number, session?: string, at?: string, after?: number }[]}
 */
function compactionRecords() {
	try {
		const records = JSON.parse(readFileSync(pointsFile, 'utf8'));
		return Array.isArray(records) ? records.filter((r) => Number.isFinite(r?.tokens) && r.tokens > 0) : [];
	} catch {
		return [];
	}
}

/**
 * The auto-compaction point: the median of the points recorded since POINTS_SINCE (lower middle for an even
 * count), or DEFAULT_POINT when none is recorded.
 * @returns {number}
 */
function compactionPoint() {
	const sorted = compactionRecords()
		.filter((r) => typeof r.at === 'string' && r.at >= POINTS_SINCE)
		.map((r) => r.tokens)
		.sort((a, b) => a - b);
	return sorted[Math.floor((sorted.length - 1) / 2)] ?? DEFAULT_POINT;
}

/** @param {number} n */
const pad2 = (n) => String(n).padStart(2, '0');
/** @param {number} n */
const count = (n) => n.toLocaleString('en-US');

/**
 * Trimmed text of a file, or `fallback` when it is missing or unreadable.
 * @param {string} file
 * @param {string} [fallback]
 * @returns {string}
 */
function readTrim(file, fallback = '') {
	try {
		return readFileSync(file, 'utf8').trim();
	} catch {
		return fallback;
	}
}

/**
 * The value `pick` returns for the last transcript line that contains `needle` and for which `pick` gives a
 * value. Reads only the tail, doubling it until a match turns up, because long transcripts pass 20 MB.
 * Null when none is found.
 * @template T
 * @param {string} path
 * @param {string} needle
 * @param {(entry: any) => T | undefined} pick
 * @returns {T | null}
 */
function lastInTranscript(path, needle, pick) {
	const fd = openSync(path, 'r');
	try {
		const size = fstatSync(fd).size;
		for (let span = TAIL_START_BYTES; ; span *= 2) {
			const start = Math.max(0, size - span);
			const buffer = Buffer.alloc(size - start);
			readSync(fd, buffer, 0, buffer.length, start);
			const lines = buffer.toString('utf8').split('\n');
			if (start > 0) lines.shift(); // The first line may be cut.
			for (let i = lines.length - 1; i >= 0; i--) {
				const line = lines[i];
				if (line === undefined || !line.includes(needle)) continue;
				let value;
				try {
					value = pick(JSON.parse(line));
				} catch {
					continue;
				}
				if (value !== undefined) return value;
			}
			if (start === 0 || span >= TAIL_MAX_BYTES) return null;
		}
	} finally {
		closeSync(fd);
	}
}

/**
 * Context size of the session: the token sum of the last main-thread assistant usage entry in the transcript.
 * @param {string | undefined} path
 * @returns {number | null}
 */
function contextTokens(path) {
	if (!path || !existsSync(path)) return null;
	return lastInTranscript(path, '"usage"', (entry) => {
		const usage = entry?.type === 'assistant' && entry.isSidechain !== true ? entry.message?.usage : undefined;
		return usage ? (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.output_tokens ?? 0) : undefined;
	});
}

/**
 * Dated Markdown files in a directory, oldest first (the date prefix sorts chronologically).
 * @param {string} dir
 * @returns {string[]}
 */
function stampedFiles(dir) {
	return existsSync(dir)
		? readdirSync(dir)
				.filter((name) => STAMP_RE.test(name))
				.sort()
		: [];
}

/**
 * Minutes since the newest state file: from the time in its name, or from its modification time when the name
 * holds only a date. Infinity if there is none.
 * @returns {number}
 */
function newestStateAgeMinutes() {
	const newest = stampedFiles(stateDir).at(-1);
	const match = newest ? STAMP_RE.exec(newest) : null;
	if (!newest || !match) return Infinity;
	const at =
		match[4] === undefined
			? statSync(join(stateDir, newest)).mtimeMs
			: new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])).getTime();
	return (Date.now() - at) / 60000;
}

/**
 * Time (ms) of the last main-thread assistant entry whose tool calls satisfy `test`, or null.
 * @param {string | undefined} path
 * @param {string} needle
 * @param {(call: any) => boolean} test
 * @returns {number | null}
 */
function lastToolCallAt(path, needle, test) {
	if (!path || !existsSync(path)) return null;
	return lastInTranscript(path, needle, (entry) => {
		if (entry?.type !== 'assistant' || entry.isSidechain === true || !Array.isArray(entry.message?.content)) return undefined;
		const hit = entry.message.content.some((/** @type {any} */ part) => part?.type === 'tool_use' && test(part));
		const at = hit ? Date.parse(entry.timestamp) : NaN;
		return Number.isFinite(at) ? at : undefined;
	});
}

/**
 * The task slug of the last state path any main-thread tool call named (Write, Edit, Bash, Read...), or null.
 * @param {string | undefined} path
 * @returns {string | null}
 */
function sessionSlug(path) {
	if (!path || !existsSync(path)) return null;
	const slugRe = new RegExp(String.raw`docs[\\/]+state[\\/]+${STATE_NAME}([\w.-]+?)\.md`, 'g');
	return lastInTranscript(path, 'state', (entry) => {
		if (entry?.type !== 'assistant' || entry.isSidechain === true || !Array.isArray(entry.message?.content)) return undefined;
		let slug;
		for (const part of entry.message.content) {
			if (part?.type !== 'tool_use') continue;
			for (const m of JSON.stringify(part.input ?? {}).matchAll(slugRe)) slug = m[1];
		}
		return slug;
	});
}

/** @type {string | null | undefined} */
let cachedSlug;

/**
 * The session's task slug (sessionSlug), scanned once per hook call.
 * @returns {string | null}
 */
function taskSlug() {
	if (cachedSlug === undefined) cachedSlug = sessionSlug(input.transcript_path);
	return cachedSlug;
}

/**
 * File name of the newest state file for `slug`, or undefined.
 * @param {string | null} slug
 * @returns {string | undefined}
 */
function newestSnapshotFor(slug) {
	return slug
		? stampedFiles(stateDir)
				.filter((name) => name.endsWith(`-${slug}.md`))
				.at(-1)
		: undefined;
}

/**
 * When the session's snapshot was last written (ms): the newest of the last main-thread Write or Edit to a
 * state file and the modification time of the newest state file for the session's task slug. Null when there
 * is neither.
 * @param {string} path
 * @returns {number | null}
 */
function snapshotWrittenAt(path) {
	const wroteByTool = lastToolCallAt(path, 'state', (call) => (call.name === 'Write' || call.name === 'Edit') && STATE_PATH_RE.test(String(call.input?.file_path ?? '')));
	const newest = newestSnapshotFor(taskSlug());
	const wroteOnDisk = newest ? statSync(join(stateDir, newest)).mtimeMs : null;
	const wrote = Math.max(wroteByTool ?? -Infinity, wroteOnDisk ?? -Infinity);
	return Number.isFinite(wrote) ? wrote : null;
}

/**
 * Whether a snapshot covers the session's latest work. See "Current" in the docblock.
 * @returns {boolean}
 */
function snapshotIsCurrent() {
	try {
		const path = input.transcript_path;
		if (path && existsSync(path)) {
			const wrote = snapshotWrittenAt(path);
			if (wrote === null) return false;
			const worked = lastToolCallAt(path, '"tool_use"', () => true) ?? wrote;
			return worked <= wrote + GRACE_MINUTES * 60000;
		}
	} catch {
		// Unreadable transcript: fall back to the age rule.
	}
	try {
		return newestStateAgeMinutes() <= FRESH_MINUTES;
	} catch {
		return false;
	}
}

/**
 * Repo-relative path of the newest state file for the session's task slug, or null.
 * @returns {string | null}
 */
function newestTaskSnapshot() {
	try {
		const newest = newestSnapshotFor(taskSlug());
		return newest ? `${STATE_DIR}/${newest}` : null;
	} catch {
		return null;
	}
}

/**
 * Local "YYYY-MM-DD HH:MM" for a time in ms, or "unknown time".
 * @param {number} ms
 * @returns {string}
 */
function localTime(ms) {
	if (!Number.isFinite(ms)) return 'unknown time';
	const d = new Date(ms);
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Local timestamp in the convention's YYYY-MM-DD-HHMM form.
 * @returns {string}
 */
function localStamp() {
	return localTime(Date.now()).replace(' ', '-').replace(':', '');
}

/**
 * Text as a Markdown blockquote, with obvious secrets replaced. Cut at `max` characters, the cut marked.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function quote(text, max) {
	let t = text.replace(/\r\n/g, '\n').replace(SECRET_RE, '[secret removed by the hook]').trim();
	if (t.length > max) t = `${t.slice(0, max)}\n[... ${count(t.length - max)} more characters cut by the hook]`;
	return t
		.split('\n')
		.map((line) => (line ? `> ${line}` : '>'))
		.join('\n');
}

/**
 * What the owner typed in a user entry, or null for tool results and harness text. A slash command becomes
 * "/name args"; images become "[image]"; system reminders are dropped.
 * @param {unknown} content
 * @returns {string | null}
 */
function ownerText(content) {
	/** @param {string} s */
	const clean = (s) => {
		const command = /<command-name>([^<]*)<\/command-name>/.exec(s);
		if (command) {
			const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(s)?.[1]?.trim();
			return `${(command[1] ?? '').trim()}${args ? ` ${args}` : ''}`;
		}
		if (s.trimStart().startsWith('<local-command')) return '';
		return s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
	};
	if (typeof content === 'string') return clean(content) || null;
	if (!Array.isArray(content) || content.some((part) => part?.type === 'tool_result')) return null;
	const text = content
		.map((part) => (part?.type === 'text' ? clean(String(part.text ?? '')) : part?.type === 'image' ? '[image]' : ''))
		.filter(Boolean)
		.join('\n\n');
	return text || null;
}

/**
 * Items that fit in `max` characters: the first, then the newest, with a note on how many were left out.
 * @param {string[]} items
 * @param {number} max
 * @param {boolean} keepFirst
 * @returns {string[]}
 */
function fitNewest(items, max, keepFirst) {
	const total = items.reduce((n, s) => n + s.length, 0);
	if (total <= max) return items;
	const head = keepFirst && items.length > 0 ? [items[0] ?? ''] : [];
	let used = head.reduce((n, s) => n + s.length, 0);
	/** @type {string[]} */
	const tail = [];
	for (let i = items.length - 1; i >= head.length; i--) {
		if (used + (items[i] ?? '').length > max) break;
		used += (items[i] ?? '').length;
		tail.unshift(items[i] ?? '');
	}
	const dropped = items.length - head.length - tail.length;
	return [...head, `_${dropped} ${keepFirst ? 'messages in the middle' : 'earlier replies'} left out by the hook to stay under ${count(max)} characters._\n`, ...tail];
}

/**
 * The word-for-word capture written before compaction, from the transcript: the owner's messages since the last
 * compaction boundary, the files written or edited in that window, and the agent's replies since the last
 * snapshot. Null when the transcript is unreadable.
 * @param {string | undefined} path
 * @returns {string | null}
 */
function buildCapture(path) {
	if (!path || !existsSync(path)) return null;
	const lines = readFileSync(path, 'utf8').split('\n');
	let start = 0;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (!(lines[i] ?? '').includes('"compact_boundary"')) continue;
		try {
			if (JSON.parse(lines[i] ?? '').subtype === 'compact_boundary') {
				start = i + 1;
				break;
			}
		} catch {
			// Not a boundary line.
		}
	}
	let since = null;
	try {
		since = snapshotWrittenAt(path);
	} catch {
		// No snapshot time: replies are taken from the whole window.
	}
	/** @type {{ at: number, text: string }[]} */
	const owner = [];
	/** @type {{ at: number, text: string }[]} */
	const replies = [];
	/** @type {Map<string, Map<string, number>>} */
	const files = new Map();
	let windowStart = NaN;
	for (const line of lines.slice(start)) {
		if (!line.trim()) continue;
		let entry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		if (entry?.isSidechain === true) continue;
		const at = Date.parse(entry?.timestamp);
		if (!Number.isFinite(windowStart) && Number.isFinite(at)) windowStart = at;
		if (entry?.type === 'user' && !entry.isMeta && !entry.isCompactSummary) {
			const text = ownerText(entry.message?.content);
			if (text) owner.push({ at, text });
		} else if (entry?.type === 'assistant' && Array.isArray(entry.message?.content)) {
			for (const part of entry.message.content) {
				if (part?.type === 'tool_use' && ['Write', 'Edit', 'NotebookEdit'].includes(part.name)) {
					const file = String(part.input?.file_path ?? part.input?.notebook_path ?? '');
					if (!file) continue;
					const counts = files.get(file) ?? new Map();
					counts.set(part.name, (counts.get(part.name) ?? 0) + 1);
					files.set(file, counts);
				} else if (part?.type === 'text' && String(part.text ?? '').trim() && (since === null || at > since)) {
					replies.push({ at, text: String(part.text) });
				}
			}
		}
	}
	const ownerBlocks = fitNewest(
		owner.map((m, i) => `### Message ${i + 1}, ${localTime(m.at)}\n\n${quote(m.text, CAPTURE_MESSAGE_CHARS)}\n`),
		CAPTURE_OWNER_CHARS,
		true
	);
	const replyBlocks = fitNewest(
		replies.map((r, i) => `### Reply ${i + 1}, ${localTime(r.at)}\n\n${quote(r.text, CAPTURE_REPLIES_CHARS)}\n`),
		CAPTURE_REPLIES_CHARS,
		false
	);
	const rootSlash = root.replace(/\\/g, '/').replace(/\/?$/, '/').toLowerCase();
	/** @param {string} file */
	const relative = (file) => {
		const f = file.replace(/\\/g, '/');
		return f.toLowerCase().startsWith(rootSlash) ? f.slice(rootSlash.length) : f;
	};
	const fileLines = [...files].map(([file, counts]) => `- \`${relative(file)}\` (${[...counts].map(([tool, n]) => `${tool} ${n}`).join(', ')})`);
	return [
		'# Word-for-word capture before compaction',
		'',
		'Private: this file may hold personal details from the chat. It stays in the gitignored scratch folder and is never copied whole into a tracked file.',
		'',
		`- Written: ${localTime(Date.now())}, compaction trigger: ${trigger}`,
		`- Session: ${input.session_id ?? 'unknown'}`,
		`- Window: the chat log since the last compaction (from ${localTime(windowStart)}), ${owner.length} owner messages`,
		`- Agent replies: ${since === null ? 'the whole window (no snapshot found for this session)' : `since the last snapshot (${localTime(since)})`}`,
		'',
		'Written by the PreCompact hook from the chat log; nothing here is summarised. Long messages are cut and every cut is marked. Obvious secrets (API keys, tokens) are replaced.',
		'',
		'## Owner messages, word for word',
		'',
		...(ownerBlocks.length ? ownerBlocks : ['None.', '']),
		'## Files written or edited',
		'',
		...(fileLines.length ? fileLines : ['None.']),
		'',
		'## Agent replies since the last snapshot, word for word',
		'',
		...(replyBlocks.length ? replyBlocks : ['None.', '']),
	].join('\n');
}

/**
 * File name of this session's capture in the scratch folder, or null when the pointer or the file is missing.
 * @returns {string | null}
 */
function readCaptureName() {
	const name = readTrim(capturePointer);
	return name && existsSync(join(scratchDir, name)) ? name : null;
}

/** Run one mode. Every mode ends with exit code 0. */
function main() {
	if (mode === 'pre-compact') {
		if (foreign) return;
		const bypass = typeof input.custom_instructions === 'string' && input.custom_instructions.includes(BYPASS_WORD);
		try {
			mkdirSync(scratchDir, { recursive: true });
			writeFileSync(triggerFile, bypass ? 'manual-bypass' : trigger, 'utf8');
			rmSync(capturePointer, { force: true });
			const tokens = trigger === 'auto' ? contextTokens(input.transcript_path) : null;
			if (tokens !== null) {
				const record = { tokens, session: input.session_id, at: new Date().toISOString() };
				writeFileSync(pointsFile, JSON.stringify([...compactionRecords(), record].slice(-KEEP_POINTS)), 'utf8');
			}
		} catch {
			// Best effort: a failed write must never fail the compaction.
		}
		if (bypass) return;
		try {
			const capture = buildCapture(input.transcript_path);
			if (capture !== null) {
				const name = `${localStamp()}-capture-${sessionTag}.md`;
				writeFileSync(join(scratchDir, name), capture, 'utf8');
				writeFileSync(capturePointer, name, 'utf8');
			}
		} catch (error) {
			// Best effort: the compaction goes ahead without a capture. stderr only: stdout would steer the summary.
			process.stderr.write(`state-snapshot hook: could not write the capture (${error})\n`);
		}
		return;
	}

	if (mode === 'post-compact') {
		if (typeof input.compact_summary === 'string' && input.compact_summary.length > 0) {
			mkdirSync(scratchDir, { recursive: true });
			writeFileSync(join(scratchDir, `${localStamp()}-${trigger}-${sessionTag}.md`), input.compact_summary, 'utf8');
			for (const old of stampedFiles(scratchDir).slice(0, -KEEP_SUMMARIES)) rmSync(join(scratchDir, old), { force: true });
		}
		// The size after an automatic compaction, from the boundary entry, joins this session's newest record.
		const records = compactionRecords();
		const last = records.at(-1);
		if (!foreign && trigger === 'auto' && last && last.session === input.session_id && last.after === undefined && input.transcript_path && existsSync(input.transcript_path)) {
			const after = lastInTranscript(input.transcript_path, '"compactMetadata"', (entry) => entry?.compactMetadata?.postTokens);
			if (after !== null) writeFileSync(pointsFile, JSON.stringify([...records.slice(0, -1), { ...last, after }]), 'utf8');
		}
		return;
	}

	if (mode === 'session-start') {
		const last = readTrim(triggerFile, 'unknown');
		const stateTrigger = last === 'auto' ? 'auto-compact' : 'manual-compact';
		const resume =
			' Open your reply with a short "Resuming:" block: the original request (from the snapshot\'s section 2 or the summary), the snapshot path, and the next step.' +
			(last === 'auto'
				? ' Then carry on with that next step without waiting to be asked.'
				: ' Then, if the owner\'s message gives a new instruction, follow it; if it only says to continue (for example "continue"), do that next step.');
		const captureName = readCaptureName();
		const captureNote = captureName
			? ` A word-for-word capture of the owner's messages and your replies from before the compaction is at ${SCRATCH_DIR}/${captureName}: use it for exact wording and for detail the summary dropped. It is private; never copy it whole into a tracked file.`
			: '';
		let message;
		if (last !== 'manual-bypass' && snapshotIsCurrent()) {
			const current = newestTaskSnapshot() ?? `the newest state file for this task in ${STATE_DIR}/`;
			message = `The context was just compacted (trigger: ${last}). A state snapshot already covered the latest work: ${current}. Read its sections 1, 2 and 5.${resume}`;
		} else {
			message = `The context was just compacted (trigger: ${last}) and no state snapshot covered the session's latest work. Write one now in ${STATE_DIR}/ with trigger: ${stateTrigger}, rebuilt from the compaction summary in your context (copies are under ${SCRATCH_DIR}/). Follow ${STATE_DIR}/README.md, including its content rules for a public repository, and say in section 10 that detail may have been lost.${resume}`;
		}
		process.stdout.write(`${message}${captureNote}\n`);
		return;
	}

	if (mode === 'pressure') {
		// A subagent's tool calls carry agent_id; its context is not the main session's.
		if (foreign || input.agent_id) return;
		const tokens = contextTokens(input.transcript_path);
		if (tokens === null) return;
		const point = compactionPoint();
		const marker = join(scratchDir, `.pressure-${sessionKey}`);
		if (tokens < point - HEADROOM) {
			rmSync(marker, { force: true }); // Below the line again: arm the next cycle's warning.
			return;
		}
		const warnedAt = Number(readTrim(marker, 'NaN'));
		const first = !Number.isFinite(warnedAt);
		if (!first && tokens < warnedAt + REWARN_TOKENS) return;
		mkdirSync(scratchDir, { recursive: true });
		writeFileSync(marker, String(tokens), 'utf8');
		if (!first && snapshotIsCurrent()) return;
		const where = `Context is at ${count(tokens)} tokens, within ${count(HEADROOM)} tokens of the automatic compaction point (about ${count(point)}).`;
		const ask = first
			? `Project rule (AGENTS.md, State files): at this point the agent writes a state snapshot with trigger: pause-point before any other tool call, following ${STATE_DIR}/README.md, tells the owner its path in one line, then carries on. It is not postponed to a later turn.`
			: `The session has worked since its last state snapshot. Project rule (AGENTS.md, State files): the agent now writes a new snapshot with trigger: pause-point that supersedes it, before any other tool call, so that compaction keeps the latest decisions, wording and next step; it tells the owner the path in one line, then carries on.`;
		process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name ?? 'PostToolUse', additionalContext: `${where} ${ask}` } }));
		return;
	}

	process.stderr.write(`state-snapshot hook: unknown mode "${mode}"\n`);
}

try {
	main();
} catch {
	// Fail open: the hook is advisory and must never disturb a tool call, a prompt or a compaction.
}
process.exit(0);
