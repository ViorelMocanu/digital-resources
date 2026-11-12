import {
	type Block,
	type GuardDeps,
	type GuardScope,
	blockMessage,
	checkFileTool,
	checkShell,
	defaultGuardDeps,
	guardHandlers,
	isDeniedEnvName,
	makeGitProbe,
	makeLockGate,
	suspicion,
} from './guard.ts';
import { type Holder, TOKEN_VARIABLE, handshake } from '../checkout-lock.ts';
import { type HookOutput, runHook } from './hook-io.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, win32 } from 'node:path';
import { HOOK_ENV, initScratchRepo, isolatedGitEnv, makeScratchDir, removeScratchDir, scratchGit, scrubbedEnv } from '../lib/scratch-git.ts';
import { Buffer } from 'node:buffer';
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The command guard (OpenSpec change harness-guardrails, design D3-D5, D7, D8; spec harness--guards). The rule
// tables run against an injected file system and git probe on `win32` paths, so they pass on the Linux CI runner
// too. Folder detection also runs against a real throwaway repo, and the per-host cases spawn the real entry point
// with JSON on stdin. Scratch folders live under the repo's `tmp/`.

const GUARD = resolve(import.meta.dirname, 'guard.ts');
const ROOT = 'G:\\repo';

/** The fake checkout's paths, lowercased: folders and files. */
const KINDS = new Map<string, 'dir' | 'file'>(
	(
		[
			[ROOT, 'dir'],
			[`${ROOT}\\.git`, 'dir'],
			[`${ROOT}\\src`, 'dir'],
			[`${ROOT}\\src\\components`, 'dir'],
			[`${ROOT}\\src\\app.ts`, 'file'],
			[`${ROOT}\\docs`, 'dir'],
			[`${ROOT}\\tmp`, 'dir'],
			[`${ROOT}\\README.md`, 'file'],
			[`${ROOT}\\list.txt`, 'file'],
		] as const
	).map(([path, kind]) => [path.toLowerCase(), kind])
);

/** What the fake `git cat-file -t` answers; every other spec is unknown to git. */
const PROBES = new Map([
	[':./LICENSE', 'blob'],
	['HEAD:./LICENSE', 'blob'],
	['HEAD:./gone', 'tree'],
]);

/** The specs the fake probe was asked about, newest last. */
const probed: string[] = [];

/**
 * Dependencies over the fake checkout.
 * @param overrides Dependencies to replace.
 * @returns The dependencies.
 */
function fakeDeps(overrides: Partial<GuardDeps> = {}): GuardDeps {
	const kind = (path: string): 'dir' | 'file' | null => KINDS.get(win32.resolve(path).toLowerCase()) ?? null;
	return {
		...defaultGuardDeps(),
		// The cases below were written for the destructive-only policy; the read-only policy has its own block.
		gitPolicy: 'destructive-only',
		stat: kind,
		exists: (path) => kind(path) !== null,
		gitProbe: (_dir, spec) => {
			probed.push(spec);
			return PROBES.get(spec) ?? null;
		},
		lockGate: makeLockGate(() => null),
		log: () => true,
		...overrides,
	};
}

/**
 * A guard scope in the fake checkout.
 * @param overrides Scope fields to replace.
 * @returns The scope.
 */
function fakeScope(overrides: Partial<GuardScope> = {}): GuardScope {
	return { platform: 'win32', env: {}, cwd: ROOT, root: ROOT, host: 'claude', now: () => new Date(2026, 9, 25, 20, 0, 0), deps: fakeDeps(), ...overrides };
}

/**
 * Judge a shell command in the fake checkout.
 * @param command The command text.
 * @param overrides Scope fields to replace.
 * @returns The block, or null.
 */
function check(command: string, overrides: Partial<GuardScope> = {}): Block | null {
	return checkShell(command, fakeScope(overrides));
}

describe("the read-only git policy, this checkout's default", () => {
	const strict = (command: string): Block | null => check(command, { deps: fakeDeps({ gitPolicy: 'read-only' }) });

	it('is what the real dependencies use', () => {
		expect(defaultGuardDeps().gitPolicy).toBe('read-only');
	});

	it.each([
		'git add .',
		'git add src/config.ts',
		'git commit -m "x"',
		'git commit --amend --no-edit',
		'git pull',
		'git fetch origin',
		'git merge main',
		'git rebase main',
		'git cherry-pick abc1234',
		'git revert HEAD',
		'git checkout main',
		'git switch -c feature',
		'git restore --staged src/config.ts',
		'git reset HEAD~1',
		'git rm README.md',
		'git mv a.txt b.txt',
		'git stash',
		'git stash pop',
		'git branch feature',
		'git branch -m old new',
		'git tag v1.0.0',
		'git tag -d v1.0.0',
		'git remote add origin https://example.com/x.git',
		'git config user.name x',
		'git config --unset user.name',
		'git worktree add ../x',
		'git clean -fd',
		'git apply fix.patch',
		'git init',
		'git frobnicate',
		'git status && git commit -m x',
		'bash -c "git add ."',
		'pwsh -Command "git commit -m x"',
		'git -C tmp/x commit -m x',
		'git -c alias.ci="commit -m x" ci',
		// Write options in the abbreviated forms git accepts, and a branch name after `--`.
		'git symbolic-ref --del HEAD',
		'git config --remove-sec foo',
		'git config --unset-al a.b',
		'git tag --del v1.0.0',
		'git branch --del feature',
		'git branch -- feature',
		'git apply --exclude --check fix.patch',
	])('blocks %s', (command) => {
		const block = strict(command);
		expect(block?.kind).toBe('git');
	});

	it.each([
		'git status --short',
		'git log -3 --oneline',
		'git diff HEAD~1 -- src',
		'git show HEAD:package.json',
		'git blame README.md',
		'git ls-files',
		'git rev-parse HEAD',
		'git grep -n commit',
		'git log --grep "git push"',
		'git branch',
		"git branch --list 'feat*'",
		'git branch --contains HEAD',
		'git branch --sort committerdate',
		'git config --file other.cfg core.hooksPath',
		'git tag',
		"git tag -l 'v*'",
		'git stash list',
		'git stash show',
		'git remote -v',
		'git remote get-url origin',
		'git config --get core.hooksPath',
		'git config --list',
		'git worktree list',
		'git reflog',
		'git clean -n',
		'git apply --check fix.patch',
		'git --version',
		'git check-ignore -v tmp',
		'echo git commit',
		'grep -c commit README.md',
	])('allows %s', (command) => {
		expect(strict(command)).toBeNull();
	});

	it('names the subcommand and the rule in the block', () => {
		expect(strict('git commit -m x')?.rule).toBe('git commit (only read-only git is allowed here)');
		expect(strict('git push')?.rule).toBe('git push');
	});

	it('looks for a write subcommand in text it cannot read safely', () => {
		expect(suspicion("git commit -m 'x", {}, false, 'read-only')?.kind).toBe('suspicion');
		expect(suspicion("git status 'x", {}, false, 'read-only')).toBeNull();
		expect(suspicion("git commit -m 'x", {})).toBeNull();
	});
});

describe('git rules (D3)', () => {
	it.each([
		// The first probe list: the forms an earlier guard blocked.
		'git push',
		'& git push origin main',
		'git -C "G:/elsewhere" push',
		'git --no-pager push',
		'git --git-dir=.git push',
		'git.exe push',
		'GIT_TRACE=1 git push',
		'git log | xargs git push',
		'git status && git push',
		'Set-Location G:\\x; git push',
		'Start-Process git -ArgumentList push',
		'git --% push',
		'git push --dry-run',
		'git push -f origin main',
		'git reset --hard',
		'git reset --hard HEAD~1',
		'git reset --ha',
		'git clean -fdx',
		'git clean -xdf',
		'git clean -ffx',
		'git clean --force -d',
		'git clean -i',
		'git clean --interactive',
		'git clean',
		'git -c clean.requireForce=false clean -n',
		'git clean -nf',
		'git branch -D feature/x',
		'git branch -df feature/x',
		'git branch -d -f feature/x',
		'git branch --delete --force feature/x',
		'git branch -Dr origin/x',
		'git restore :/',
		'git restore --worktree --staged .',
		'git restore --source=HEAD~1 -- src\\components\\',
		// The forms that earlier guard missed: folder checkout and restore, wrappers, quoted paths, aliases, continuations.
		'git checkout -- src/',
		'git checkout src/components',
		'git checkout HEAD -- src/',
		'git checkout .',
		'git checkout ./',
		"git checkout -- '*.ts'",
		'git checkout -f main',
		'git checkout --force main',
		'git checkout --pathspec-from-file=list.txt',
		'git restore src/',
		'git restore -- src/components',
		'git restore src',
		'git restore -W src',
		'git restore --pathspec-from-file=list.txt',
		'git restore -s HEAD~1 src',
		'git restore -sHEAD~1 docs',
		'echo $(git push)',
		'bash -c "git push"',
		'sh -lc "git push"',
		'pwsh -Command "git push"',
		'powershell.exe -NoProfile -c "git push"',
		'Invoke-Expression "git push"',
		"iex 'git push'",
		'eval "git push"',
		'cmd /c "git push"',
		'& "C:\\Program Files\\Git\\bin\\git.exe" push',
		'"C:\\Program Files\\Git\\bin\\git.exe" push',
		'git -c alias.p=push p',
		"git -c 'alias.x=!git push' x",
		'git `\n  push',
		'git \\\n  push',
		"git 'push'",
		'git "push"',
		'"g"it push',
		"g''it push",
		'GIT push',
		'git PUSH',
		// Every package runner, wsl and sudo.
		'pnpm exec git push',
		'pnpm --filter site exec git push',
		'pnpm dlx git push',
		'npx git push',
		'npx -y git push',
		'npm exec -- git push',
		'yarn exec git push',
		'bunx git push',
		'pnpm exec -c "git push"',
		'npx -c "git push"',
		'wsl git push',
		'wsl -e git push',
		'wsl -- git push',
		'sudo git push',
		'env git push',
		'timeout 10 git push',
		'nohup git push',
		`pwsh -EncodedCommand ${Buffer.from('git push --force', 'utf16le').toString('base64')}`,
		// Dynamic shapes that name the subcommand somewhere: the suspicion check.
		'sub=push; git $sub',
		'$s = "push"; git $s',
		'& $git push',
		"node -e \"require('child_process').execSync('git push')\"",
		"git push 'unterminated",
	])('blocks %s', (command) => {
		expect(check(command), command).not.toBeNull();
	});

	it.each([
		'git commit -m "never git push"',
		'grep "git push" docs',
		'echo "git reset --hard"',
		'git log --grep="push"',
		'git status',
		'git diff --staged',
		'git log --oneline -5',
		'git push -h',
		'git push --help',
		'git reset --soft HEAD~1',
		'git reset --mixed',
		'git reset --keep HEAD~1',
		'git reset --merge',
		'git reset HEAD src/app.ts',
		'git reset -- --hard',
		'git clean -n',
		'git clean --dry-run',
		'git clean -nd',
		'git branch',
		'git branch -a',
		'git branch -d feature/x',
		'git branch -m old new',
		'git branch -M old new',
		'git checkout main',
		'git checkout HEAD~1',
		'git checkout feature/x',
		'git checkout -b feature/new',
		'git checkout -B feature/new origin/main',
		'git checkout -',
		'git checkout src/app.ts',
		'git checkout -- src/app.ts',
		'git checkout -- LICENSE',
		'git checkout HEAD -- LICENSE',
		'git restore src/app.ts',
		'git restore LICENSE',
		'git restore --staged .',
		'git restore --staged src/',
		'git restore -S src',
		'git restore --source=HEAD~1 src/app.ts',
		'git switch --discard-changes main',
		'git stash drop',
		'git worktree remove --force tmp/wt',
		'gh pr create',
		'git -c alias.st=status st',
		'git -C tmp/harness-guardrails/repo status',
		'git -C "$dir" status',
		'git restore --help',
		'git checkout -h',
	])('allows %s', (command) => {
		expect(check(command), command).toBeNull();
	});

	it('probes git only for a missing pathspec, and never for the branch position', () => {
		probed.length = 0;
		check('git checkout main');
		check('git checkout feature/x');
		check('git restore src/app.ts');
		expect(probed).toEqual([]);
		check('git restore LICENSE');
		check('git checkout HEAD -- gone');
		expect(probed).toEqual([':./LICENSE', 'HEAD:./gone']);
	});

	it('resolves pathspecs from the effective -C folder', () => {
		expect(check('git -C src restore components', { cwd: ROOT })).not.toBeNull();
		expect(check('git -C src restore app.ts', { cwd: ROOT })).toBeNull();
		expect(check('git -C G:\\repo restore src', { cwd: 'G:\\elsewhere' })).not.toBeNull();
	});

	it('places a Git Bash drive path for -C on its own drive', () => {
		expect(check('git -C /g/repo checkout src', { cwd: 'G:\\elsewhere' })).not.toBeNull();
		expect(check('git -C /g/repo restore src', { cwd: 'G:\\elsewhere' })).not.toBeNull();
		// Read as G:\g\repo, the file would be unknown and block.
		expect(check('git -C /g/repo restore src/app.ts', { cwd: 'G:\\elsewhere' })).toBeNull();
	});

	it('asks git once for all the unknown pathspecs of a call', () => {
		const batches: string[][] = [];
		const gitProbe = Object.assign((_dir: string, spec: string) => PROBES.get(spec) ?? null, {
			batch: (_dir: string, specs: readonly string[]) => {
				batches.push([...specs]);
				return specs.map((spec) => PROBES.get(spec) ?? null);
			},
		});
		expect(check('git restore LICENSE gone2', { deps: fakeDeps({ gitProbe }) })).not.toBeNull();
		expect(batches).toEqual([[':./LICENSE', ':./gone2']]);
	});

	it('blocks a pathspec it cannot place when the call has no folder', () => {
		expect(check('git restore app.ts', { cwd: null, root: null })).not.toBeNull();
		expect(check('git push', { cwd: null, root: null })).not.toBeNull();
		expect(check('git status', { cwd: null, root: null })).toBeNull();
	});
});

describe('OpenSpec rule (D7)', () => {
	it.each([
		'openspec update',
		'openspec update --force',
		'openspec update .',
		'openspec init',
		'openspec init --tools claude',
		'openspec init --tools=claude,cursor .',
		'openspec.cmd update',
		'openspec.ps1 update',
		'npx -y @fission-ai/openspec@1.3.1 update --force',
		'npx @fission-ai/openspec update',
		'pnpm dlx @fission-ai/openspec update',
		'pnpm exec openspec update',
		'yarn dlx @fission-ai/openspec update',
		'bunx @fission-ai/openspec init',
		'pnpm openspec update',
		'pnpm run openspec update',
		'node node_modules/@fission-ai/openspec/bin/openspec.js update',
		'node C:\\tools\\bin\\openspec update',
		'echo hi; openspec update',
		'bash -c "openspec update"',
		'pwsh -Command "openspec init"',
		'openspec update src/tmp/x',
		'openspec update G:\\repo\\src',
		'openspec update tmp/../src',
		// Git Bash drops these backslashes, so it would run `openspec update G:repotmpx`, a folder in the checkout.
		'openspec update G:\\repo\\tmp\\x',
		'RESURSE_GUARD_ALLOW=openspec openspec update',
		'env RESURSE_GUARD_ALLOW=openspec openspec update',
		'$env:RESURSE_GUARD_ALLOW = "openspec"; openspec init',
		'OPENSPEC UPDATE',
	])('blocks %s', (command) => {
		expect(check(command), command).not.toBeNull();
	});

	it.each([
		'openspec update --help',
		'openspec init -h',
		'openspec update tmp/x',
		'openspec update G:/repo/tmp/x',
		'openspec init tmp/harness-guardrails/probe',
		'openspec update ../other',
		'openspec new change x',
		'openspec validate x --strict',
		'openspec status',
		'openspec list',
		'openspec show x',
		'openspec archive x',
		'openspec instructions apply',
		'openspec view',
		'openspec templates',
		'openspec --version',
		'echo "openspec update"',
	])('allows %s', (command) => {
		expect(check(command), command).toBeNull();
	});

	it('allows a cwd under <root>/tmp/ but not a tmp folder elsewhere in the checkout', () => {
		expect(check('openspec update', { cwd: `${ROOT}\\tmp\\x` })).toBeNull();
		expect(check('openspec update', { cwd: `${ROOT}\\src\\tmp` })).not.toBeNull();
	});

	it('places a Git Bash drive path on its own drive (simplify finding, 2026-10-26)', () => {
		// Read as G:\g\repo, the target fell outside the checkout and passed.
		expect(check('openspec update /g/repo')).not.toBeNull();
		expect(check('openspec update /g/repo/src', { cwd: 'G:\\elsewhere', root: null })).not.toBeNull();
		expect(check('openspec update /g/repo/tmp/x')).toBeNull();
	});

	it('allows a target outside any checkout', () => {
		expect(check('openspec update', { cwd: 'G:\\elsewhere', root: null })).toBeNull();
		expect(check('openspec update G:/elsewhere', { cwd: null, root: null })).toBeNull();
	});

	it('blocks a target it cannot place, as git restore does, unless the override is set (reviewer finding, 2026-10-26)', () => {
		expect(check('openspec update', { cwd: null, root: null })).not.toBeNull();
		expect(check('openspec init src', { cwd: null, root: null })).not.toBeNull();
		expect(check('git restore .', { cwd: null, root: null })).not.toBeNull();
		expect(check('openspec update', { cwd: null, root: null, env: { RESURSE_GUARD_ALLOW: 'openspec' } })).toBeNull();
	});

	it("lets the owner's override through for update and init only, and logs each use", () => {
		const lines: string[] = [];
		const deps = fakeDeps({
			log: (file, line) => {
				lines.push(`${file} ${line}`);
				return true;
			},
		});
		const env = { RESURSE_GUARD_ALLOW: 'openspec' };
		expect(check('openspec update', { env, deps })).toBeNull();
		expect(check('npx -y @fission-ai/openspec init', { env, deps })).toBeNull();
		expect(check('git push', { env, deps })).not.toBeNull();
		expect(check('cat .env', { env, deps })).not.toBeNull();
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain(`${ROOT}\\tmp\\agent-state\\guard-overrides.log`);
		expect(lines[0]).toContain('openspec update');
	});

	it.each(['1', 'OPENSPEC', 'openspec,git', ' openspec', 'git'])('overrides nothing with RESURSE_GUARD_ALLOW=%s', (value) => {
		expect(check('openspec update', { env: { RESURSE_GUARD_ALLOW: value } })).not.toBeNull();
	});
});

describe('env rule (D8)', () => {
	it.each([
		'cat .env',
		'cat .env.staging',
		'cat .env.local',
		'cat .env.production',
		'cat .ENV',
		'cat config/.env',
		'cat G:\\repo\\.env',
		'cat .env*',
		'Get-Content .env',
		'Get-Content -Path .env',
		'gc README.md,.env',
		'type .env',
		'head -5 .dev.vars',
		'cat .dev.vars.production',
		'cat < .env',
		'grep KEY .env',
		'rg -g .env KEY',
		'sls KEY -Path .env',
		'cp .env backup.txt',
		'Copy-Item .env x',
		'mv .dev.vars y',
		'Move-Item .env y',
		'source .env',
		'. ./.env',
		'echo $(cat .env)',
		'bash -c "cat .env"',
		'ls .env | xargs cat',
		'Get-ChildItem .env | Get-Content',
		"node -e \"console.log(require('fs').readFileSync('.env','utf8'))\"",
		'echo ok > .env',
	])('blocks %s', (command) => {
		expect(check(command), command).not.toBeNull();
	});

	it.each([
		'cat .env.example',
		'git check-ignore .env',
		'git check-ignore -v .dev.vars',
		'git ls-files .env.example',
		'git status',
		'ls -la .env',
		'Test-Path .env',
		'test -f .env',
		'[ -f .env ]',
		'stat .env',
		'Get-ChildItem -Force .env*',
		'node --env-file=.env scripts/x.ts',
		'node --env-file .env scripts/x.ts',
		'node --env-file-if-exists=.dev.vars scripts/x.ts',
		'grep ".env" .gitignore',
		'grep -e .env -e .dev.vars .gitignore',
		'grep -n --regexp=.env .gitignore',
		'rg -F .dev.vars docs',
		'git grep .env -- docs',
		'Select-String -Pattern ".env" -Path .gitignore',
		'sls .env .gitignore',
		'findstr .env .gitignore',
		'findstr /c:".env" .gitignore',
		'echo "never cat .env"',
		'echo ".env.local holds the keys; never print it"',
		'cat .gitignore',
	])('allows %s', (command) => {
		expect(check(command), command).toBeNull();
	});

	it('matches the denied names exactly, case-insensitively', () => {
		expect(['.env', '.ENV.local', '.env.staging', '.dev.vars', '.dev.vars.prod'].every(isDeniedEnvName)).toBe(true);
		expect(['.env.example', '.envrc', 'env', '.dev.varsx', 'prod.env', 'README.md'].some(isDeniedEnvName)).toBe(false);
	});

	it('scans every single-line string of a file tool, and the headers of a patch', () => {
		expect(checkFileTool({ file_path: 'G:\\repo\\.env' })).not.toBeNull();
		expect(checkFileTool({ target_file: 'src/.dev.vars.local' })).not.toBeNull();
		expect(checkFileTool({ args: { AbsolutePath: '/srv/repo/.env.production' } })).not.toBeNull();
		expect(checkFileTool({ command: '*** Begin Patch\n*** Update File: .env\n@@\n-A=1\n+A=2\n*** End Patch\n' })).not.toBeNull();
		expect(checkFileTool({ command: '*** Begin Patch\n*** Update File: src/a.ts\n*** Move to: config/.dev.vars\n*** End Patch\n' })).not.toBeNull();
		expect(checkFileTool({ file_path: '.env.example' })).toBeNull();
		expect(checkFileTool({ file_path: 'src/app.ts', content: 'KEY=1\n.env\n' })).toBeNull();
		expect(checkFileTool({ command: '*** Begin Patch\n*** Update File: .gitignore\n@@\n+.env.*\n*** End Patch\n' })).toBeNull();
	});

	it('reads no single-line replacement or content text as a path (reviewer finding, 2026-10-26)', () => {
		expect(checkFileTool({ path: 'README.md', old_string: 'x', new_string: '.env' })).toBeNull();
		expect(checkFileTool({ file_path: '.gitignore', old_string: 'node_modules', new_string: '.env.*' })).toBeNull();
		expect(
			checkFileTool({
				TargetFile: 'README.md',
				ReplacementChunks: [{ TargetContent: 'x', ReplacementContent: '.dev.vars' }],
				Instruction: 'mention .env.local',
				Description: '.env',
			})
		).toBeNull();
		expect(checkFileTool({ TargetFile: 'notes.md', CodeContent: '.env' })).toBeNull();
		expect(checkFileTool({ path: '.env', old_string: 'A=1', new_string: 'A=2' })).not.toBeNull();
		expect(checkFileTool({ TargetFile: 'config/.dev.vars', CodeContent: 'A=1' })).not.toBeNull();
	});
});

describe('suspicion (D4)', () => {
	it('blocks only text that is incomplete or dynamic and looks dangerous', () => {
		expect(suspicion("git push 'x", {})?.kind).toBe('suspicion');
		expect(suspicion("echo 'x", {})).toBeNull();
		expect(suspicion("openspec update 'x", {})).not.toBeNull();
		expect(suspicion("openspec update 'x", { RESURSE_GUARD_ALLOW: 'openspec' })).toBeNull();
		expect(suspicion("cat .env 'x", {})).not.toBeNull();
		expect(suspicion("node --env-file=.env -e 'x'", {})).toBeNull();
		expect(suspicion("git checkout main 'x", {})).toBeNull();
		expect(suspicion("git checkout . 'x", {})).not.toBeNull();
	});

	it('judges a PowerShell backtick line by its complete PowerShell reading', () => {
		expect(check('git commit -m "a `"quoted`" note about git push"')).toBeNull();
	});

	it('leaves a dynamic command alone when its text names nothing dangerous', () => {
		expect(check('node -e "console.log(1)"')).toBeNull();
		expect(check('bash -c "$CMD"')).toBeNull();
		expect(check('ls | xargs rm')).toBeNull();
	});
});

describe('block message (D5)', () => {
	it('has the three lines, names the guard doc, and stays ASCII and short', () => {
		const block = check(`git push ${'x'.repeat(2000)}`);
		expect(block).not.toBeNull();
		const message = blockMessage(block as Block, ROOT, 'win32');
		const lines = message.split('\n');
		expect(lines).toHaveLength(3);
		expect(lines[0]).toMatch(/^resurse guard blocked: /);
		expect(lines[1]).toMatch(/^Why: .*AGENTS.md, Never 1/);
		expect(lines[2]).toMatch(/^Do instead: /);
		expect(message).toContain('docs/agent/guardrails.md');
		expect(message.length).toBeLessThanOrEqual(600);
		expect(/^[\x20-\x7e\n]*$/.test(message)).toBe(true);
	});

	it('ends every advice with a full stop before the doc pointer', () => {
		for (const command of ['git push', 'openspec update', 'cat .env', "git push 'x"]) {
			expect(blockMessage(check(command) as Block, ROOT, 'win32').split('\n')[2], command).toMatch(/[^.]\. See docs\/agent\/guardrails\.md\.$/);
		}
		expect(blockMessage(check('git push') as Block, ROOT, 'win32')).toContain('G:\\repo\\tmp\\<task>\\. See docs/agent/guardrails.md.');
	});

	it("names the absolute <root>/tmp/<task>/ folder for git and the owner's own terminal for OpenSpec", () => {
		expect(blockMessage(check('git push') as Block, ROOT, 'win32')).toContain('G:\\repo\\tmp\\<task>\\');
		expect(blockMessage(check('git push') as Block, '/srv/repo', 'linux')).toContain('/srv/repo/tmp/<task>/');
		expect(blockMessage(check('openspec update') as Block, ROOT, 'win32')).toMatch(/own terminal/);
		expect(blockMessage(check('cat .env') as Block, ROOT, 'win32')).toContain('.env.example');
	});
});

// ─── The lock gate (D17) ─────────────────────────────────────────────────────

/** Another thread's `pnpm build`, as its handshake names it. */
const HOLDER: Holder = { pid: 4242, label: 'build', command: 'astro build && node scripts/flatten-locale-404.ts', started: '2026-10-25T19:57:00+02:00', token: '0123456789abcdef' };

/**
 * A scope in the fake checkout whose lock {@link HOLDER} holds; every other checkout is free.
 * @param overrides Scope fields to replace.
 * @returns The scope.
 */
function heldScope(overrides: Partial<GuardScope> = {}): GuardScope {
	const lockGate = makeLockGate((root) => (win32.resolve(root).toLowerCase() === ROOT.toLowerCase() ? HOLDER : null));
	return fakeScope({ now: () => new Date('2026-10-25T20:00:30+02:00'), deps: fakeDeps({ lockGate }), ...overrides });
}

describe('lock gate (D17)', () => {
	it.each([
		'pnpm install',
		'pnpm i',
		'pnpm install --frozen-lockfile',
		'pnpm add -D some-package',
		'pnpm remove x',
		'pnpm rm x',
		'pnpm uninstall x',
		'pnpm un x',
		'pnpm uni x',
		'pnpm update',
		'pnpm up',
		'pnpm upgrade --latest',
		'pnpm dedupe',
		'pnpm rebuild',
		'pnpm rb',
		'pnpm prune',
		'pnpm link ../x',
		'pnpm ln ../x',
		'pnpm unlink',
		'pnpm dislink',
		'pnpm import',
		'pnpm fetch',
		'pnpm install-test',
		'pnpm it',
		'pnpm.cmd install',
		'pnpm -r install',
		'pnpm --dir . add x',
		'npx pnpm install',
		'echo hi && pnpm install',
	])('blocks %s while another thread holds the lock', (command) => {
		expect(check(command, heldScope())?.kind, command).toBe('lock');
	});

	it.each([
		'pnpm exec astro build',
		'pnpm astro build',
		'pnpm dlx astro build',
		'npx astro build',
		'npx astro --root . build',
		'pnpm exec playwright test',
		'npx playwright test -g home',
		'pnpm exec playwright test --list',
		'pnpm exec serve dist/client -l 4901',
		'npx serve dist',
		'npx serve@14.2.6 ./dist/client',
		'npx serve -l 4901 dist\\client',
		'pnpm exec node scripts/sync-harness.ts',
		'node scripts/sync-harness.ts --prune',
	])('blocks the raw bypass %s', (command) => {
		expect(check(command, heldScope())?.kind, command).toBe('lock');
	});

	it.each([
		'pnpm exec prettier --write .',
		'pnpm exec prettier -w src',
		'npx prettier --write "**/*.md"',
		'pnpm exec prettier --write',
		'pnpm prettier --write .',
		'pnpm exec prettier --write README.md src',
		'pnpm exec prettier --write $files',
		'pnpm exec eslint . --fix',
		'pnpm exec eslint --fix',
		'npx eslint --fix src/components',
		'pnpm exec eslint --fix --rule no-console:off src',
		'pnpm exec stylelint "src/**/*.scss" --fix',
		'pnpm exec stylelint --fix strict src',
		'pnpm exec stylelint --fix=lax src',
		'pnpm exec markdownlint --fix "**/*.md"',
		'pnpm exec markdownlint -f docs',
		'pnpm exec markdownlint --fix --disable MD013 MD033 -- docs',
	])('blocks the repo-wide fixer %s', (command) => {
		expect(check(command, heldScope())?.kind, command).toBe('lock');
	});

	it.each([
		'pnpm install --help',
		'pnpm add -h',
		'pnpm dedupe --check',
		'pnpm outdated',
		'pnpm audit --prod',
		'pnpm list',
		'pnpm why serve',
		'pnpm test',
		'pnpm build',
		'pnpm verify',
		'pnpm --version',
		'pnpm exec astro check',
		'pnpm exec astro build --help',
		'pnpm exec playwright show-report',
		'pnpm exec playwright --version',
		'pnpm exec serve tmp/x -l 4901',
		'pnpm exec node scripts/sync-harness.ts --check',
		'node scripts/sync-harness.ts --diff',
		'node scripts/checkout-lock.ts --probe',
		'pnpm exec prettier --write openspec/changes/x/design.md',
		'pnpm exec prettier --write README.md src/app.ts',
		'pnpm exec prettier --write --config .prettierrc README.md',
		'pnpm exec prettier --check .',
		'pnpm exec eslint src/app.ts --fix',
		'pnpm exec eslint . --fix-dry-run',
		'pnpm exec eslint .',
		'pnpm exec eslint --fix-type layout src/app.ts --fix',
		'pnpm exec stylelint src/app.ts --fix',
		'pnpm exec stylelint --fix strict src/app.ts',
		'pnpm exec markdownlint --fix README.md docs/new-file.md',
		'pnpm exec markdownlint docs',
		'git status',
	])('allows %s while another thread holds the lock', (command) => {
		expect(check(command, heldScope()), command).toBeNull();
	});

	it("allows everything when the lock is free, or held by the caller's own run", () => {
		for (const command of ['pnpm install', 'pnpm exec prettier --write .', 'npx astro build']) {
			expect(check(command), command).toBeNull();
			expect(check(command, heldScope({ env: { [TOKEN_VARIABLE]: HOLDER.token } })), command).toBeNull();
			expect(check(command, heldScope({ env: { [TOKEN_VARIABLE]: 'fedcba9876543210' } }))?.kind, command).toBe('lock');
		}
	});

	it('allows when reading the holder fails', () => {
		const lockGate = makeLockGate(() => {
			throw new Error('pipe broke');
		});
		expect(check('pnpm install', fakeScope({ deps: fakeDeps({ lockGate }) }))).toBeNull();
	});

	it("checks the checkout the command runs in: the payload cwd's root, or pnpm's -C/--dir", () => {
		expect(check('pnpm install', heldScope({ cwd: 'G:\\other', root: 'G:\\other' }))).toBeNull();
		expect(check('pnpm install', heldScope({ cwd: 'G:\\other', root: null }))).toBeNull();
		// Forward slashes, so the Bash reading (where a backslash escapes) names the same folder as the PowerShell one.
		expect(check('pnpm -C G:/repo install', heldScope({ cwd: 'G:\\other', root: null }))?.kind).toBe('lock');
		expect(check('pnpm --dir=G:/repo/src add x', heldScope({ cwd: 'G:\\other', root: null }))?.kind).toBe('lock');
		expect(check('pnpm -C G:/elsewhere install', heldScope())).toBeNull();
		// A Git Bash drive path names the same folder on Windows (missed live on 2026-10-25, before this case).
		expect(check('pnpm -C /g/repo install', heldScope({ cwd: 'G:\\other', root: null }))?.kind).toBe('lock');
		expect(check('pnpm --dir=/G/repo/src add x', heldScope({ cwd: 'G:\\other', root: null }))?.kind).toBe('lock');
		expect(check('pnpm -C /g/elsewhere install', heldScope())).toBeNull();
	});

	it('follows a literal cd to the checkout the later commands run in', () => {
		const elsewhere = { cwd: 'G:\\other', root: null };
		// Into the held checkout from a payload outside it (missed live on 2026-10-25, before this case).
		for (const command of [
			'cd G:/repo && pnpm install',
			'cd /g/repo && pnpm install',
			'cd -- G:/repo; pnpm add x',
			'Set-Location -Path G:/repo; pnpm install',
			'pushd G:/repo/src && npx astro build',
			"bash -c 'cd G:/repo && pnpm install'",
		]) {
			expect(check(command, heldScope(elsewhere))?.kind, command).toBe('lock');
		}
		// Relative folders resolve from the folder cd moved to.
		expect(check('cd src && pnpm exec prettier --write components', heldScope())?.kind).toBe('lock');
		expect(check('cd src && pnpm exec prettier --write app.ts', heldScope())).toBeNull();
		// Out of the held checkout, the later commands run where no lock applies.
		expect(check('cd G:/elsewhere && pnpm install', heldScope())).toBeNull();
		// A cd that cannot be read, a cd after the command, or one inside a nested shell keeps the payload's checkout.
		for (const command of [
			'cd "$dir" && pnpm install',
			'cd - && pnpm install',
			'cd && pnpm install',
			'pnpm install; cd G:/elsewhere',
			"bash -c 'cd G:/elsewhere' && pnpm install",
		]) {
			expect(check(command, heldScope())?.kind, command).toBe('lock');
		}
	});

	it('names the holder in a three-line message that says to wait, never to stop it', () => {
		const message = blockMessage(check('pnpm add -D some-package', heldScope()) as Block, ROOT, 'win32');
		const lines = message.split('\n');
		expect(lines).toHaveLength(3);
		expect(lines[0]).toBe('resurse guard blocked: pnpm add (pnpm add -D some-package)');
		expect(lines[1]).toBe('Why: "build" is running in this checkout (pid 4242, started 2026-10-25 19:57 +02:00, 3 min ago).');
		expect(lines[2]).toMatch(/^Do instead: wait .*never stop a process you did not start\. See docs\/agent\/guardrails\.md\.$/);
		expect(message.length).toBeLessThanOrEqual(600);
		expect(/^[\x20-\x7e\n]*$/.test(message)).toBe(true);
	});
});

describe("runHook with the guard's handlers (D4)", () => {
	let scratch = '';
	let root = '';

	beforeAll(() => {
		scratch = makeScratchDir('guard-unit-');
		root = join(scratch, 'repo');
		mkdirSync(join(root, '.git'), { recursive: true });
	});

	afterAll(() => {
		removeScratchDir(scratch);
	});

	/**
	 * Run the hook on a Claude Bash payload, with the given parser.
	 * @param command The command.
	 * @param parse The parser to inject.
	 * @returns The output.
	 */
	function run(command: string, parse: GuardDeps['parse']): HookOutput {
		const payload = { session_id: 's1', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } };
		return runHook({ hint: 'claude', stdin: JSON.stringify(payload), env: {}, platform: process.platform }, guardHandlers({ parse }));
	}

	const throwing: GuardDeps['parse'] = () => {
		throw new TypeError('parser bug');
	};

	it('blocks with exit 2 when the parser throws on text that contains git push', () => {
		const output = run('git push origin main', throwing);
		expect(output.exitCode).toBe(2);
		expect(output.stderr).toContain('could not be read safely');
	});

	it('allows and logs one line when the parser throws on text that matches nothing', () => {
		const output = run('echo hi', throwing);
		expect(output).toEqual({ stdout: '', stderr: '', exitCode: 0 });
		const log = readFileSync(join(root, 'tmp', 'agent-state', 'hook-errors.log'), 'utf8');
		expect(log.trim().split('\n')).toHaveLength(1);
		expect(log).toContain('TypeError: parser bug');
		expect(log).not.toContain('echo hi');
	});

	it('allows when the suspicion check throws too', () => {
		const handlers = guardHandlers({ parse: throwing });
		const payload = { session_id: 's1', cwd: root, tool_name: 'Bash', tool_input: { command: 'git push' } };
		const output = runHook(
			{ hint: 'claude', stdin: JSON.stringify(payload), env: {}, platform: process.platform },
			{
				...handlers,
				suspicion: () => {
					throw new Error('also broken');
				},
			}
		);
		expect(output.exitCode).toBe(0);
	});
});

describe('folder detection against a real throwaway repo (D3)', () => {
	let scratch = '';
	let repo = '';
	let deps: GuardDeps;

	beforeAll(() => {
		scratch = makeScratchDir('guard-git-');
		repo = join(scratch, 'repo');
		mkdirSync(join(repo, 'src'), { recursive: true });
		mkdirSync(join(repo, 'docs'), { recursive: true });
		const env = isolatedGitEnv(scratch);
		initScratchRepo(repo, env);
		writeFileSync(join(repo, 'src', 'a.ts'), 'export {};\n');
		writeFileSync(join(repo, 'docs', 'notes.md'), '# Notes\n');
		writeFileSync(join(repo, 'LICENSE'), 'MIT\n');
		scratchGit(repo, env, ['add', '-A']);
		scratchGit(repo, env, ['commit', '-q', '-m', 'fixture']);
		rmSync(join(repo, 'docs'), { recursive: true, force: true });
		rmSync(join(repo, 'LICENSE'), { force: true });
		deps = { ...defaultGuardDeps(), gitPolicy: 'destructive-only', gitProbe: makeGitProbe(env), log: () => true };
	});

	afterAll(() => {
		removeScratchDir(scratch);
	});

	/**
	 * Judge a command with the real file system and git.
	 * @param command The command.
	 * @param cwd The folder it runs in.
	 * @returns The block, or null.
	 */
	function real(command: string, cwd: string = repo): Block | null {
		return checkShell(command, { platform: process.platform, env: {}, cwd, root: repo, host: 'claude', now: () => new Date(), deps });
	}

	it('blocks an existing folder and a deleted folder', () => {
		expect(real('git restore src')).not.toBeNull();
		expect(real('git restore docs')).not.toBeNull();
		expect(real('git checkout HEAD -- docs')).not.toBeNull();
		expect(real('git checkout src')).not.toBeNull();
	});

	it('passes a deleted extensionless file restored from the index, and a branch', () => {
		expect(real('git restore LICENSE')).toBeNull();
		expect(real('git checkout -- LICENSE')).toBeNull();
		expect(real('git checkout HEAD -- LICENSE')).toBeNull();
		expect(real('git restore src/a.ts')).toBeNull();
		expect(real('git checkout main')).toBeNull();
	});

	it('works through the effective -C folder', () => {
		expect(real('git -C repo restore docs', scratch)).not.toBeNull();
		expect(real('git -C repo restore LICENSE', scratch)).toBeNull();
		expect(real('git -C repo/src restore a.ts', scratch)).toBeNull();
	});
});

// ─── The real entry point ────────────────────────────────────────────────────

/** The result of one guard run. */
interface Run {
	status: number | null;
	stdout: string;
	stderr: string;
}

/**
 * The test process's environment without the variables that steer the guard, plus the given ones.
 * @param extra Variables to set.
 * @returns The environment.
 */
function guardEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	return scrubbedEnv(HOOK_ENV, extra);
}

/**
 * Spawn the guard with a payload on stdin.
 * @param hint The host argument.
 * @param payload The payload, or raw text.
 * @param env The environment, from {@link guardEnv}.
 * @returns The exit status and output.
 */
function spawnGuard(hint: string, payload: unknown, env: NodeJS.ProcessEnv = guardEnv()): Run {
	const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
	const result = spawnSync(process.execPath, [GUARD, hint], { input, env, encoding: 'utf-8', timeout: 20_000 });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('the guard entry point, per host (D5, D6)', () => {
	let scratch = '';
	let root = '';

	beforeAll(() => {
		scratch = makeScratchDir('guard-cli-');
		root = join(scratch, 'repo');
		mkdirSync(join(root, '.git'), { recursive: true });
		mkdirSync(join(root, 'scripts'), { recursive: true });
		mkdirSync(join(root, 'src'), { recursive: true });
		mkdirSync(join(scratch, 'outside'), { recursive: true });
	});

	afterAll(() => {
		removeScratchDir(scratch);
	});

	/**
	 * A Claude Code PreToolUse payload.
	 * @param tool The tool name.
	 * @param input The tool input.
	 * @param cwd The session folder.
	 * @returns The payload.
	 */
	function claude(tool: string, input: Record<string, unknown>, cwd: string = root): Record<string, unknown> {
		return {
			session_id: 'c1',
			transcript_path: join(scratch, 't.jsonl'),
			cwd,
			permission_mode: 'default',
			hook_event_name: 'PreToolUse',
			tool_name: tool,
			tool_input: input,
			tool_use_id: 'u1',
		};
	}

	/**
	 * Check that a run exited only with 0 or 2.
	 * @param run The run.
	 * @returns The run.
	 */
	function only0or2(run: Run): Run {
		expect([0, 2]).toContain(run.status);
		return run;
	}

	it('Claude Bash: a deny is exit 2 with the message on stderr; an allow is exit 0 with empty stdout', () => {
		const deny = only0or2(spawnGuard('claude', claude('Bash', { command: 'git push', description: 'Push', timeout: 120000 })));
		expect(deny.status).toBe(2);
		expect(deny.stdout).toBe('');
		expect(deny.stderr).toContain('resurse guard blocked: git push');
		const allow = only0or2(spawnGuard('claude', claude('Bash', { command: 'git status' })));
		expect(allow).toEqual({ status: 0, stdout: '', stderr: '' });
		expect(allow.stdout).not.toContain('permissionDecision');
	});

	it('Claude PowerShell and Monitor', () => {
		expect(spawnGuard('claude', claude('PowerShell', { command: 'Remove-Item x; git push' })).status).toBe(2);
		expect(spawnGuard('claude', claude('Monitor', { command: 'tail -f log & git push' })).status).toBe(2);
		expect(spawnGuard('claude', claude('Monitor', { ws: 'ws://127.0.0.1:4901' }))).toEqual({ status: 0, stdout: '', stderr: '' });
	});

	it('Cursor: a deny prints its JSON and exits 0, which survives PowerShell; an allow prints the provisional form', () => {
		const payload = {
			conversation_id: 'k1',
			generation_id: 'g1',
			hook_event_name: 'beforeShellExecution',
			cursor_version: '3.24.9',
			workspace_roots: [root],
			command: 'git push',
			cwd: root,
			sandbox: false,
		};
		const env = guardEnv({ CURSOR_VERSION: '3.24.9' });
		const deny = only0or2(spawnGuard('cursor', payload, env));
		expect(deny.status).toBe(0);
		expect(JSON.parse(deny.stdout)).toMatchObject({ permission: 'deny' });
		expect((JSON.parse(deny.stdout) as { agent_message: string }).agent_message).toContain('git push');
		const allow = only0or2(spawnGuard('cursor', { ...payload, command: 'git status' }, env));
		expect(allow.status).toBe(0);
		expect(JSON.parse(allow.stdout)).toEqual({});
	});

	it('Codex: Bash with an argv command, and apply_patch headers; a deny is its JSON with exit 0', () => {
		const base = { session_id: 'x1', turn_id: 't1', transcript_path: join(scratch, 'r.jsonl'), cwd: root, hook_event_name: 'PreToolUse', model: 'gpt-5' };
		/**
		 * Whether Codex reads a run as a deny: exit 0 with `permissionDecision: "deny"` (codex-rs/hooks pre_tool_use.rs).
		 * @param run The run.
		 * @returns True for a deny.
		 */
		const denied = (run: Run): boolean =>
			run.status === 0 &&
			run.stdout !== '' &&
			(JSON.parse(run.stdout) as { hookSpecificOutput?: { permissionDecision?: string } }).hookSpecificOutput?.permissionDecision === 'deny';
		const push = only0or2(spawnGuard('codex', { ...base, tool_name: 'Bash', tool_input: { command: ['bash', '-lc', 'git push'] } }));
		expect(denied(push)).toBe(true);
		expect(push.stdout).toContain('resurse guard blocked: git push');
		expect(spawnGuard('codex', { ...base, tool_name: 'Bash', tool_input: { command: 'git status' } })).toEqual({ status: 0, stdout: '', stderr: '' });
		const patch = (file: string): string => `*** Begin Patch\n*** Update File: ${file}\n@@\n-A=1\n+A=2\n*** End Patch\n`;
		expect(denied(spawnGuard('codex', { ...base, tool_name: 'apply_patch', tool_input: { command: patch('.env') } }))).toBe(true);
		expect(spawnGuard('codex', { ...base, tool_name: 'apply_patch', tool_input: { command: patch('src/a.ts') } })).toEqual({ status: 0, stdout: '', stderr: '' });
	});

	it('Grok: Bash, read_file and search_replace; a deny is exit 2 plus its JSON', () => {
		const env = guardEnv({ GROK_HOOK_EVENT: 'PreToolUse' });
		const base = { sessionId: 'g1', cwd: root, workspaceRoot: root, permissionMode: 'default', hook_event_name: 'PreToolUse', toolUseId: 'u1' };
		const shell = only0or2(spawnGuard('grok', { ...base, toolName: 'run_terminal_command', toolInput: { command: 'git push' } }, env));
		expect(shell.status).toBe(2);
		expect(shell.stderr).toContain('git push');
		expect(JSON.parse(shell.stdout)).toMatchObject({ decision: 'deny' });
		expect(spawnGuard('grok', { ...base, toolName: 'Bash', toolInput: { command: 'git status' } }, env).status).toBe(0);
		expect(spawnGuard('grok', { ...base, toolName: 'read_file', toolInput: { target_file: '.env' } }, env).status).toBe(2);
		expect(spawnGuard('grok', { ...base, toolName: 'search_replace', toolInput: { file_path: 'src/.dev.vars', old_string: 'a', new_string: 'b' } }, env).status).toBe(2);
		expect(spawnGuard('grok', { ...base, toolName: 'search_replace', toolInput: { file_path: 'src/a.ts', old_string: 'a', new_string: 'b' } }, env).status).toBe(0);
	});

	it('Antigravity: run_command and file tools deny with its JSON and exit 0', () => {
		const base = { conversationId: 'a1', workspacePaths: [root], transcriptPath: join(scratch, 'a.jsonl'), modelName: 'gemini', stepIdx: 3 };
		const deny = only0or2(spawnGuard('antigravity', { ...base, toolCall: { name: 'run_command', args: { CommandLine: 'git push', Cwd: root } } }));
		expect(deny.status).toBe(0);
		expect(JSON.parse(deny.stdout)).toMatchObject({ decision: 'deny' });
		const file = spawnGuard('antigravity', { ...base, toolCall: { name: 'view_file', args: { AbsolutePath: join(root, '.env') } } });
		expect(JSON.parse(file.stdout)).toMatchObject({ decision: 'deny' });
		expect(spawnGuard('antigravity', { ...base, toolCall: { name: 'run_command', args: { CommandLine: 'git status', Cwd: root } } })).toEqual({
			status: 0,
			stdout: '',
			stderr: '',
		});
	});

	it("Copilot's camelCase payload acts through the Claude-file entry", () => {
		const payload = { sessionId: 'p1', timestamp: 1, cwd: root, toolName: 'bash', toolArgs: JSON.stringify({ command: 'git push' }) };
		expect(spawnGuard('claude', payload).status).toBe(2);
		expect(spawnGuard('claude', { ...payload, toolArgs: { command: 'git status' } }).status).toBe(0);
	});

	it('the Claude-file entries do nothing under Cursor and Grok, and the Cursor-file entry nothing under Grok', () => {
		const cursorPayload = {
			conversation_id: 'k1',
			cursor_version: '3.24.9',
			hook_event_name: 'preToolUse',
			tool_name: 'Shell',
			tool_input: { command: 'git push' },
			cwd: root,
		};
		const underCursor = spawnGuard('claude', cursorPayload, guardEnv({ CURSOR_VERSION: '3.24.9', CURSOR_PROJECT_DIR: root }));
		expect(underCursor.status).toBe(0);
		expect(JSON.parse(underCursor.stdout)).toEqual({});
		const grokPayload = { sessionId: 'g1', cwd: root, hook_event_name: 'PreToolUse', toolName: 'Bash', toolInput: { command: 'git push' } };
		expect(spawnGuard('claude', grokPayload, guardEnv({ GROK_HOOK_EVENT: 'PreToolUse' }))).toEqual({ status: 0, stdout: '', stderr: '' });
		expect(spawnGuard('cursor', grokPayload, guardEnv({ GROK_HOOK_EVENT: 'PreToolUse' }))).toEqual({ status: 0, stdout: '', stderr: '' });
	});

	it('fails open on bad JSON, logging under the root from the project-folder variable', () => {
		expect(spawnGuard('claude', '{not json')).toEqual({ status: 0, stdout: '', stderr: '' });
		const cursor = spawnGuard('cursor', '{not json');
		expect(cursor.status).toBe(0);
		expect(JSON.parse(cursor.stdout)).toEqual({});
		expect(spawnGuard('claude', '{not json', guardEnv({ CLAUDE_PROJECT_DIR: join(root, 'scripts') })).status).toBe(0);
		expect(readFileSync(join(root, 'tmp', 'agent-state', 'hook-errors.log'), 'utf8')).toContain('not a JSON object');
	});

	it('fails open when stdin stays open', async () => {
		const started = Date.now();
		const child = spawn(process.execPath, [GUARD, 'claude'], { env: guardEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
		let stdout = '';
		child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
		const status = await new Promise<number | null>((done) => child.on('exit', (code) => done(code)));
		child.stdin.destroy();
		expect(status).toBe(0);
		expect(stdout).toBe('');
		expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
	}, 15_000);

	it('caps the message at 600 characters', () => {
		const run = spawnGuard('claude', claude('Bash', { command: `git push ${'x'.repeat(5000)}` }));
		expect(run.status).toBe(2);
		expect(run.stderr.trimEnd().length).toBeLessThanOrEqual(600);
		expect(run.stderr).toContain('docs/agent/guardrails.md');
	});

	it("the owner's override: openspec update and init pass and log one line each; git and env stay blocked", () => {
		const env = guardEnv({ RESURSE_GUARD_ALLOW: 'openspec' });
		const log = join(root, 'tmp', 'agent-state', 'guard-overrides.log');
		rmSync(log, { force: true });
		expect(spawnGuard('claude', claude('Bash', { command: 'openspec update' }), env).status).toBe(0);
		expect(spawnGuard('claude', claude('PowerShell', { command: 'openspec init --tools claude' }), env).status).toBe(0);
		expect(readFileSync(log, 'utf8').trim().split('\n')).toHaveLength(2);
		expect(spawnGuard('claude', claude('Bash', { command: 'git push' }), env).status).toBe(2);
		expect(spawnGuard('claude', claude('Bash', { command: 'cat .env' }), env).status).toBe(2);
	});

	it("without the override in the guard's own environment, inline assignments and other values change nothing", () => {
		for (const command of [
			'RESURSE_GUARD_ALLOW=openspec openspec update',
			'env RESURSE_GUARD_ALLOW=openspec openspec update',
			'$env:RESURSE_GUARD_ALLOW = "openspec"; openspec init',
		]) {
			expect(spawnGuard('claude', claude('Bash', { command })).status, command).toBe(2);
		}
		expect(spawnGuard('claude', claude('Bash', { command: 'openspec update' }), guardEnv({ RESURSE_GUARD_ALLOW: '1' })).status).toBe(2);
		const openspec = spawnGuard('claude', claude('Bash', { command: 'openspec update' }));
		expect(openspec.stderr).toMatch(/Do instead: .*own terminal/);
		const git = spawnGuard('claude', claude('Bash', { command: 'git push' }));
		expect(git.stderr).toContain(`Do instead: `);
		expect(git.stderr).toContain(`${join(root, 'tmp', '<task>')}${process.platform === 'win32' ? '\\' : '/'}`);
	});

	it('scratch paths: a cwd of <root>/scripts logs under <root>/tmp/ and creates no scripts/tmp/', () => {
		const log = join(root, 'tmp', 'agent-state', 'hook-errors.log');
		rmSync(log, { force: true });
		expect(spawnGuard('claude', claude('Bash', {}, join(root, 'scripts')))).toEqual({ status: 0, stdout: '', stderr: '' });
		expect(readFileSync(log, 'utf8')).toContain('no command');
		expect(existsSync(join(root, 'scripts', 'tmp'))).toBe(false);
	});

	it('scratch paths: a cwd outside any checkout allows and creates no tmp folder', () => {
		const outside = join(scratch, 'outside');
		const env = guardEnv({ GIT_CEILING_DIRECTORIES: scratch, RESURSE_GUARD_ALLOW: 'openspec' });
		expect(spawnGuard('claude', claude('Bash', { command: 'openspec update' }, outside), env).status).toBe(0);
		expect(spawnGuard('claude', claude('Bash', {}, outside), env).status).toBe(0);
		expect(spawnGuard('claude', '{not json', env).status).toBe(0);
		expect(existsSync(join(outside, 'tmp'))).toBe(false);
		expect(existsSync(join(scratch, 'tmp'))).toBe(false);
	});

	it('scratch paths: openspec update src/tmp/x is blocked, tmp/x from the root is allowed', () => {
		expect(spawnGuard('claude', claude('Bash', { command: 'openspec update src/tmp/x' })).status).toBe(2);
		expect(spawnGuard('claude', claude('Bash', { command: 'openspec update tmp/x' })).status).toBe(0);
	});
});

describe('the lock gate on a real holder (D17)', { timeout: 60_000 }, () => {
	let scratch = '';
	let root = '';
	let other = '';
	let holder: ChildProcess | null = null;
	/** The fake holder's handshake: another thread's build, started three minutes ago. */
	const fake: Holder = { ...HOLDER, pid: 31337, started: new Date(Date.now() - 3 * 60_000 - 5000).toISOString().replace(/\.\d+Z$/, '+00:00') };

	beforeAll(async () => {
		scratch = makeScratchDir('guard-lock-');
		root = join(scratch, 'repo');
		other = join(scratch, 'other');
		mkdirSync(join(root, '.git'), { recursive: true });
		mkdirSync(join(other, '.git'), { recursive: true });
		// A stand-in holder on the scratch repo's own lock address, answering with a fixed handshake. It runs in its own
		// process, because the guard reads the lock synchronously and would block the event loop that answers it.
		const script = join(scratch, 'holder.mjs');
		const lockModule = pathToFileURL(resolve(import.meta.dirname, '..', 'checkout-lock.ts')).href;
		writeFileSync(
			script,
			[
				`import { lockAddress, nodeAdapter } from ${JSON.stringify(lockModule)};`,
				'const [root, line] = process.argv.slice(2);',
				'const { result } = await nodeAdapter(process.platform).listen(lockAddress(root, process.platform), () => line);',
				'process.stdout.write(`${result.state}\\n`);',
				'setTimeout(() => process.exit(0), 50_000);',
				'',
			].join('\n')
		);
		const child = spawn(process.execPath, [script, root, handshake(fake)], { stdio: ['ignore', 'pipe', 'inherit'] });
		holder = child;
		const state = await new Promise<string>((done) => child.stdout?.once('data', (chunk: Buffer) => done(chunk.toString().trim())));
		expect(state).toBe('ok');
	});

	afterAll(async () => {
		if (holder !== null && holder.exitCode === null && holder.signalCode === null) {
			const exited = new Promise((done) => holder?.once('exit', done));
			holder.kill();
			await exited;
		}
		removeScratchDir(scratch);
	}, 30_000);

	/**
	 * A Claude Code Bash payload.
	 * @param command The command.
	 * @param cwd The session folder.
	 * @returns The payload.
	 */
	function bash(command: string, cwd: string): Record<string, unknown> {
		return { session_id: 'l1', cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } };
	}

	it('blocks pnpm add and a repo-wide fixer in the held checkout, naming the holder', () => {
		const add = spawnGuard('claude', bash('pnpm add -D some-package', root));
		expect(add.status).toBe(2);
		expect(add.stderr).toContain('resurse guard blocked: pnpm add (pnpm add -D some-package)');
		expect(add.stderr).toMatch(/Why: "build" is running in this checkout \(pid 31337, started \d{4}-\d{2}-\d{2} \d{2}:\d{2} \+00:00, 3 min ago\)\./);
		expect(add.stderr).toContain('never stop a process you did not start');
		expect(spawnGuard('claude', bash('pnpm exec prettier --write .', root)).status).toBe(2);
	});

	it("allows the same commands in another checkout, with the holder's own token, and a fixer on explicit files", () => {
		expect(spawnGuard('claude', bash('pnpm add -D some-package', other))).toEqual({ status: 0, stdout: '', stderr: '' });
		expect(spawnGuard('claude', bash('pnpm install', root), guardEnv({ [TOKEN_VARIABLE]: fake.token })).status).toBe(0);
		expect(spawnGuard('claude', bash('pnpm exec prettier --write README.md', root)).status).toBe(0);
	});

	it('reads the holder in well under 50 ms, and nothing at all for a command the gate does not judge', () => {
		const scope: GuardScope = {
			platform: process.platform,
			env: {},
			cwd: root,
			root,
			host: 'claude',
			now: () => new Date(),
			deps: { ...defaultGuardDeps(), lockGate: makeLockGate() },
		};
		const timed = (command: string): number => {
			const started = performance.now();
			checkShell(command, scope);
			return performance.now() - started;
		};
		const times = Array.from({ length: 20 }, () => timed('pnpm install')).sort((a, b) => a - b);
		expect(checkShell('pnpm install', scope)?.kind).toBe('lock');
		let reads = 0;
		const counting: GuardScope = {
			...scope,
			deps: {
				...scope.deps,
				lockGate: makeLockGate(() => {
					reads++;
					return null;
				}),
			},
		};
		for (const command of ['git status', 'pnpm test', 'pnpm exec prettier --write README.md', 'echo .env.example']) checkShell(command, counting);
		expect(reads).toBe(0);
		// The POSIX read starts one Node process (`--probe`), so the 50 ms budget is checked on Windows, the owner's platform.
		if (process.platform === 'win32') expect(times[18]).toBeLessThan(50);
	});

	it('allows once the holder is gone', async () => {
		const exited = new Promise((done) => holder?.once('exit', done));
		holder?.kill();
		await exited;
		expect(spawnGuard('claude', bash('pnpm add -D some-package', root))).toEqual({ status: 0, stdout: '', stderr: '' });
	});
});
