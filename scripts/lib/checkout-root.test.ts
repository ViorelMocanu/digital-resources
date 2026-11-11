import { ceilingDirectories, findCheckoutRoot, isInside, nativeDrive, normaliseRoot, placeWord, scratchPath, withoutRepoVariables } from './checkout-root.ts';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeScratchDir, removeScratchDir } from './scratch-git.ts';

// Pure tests (OpenSpec change harness-guardrails, design D1 "Shared code" and "Scratch paths"): the walk takes an
// injected existence check and platform, so the win32 cases run on the Linux CI runner too. One block walks a real
// tree under the repo's tmp/.

/**
 * An existence check that knows only the given paths.
 * @param paths The paths that exist, written with the platform's separators.
 * @returns The check.
 */
function existing(...paths: string[]): (path: string) => boolean {
	const known = new Set(paths);
	return (path) => known.has(path);
}

describe('findCheckoutRoot', () => {
	it('returns the folder that holds .git, from the folder itself or below it', () => {
		const exists = existing('G:\\repo\\.git');
		expect(findCheckoutRoot('G:\\repo', { platform: 'win32', exists })).toBe('G:\\repo');
		expect(findCheckoutRoot('G:\\repo\\scripts\\hooks', { platform: 'win32', exists })).toBe('G:\\repo');
	});

	it('stops at the nearest .git, so a worktree or a nested repo is its own root', () => {
		const exists = existing('/srv/repo/.git', '/srv/repo/tmp/wt/.git');
		expect(findCheckoutRoot('/srv/repo/tmp/wt/src', { platform: 'linux', exists })).toBe('/srv/repo/tmp/wt');
	});

	it('returns null outside any checkout, at a drive root too', () => {
		expect(findCheckoutRoot('G:\\', { platform: 'win32', exists: existing() })).toBeNull();
		expect(findCheckoutRoot('/srv/x', { platform: 'linux', exists: existing() })).toBeNull();
	});

	it('never moves up into a ceiling folder, as git does', () => {
		const exists = existing('/srv/repo/.git');
		expect(findCheckoutRoot('/srv/repo/tmp/outside', { platform: 'linux', exists, ceilings: ['/srv/repo/tmp'] })).toBeNull();
		expect(findCheckoutRoot('/srv/repo/tmp', { platform: 'linux', exists, ceilings: ['/srv/repo/tmp'] })).toBe('/srv/repo');
	});
});

describe('normaliseRoot', () => {
	it('ignores slash direction, letter case and a trailing separator on win32', () => {
		expect(normaliseRoot('G:\\_Projects\\resurse\\', 'win32')).toBe('g:/_projects/resurse');
		expect(normaliseRoot('g:/_projects/resurse/', 'win32')).toBe('g:/_projects/resurse');
	});

	it('keeps letter case on linux and drops a trailing separator', () => {
		expect(normaliseRoot('/srv/Repo/', 'linux')).toBe('/srv/Repo');
	});
});

describe('nativeDrive and placeWord', () => {
	it('turns a Git Bash drive path into a Windows one on win32 only', () => {
		expect(nativeDrive('/g/_Projects/resurse', 'win32')).toBe('g:/_Projects/resurse');
		expect(nativeDrive('/c', 'win32')).toBe('c:/');
		expect(nativeDrive('/G/', 'win32')).toBe('G:/');
		expect(nativeDrive('/gx/y', 'win32')).toBe('/gx/y');
		expect(nativeDrive('G:\\x', 'win32')).toBe('G:\\x');
		expect(nativeDrive('src/x', 'win32')).toBe('src/x');
		expect(nativeDrive('/g/x', 'linux')).toBe('/g/x');
	});

	it('places a Git Bash drive path on its own drive, not under the current one', () => {
		expect(placeWord('/g/_Projects/resurse', 'C:\\elsewhere', 'win32')).toBe('g:\\_Projects\\resurse');
		expect(placeWord('/g/x', null, 'win32')).toBe('g:\\x');
	});

	it('resolves an absolute path as it is and a relative one against the base', () => {
		expect(placeWord('G:/repo/tmp/../src', null, 'win32')).toBe('G:\\repo\\src');
		expect(placeWord('src\\x', 'G:\\repo', 'win32')).toBe('G:\\repo\\src\\x');
		expect(placeWord('../other', '/srv/repo', 'linux')).toBe('/srv/other');
		expect(placeWord('/srv/repo/', '/elsewhere', 'linux')).toBe('/srv/repo');
	});

	it("gives null for a relative path without a base, never the process's folder", () => {
		expect(placeWord('src', null, 'win32')).toBeNull();
		expect(placeWord('src', null, 'linux')).toBeNull();
	});
});

describe('withoutRepoVariables', () => {
	it('drops every variable that points git at another repository, in any letter case, and keeps the rest', () => {
		const env = {
			GIT_DIR: 'x',
			git_work_tree: 'x',
			GIT_INDEX_FILE: 'x',
			GIT_COMMON_DIR: 'x',
			GIT_OBJECT_DIRECTORY: 'x',
			GIT_ALTERNATE_OBJECT_DIRECTORIES: 'x',
			GIT_NAMESPACE: 'x',
			GIT_PREFIX: 'x',
			GIT_CEILING_DIRECTORIES: '/c',
			PATH: '/bin',
		};
		expect(withoutRepoVariables(env)).toEqual({ GIT_CEILING_DIRECTORIES: '/c', PATH: '/bin' });
		expect(env.GIT_DIR).toBe('x');
	});
});

describe('ceilingDirectories', () => {
	it('splits on ; for win32 and : elsewhere, and drops relative and empty entries', () => {
		expect(ceilingDirectories({ GIT_CEILING_DIRECTORIES: 'G:\\a;;rel;C:/B/' }, 'win32')).toEqual(['g:/a', 'c:/b']);
		expect(ceilingDirectories({ GIT_CEILING_DIRECTORIES: '/a::rel:/b/' }, 'linux')).toEqual(['/a', '/b']);
		expect(ceilingDirectories({}, 'linux')).toEqual([]);
	});
});

describe('isInside and scratchPath', () => {
	it('compares normalised paths, case-insensitively on win32', () => {
		expect(isInside('g:/Repo/tmp/x', 'G:\\repo', 'win32')).toBe(true);
		expect(isInside('G:\\repo', 'G:\\repo\\', 'win32')).toBe(true);
		expect(isInside('G:\\repository', 'G:\\repo', 'win32')).toBe(false);
		expect(isInside('/srv/Repo/x', '/srv/repo', 'linux')).toBe(false);
	});

	it('builds every scratch path under <root>/tmp/', () => {
		expect(scratchPath('G:\\repo', 'win32', 'agent-state', 'hook-errors.log')).toBe('G:\\repo\\tmp\\agent-state\\hook-errors.log');
		expect(normaliseRoot(scratchPath('/srv/repo', 'linux', 'x'), 'linux')).toBe('/srv/repo/tmp/x');
	});
});

describe('findCheckoutRoot on the real file system', () => {
	let scratch = '';

	afterEach(() => {
		if (scratch !== '') removeScratchDir(scratch);
		scratch = '';
	});

	it('finds a .git file (a worktree) as well as a .git folder', () => {
		scratch = makeScratchDir('checkout-root-');
		const worktree = join(scratch, 'wt');
		mkdirSync(join(worktree, 'scripts'), { recursive: true });
		writeFileSync(join(worktree, '.git'), 'gitdir: elsewhere\n');
		expect(findCheckoutRoot(join(worktree, 'scripts'))).toBe(resolve(worktree));
	});
});
