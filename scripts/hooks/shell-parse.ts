/**
 * Shell parser for the command guard (OpenSpec change harness-guardrails, design D2; spec harness--guards, "The guard
 * reads every command in a shell call").
 *
 * `parseCommand` reads a shell tool's command text twice, once with Bash rules and once with PowerShell rules, and
 * returns every simple command that either reading found, nested ones included: separators, substitutions, groups,
 * script blocks and heredocs; the shell-string wrappers (`bash -c`, `cmd /c`, `pwsh -Command` and `-EncodedCommand`,
 * `iex`, `eval`, a heredoc fed to a shell, the package runners' shell modes, `wsl`); and the prefixes that run their
 * arguments (`env`, `sudo`, `timeout`, `xargs`, `Start-Process`, `pnpm exec`, `npx` and the rest). Each command
 * carries its words with a `quoted` and a `literal` flag, the dialect that read it, how deep it was nested, whether
 * a pipe feeds it, and a `dynamic` flag for shapes that cannot be read statically (a variable as the command word or
 * the git subcommand, `iex` or `eval` of a non-literal, a pipe into a shell, an interpreter one-liner); the guard's
 * suspicion check (design D4) covers those.
 *
 * The guard applies its rules to the union of the two readings, so it never has to know which shell runs the text. A
 * reading that breaks off (unbalanced quotes or brackets, nesting past depth 8, input over 64 KB) is not complete,
 * but keeps the commands it read before the break.
 *
 * Pure: `node:` built-ins only, no file system or process access, no side effects on import.
 */

import { Buffer } from 'node:buffer';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A shell grammar: Bash (Git Bash, WSL, sh), PowerShell 7, or cmd.exe (only inside `cmd /c`). */
export type Dialect = 'bash' | 'powershell' | 'cmd';

/** One word of a command, after quote removal. */
export interface Word {
	/** The word's text, its quoted and unquoted parts joined; an expansion keeps its source text. */
	value: string;
	/** Some part of the word was quoted or escaped. */
	quoted: boolean;
	/** No part of the word expands when the shell runs it: no variable, substitution, splat, group or block. */
	literal: boolean;
}

/** One simple command, after its prefixes and wrappers were unwrapped. */
export interface SimpleCommand {
	/** The command word, then its arguments; empty for a bare redirect. */
	words: Word[];
	/** The file targets of its redirects. */
	redirects: Word[];
	/** The dialect that read it. */
	dialect: Dialect;
	/** What this command runs cannot be read statically. */
	dynamic: boolean;
	/** Its standard input comes from a pipe. */
	piped: boolean;
	/** How deep it was nested: 0 at the top level. */
	depth: number;
}

/** What one dialect read. */
export interface Reading {
	dialect: Dialect;
	/** Every command read, including those before the point where the reading broke off. */
	commands: SimpleCommand[];
	/** The whole text was read. */
	complete: boolean;
}

/** Both readings of a text. */
export interface ParseResult {
	readings: Reading[];
	/** The union of the readings' commands, Bash first. */
	commands: SimpleCommand[];
	/** At least one reading is complete. */
	complete: boolean;
	/** At least one command is dynamic. */
	dynamic: boolean;
}

/** Options for {@link parseCommand}. */
export interface ParseOptions {
	/** The platform the command runs on: on `win32` a backslash also separates path segments of a command word. */
	platform: NodeJS.Platform;
}

/** A `git` invocation's global options and subcommand (design D3). */
export interface GitCall {
	/** The index of the subcommand word, or -1 when there is none. */
	sub: number;
	/** The `-C` values, in order. */
	dirs: Word[];
	/** The `-c` values, in order. */
	configs: Word[];
	/** The subcommand, a word before it or a `-c` value is not literal. */
	dynamic: boolean;
}

/** Input longer than this many UTF-8 bytes is not read (design D2, "Limits"). */
export const MAX_INPUT_BYTES = 64 * 1024;

/** The deepest nesting read (design D2): substitutions, groups, blocks and wrapper strings each add a level. */
export const MAX_DEPTH = 8;

// ─── Internal state ──────────────────────────────────────────────────────────

/** A reading broke off; caught at the top of the reading. */
class Incomplete extends Error {
	override name = 'Incomplete';
}

/** Shared by every reader of one reading. */
interface Frame {
	platform: NodeJS.Platform;
	/** Where every finished command goes. */
	out: SimpleCommand[];
	depth: number;
}

/** A word being read. */
interface Builder {
	value: string;
	quoted: boolean;
	literal: boolean;
	/** The word so far is exactly one variable reference (PowerShell assignments). */
	variable: boolean;
}

/** A heredoc: the delimiter, and the body once the next line has been read. */
interface Heredoc {
	delimiter: string;
	quoted: boolean;
	strip: boolean;
	body: string | null;
}

/** A command being read. */
interface Pending {
	words: Word[];
	redirects: Word[];
	piped: boolean;
	/** PowerShell's `&` or `.` operator came first. */
	call: boolean;
	heredocs: Heredoc[];
	/** Here-strings (`<<<`). */
	stdin: Word[];
}

/** What a command carries into the unwrapping besides its words. */
interface Meta {
	redirects: Word[];
	piped: boolean;
	call: boolean;
	/** Text fed to the command's standard input: here-strings and heredoc bodies. */
	stdin: Word[];
}

/** A piece of a word read by a helper, and the offset after it. */
interface Piece {
	value: string;
	literal: boolean;
	end: number;
	variable?: boolean;
}

/** Where the next finished word goes. */
type Target = 'redirect' | 'dup' | 'heredoc' | 'herestring' | null;

/** A dialect's read loop: reads from the reader's position up to `close` (or the end) and returns the offset after it. */
type ReadLoop = (reader: Reader, close: ')' | '}' | null) => number;

/** The word and command state of one read loop. */
class Reader {
	readonly frame: Frame;
	readonly dialect: Dialect;
	readonly text: string;
	pos: number;
	pending: Pending = newPending(false);
	word: Builder | null = null;
	target: Target = null;
	stripTabs = false;
	awaiting: Pending[] = [];

	constructor(frame: Frame, dialect: Dialect, text: string, start: number) {
		if (frame.depth > MAX_DEPTH) throw new Incomplete(`nesting deeper than ${MAX_DEPTH}`);
		this.frame = frame;
		this.dialect = dialect;
		this.text = text;
		this.pos = start;
	}

	/**
	 * The character at an offset from the current position.
	 * @param offset The offset, 0 for the current character.
	 * @returns The character, or "" past the end.
	 */
	at(offset = 0): string {
		return this.text[this.pos + offset] ?? '';
	}

	/**
	 * Whether no word is being read.
	 * @returns True between words.
	 */
	atWordStart(): boolean {
		return this.word === null;
	}

	/**
	 * Whether neither a word nor a command has started.
	 * @returns True at the start of a command.
	 */
	commandEmpty(): boolean {
		return this.word === null && this.pending.words.length === 0;
	}

	/**
	 * Append a piece to the current word, starting one if needed.
	 * @param value The piece's text.
	 * @param quoted The piece was quoted or escaped.
	 * @param literal The piece expands to nothing else.
	 * @param variable The piece is a variable reference that starts the word.
	 */
	part(value: string, quoted: boolean, literal: boolean, variable = false): void {
		if (this.word === null) {
			this.word = { value: '', quoted: false, literal: true, variable };
		} else {
			this.word.variable = false;
		}
		this.word.value += value;
		this.word.quoted ||= quoted;
		this.word.literal &&= literal;
	}

	/** End the current word and file it as a word, a redirect target, a heredoc delimiter or a here-string. */
	finishWord(): void {
		const word = this.word;
		if (word === null) return;
		this.word = null;
		const done: Word = { value: word.value, quoted: word.quoted, literal: word.literal };
		const target = this.target;
		this.target = null;
		if (target === 'heredoc') this.pending.heredocs.push({ delimiter: done.value, quoted: done.quoted, strip: this.stripTabs, body: null });
		else if (target === 'herestring') this.pending.stdin.push(done);
		else if (target === 'dup') {
			if (!/^(?:\d+-?|-)$/.test(done.value)) this.pending.redirects.push(done);
		} else if (target === 'redirect') this.pending.redirects.push(done);
		else this.pending.words.push(done);
	}

	/**
	 * Drop a word that is a stream number before a redirect (`2>`), or else finish it.
	 * @param pattern The stream numbers of the dialect.
	 */
	dropStreamNumber(pattern: RegExp): void {
		const word = this.word;
		if (word !== null && !word.quoted && word.literal && pattern.test(word.value)) this.word = null;
		else this.finishWord();
	}

	/**
	 * End the current command; one with heredocs waits for its bodies after the next newline.
	 * @param nextPiped The next command reads this one's output.
	 */
	finishCommand(nextPiped: boolean): void {
		this.finishWord();
		if (this.target !== null) throw new Incomplete('an operator without its word');
		if (this.pending.heredocs.length > 0) this.awaiting.push(this.pending);
		else finalize(this.frame, this.dialect, this.pending);
		this.pending = newPending(nextPiped);
	}

	/** Read the heredoc bodies that follow a newline, then finish their commands. */
	readBodies(): void {
		for (const command of this.awaiting) {
			for (const doc of command.heredocs) doc.body = this.readBody(doc);
			finalize(this.frame, this.dialect, command);
		}
		this.awaiting = [];
	}

	/** Fail when a heredoc never got its body. */
	requireBodies(): void {
		if (this.awaiting.length > 0) throw new Incomplete('a heredoc without its delimiter line');
	}

	/**
	 * Read one heredoc body, up to its delimiter line.
	 * @param doc The heredoc.
	 * @returns The body, each line ending in a newline.
	 */
	private readBody(doc: Heredoc): string {
		const lines: string[] = [];
		for (;;) {
			if (this.pos >= this.text.length) throw new Incomplete('a heredoc without its delimiter line');
			const newline = this.text.indexOf('\n', this.pos);
			const end = newline === -1 ? this.text.length : newline;
			const raw = this.text.slice(this.pos, end).replace(/\r$/, '');
			const line = doc.strip ? raw.replace(/^\t+/, '') : raw;
			this.pos = newline === -1 ? this.text.length : newline + 1;
			if (line === doc.delimiter) return lines.map((each) => `${each}\n`).join('');
			lines.push(line);
		}
	}
}

/**
 * A command with nothing read yet.
 * @param piped Its standard input comes from a pipe.
 * @returns The empty command.
 */
function newPending(piped: boolean): Pending {
	return { words: [], redirects: [], piped, call: false, heredocs: [], stdin: [] };
}

/**
 * Whether a character is one of a set; never true for "" (past the end of the text).
 * @param chars The set, as a string.
 * @param char The character.
 * @returns True when it is one of them.
 */
function isOneOf(chars: string, char: string): boolean {
	return char !== '' && chars.includes(char);
}

/**
 * Read a nested construct with a fresh reader one level deeper, from a given offset of the same text.
 * @param reader The enclosing reader.
 * @param read The dialect's read loop.
 * @param close The closing bracket.
 * @param start The offset after the opening bracket.
 * @returns The offset after the closing bracket.
 */
function nestedAt(reader: Reader, read: ReadLoop, close: ')' | '}', start: number): number {
	return read(new Reader({ ...reader.frame, depth: reader.frame.depth + 1 }, reader.dialect, reader.text, start), close);
}

/**
 * Read a whole separate text (a backtick substitution, a wrapper's script) in a dialect.
 * @param frame The frame, with the depth and wrappers for this text.
 * @param text The text.
 * @param dialect The dialect.
 */
function readText(frame: Frame, text: string, dialect: Dialect): void {
	READ_LOOPS[dialect](new Reader(frame, dialect, text, 0), null);
}

/**
 * Skip to the end of the line (a comment), leaving the newline to the read loop.
 * @param reader The reader.
 */
function skipLine(reader: Reader): void {
	const end = reader.text.indexOf('\n', reader.pos);
	reader.pos = end === -1 ? reader.text.length : end;
}

// ─── Bash ────────────────────────────────────────────────────────────────────

/** Bash variable names after `$`: a name, or one special parameter character. */
const BASH_VARIABLE = /[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-]/y;

/** ANSI-C escapes in `$'…'`. */
const ANSI_ESCAPES = new Map([
	['n', '\n'],
	['t', '\t'],
	['r', '\r'],
	['a', '\x07'],
	['b', '\b'],
	['e', '\x1b'],
	['E', '\x1b'],
	['f', '\f'],
	['v', '\v'],
	['\\', '\\'],
	["'", "'"],
	['"', '"'],
	['?', '?'],
]);

/**
 * The Bash read loop.
 * @param reader The reader.
 * @param close The closing bracket of the construct being read, or null at the top of a text.
 * @returns The offset after the closing bracket, or the text length.
 */
function readBash(reader: Reader, close: ')' | '}' | null): number {
	const { text } = reader;
	for (;;) {
		if (reader.pos >= text.length) {
			if (close !== null) throw new Incomplete('an unclosed (');
			reader.finishCommand(false);
			reader.requireBodies();
			return reader.pos;
		}
		const c = reader.at();
		if (c === ')') {
			if (close !== ')') throw new Incomplete('an unbalanced )');
			reader.finishCommand(false);
			reader.requireBodies();
			return reader.pos + 1;
		}
		switch (c) {
			case ' ':
			case '\t':
				reader.finishWord();
				reader.pos++;
				break;
			case '\n':
				reader.finishCommand(false);
				reader.pos++;
				reader.readBodies();
				break;
			case '\r':
			case ';':
				reader.finishCommand(false);
				reader.pos++;
				break;
			case '&':
				if (reader.at(1) === '&') {
					reader.finishCommand(false);
					reader.pos += 2;
				} else if (reader.at(1) === '>') {
					reader.finishWord();
					reader.target = 'redirect';
					reader.pos += reader.at(2) === '>' ? 3 : 2;
				} else {
					reader.finishCommand(false);
					reader.pos++;
				}
				break;
			case '|':
				if (reader.at(1) === '|') {
					reader.finishCommand(false);
					reader.pos += 2;
				} else {
					reader.finishCommand(true);
					reader.pos += reader.at(1) === '&' ? 2 : 1;
				}
				break;
			case '<':
			case '>':
				bashRedirect(reader);
				break;
			case '(': {
				const end = nestedAt(reader, readBash, ')', reader.pos + 1);
				if (!reader.atWordStart()) reader.part(text.slice(reader.pos, end), false, false);
				reader.pos = end;
				break;
			}
			case '`': {
				const end = bashBacktick(reader, reader.pos);
				reader.part(text.slice(reader.pos, end), false, false);
				reader.pos = end;
				break;
			}
			case '$': {
				const piece = bashDollar(reader, reader.pos, false);
				reader.part(piece.value, piece.variable === false, piece.literal);
				reader.pos = piece.end;
				break;
			}
			case "'": {
				const end = text.indexOf("'", reader.pos + 1);
				if (end === -1) throw new Incomplete('an unterminated single quote');
				reader.part(text.slice(reader.pos + 1, end), true, true);
				reader.pos = end + 1;
				break;
			}
			case '"': {
				const piece = bashExpandable(reader, reader.pos + 1, true);
				reader.part(piece.value, true, piece.literal);
				reader.pos = piece.end;
				break;
			}
			case '\\': {
				const next = reader.at(1);
				if (next === '') reader.pos++;
				else if (next === '\n') reader.pos += 2;
				else if (next === '\r' && reader.at(2) === '\n') reader.pos += 3;
				else {
					reader.part(next, true, true);
					reader.pos += 2;
				}
				break;
			}
			case '#':
				if (reader.atWordStart()) skipLine(reader);
				else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			default:
				reader.part(c, false, true);
				reader.pos++;
		}
	}
}

/**
 * Read a Bash redirect operator, a heredoc or here-string operator, or a process substitution.
 * @param reader The reader, at `<` or `>`.
 */
function bashRedirect(reader: Reader): void {
	const c = reader.at();
	const next = reader.at(1);
	if (next === '(') {
		reader.finishWord();
		const end = nestedAt(reader, readBash, ')', reader.pos + 2);
		reader.part(reader.text.slice(reader.pos, end), false, false);
		reader.pos = end;
		return;
	}
	reader.dropStreamNumber(/^\d+$/);
	if (c === '<' && next === '<') {
		if (reader.at(2) === '<') {
			reader.target = 'herestring';
			reader.pos += 3;
		} else {
			reader.stripTabs = reader.at(2) === '-';
			reader.target = 'heredoc';
			reader.pos += reader.stripTabs ? 3 : 2;
		}
		return;
	}
	if (next === '&') {
		reader.target = 'dup';
		reader.pos += 2;
		return;
	}
	reader.target = 'redirect';
	reader.pos += (c === '>' && (next === '>' || next === '|')) || (c === '<' && next === '>') ? 2 : 1;
}

/**
 * Read what follows a Bash `$`: a substitution, an arithmetic expansion, a parameter expansion, an ANSI-C or locale
 * string, or a variable.
 * @param reader The reader, whose text is read.
 * @param pos The offset of the `$`.
 * @param inQuotes Inside double quotes, where `$'` and `$"` are plain text.
 * @returns The piece; `variable: false` marks a quoted string.
 */
function bashDollar(reader: Reader, pos: number, inQuotes: boolean): Piece {
	const { text } = reader;
	const next = text[pos + 1] ?? '';
	if (next === '(') {
		const end = text[pos + 2] === '(' ? skipArithmetic(text, pos + 3) : nestedAt(reader, readBash, ')', pos + 2);
		return { value: text.slice(pos, end), literal: false, end };
	}
	if (next === '{') {
		const end = bashBraceParameter(reader, pos + 2);
		return { value: text.slice(pos, end), literal: false, end };
	}
	if (!inQuotes && next === "'") return { ...ansiC(text, pos + 2), variable: false };
	if (!inQuotes && next === '"') return { ...bashExpandable(reader, pos + 2, true), variable: false };
	BASH_VARIABLE.lastIndex = pos + 1;
	const name = BASH_VARIABLE.exec(text);
	if (name !== null) return { value: `$${name[0]}`, literal: false, end: pos + 1 + name[0].length };
	return { value: '$', literal: true, end: pos + 1 };
}

/**
 * Skip an arithmetic expansion `$(( … ))`, which runs no command.
 * @param text The text.
 * @param start The offset after `$((`.
 * @returns The offset after the closing `))`.
 */
function skipArithmetic(text: string, start: number): number {
	let depth = 2;
	for (let pos = start; pos < text.length; pos++) {
		if (text[pos] === '(') depth++;
		else if (text[pos] === ')' && --depth === 0) return pos + 1;
	}
	throw new Incomplete('an unclosed $((');
}

/**
 * Read a parameter expansion `${ … }`, whose default values may hold substitutions.
 * @param reader The reader.
 * @param start The offset after `${`.
 * @returns The offset after the closing `}`.
 */
function bashBraceParameter(reader: Reader, start: number): number {
	const { text } = reader;
	let pos = start;
	while (pos < text.length) {
		const c = text[pos];
		if (c === '}') return pos + 1;
		if (c === '\\') pos += 2;
		else if (c === "'") {
			const end = text.indexOf("'", pos + 1);
			if (end === -1) throw new Incomplete('an unterminated single quote');
			pos = end + 1;
		} else if (c === '"') pos = bashExpandable(reader, pos + 1, true).end;
		else if (c === '$') pos = bashDollar(reader, pos, true).end;
		else if (c === '`') pos = bashBacktick(reader, pos);
		else pos++;
	}
	throw new Incomplete('an unclosed ${');
}

/**
 * Read double-quoted text, or a whole unquoted heredoc body: backslash escapes, `$` expansions and backticks.
 * @param reader The reader.
 * @param start The offset after the opening quote, or 0 for a body.
 * @param quoted Stop at a closing double quote, which must exist.
 * @returns The text read and the offset after it.
 */
function bashExpandable(reader: Reader, start: number, quoted: boolean): Piece {
	const { text } = reader;
	let value = '';
	let literal = true;
	let pos = start;
	while (pos < text.length) {
		const c = text[pos] ?? '';
		if (quoted && c === '"') return { value, literal, end: pos + 1 };
		if (c === '\\') {
			const next = text[pos + 1] ?? '';
			if (next === '\n') pos += 2;
			else if (isOneOf('$`\\', next) || (quoted && next === '"')) {
				value += next;
				pos += 2;
			} else {
				value += c;
				pos++;
			}
		} else if (c === '$') {
			const piece = bashDollar(reader, pos, true);
			value += piece.value;
			literal &&= piece.literal;
			pos = piece.end;
		} else if (c === '`') {
			const end = bashBacktick(reader, pos);
			value += text.slice(pos, end);
			literal = false;
			pos = end;
		} else {
			value += c;
			pos++;
		}
	}
	if (quoted) throw new Incomplete('an unterminated double quote');
	return { value, literal, end: pos };
}

/**
 * Read a backtick substitution and parse its content as Bash, one level deeper.
 * @param reader The reader.
 * @param start The offset of the opening backtick.
 * @returns The offset after the closing backtick.
 */
function bashBacktick(reader: Reader, start: number): number {
	const { text } = reader;
	let content = '';
	for (let pos = start + 1; pos < text.length; pos++) {
		const c = text[pos] ?? '';
		if (c === '\\' && pos + 1 < text.length) {
			const next = text[pos + 1] ?? '';
			content += isOneOf('`$\\', next) ? next : c + next;
			pos++;
		} else if (c === '`') {
			readText({ ...reader.frame, depth: reader.frame.depth + 1 }, content, 'bash');
			return pos + 1;
		} else content += c;
	}
	throw new Incomplete('an unterminated backtick');
}

/**
 * Read an ANSI-C string `$'…'`, decoding its escapes.
 * @param text The text.
 * @param start The offset after `$'`.
 * @returns The decoded string and the offset after the closing quote.
 */
function ansiC(text: string, start: number): Piece {
	let value = '';
	let pos = start;
	while (pos < text.length) {
		const c = text[pos] ?? '';
		if (c === "'") return { value, literal: true, end: pos + 1 };
		if (c !== '\\') {
			value += c;
			pos++;
			continue;
		}
		const next = text[pos + 1] ?? '';
		const numeric = /^(?:x[0-9A-Fa-f]{1,2}|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|[0-7]{1,3})/.exec(text.slice(pos + 1, pos + 10));
		if (numeric !== null) {
			const digits = numeric[0];
			const code = /^[0-7]/.test(digits) ? Number.parseInt(digits, 8) : Number.parseInt(digits.slice(1), 16);
			value += String.fromCodePoint(Math.min(code, 0x10ffff));
			pos += 1 + digits.length;
		} else {
			value += ANSI_ESCAPES.get(next) ?? `\\${next}`;
			pos += 2;
		}
	}
	throw new Incomplete("an unterminated $' string");
}

// ─── PowerShell ──────────────────────────────────────────────────────────────

/** PowerShell's single quotes, typographic ones included. */
const PS_SINGLE = "'‘’‚‛";

/** PowerShell's double quotes, typographic ones included. */
const PS_DOUBLE = '"“”„';

/** Backtick escapes in PowerShell double-quoted strings. */
const PS_ESCAPES = new Map([
	['0', '\0'],
	['a', '\x07'],
	['b', '\b'],
	['e', '\x1b'],
	['f', '\f'],
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['v', '\v'],
]);

/** PowerShell variable names after `$`: a name with an optional scope (`env:`), or `?`, `^`, `$`. */
const PS_VARIABLE = /[A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?|[?^$]/y;

/**
 * The PowerShell read loop.
 * @param reader The reader.
 * @param close The closing bracket of the construct being read, or null at the top of a text.
 * @returns The offset after the closing bracket, or the text length.
 */
function readPowerShell(reader: Reader, close: ')' | '}' | null): number {
	const { text } = reader;
	for (;;) {
		if (reader.pos >= text.length) {
			if (close !== null) throw new Incomplete(`an unclosed ${close === ')' ? '(' : '{'}`);
			reader.finishCommand(false);
			return reader.pos;
		}
		const c = reader.at();
		if (c === close) {
			reader.finishCommand(false);
			return reader.pos + 1;
		}
		if (c === ')' || c === '}') throw new Incomplete(`an unbalanced ${c}`);
		if (isOneOf(PS_SINGLE, c)) {
			psSingle(reader);
			continue;
		}
		if (isOneOf(PS_DOUBLE, c)) {
			const piece = psDouble(reader, reader.pos + 1, true);
			reader.part(piece.value, true, piece.literal);
			reader.pos = piece.end;
			continue;
		}
		switch (c) {
			case ' ':
			case '\t':
			case '\f':
			case '\u00a0':
				reader.finishWord();
				reader.pos++;
				break;
			case '`': {
				const next = reader.at(1);
				if (next === '') reader.pos++;
				else if (next === '\n') reader.pos += 2;
				else if (next === '\r' && reader.at(2) === '\n') reader.pos += 3;
				else {
					reader.part(next, true, true);
					reader.pos += 2;
				}
				break;
			}
			case '\n':
			case '\r':
			case ';':
				reader.finishCommand(false);
				reader.pos++;
				break;
			case '&':
				if (reader.at(1) === '&') {
					reader.finishCommand(false);
					reader.pos += 2;
				} else if (reader.commandEmpty()) {
					reader.pending.call = true;
					reader.pos++;
				} else {
					reader.finishCommand(false);
					reader.pos++;
				}
				break;
			case '|':
				if (reader.at(1) === '|') {
					reader.finishCommand(false);
					reader.pos += 2;
				} else {
					reader.finishCommand(true);
					reader.pos++;
				}
				break;
			case '>':
				psRedirect(reader);
				break;
			case '<':
				if (reader.at(1) !== '#') throw new Incomplete('PowerShell reserves the < operator');
				psBlockComment(reader);
				break;
			case '#':
				if (reader.atWordStart()) skipLine(reader);
				else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			case '@':
				psAt(reader);
				break;
			case '$': {
				const piece = psDollar(reader, reader.pos);
				reader.part(piece.value, false, piece.literal, piece.variable === true);
				reader.pos = piece.end;
				break;
			}
			case '(':
			case '{': {
				const end = nestedAt(reader, readPowerShell, c === '(' ? ')' : '}', reader.pos + 1);
				reader.part(text.slice(reader.pos, end), false, false);
				reader.pos = end;
				break;
			}
			case '-':
				if (reader.atWordStart() && text.startsWith('--%', reader.pos) && /^[ \t\r\n]?$/.test(reader.at(3))) psStopParsing(reader);
				else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			case '.':
				if (reader.commandEmpty() && /^[ \t]$/.test(reader.at(1))) {
					reader.pending.call = true;
					reader.pos++;
				} else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			case '=':
				if (reader.word?.variable === true) {
					reader.finishWord();
					reader.pending.words.push({ value: '=', quoted: false, literal: true });
				} else reader.part(c, false, true);
				reader.pos++;
				break;
			default:
				reader.part(c, false, true);
				reader.pos++;
		}
	}
}

/**
 * Read a PowerShell single-quoted string, where `''` is a quote.
 * @param reader The reader, at the opening quote.
 */
function psSingle(reader: Reader): void {
	const { text } = reader;
	let value = '';
	let pos = reader.pos + 1;
	while (pos < text.length) {
		const c = text[pos] ?? '';
		if (isOneOf(PS_SINGLE, c)) {
			if (isOneOf(PS_SINGLE, text[pos + 1] ?? '')) {
				value += "'";
				pos += 2;
				continue;
			}
			reader.part(value, true, true);
			reader.pos = pos + 1;
			return;
		}
		value += c;
		pos++;
	}
	throw new Incomplete('an unterminated single quote');
}

/**
 * Read a PowerShell double-quoted string, or a whole expandable here-string body: backtick escapes, `""` and `$`
 * expansions.
 * @param reader The reader.
 * @param start The offset after the opening quote, or 0 for a body.
 * @param quoted Stop at a closing double quote, which must exist.
 * @returns The text read and the offset after it.
 */
function psDouble(reader: Reader, start: number, quoted: boolean): Piece {
	const { text } = reader;
	let value = '';
	let literal = true;
	let pos = start;
	while (pos < text.length) {
		const c = text[pos] ?? '';
		if (quoted && isOneOf(PS_DOUBLE, c)) {
			if (!isOneOf(PS_DOUBLE, text[pos + 1] ?? '')) return { value, literal, end: pos + 1 };
			value += '"';
			pos += 2;
		} else if (c === '`') {
			const next = text[pos + 1] ?? '';
			value += PS_ESCAPES.get(next) ?? next;
			pos += next === '' ? 1 : 2;
		} else if (c === '$') {
			const piece = psDollar(reader, pos);
			value += piece.value;
			literal &&= piece.literal;
			pos = piece.end;
		} else {
			value += c;
			pos++;
		}
	}
	if (quoted) throw new Incomplete('an unterminated double quote');
	return { value, literal, end: pos };
}

/**
 * Read what follows a PowerShell `$`: a subexpression, a braced variable or a variable.
 * @param reader The reader.
 * @param pos The offset of the `$`.
 * @returns The piece; `variable` marks a variable reference.
 */
function psDollar(reader: Reader, pos: number): Piece {
	const { text } = reader;
	const next = text[pos + 1] ?? '';
	if (next === '(') {
		const end = nestedAt(reader, readPowerShell, ')', pos + 2);
		return { value: text.slice(pos, end), literal: false, end };
	}
	if (next === '{') {
		const end = text.indexOf('}', pos + 2);
		if (end === -1) throw new Incomplete('an unclosed ${');
		return { value: text.slice(pos, end + 1), literal: false, end: end + 1, variable: true };
	}
	PS_VARIABLE.lastIndex = pos + 1;
	const name = PS_VARIABLE.exec(text);
	if (name !== null) return { value: `$${name[0]}`, literal: false, end: pos + 1 + name[0].length, variable: true };
	return { value: '$', literal: true, end: pos + 1 };
}

/**
 * Read what follows a PowerShell `@` at the start of a word: a here-string, an array subexpression, a hashtable or
 * a splat. Elsewhere `@` is plain text.
 * @param reader The reader, at the `@`.
 */
function psAt(reader: Reader): void {
	const { text } = reader;
	const next = reader.at(1);
	if (!reader.atWordStart()) {
		reader.part('@', false, true);
		reader.pos++;
		return;
	}
	if (isOneOf(PS_SINGLE + PS_DOUBLE, next) && /^[ \t]*\r?\n/.test(text.slice(reader.pos + 2, reader.pos + 66))) {
		psHereString(reader, isOneOf(PS_SINGLE, next));
		return;
	}
	if (next === '(' || next === '{') {
		const end = nestedAt(reader, readPowerShell, next === '(' ? ')' : '}', reader.pos + 2);
		reader.part(text.slice(reader.pos, end), false, false);
		reader.pos = end;
		return;
	}
	const splat = /^[A-Za-z_?][A-Za-z0-9_:?]*/.exec(text.slice(reader.pos + 1, reader.pos + 129));
	if (splat !== null) {
		reader.part(`@${splat[0]}`, false, false);
		reader.pos += 1 + splat[0].length;
		return;
	}
	reader.part('@', false, true);
	reader.pos++;
}

/**
 * Read a PowerShell here-string, `@'…'@` or `@"…"@`, whose closing quote starts a line.
 * @param reader The reader, at the `@`.
 * @param single A literal here-string; otherwise its body expands.
 */
function psHereString(reader: Reader, single: boolean): void {
	const { text } = reader;
	const bodyStart = text.indexOf('\n', reader.pos) + 1;
	const closing = new RegExp(`\\r?\\n[${single ? PS_SINGLE : PS_DOUBLE}]@`, 'g');
	closing.lastIndex = bodyStart - 1;
	const match = closing.exec(text);
	if (match === null) throw new Incomplete('an unterminated here-string');
	const body = text.slice(bodyStart, match.index);
	if (single) reader.part(body, true, true);
	else {
		const piece = psDouble(new Reader({ ...reader.frame, depth: reader.frame.depth + 1 }, 'powershell', body, 0), 0, false);
		reader.part(piece.value, true, piece.literal);
	}
	reader.pos = match.index + match[0].length;
}

/**
 * Read a PowerShell redirect: `>`, `>>`, `2>`, `*>`, and stream merges such as `2>&1`.
 * @param reader The reader, at `>`.
 */
function psRedirect(reader: Reader): void {
	reader.dropStreamNumber(/^(?:\d|\*)$/);
	reader.pos += reader.at(1) === '>' ? 2 : 1;
	if (reader.at() === '&') {
		reader.pos++;
		while (/^\d$/.test(reader.at())) reader.pos++;
		return;
	}
	reader.target = 'redirect';
}

/**
 * Skip a PowerShell block comment `<# … #>`.
 * @param reader The reader, at `<#`.
 */
function psBlockComment(reader: Reader): void {
	reader.finishWord();
	const end = reader.text.indexOf('#>', reader.pos + 2);
	if (end === -1) throw new Incomplete('an unterminated block comment');
	reader.pos = end + 2;
}

/**
 * Read the rest of the line after PowerShell's stop-parsing token `--%` as plain words, where double quotes only
 * group and nothing expands but `%NAME%`.
 * @param reader The reader, at `--%`.
 */
function psStopParsing(reader: Reader): void {
	const { text } = reader;
	reader.pos += 3;
	let current: string | null = null;
	let inQuote = false;
	const flush = (): void => {
		if (current !== null) reader.pending.words.push({ value: current, quoted: false, literal: !/%[^%\s]+%/.test(current) });
		current = null;
	};
	while (reader.pos < text.length) {
		const c = reader.at();
		if (c === '\n' || c === '\r') break;
		if (c === '"') {
			inQuote = !inQuote;
			current ??= '';
		} else if (!inQuote && (c === ' ' || c === '\t')) flush();
		else current = (current ?? '') + c;
		reader.pos++;
	}
	flush();
}

// ─── cmd.exe ─────────────────────────────────────────────────────────────────

/**
 * The cmd.exe read loop, for the text of `cmd /c`: double quotes, `^` escapes, `&`, `&&`, `||`, `|`, redirects,
 * `( … )` groups and `%NAME%` expansions.
 * @param reader The reader.
 * @param close The closing bracket of a group, or null at the top of a text.
 * @returns The offset after the closing bracket, or the text length.
 */
function readCmd(reader: Reader, close: ')' | '}' | null): number {
	const { text } = reader;
	for (;;) {
		if (reader.pos >= text.length) {
			if (close !== null) throw new Incomplete('an unclosed (');
			reader.finishCommand(false);
			return reader.pos;
		}
		const c = reader.at();
		if (c === ')' && close === ')') {
			reader.finishCommand(false);
			return reader.pos + 1;
		}
		switch (c) {
			case ' ':
			case '\t':
				reader.finishWord();
				reader.pos++;
				break;
			case '\n':
			case '\r':
				reader.finishCommand(false);
				reader.pos++;
				break;
			case '"': {
				const end = text.indexOf('"', reader.pos + 1);
				if (end === -1) throw new Incomplete('an unterminated double quote');
				const content = text.slice(reader.pos + 1, end);
				reader.part(content, true, !/%[^%\s]+%/.test(content));
				reader.pos = end + 1;
				break;
			}
			case '^': {
				const next = reader.at(1);
				if (next === '') reader.pos++;
				else if (next === '\n') reader.pos += 2;
				else {
					reader.part(next, true, true);
					reader.pos += 2;
				}
				break;
			}
			case '&':
				reader.finishCommand(false);
				reader.pos += reader.at(1) === '&' ? 2 : 1;
				break;
			case '|':
				if (reader.at(1) === '|') {
					reader.finishCommand(false);
					reader.pos += 2;
				} else {
					reader.finishCommand(true);
					reader.pos++;
				}
				break;
			case '<':
			case '>':
				reader.dropStreamNumber(/^\d$/);
				if (reader.at(1) === '&') {
					reader.target = 'dup';
					reader.pos += 2;
				} else {
					reader.target = 'redirect';
					reader.pos += c === '>' && reader.at(1) === '>' ? 2 : 1;
				}
				break;
			case '(':
				if (reader.commandEmpty()) reader.pos = nestedAt(reader, readCmd, ')', reader.pos + 1);
				else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			case '%': {
				const end = text.indexOf('%', reader.pos + 1);
				if (reader.at(1) === '%') {
					reader.part('%', false, true);
					reader.pos += 2;
				} else if (end > reader.pos + 1) {
					reader.part(text.slice(reader.pos, end + 1), false, false);
					reader.pos = end + 1;
				} else {
					reader.part(c, false, true);
					reader.pos++;
				}
				break;
			}
			default:
				reader.part(c, false, true);
				reader.pos++;
		}
	}
}

/** The read loop of each dialect. */
const READ_LOOPS: Record<Dialect, ReadLoop> = { bash: readBash, powershell: readPowerShell, cmd: readCmd };

// ─── Finishing a command ─────────────────────────────────────────────────────

/** Bash reserved words that may lead a simple command; they are dropped. */
const BASH_LEADING = new Set(['!', '{', '}', 'if', 'then', 'elif', 'else', 'fi', 'do', 'done', 'while', 'until', 'function', 'coproc']);

/** Bash compound heads whose words run nothing (`for x in …`, `case … in`); their substitutions were read already. */
const BASH_NO_COMMAND = new Set(['for', 'select', 'case', 'esac']);

/** A Bash assignment before the command word, `NAME=value` or `NAME[i]+=value`. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?\+?=/;

/** A PowerShell assignment operator after a variable. */
const PS_ASSIGN = /^(?:[-+*/%]|\?\?)?=$/;

/**
 * Turn a finished command into simple commands: drop leading reserved words and assignments, read unquoted heredoc
 * bodies for substitutions, and unwrap prefixes and wrappers.
 * @param frame The frame.
 * @param dialect The dialect that read it.
 * @param pending The command.
 */
function finalize(frame: Frame, dialect: Dialect, pending: Pending): void {
	let words = pending.words;
	if (dialect === 'bash') {
		while (words[0] !== undefined && !words[0].quoted && BASH_LEADING.has(words[0].value)) words = words.slice(1);
		if (words[0] !== undefined && !words[0].quoted && BASH_NO_COMMAND.has(words[0].value)) words = [];
		while (words[0] !== undefined && ASSIGNMENT.test(words[0].value)) words = words.slice(1);
	} else if (dialect === 'powershell') {
		if (words[0]?.value.startsWith('$') === true && PS_ASSIGN.test(words[1]?.value ?? '')) words = words.slice(2);
	} else if (words[0] !== undefined) {
		const head = { ...words[0], value: words[0].value.replace(/^@+/, '') };
		words = head.value === '' ? words.slice(1) : [head, ...words.slice(1)];
	}
	const stdin = [...pending.stdin];
	for (const doc of pending.heredocs) {
		const body = doc.body ?? '';
		if (!doc.quoted) bashExpandable(new Reader({ ...frame, depth: frame.depth + 1 }, 'bash', body, 0), 0, false);
		stdin.push({ value: body, quoted: true, literal: true });
	}
	if (words.length === 0 && pending.redirects.length === 0) return;
	unwrap(frame, dialect, words, { redirects: pending.redirects, piped: pending.piped, call: pending.call, stdin });
}

// ─── Unwrapping prefixes and wrappers ────────────────────────────────────────

/** The state of one command's unwrapping, for the handlers. */
interface Unwrapping {
	frame: Frame;
	dialect: Dialect;
	meta: Meta;
	words: Word[];
	/** The last prefix was `xargs`, which appends arguments from standard input. */
	viaXargs: boolean;
	/** Push the current words as a command. */
	emit: (dynamic: boolean) => void;
	/** Read a wrapper's script as a further text, one level deeper, once per dialect. */
	nest: (text: string, dialects: readonly Dialect[]) => void;
}

/** A handler's result: the next words to unwrap, or null when it emitted or nested. */
type Outcome = Word[] | null;

/** Unwraps one command name. */
type Handler = (state: Unwrapping, rest: Word[], name: string) => Outcome;

/** Prefixes that run their arguments: their options, those that take a value, and whether a duration follows them. */
const PREFIXES = new Map<string, { valued: ReadonlySet<string>; duration?: true }>([
	['command', { valued: new Set() }],
	['builtin', { valued: new Set() }],
	['exec', { valued: new Set(['-a']) }],
	['nohup', { valued: new Set() }],
	['nice', { valued: new Set(['-n', '--adjustment']) }],
	['time', { valued: new Set(['-o', '-f', '--output', '--format']) }],
	['timeout', { valued: new Set(['-s', '--signal', '-k', '--kill-after']), duration: true }],
	[
		'xargs',
		{
			valued: new Set([
				'-I',
				'-n',
				'-P',
				'-L',
				'-s',
				'-d',
				'-E',
				'-a',
				'--arg-file',
				'--delimiter',
				'--max-args',
				'--max-procs',
				'--max-lines',
				'--max-chars',
				'--eof',
				'--replace',
				'--process-slot-var',
			]),
		},
	],
	['stdbuf', { valued: new Set(['-i', '-o', '-e', '--input', '--output', '--error']) }],
	[
		'sudo',
		{
			valued: new Set([
				'-u',
				'-g',
				'-h',
				'-p',
				'-C',
				'-D',
				'-r',
				'-t',
				'-T',
				'-U',
				'--user',
				'--group',
				'--host',
				'--prompt',
				'--close-from',
				'--chdir',
				'--role',
				'--type',
				'--command-timeout',
				'--other-user',
			]),
		},
	],
	['call', { valued: new Set() }],
]);

/** pnpm's global options that take a value, before the subcommand; the guard's lock gate reads them too. */
export const PNPM_GLOBAL_VALUED: ReadonlySet<string> = new Set([
	'-C',
	'--dir',
	'-F',
	'--filter',
	'--filter-prod',
	'--test-pattern',
	'--changed-files-ignore-pattern',
	'--reporter',
	'--loglevel',
	'--workspace-concurrency',
	'--resume-from',
]);

/** `pnpm exec`, `pnpm dlx` and `pnpm run` options that take a value. */
const PNPM_SUB_VALUED = new Set(['-C', '--dir', '-F', '--filter', '--filter-prod', '--reporter', '--resume-from', '--package', '--allow-build', '--workspace-concurrency']);

/** pnpm's own commands, which run no other command (`run`, `exec` and `dlx` are unwrapped). */
const PNPM_BUILTINS = new Set(
	'add approve-builds audit bin c cache cat-file cat-index config create dedupe deploy dislink doctor env fetch find-hash help i ignored-builds import init install install-test it la licenses link list ll ln ls m multi outdated pack patch patch-commit patch-remove prune publish rb rebuild recursive remove restart rm root sbom self-update server setup start store t test tst un uni uninstall unlink up update upgrade version why'.split(
		' '
	)
);

/** `npx` and `npm exec` options that take a value. */
const NPX_VALUED = new Set(['-p', '--package', '--prefix', '-w', '--workspace', '--cache', '--userconfig', '--registry']);

/** Yarn's own commands, which run no other command. */
const YARN_BUILTINS = new Set(
	'add audit autoclean bin cache check config constraints dedupe explain generate-lock-entry global import info init install licenses link list login logout npm outdated owner pack patch patch-commit plugin policies publish rebuild remove set stage tag team test unlink unplug up upgrade upgrade-interactive version why workspace workspaces'.split(
		' '
	)
);

/** `wsl` options that take a value. */
const WSL_VALUED = new Set(['-d', '--distribution', '-u', '--user', '--cd', '--shell-type', '--distribution-id']);

/** `pwsh` parameters that take a value, matched by unambiguous prefix (two letters at least). */
const PWSH_VALUED = [
	'executionpolicy',
	'workingdirectory',
	'windowstyle',
	'outputformat',
	'inputformat',
	'configurationname',
	'configurationfile',
	'settingsfile',
	'custompipename',
	'psconsolefile',
	'version',
];

/** `pwsh` parameter aliases that take a value. */
const PWSH_VALUED_ALIASES = new Set(['ep', 'wd', 'w', 'o', 'of', 'if', 'inp', 'config', 'settings', 'v']);

/** `Start-Process` parameters that take a value, besides `-FilePath` and `-ArgumentList`. */
const START_PROCESS_VALUED = ['credential', 'workingdirectory', 'redirectstandarderror', 'redirectstandardinput', 'redirectstandardoutput', 'verb', 'windowstyle', 'environment'];

/** Node options that take a value, before the script; the guard reads them too. */
export const NODE_VALUED: ReadonlySet<string> = new Set([
	'-r',
	'--require',
	'--import',
	'--loader',
	'--experimental-loader',
	'-C',
	'--conditions',
	'--input-type',
	'--title',
	'--env-file',
	'--env-file-if-exists',
]);

/** Shells whose `-c` argument is a script. */
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish']);

/**
 * Skip a command's own options: words that start with `-`, up to `--` or the first other word.
 * @param words The words.
 * @param start The index to start at.
 * @param valued The options that take the next word as their value.
 * @returns The index of the first word after the options.
 */
function skipOptions(words: readonly Word[], start: number, valued: ReadonlySet<string>): number {
	let index = start;
	while (index < words.length) {
		const value = words[index]?.value ?? '';
		if (value === '--') return index + 1;
		if (!value.startsWith('-') || value === '-') return index;
		index += valued.has(value) ? 2 : 1;
	}
	return index;
}

/**
 * Join words into one command line, as a wrapper that receives them does.
 * @param words The words.
 * @returns Their values joined by spaces.
 */
function joinWords(words: readonly Word[]): string {
	return words.map((word) => word.value).join(' ');
}

/**
 * Split a word on commas and whitespace (a `Start-Process -ArgumentList` value, an `env -S` string).
 * @param word The word.
 * @returns The parts, with the word's flags.
 */
function splitWord(word: Word): Word[] {
	return word.value
		.split(/[\s,]+/)
		.filter((part) => part !== '')
		.map((value) => ({ value, quoted: word.quoted, literal: word.literal }));
}

/**
 * The bin a package runner runs for a package spec: `@scope/name@1.2.3` is `name`.
 * @param words The runner's command words; the first is the spec.
 * @returns The words with the spec replaced by its name.
 */
function asPackage(words: readonly Word[]): Word[] {
	const [head, ...rest] = words;
	if (head === undefined) return [];
	let spec = head.value;
	if (spec.startsWith('@')) spec = spec.slice(spec.indexOf('/') + 1);
	const version = spec.indexOf('@');
	return [{ ...head, value: version > 0 ? spec.slice(0, version) : spec }, ...rest];
}

/** The dialects a package runner's shell mode (`pnpm exec -c`, `npx -c`) runs in: `sh`, or `cmd.exe` on Windows. */
const SHELL_MODE: readonly Dialect[] = ['bash', 'cmd'];

/**
 * Read a wrapper's script in its dialects, or emit the command as dynamic when the script is not literal.
 * @param state The unwrapping.
 * @param words The script's words.
 * @param dialects The dialects the wrapper may run it in: one for a shell, {@link SHELL_MODE} for a package runner.
 * @returns Null: the script was read or the command emitted.
 */
function script(state: Unwrapping, words: readonly Word[], dialects: readonly Dialect[]): Outcome {
	if (words.length === 0) state.emit(false);
	else if (words.some((word) => !word.literal)) state.emit(true);
	else state.nest(joinWords(words), dialects);
	return null;
}

/**
 * `env`: options, `-S` strings and assignments.
 * @param _state The unwrapping (unused).
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapEnv: Handler = (_state, rest) => {
	let index = 0;
	while (index < rest.length) {
		const value = rest[index]?.value ?? '';
		if (value === '-S' || value === '--split-string') {
			const split = rest[index + 1];
			return [...(split === undefined ? [] : splitWord(split)), ...rest.slice(index + 2)];
		}
		if (value === '--') {
			index++;
			break;
		}
		if (!value.startsWith('-')) break;
		index += value === '-u' || value === '--unset' || value === '-C' || value === '--chdir' ? 2 : 1;
	}
	while (index < rest.length && ASSIGNMENT.test(rest[index]?.value ?? '')) index++;
	return rest.slice(index);
};

/**
 * `start`: PowerShell's alias of `Start-Process`, and cmd's `start ["title"] [/options] command`.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @param name The command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapStart: Handler = (state, rest, name) => {
	if (state.dialect === 'powershell') return unwrapStartProcess(state, rest, name);
	let index = rest[0]?.quoted === true ? 1 : 0;
	while (rest[index]?.value.startsWith('/') === true) {
		const option = rest[index]?.value.toLowerCase() ?? '';
		index += option === '/d' || option === '/node' || option === '/affinity' ? 2 : 1;
	}
	return rest.slice(index);
};

/**
 * `Start-Process <file> [-ArgumentList <args>]`, with named or positional parameters.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapStartProcess: Handler = (state, rest) => {
	let file: Word | undefined;
	let args: Word[] = [];
	const positional: Word[] = [];
	for (let index = 0; index < rest.length; index++) {
		const word = rest[index];
		if (word === undefined) break;
		if (!/^-[A-Za-z]/.test(word.value)) {
			positional.push(word);
			continue;
		}
		const parameter = word.value.slice(1).replace(/:$/, '').toLowerCase();
		const value = rest[index + 1];
		if ('filepath'.startsWith(parameter) || parameter === 'path' || parameter === 'pspath') {
			file = value;
			index++;
		} else if ('argumentlist'.startsWith(parameter) || parameter === 'args') {
			if (value !== undefined) args = splitWord(value);
			index++;
		} else if (parameter.length >= 2 && START_PROCESS_VALUED.some((name) => name.startsWith(parameter))) index++;
	}
	file ??= positional[0];
	if (args.length === 0) args = positional.slice(1).flatMap(splitWord);
	if (file === undefined) {
		state.emit(false);
		return null;
	}
	return [file, ...args];
};

/**
 * `pnpm exec`, `pnpm dlx`, `pnpm run`, and `pnpm <name>` for anything that is not a pnpm command.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapPnpm: Handler = (state, rest) => {
	const index = skipOptions(rest, 0, PNPM_GLOBAL_VALUED);
	const sub = rest[index]?.value.toLowerCase();
	if (sub === undefined || PNPM_BUILTINS.has(sub)) {
		state.emit(false);
		return null;
	}
	if (sub === 'run' || sub === 'run-script') return rest.slice(skipOptions(rest, index + 1, PNPM_SUB_VALUED));
	if (sub !== 'exec' && sub !== 'dlx') return rest.slice(index);
	let start = index + 1;
	let shell = false;
	while (start < rest.length) {
		const value = rest[start]?.value ?? '';
		if (value === '--') {
			start++;
			break;
		}
		if (!value.startsWith('-')) break;
		if (value === '-c' || value === '--shell-mode') shell = true;
		start += PNPM_SUB_VALUED.has(value) ? 2 : 1;
	}
	if (shell) return script(state, rest.slice(start), SHELL_MODE);
	return sub === 'dlx' ? asPackage(rest.slice(start)) : rest.slice(start);
};

/**
 * `npx` and `npm exec`: options, the `-c` shell mode, then a package spec.
 * @param state The unwrapping.
 * @param args The words after `npx` or `npm exec`.
 * @returns The package's command, or null for a shell mode.
 */
function npxLike(state: Unwrapping, args: readonly Word[]): Outcome {
	let index = 0;
	while (index < args.length) {
		const value = args[index]?.value ?? '';
		if (value === '--') {
			index++;
			break;
		}
		if (!value.startsWith('-')) break;
		if (value === '-c' || value === '--call') return script(state, args.slice(index + 1, index + 2), SHELL_MODE);
		if (value.startsWith('--call=')) return script(state, [{ ...(args[index] as Word), value: value.slice('--call='.length) }], SHELL_MODE);
		index += NPX_VALUED.has(value) ? 2 : 1;
	}
	return asPackage(args.slice(index));
}

/**
 * `npm exec`, `npm x` and `npm run`.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapNpm: Handler = (state, rest) => {
	const sub = rest[0]?.value.toLowerCase();
	if (sub === 'exec' || sub === 'x') return npxLike(state, rest.slice(1));
	if (sub === 'run' || sub === 'run-script') return rest.slice(skipOptions(rest, 1, new Set()));
	state.emit(false);
	return null;
};

/**
 * `yarn exec`, `yarn dlx`, `yarn run`, and `yarn <name>` for anything that is not a Yarn command.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapYarn: Handler = (state, rest) => {
	const sub = rest[0]?.value.toLowerCase();
	if (sub === undefined || sub.startsWith('-') || YARN_BUILTINS.has(sub)) {
		state.emit(false);
		return null;
	}
	if (sub === 'dlx') return asPackage(rest.slice(skipOptions(rest, 1, new Set(['-p', '--package']))));
	if (sub === 'exec' || sub === 'run') return rest.slice(1);
	return rest;
};

/**
 * `bunx` and `bun x`.
 * @param _state The unwrapping (unused).
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapBunx: Handler = (_state, rest) => asPackage(rest.slice(skipOptions(rest, 0, new Set(['-p', '--package']))));

/**
 * `bun x`, `bun run`, and `bun -e` one-liners.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @param name The command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapBun: Handler = (state, rest, name) => {
	const sub = rest[0]?.value.toLowerCase();
	if (sub === 'x') return unwrapBunx(state, rest.slice(1), name);
	if (sub === 'run') return rest.slice(1);
	state.emit(nodeEval(rest));
	return null;
};

/**
 * `wsl [options] command`, `wsl -e command` and `wsl -- command`; the command is read as Bash.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapWsl: Handler = (state, rest) => {
	let index = 0;
	while (index < rest.length) {
		const value = rest[index]?.value ?? '';
		if (value === '--') return script(state, rest.slice(index + 1), ['bash']);
		if (value === '-e' || value === '--exec') return rest.slice(index + 1);
		if (!value.startsWith('-')) break;
		index += WSL_VALUED.has(value) ? 2 : 1;
	}
	return script(state, rest.slice(index), ['bash']);
};

/**
 * `bash -c`, `sh -lc` and the other shells; a heredoc or here-string fed to a shell; a pipe into a shell.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapShell: Handler = (state, rest) => {
	let index = 0;
	let hasScript = false;
	while (index < rest.length) {
		const value = rest[index]?.value ?? '';
		if (value === '--' || value === '-') {
			index++;
			break;
		}
		if (value.startsWith('--')) index += value === '--rcfile' || value === '--init-file' ? 2 : 1;
		else if (/^[-+][oO]$/.test(value)) index += 2;
		else if (/^[-+][A-Za-z]+$/.test(value)) {
			if (value.startsWith('-') && value.includes('c')) hasScript = true;
			index++;
		} else break;
	}
	if (hasScript) return script(state, rest.slice(index, index + 1), ['bash']);
	if (state.meta.stdin.length > 0) {
		for (const input of state.meta.stdin) state.nest(input.value, ['bash']);
		return null;
	}
	state.emit(index >= rest.length && state.meta.piped);
	return null;
};

/**
 * `cmd /c` and `cmd /k`, whose rest is read as cmd.exe text; a pipe into `cmd`.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapCmd: Handler = (state, rest) => {
	const index = rest.findIndex((word) => /^(?:\/[a-z](?::[a-z]+)?)*\/[ck]$/i.test(word.value));
	if (index === -1) {
		state.emit(state.meta.piped && rest.every((word) => word.value.startsWith('/')));
		return null;
	}
	return script(state, rest.slice(index + 1), ['cmd']);
};

/**
 * `pwsh` and `powershell`: `-Command`, `-CommandWithArgs`, `-EncodedCommand`, or a positional command.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapPwsh: Handler = (state, rest) => {
	for (let index = 0; index < rest.length; index++) {
		const value = rest[index]?.value ?? '';
		if (!/^[-/]/.test(value)) return script(state, rest.slice(index), ['powershell']);
		const parameter = value
			.replace(/^[-/]+/, '')
			.replace(/:$/, '')
			.toLowerCase();
		if (parameter === 'cwa' || (parameter.length >= 8 && 'commandwithargs'.startsWith(parameter))) return script(state, rest.slice(index + 1, index + 2), ['powershell']);
		if (parameter === 'c' || (parameter.length >= 3 && 'command'.startsWith(parameter))) {
			const words = rest.slice(index + 1);
			if (words.length === 1 && words[0]?.value === '-') {
				state.emit(true);
				return null;
			}
			return script(state, words, ['powershell']);
		}
		if (parameter === 'e' || parameter === 'ec' || (parameter.length >= 2 && 'encodedcommand'.startsWith(parameter))) {
			const encoded = rest[index + 1];
			if (encoded === undefined) state.emit(false);
			else if (!encoded.literal || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded.value)) state.emit(true);
			else state.nest(Buffer.from(encoded.value, 'base64').toString('utf16le'), ['powershell']);
			return null;
		}
		if (parameter === 'f' || (parameter.length >= 2 && 'file'.startsWith(parameter))) break;
		if (PWSH_VALUED_ALIASES.has(parameter) || (parameter.length >= 2 && PWSH_VALUED.some((name) => name.startsWith(parameter)))) index++;
	}
	state.emit(state.meta.piped);
	return null;
};

/**
 * `Invoke-Expression` and `iex`.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapIex: Handler = (state, rest) => {
	const words = rest[0] !== undefined && /^-c(?:o(?:m(?:m(?:a(?:n(?:d)?)?)?)?)?)?:?$/i.test(rest[0].value) ? rest.slice(1) : rest;
	if (words.length === 0) {
		state.emit(state.meta.piped);
		return null;
	}
	return script(state, words, ['powershell']);
};

/**
 * Bash `eval`.
 * @param state The unwrapping.
 * @param rest The words after the command name.
 * @returns The next words, or null when the handler emitted or nested.
 */
const unwrapEval: Handler = (state, rest) => script(state, rest, ['bash']);

/**
 * Whether Node's (or Bun's) options run inline code: `-e`, `-p`, `--eval`, `--print`, or a cluster such as `-pe`.
 * @param args The words after `node`.
 * @returns True for an inline script.
 */
function nodeEval(args: readonly Word[]): boolean {
	for (let index = 0; index < args.length; index++) {
		const value = args[index]?.value ?? '';
		if (!value.startsWith('-')) return false;
		if (/^--(?:eval|print)(?:=|$)/.test(value) || /^-[A-Za-z]*[ep][A-Za-z]*$/.test(value)) return true;
		if (NODE_VALUED.has(value)) index++;
	}
	return false;
}

/**
 * Whether an interpreter's single-dash options, before its script, hold a flag that runs inline code.
 * @param args The words after the interpreter.
 * @param flag The inline-code flags, as a character class body such as `eE`.
 * @param stop Options after which the next word is not inline code (Python's `-m`).
 * @returns True for an inline script.
 */
function inlineFlag(args: readonly Word[], flag: string, stop: ReadonlySet<string> = new Set()): boolean {
	// The flag is a letter constant from this module, never command text.
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
	const cluster = new RegExp(`^-[A-Za-z0-9]*[${flag}][A-Za-z0-9]*$`);
	for (let index = 0; index < args.length; index++) {
		const value = args[index]?.value ?? '';
		if (!value.startsWith('-') || stop.has(value)) return false;
		if (cluster.test(value)) return true;
		if (value === '-W' || value === '-X') index++;
	}
	return false;
}

/**
 * The interpreters whose one-liners the guard cannot read (design D2, "Dynamic shapes"): their names, and whether
 * their arguments run inline code.
 */
const INTERPRETERS: readonly (readonly [readonly string[], (args: readonly Word[]) => boolean])[] = [
	// node: `-e`, `-p`, `--eval`, `--print`, or a cluster such as `-pe`.
	[['node', 'nodejs'], nodeEval],
	// Python: `-c`, but not after `-m`, whose next word is a module.
	[['python', 'python3', 'py'], (args) => inlineFlag(args, 'c', new Set(['-m']))],
	// perl: `-e` and `-E`.
	[['perl'], (args) => inlineFlag(args, 'eE')],
	// ruby: `-e`.
	[['ruby'], (args) => inlineFlag(args, 'e')],
	// deno: the `eval` subcommand.
	[['deno'], (args) => args[0]?.value === 'eval'],
];

/**
 * The handler of an interpreter: it emits the command, dynamic when it runs inline code.
 * @param inline Whether the interpreter's arguments run inline code.
 * @returns The handler.
 */
function interpreter(inline: (args: readonly Word[]) => boolean): Handler {
	return (state, rest) => {
		state.emit(inline(rest));
		return null;
	};
}

/**
 * `git`: dynamic when its subcommand cannot be read, or when `xargs` supplies it.
 * @param state The unwrapping.
 * @returns Null: the handler emitted.
 */
const unwrapGit: Handler = (state) => {
	const call = readGitCall(state.words);
	state.emit(call.dynamic || (state.viaXargs && call.sub === -1));
	return null;
};

/** The handler for each command name (after {@link commandName}). */
const HANDLERS = new Map<string, Handler>([
	['env', unwrapEnv],
	['start', unwrapStart],
	['start-process', unwrapStartProcess],
	['saps', unwrapStartProcess],
	['pnpm', unwrapPnpm],
	['npx', npxLike],
	['npm', unwrapNpm],
	['yarn', unwrapYarn],
	['bunx', unwrapBunx],
	['bun', unwrapBun],
	['wsl', unwrapWsl],
	['cmd', unwrapCmd],
	['pwsh', unwrapPwsh],
	['powershell', unwrapPwsh],
	['invoke-expression', unwrapIex],
	['iex', unwrapIex],
	['eval', unwrapEval],
	['git', unwrapGit],
	...INTERPRETERS.flatMap(([names, inline]) => names.map((name): [string, Handler] => [name, interpreter(inline)])),
	...[...SHELLS].map((shell): [string, Handler] => [shell, unwrapShell]),
]);

/**
 * Unwrap a command's prefixes and wrappers and emit what it runs.
 * @param frame The frame.
 * @param dialect The dialect that read it.
 * @param words The command's words.
 * @param meta Its redirects, pipe, call operator and standard-input texts.
 */
function unwrap(frame: Frame, dialect: Dialect, words: Word[], meta: Meta): void {
	let wrapperEmitted = false;
	const state: Unwrapping = {
		frame,
		dialect,
		meta,
		words,
		viaXargs: false,
		emit: (dynamic) => {
			frame.out.push({ words: state.words, redirects: meta.redirects, dialect, dynamic, piped: meta.piped, depth: frame.depth });
		},
		nest: (text, dialects) => {
			if (meta.redirects.length > 0 && !wrapperEmitted) {
				state.emit(false);
				wrapperEmitted = true;
			}
			for (const each of dialects) readText({ ...frame, depth: frame.depth + 1 }, text, each);
		},
	};
	for (let hop = 0; hop < 32; hop++) {
		const head = state.words[0];
		if (head === undefined) {
			if (meta.redirects.length > 0) state.emit(false);
			return;
		}
		if (!head.literal) {
			// A PowerShell expression statement (`$x`, `(…)`) runs nothing by itself; only `&` or `.` calls it.
			const called = hop > 0 || dialect !== 'powershell' || meta.call;
			state.emit(called && !head.value.startsWith('{'));
			return;
		}
		const name = commandName(head.value, frame.platform);
		const rest = state.words.slice(1);
		const prefix = PREFIXES.get(name);
		let next: Outcome;
		if (prefix !== undefined) {
			let index = skipOptions(rest, 0, prefix.valued);
			if (prefix.duration === true) index++;
			next = rest.slice(index);
		} else {
			const handler = HANDLERS.get(name);
			if (handler === undefined) {
				state.emit(state.viaXargs && state.words.length === 1);
				return;
			}
			next = handler(state, rest, name);
		}
		if (next === null) return;
		state.viaXargs = name === 'xargs';
		state.words = next;
	}
	state.emit(true);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Git's global options that take the next word as their value. */
const GIT_GLOBAL_VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);

/**
 * Name a command word: its last path segment, lowercased, without `.exe`, `.cmd`, `.bat` or `.ps1` (design D2,
 * "Command words").
 * @param value The command word's value.
 * @param platform The platform: on `win32` a backslash also separates path segments.
 * @returns The name, such as `git`.
 */
export function commandName(value: string, platform: NodeJS.Platform): string {
	const segments = value.split(platform === 'win32' ? /[\\/]/ : /\//);
	return (segments.at(-1) ?? '').toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');
}

/**
 * Read a `git` invocation's global options (design D3) and find its subcommand.
 * @param words The command's words; the first is `git`.
 * @returns The subcommand's index, the `-C` and `-c` values, and whether the subcommand is dynamic.
 */
export function readGitCall(words: readonly Word[]): GitCall {
	const dirs: Word[] = [];
	const configs: Word[] = [];
	for (let index = 1; index < words.length; index++) {
		const word = words[index];
		if (word === undefined) break;
		if (GIT_GLOBAL_VALUED.has(word.value)) {
			const option = words[index + 1];
			if (option !== undefined && word.value === '-C') dirs.push(option);
			if (option !== undefined && word.value === '-c') {
				configs.push(option);
				if (!option.literal) return { sub: -1, dirs, configs, dynamic: true };
			}
			index++;
			continue;
		}
		if (word.value.startsWith('-') && (word.literal || word.value.includes('='))) continue;
		return { sub: index, dirs, configs, dynamic: !word.literal };
	}
	return { sub: -1, dirs, configs, dynamic: false };
}

/**
 * Read a text with one dialect's rules.
 * @param text The command text.
 * @param dialect The dialect.
 * @param platform The platform the command runs on.
 * @returns Every command read, and whether the whole text was read.
 */
export function readShell(text: string, dialect: Dialect, platform: NodeJS.Platform): Reading {
	const out: SimpleCommand[] = [];
	if (Buffer.byteLength(text, 'utf8') > MAX_INPUT_BYTES) return { dialect, commands: out, complete: false };
	try {
		readText({ platform, out, depth: 0 }, text, dialect);
		return { dialect, commands: out, complete: true };
	} catch (error) {
		if (error instanceof Incomplete) return { dialect, commands: out, complete: false };
		throw error;
	}
}

/**
 * Read a shell tool's command text with both dialects (design D2, "Two readings, rules on the union").
 * @param text The command text.
 * @param options The platform.
 * @returns Both readings and the union of their commands.
 */
export function parseCommand(text: string, options: ParseOptions): ParseResult {
	const readings = (['bash', 'powershell'] as const).map((dialect) => readShell(text, dialect, options.platform));
	const commands = readings.flatMap((reading) => reading.commands);
	return { readings, commands, complete: readings.some((reading) => reading.complete), dynamic: commands.some((command) => command.dynamic) };
}
