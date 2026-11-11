/**
 * Hook input and output for every agent host (OpenSpec change harness-guardrails, design D1 "A host hint plus
 * detection" and "Scratch paths come from the checkout root", D4 "Failure modes", D5 "Delivery").
 *
 * A hook script reads one JSON payload from stdin (2 s at most, a UTF-8 BOM and CRLF stripped), works out which host
 * sent it from the configured hint, the environment and the payload's shape, reads the tool call out of that host's
 * payload, finds the checkout root by walking up from the payload's `cwd`, and prints its decision in that host's
 * format. Every `tmp/` path is built from the checkout root and never from the process's folder; a hook that finds no
 * root writes nothing. {@link safeMain} wraps all of it so that a hook only ever exits 0 or 2: an internal error
 * allows, after the raw-text suspicion check has had its chance to block, and leaves one capped line in
 * `<root>/tmp/agent-state/hook-errors.log`.
 *
 * Uses only `node:` built-ins and the shared `scripts/lib/` modules, and has no side effects on import.
 */

import { appendFileSync, mkdirSync, statSync, writeSync } from 'node:fs';
import { type Env, ceilingDirectories, findCheckoutRoot, pathFor, scratchPath } from '../lib/checkout-root.ts';

// ─── Hosts ───────────────────────────────────────────────────────────────────

/** The host a hook command is configured for: its first argument. */
export type HostHint = 'claude' | 'cursor' | 'codex' | 'grok' | 'antigravity';

/** The host that actually ran the hook; Copilot CLI reads the Claude file and has no hint of its own. */
export type Host = HostHint | 'copilot';

/** Every configured host hint. */
export const HOST_HINTS: readonly HostHint[] = ['claude', 'cursor', 'codex', 'grok', 'antigravity'];

/** A parsed hook payload. */
export type Payload = Record<string, unknown>;

/** How long a hook waits for stdin to close (design D4). */
export const STDIN_TIMEOUT_MS = 2000;

/** The cap of each log under `tmp/agent-state/`; a log at or over it gets no more lines (design D4). */
export const LOG_CAP_BYTES = 256 * 1024;

/** The longest block message (design D5). */
export const MAX_MESSAGE_CHARS = 600;

/** The longest line in `hook-errors.log`, before the newline. */
export const MAX_LOG_LINE_CHARS = 200;

/**
 * What the Cursor guard prints when it allows. Cursor blocks a permission hook whose stdout is not valid JSON, and
 * `{"permission":"allow"}` may skip its own approval prompt; `{}` is the lightest valid form. Provisional until the
 * owner's probe settles Open Question 14; until then the Cursor guard is written but not claimed.
 */
export const CURSOR_ALLOW_OUTPUT = '{}';

/**
 * Read a hook command's host argument.
 * @param value The first argument, if any.
 * @returns The hint; `claude` when it is missing or unknown, the host whose file most entries live in.
 */
export function parseHint(value: string | undefined): HostHint {
	return HOST_HINTS.find((hint) => hint === value?.toLowerCase()) ?? 'claude';
}

/**
 * Whether a payload has a key.
 * @param payload The payload.
 * @param key The key.
 * @returns True when the key is present and not undefined.
 */
function has(payload: Payload, key: string): boolean {
	return payload[key] !== undefined;
}

/**
 * Work out which host ran the hook (design D1): the hint, corrected by `GROK_HOOK_EVENT`, by `CURSOR_VERSION` when
 * the payload also looks like Cursor's, and by Copilot's camelCase `toolName` and `toolArgs`.
 * @param hint The configured host.
 * @param env The hook's environment.
 * @param payload The payload.
 * @returns The host.
 */
export function detectHost(hint: HostHint, env: Env, payload: Payload): Host {
	if (hint === 'codex' || hint === 'antigravity') return hint;
	if ((env.GROK_HOOK_EVENT ?? '') !== '' || (has(payload, 'toolName') && has(payload, 'toolInput'))) return 'grok';
	const cursorShape = has(payload, 'cursor_version') || has(payload, 'conversation_id') || !has(payload, 'session_id');
	if (hint === 'cursor' || ((env.CURSOR_VERSION ?? '') !== '' && cursorShape)) return 'cursor';
	if (has(payload, 'toolName') && has(payload, 'toolArgs')) return 'copilot';
	return hint;
}

/**
 * Whether a hook entry should act for the host that ran it (design D1). The Claude-file entries act for Claude Code
 * and Copilot, and do nothing under Cursor and Grok, which have entries of their own; the Cursor-file entry does
 * nothing under Grok.
 * @param hint The configured host.
 * @param host The detected host.
 * @returns True when the entry should judge the call.
 */
export function hostActs(hint: HostHint, host: Host): boolean {
	if (hint === 'claude') return host === 'claude' || host === 'copilot';
	return host === hint;
}

// ─── The tool call ───────────────────────────────────────────────────────────

/** The tool names whose input is a shell command. */
const SHELL_TOOLS = new Set(['bash', 'powershell', 'monitor', 'shell', 'run_terminal_command', 'run_command', 'exec_command']);

/** A tool call, read out of any host's payload. */
export interface ToolCall {
	/** The tool's name as the host sent it; empty for Cursor's `beforeShellExecution`. */
	toolName: string;
	/** The tool's arguments. */
	input: Record<string, unknown>;
	/** The tool runs a shell command. */
	shell: boolean;
	/** The command text of a shell tool, or null when it has none. */
	command: string | null;
	/** The folder the call runs in, from the payload, or null. */
	cwd: string | null;
}

/**
 * Narrow a value to a plain object.
 * @param value The value.
 * @returns The object, or an empty one.
 */
export function asObject(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Read a non-empty string.
 * @param value The value.
 * @returns The string, or null.
 */
export function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * The first string of a value that is a string or an array of strings.
 * @param value The value.
 * @returns The string, or null when it is empty or missing.
 */
export function firstString(value: unknown): string | null {
	return nonEmptyString(Array.isArray(value) ? value[0] : value);
}

/**
 * Read a Node error's code.
 * @param error The thrown value.
 * @param fallback What to return when it has no string code.
 * @returns The code, or the fallback.
 */
export function errorCode(error: unknown, fallback = ''): string {
	return nonEmptyString(asObject(error).code) ?? fallback;
}

/**
 * Quote one argument of an argv-form command so that both shell readings keep it one word.
 * @param arg The argument.
 * @returns The argument, single-quoted when it needs quoting.
 */
function quoteArg(arg: string): string {
	return /^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * The command text of a shell tool's input: a string, or an argv array (Codex) joined with quoting.
 * @param input The tool's input.
 * @returns The command, or null.
 */
function commandText(input: Record<string, unknown>): string | null {
	const value = input.command ?? input.CommandLine ?? input.cmd;
	if (typeof value === 'string') return value;
	if (Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string')) return value.map(quoteArg).join(' ');
	return null;
}

/**
 * Read the tool call out of a host's payload (Claude and Codex `tool_input`, Cursor's top-level `command`, Grok's
 * `toolInput`, Antigravity's `toolCall.args`, Copilot's `toolArgs`, which may be a JSON string).
 * @param host The detected host.
 * @param payload The payload.
 * @returns The tool call.
 */
export function readToolCall(host: Host, payload: Payload): ToolCall {
	let toolName: string;
	let input: Record<string, unknown>;
	if (host === 'antigravity') {
		const call = asObject(payload.toolCall);
		toolName = typeof call.name === 'string' ? call.name : '';
		input = asObject(call.args);
	} else if (host === 'grok' && has(payload, 'toolInput')) {
		toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
		input = asObject(payload.toolInput);
	} else if (host === 'copilot') {
		toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
		const args = payload.toolArgs;
		input = asObject(typeof args === 'string' ? parseJson(args) : args);
	} else if (!has(payload, 'tool_input') && typeof payload.command === 'string') {
		toolName = '';
		input = { command: payload.command };
	} else {
		toolName = typeof payload.tool_name === 'string' ? payload.tool_name : '';
		input = asObject(payload.tool_input);
	}
	const shell = toolName === '' || SHELL_TOOLS.has(toolName.toLowerCase());
	const cwd =
		firstString(payload.cwd) ?? firstString(input.Cwd) ?? firstString(payload.workspaceRoot) ?? firstString(payload.workspace_roots) ?? firstString(payload.workspacePaths);
	return { toolName, input, shell, command: shell ? commandText(input) : null, cwd };
}

/** What a Codex `apply_patch` header does to its file. */
export type PatchVerb = 'Add File' | 'Update File' | 'Delete File' | 'Move to';

/**
 * Read the file headers of a Codex `apply_patch` (`*** Add File:`, `*** Update File:`, `*** Delete File:` and
 * `*** Move to:`).
 * @param text The patch text.
 * @returns Each header's verb and path, in order.
 */
export function patchHeaders(text: string): { verb: PatchVerb; path: string }[] {
	return [...text.matchAll(/^\*\*\* (Add File|Update File|Delete File|Move to): *(.+?)\s*$/gm)].map((match) => ({ verb: match[1] as PatchVerb, path: match[2] ?? '' }));
}

// ─── The checkout root and its scratch folder ────────────────────────────────

/** The environment variables that name a project folder, in the order they are tried when a payload has no `cwd`. */
export const PROJECT_DIR_VARIABLES: readonly string[] = ['CLAUDE_PROJECT_DIR', 'GROK_WORKSPACE_ROOT', 'CURSOR_PROJECT_DIR'];

/**
 * The folder the root walk starts from: the payload's `cwd`, else a project-folder variable; never the process's
 * own folder (design D1, "Scratch paths").
 * @param cwd The payload's `cwd`, if any.
 * @param env The hook's environment.
 * @param platform The platform whose path rules apply.
 * @returns An absolute folder, or null.
 */
export function walkStart(cwd: string | null, env: Env, platform: NodeJS.Platform): string | null {
	const path = pathFor(platform);
	const candidates = [cwd, ...PROJECT_DIR_VARIABLES.map((name) => env[name])];
	return candidates.find((value): value is string => typeof value === 'string' && value !== '' && path.isAbsolute(value)) ?? null;
}

/**
 * Find the checkout root for a hook: the nearest folder at or above the start that holds `.git`, stopping at the
 * folders in `GIT_CEILING_DIRECTORIES`, as git does.
 * @param start The folder from {@link walkStart}.
 * @param env The hook's environment.
 * @param platform The platform whose path rules apply.
 * @param exists The existence check; injectable for tests.
 * @returns The root, or null outside any checkout.
 */
export function hookRoot(start: string | null, env: Env, platform: NodeJS.Platform, exists?: (path: string) => boolean): string | null {
	if (start === null) return null;
	return findCheckoutRoot(start, { platform, exists, ceilings: ceilingDirectories(env, platform) });
}

/**
 * A path in the hooks' state folder, `<root>/tmp/agent-state/`.
 * @param root The checkout root.
 * @param platform The platform whose path rules apply.
 * @param segments The path below `tmp/agent-state/`, such as a file name; none for the folder itself.
 * @returns The absolute path.
 */
export function agentStateFile(root: string, platform: NodeJS.Platform, ...segments: string[]): string {
	return scratchPath(root, platform, 'agent-state', ...segments);
}

/**
 * Append one line to a log, best effort: create its folder, skip the write when the log has reached the cap, and
 * never throw.
 * @param file The log file.
 * @param line The line, without a newline.
 * @param cap The size at which the log stops growing.
 * @returns True when the line was written.
 */
export function appendCapped(file: string, line: string, cap: number = LOG_CAP_BYTES): boolean {
	try {
		let size = 0;
		try {
			size = statSync(file).size;
		} catch {
			mkdirSync(pathFor(process.platform).dirname(file), { recursive: true });
		}
		if (size >= cap) return false;
		appendFileSync(file, `${line}\n`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Format a time as local ISO 8601 with its UTC offset, such as `2026-10-25T19:43:06+03:00`.
 * @param date The time.
 * @returns The formatted time.
 */
export function localIso(date: Date): string {
	const pad = (value: number): string => String(value).padStart(2, '0');
	const offset = -date.getTimezoneOffset();
	const sign = offset >= 0 ? '+' : '-';
	const zone = `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${zone}`;
}

/**
 * Make text safe for a one-line ASCII message: no control characters or newlines, non-ASCII as `?`, and spaces
 * collapsed.
 * @param text The text.
 * @returns The cleaned text.
 */
export function asciiLine(text: string): string {
	return text
		.replace(/[^\x20-\x7e]/g, (char) => (/\s/.test(char) ? ' ' : '?'))
		.replace(/ {2,}/g, ' ')
		.trim();
}

/**
 * Cut text to a length, marking the cut.
 * @param text The text.
 * @param max The longest result.
 * @returns The text, or its start followed by `...`.
 */
export function clip(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;
}

/**
 * Build one `hook-errors.log` line: the local time, the host and what went wrong, on one ASCII line of at most 200
 * characters. Quoted parts of an error message are blanked, so command text does not reach the log.
 * @param date The time.
 * @param host The host.
 * @param what The error, or a short note.
 * @param label Words before it, such as the hook and its mode; none by default.
 * @returns The line.
 */
export function errorLine(date: Date, host: Host, what: unknown, label?: string): string {
	const text = what instanceof Error ? `${what.name}: ${what.message}` : String(what);
	const scrubbed = (label === undefined ? text : `${label} ${text}`).replace(/(["'`])[^"'`]*\1/g, '$1...$1');
	return clip(asciiLine(`${localIso(date)} ${host} ${scrubbed}`), MAX_LOG_LINE_CHARS);
}

// ─── Decisions and output ────────────────────────────────────────────────────

/** A hook's verdict on a call. */
export type Decision = { allow: true; note?: string } | { allow: false; message: string };

/** What a hook prints, and its exit code: only ever 0 or 2. */
export interface HookOutput {
	stdout: string;
	stderr: string;
	exitCode: 0 | 2;
}

/**
 * Print one JSON object on stdout.
 * @param value The object.
 * @param exitCode The exit code.
 * @returns The output: the JSON and a newline, with nothing on stderr.
 */
export function jsonOutput(value: unknown, exitCode: 0 | 2 = 0): HookOutput {
	return { stdout: `${JSON.stringify(value)}\n`, stderr: '', exitCode };
}

/**
 * Render a decision in a host's format (design D5): an allow never emits a decision that would skip the host's own
 * prompt. A deny reaches each host in the form that survives the shell the host may wrap the command in, because
 * PowerShell's `-Command` turns any native exit code other than 0 or 1 into 1, which Cursor and Codex read as a
 * failed hook and so allow:
 * - Claude Code and Copilot run the command without a shell between: stderr with exit 2.
 * - Cursor and Codex: their JSON deny on stdout with exit 0, and the message on stderr for the log.
 * - Grok honours its JSON whatever the exit code: the JSON, stderr and exit 2.
 * - Antigravity: its JSON with exit 0.
 * @param host The detected host.
 * @param decision The decision.
 * @returns The output.
 */
export function renderOutput(host: Host, decision: Decision): HookOutput {
	if (decision.allow) {
		return { stdout: host === 'cursor' ? `${CURSOR_ALLOW_OUTPUT}\n` : '', stderr: '', exitCode: 0 };
	}
	const message = clip(decision.message, MAX_MESSAGE_CHARS);
	const stderr = `${message}\n`;
	switch (host) {
		case 'antigravity':
			return jsonOutput({ decision: 'deny', reason: message });
		case 'cursor':
			return { ...jsonOutput({ permission: 'deny', user_message: message, agent_message: message }), stderr };
		case 'codex':
			return { ...jsonOutput({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: message } }), stderr };
		case 'grok':
			return { ...jsonOutput({ decision: 'deny', reason: message }, 2), stderr };
		default:
			return { stdout: '', stderr, exitCode: 2 };
	}
}

// ─── Running a hook ──────────────────────────────────────────────────────────

/**
 * Parse JSON without throwing.
 * @param text The text.
 * @returns The value, or undefined when it is not JSON.
 */
function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

/**
 * Strip what Windows shells add around a payload: a UTF-8 byte-order mark and surrounding whitespace, CRLF included.
 * @param text The raw stdin text.
 * @returns The cleaned text.
 */
export function cleanStdin(text: string): string {
	return (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
}

/**
 * Parse a payload.
 * @param text The cleaned stdin text.
 * @returns The payload object, or null when the text is not a JSON object.
 */
export function parsePayload(text: string): Payload | null {
	const value = parseJson(text);
	return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Payload) : null;
}

/**
 * Read stdin to its end, or give up after a timeout.
 * @param stream The stream, `process.stdin` by default.
 * @param timeoutMs How long to wait for the end.
 * @returns The text, or null when the stream stayed open or failed.
 */
export function readStdin(stream: NodeJS.ReadableStream = process.stdin, timeoutMs: number = STDIN_TIMEOUT_MS): Promise<string | null> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		let done = false;
		const finish = (value: string | null): void => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			stream.pause();
			resolve(value);
		};
		const timer = setTimeout(() => {
			finish(null);
		}, timeoutMs);
		stream.on('data', (chunk: Buffer | string) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
		stream.on('end', () => {
			finish(Buffer.concat(chunks).toString('utf8'));
		});
		stream.on('error', () => {
			finish(null);
		});
	});
}

/** What a hook's handler sees. */
export interface HookContext {
	host: Host;
	env: Env;
	platform: NodeJS.Platform;
	call: ToolCall;
	/** The folder the call runs in: the payload's `cwd`, else a project-folder variable, else null. */
	cwd: string | null;
	/** The checkout root, or null outside any checkout; nothing is written without one. */
	root: string | null;
	now: () => Date;
}

/** A hook's judgement, and the check that still runs when the judgement throws. */
export interface HookHandlers {
	/**
	 * Judge the call.
	 * @param context The hook's context.
	 * @returns The decision.
	 */
	judge: (context: HookContext) => Decision;
	/**
	 * The raw-text suspicion check (design D4), run in its own `try` after `judge` throws.
	 * @param text The command text, or the raw payload when no command was read.
	 * @param context The hook's context.
	 * @returns A block message, or null.
	 */
	suspicion: (text: string, context: HookContext) => string | null;
}

/** The inputs of one hook run, injectable for tests. */
export interface HookInput {
	/** The hook command's first argument. */
	hint: string | undefined;
	/** The stdin text, or null when stdin stayed open past the timeout. */
	stdin: string | null;
	env: Env;
	platform: NodeJS.Platform;
	/** The existence check of the root walk. */
	exists?: (path: string) => boolean;
	now?: () => Date;
}

/** A hook call read out of its input, for a host the entry acts for. */
export interface HookCall {
	/** The detected host. */
	host: Host;
	payload: Payload;
	call: ToolCall;
	/** The folder the call runs in: the payload's `cwd`, else a project-folder variable, else null. */
	cwd: string | null;
	/** The checkout root, or null outside any checkout. */
	root: string | null;
	/** The cleaned stdin text. */
	raw: string;
}

/** Why a hook call was not read: stdin stayed open, the payload is not a JSON object, or the entry does not act for the host. */
export type SkipReason = 'stdin' | 'payload' | 'host';

/** What {@link readHookCall} found: the call, or why there is none and the host to answer as. */
export type HookRead = ({ ok: true } & HookCall) | { ok: false; reason: SkipReason; host: Host };

/**
 * Read a hook call out of its input (design D1): clean and parse stdin, detect the host, skip an entry that does not
 * act for it, read the tool call and find the checkout root from the call's folder.
 * @param input The hook's argument, stdin, environment and platform.
 * @returns The call, or the reason to skip it with the host to answer as: the hint when no payload was read.
 */
export function readHookCall(input: HookInput): HookRead {
	const hint = parseHint(input.hint);
	if (input.stdin === null) return { ok: false, reason: 'stdin', host: hint };
	const raw = cleanStdin(input.stdin);
	const payload = parsePayload(raw);
	if (payload === null) return { ok: false, reason: 'payload', host: hint };
	const host = detectHost(hint, input.env, payload);
	if (!hostActs(hint, host)) return { ok: false, reason: 'host', host };
	const call = readToolCall(host, payload);
	const cwd = walkStart(call.cwd, input.env, input.platform);
	return { ok: true, host, payload, call, cwd, root: hookRoot(cwd, input.env, input.platform, input.exists), raw };
}

/**
 * Log a line in `<root>/tmp/agent-state/hook-errors.log`, when there is a root.
 * @param root The checkout root, or null.
 * @param platform The platform whose path rules apply.
 * @param line The line.
 */
export function logError(root: string | null, platform: NodeJS.Platform, line: string): void {
	if (root !== null) appendCapped(agentStateFile(root, platform, 'hook-errors.log'), line);
}

/** The log notes of the skips that runHook logs. */
const SKIP_NOTES: Record<Exclude<SkipReason, 'host'>, string> = { stdin: 'stdin stayed open; allowed', payload: 'payload is not a JSON object; allowed' };

/**
 * Run one hook call to its output, without throwing (design D4). An unreadable payload or an open stdin allows and
 * logs a line; a throw in the judgement runs the suspicion check on the command text, which blocks when it matches,
 * and otherwise allows and logs a line.
 * @param input The hook's argument, stdin, environment and platform.
 * @param handlers The judgement and the suspicion check.
 * @returns The output to print.
 */
export function runHook(input: HookInput, handlers: HookHandlers): HookOutput {
	const now = input.now ?? ((): Date => new Date());
	let host: Host = parseHint(input.hint);
	let root: string | null = null;
	try {
		const read = readHookCall(input);
		host = read.host;
		if (!read.ok) {
			if (read.reason !== 'host')
				logError(
					hookRoot(walkStart(null, input.env, input.platform), input.env, input.platform, input.exists),
					input.platform,
					errorLine(now(), host, SKIP_NOTES[read.reason])
				);
			return renderOutput(host, { allow: true });
		}
		root = read.root;
		const context: HookContext = { host, env: input.env, platform: input.platform, call: read.call, cwd: read.cwd, root, now };
		let decision: Decision;
		try {
			decision = handlers.judge(context);
		} catch (error) {
			let message: string | null = null;
			try {
				message = handlers.suspicion(read.call.command ?? read.raw, context);
			} catch {
				message = null;
			}
			if (message !== null) return renderOutput(host, { allow: false, message });
			logError(root, input.platform, errorLine(now(), host, error));
			return renderOutput(host, { allow: true });
		}
		if (decision.allow && decision.note !== undefined) logError(root, input.platform, errorLine(now(), host, decision.note));
		return renderOutput(host, decision);
	} catch (error) {
		try {
			logError(root, input.platform, errorLine(now(), host, error));
		} catch {
			// The log is best effort.
		}
		return renderOutput(host, { allow: true });
	}
}

/**
 * Print a hook's output and exit with its code; never returns.
 * @param output The output.
 */
export function emit(output: HookOutput): never {
	for (const [fd, text] of [
		[1, output.stdout],
		[2, output.stderr],
	] as const) {
		try {
			if (text !== '') writeSync(fd, text);
		} catch {
			// A closed stdout or stderr cannot be helped.
		}
	}
	process.exit(output.exitCode);
}

/**
 * A hook script's whole entry point: read stdin, run the hook on it, print and exit, only ever with 0 or 2
 * (design D4).
 * @param run Turns the stdin text, or null when stdin stayed open, into the output.
 * @param fallback The output when reading stdin or the run throws.
 * @returns Never: the process exits.
 */
export async function hookMain(run: (stdin: string | null) => HookOutput | Promise<HookOutput>, fallback: HookOutput): Promise<never> {
	let output: HookOutput;
	try {
		output = await run(await readStdin(process.stdin, STDIN_TIMEOUT_MS));
	} catch {
		output = fallback;
	}
	return emit(output);
}

/**
 * The guard-style entry point: {@link hookMain} with {@link runHook}; a throw allows in the hint's format.
 * @param handlers The judgement and the suspicion check.
 * @param argv The hook command's arguments, the host hint first.
 * @returns Never: the process exits.
 */
export async function safeMain(handlers: HookHandlers, argv: readonly string[] = process.argv.slice(2)): Promise<never> {
	return hookMain((stdin) => runHook({ hint: argv[0], stdin, env: process.env, platform: process.platform }, handlers), renderOutput(parseHint(argv[0]), { allow: true }));
}
