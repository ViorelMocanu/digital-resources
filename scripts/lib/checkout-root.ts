/**
 * Checkout roots and the repo's own scratch folder (OpenSpec change harness-guardrails, design D1 "Shared code" and
 * "Scratch paths come from the checkout root").
 *
 * One home for `normaliseRoot` and for the walk up to the checkout root, so the harness sync, the checkout lock and
 * the hooks cannot find or normalise a root differently. A hook that imports this module loads neither `node:net`
 * nor `node:crypto`. It also places the path words of a command (`placeWord`, with Git Bash's `/g/x` drive form) and
 * strips the variables that would point git at another repository (`withoutRepoVariables`).
 *
 * In change C, `tmp/` always means `<root>/tmp/`: never the drive root's `tmp`, the OS temp folder or a `tmp` next
 * to the process's working directory. A caller that finds no root writes nothing.
 *
 * Uses only `node:` built-ins and has no side effects on import.
 */

import { existsSync } from 'node:fs';
import { posix, win32 } from 'node:path';

/** Environment variables, as in `process.env`. */
export type Env = Record<string, string | undefined>;

/**
 * Normalise a checkout root with the path rules of the given platform, never the host's: resolve it
 * (which drops trailing separators), use forward slashes, and on `win32` lowercase it, because NTFS is
 * case-insensitive and one checkout can be reported as both `G:\x` and `g:\x`.
 * @param root The checkout root.
 * @param platform The platform whose path rules apply, as in `process.platform`.
 * @returns The normalised root.
 */
export function normaliseRoot(root: string, platform: NodeJS.Platform): string {
	if (platform === 'win32') {
		return win32.resolve(root).replace(/\\/g, '/').toLowerCase();
	}
	return posix.resolve(root);
}

/**
 * The path functions of a platform.
 * @param platform The platform, as in `process.platform`.
 * @returns `path.win32` or `path.posix`.
 */
export function pathFor(platform: NodeJS.Platform): typeof win32 {
	return platform === 'win32' ? win32 : posix;
}

/**
 * Turn a Git Bash drive path (`/g/x`) into a Windows one (`g:/x`) on `win32`; any other value, and every value on
 * other platforms, comes back unchanged.
 * @param value The path as a command or a payload names it.
 * @param platform The platform whose path rules apply.
 * @returns The path.
 */
export function nativeDrive(value: string, platform: NodeJS.Platform): string {
	const drive = platform === 'win32' ? /^\/([A-Za-z])(?:\/|$)/.exec(value) : null;
	return drive === null ? value : `${drive[1] ?? ''}:/${value.slice(3)}`;
}

/**
 * Place a path word of a command (a `git -C`, `cd` or `pnpm -C` folder, an `openspec update` target): a Git Bash
 * drive path becomes a Windows one ({@link nativeDrive}), an absolute path is resolved, and a relative one is
 * resolved against the base, never against the process's own folder.
 * @param value The word's value.
 * @param base The folder a relative path is relative to, or null when it is unknown.
 * @param platform The platform whose path rules apply.
 * @returns The absolute path, or null for a relative path without a base.
 */
export function placeWord(value: string, base: string | null, platform: NodeJS.Platform): string | null {
	const path = pathFor(platform);
	const native = nativeDrive(value, platform);
	if (path.isAbsolute(native)) return path.resolve(native);
	return base === null ? null : path.resolve(base, native);
}

/** The variables that point git at another repository, object store or index than the folder it runs in. */
const GIT_REPO_VARIABLES = new Set([
	'GIT_DIR',
	'GIT_WORK_TREE',
	'GIT_INDEX_FILE',
	'GIT_COMMON_DIR',
	'GIT_OBJECT_DIRECTORY',
	'GIT_ALTERNATE_OBJECT_DIRECTORIES',
	'GIT_NAMESPACE',
	'GIT_PREFIX',
]);

/**
 * Copy an environment without the variables that would point git at another repository, so a read-only git call
 * judges the folder it is given (the guard's `cat-file` probe, the harness sync's `check-ignore` filter).
 * @param env The environment.
 * @returns A copy without `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and the other repository variables, matched
 *   in any letter case.
 */
export function withoutRepoVariables(env: Env): Env {
	return Object.fromEntries(Object.entries(env).filter(([key]) => !GIT_REPO_VARIABLES.has(key.toUpperCase())));
}

/**
 * Read `GIT_CEILING_DIRECTORIES` as git does: absolute folders, separated by `;` on Windows and `:` elsewhere,
 * that the walk never moves up into. Empty and relative entries are dropped.
 * @param env The environment.
 * @param platform The platform whose path rules apply.
 * @returns The normalised ceiling folders.
 */
export function ceilingDirectories(env: Env, platform: NodeJS.Platform): string[] {
	const raw = env.GIT_CEILING_DIRECTORIES;
	if (raw === undefined || raw === '') return [];
	const path = pathFor(platform);
	return raw
		.split(platform === 'win32' ? ';' : ':')
		.filter((entry) => entry !== '' && path.isAbsolute(entry))
		.map((entry) => normaliseRoot(entry, platform));
}

/** Options for {@link findCheckoutRoot}; the defaults use the host's file system and path rules. */
export interface RootWalkOptions {
	/** The platform whose path rules apply. */
	platform?: NodeJS.Platform;
	/** Tells whether a path exists; injectable for tests. */
	exists?: ((path: string) => boolean) | undefined;
	/** Folders the walk never moves up into, as from {@link ceilingDirectories}. */
	ceilings?: readonly string[];
}

/**
 * Find the checkout root of a folder: the folder itself or its nearest ancestor that holds a `.git` entry, a file
 * (a worktree or submodule) or a folder. Walking up costs about 1 ms, against about 60 ms for `git rev-parse`. Like
 * git, the walk does not move up into a ceiling folder.
 * @param start An absolute folder; a relative one is resolved against the process's folder by the path rules.
 * @param options The platform, the existence check and the ceilings.
 * @returns The root as the walk found it (not normalised), or null outside any checkout.
 */
export function findCheckoutRoot(start: string, options: RootWalkOptions = {}): string | null {
	const platform = options.platform ?? process.platform;
	const path = pathFor(platform);
	const exists = options.exists ?? existsSync;
	const ceilings = new Set(options.ceilings ?? []);
	let dir = path.resolve(start);
	for (;;) {
		if (exists(path.join(dir, '.git'))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir || ceilings.has(normaliseRoot(parent, platform))) return null;
		dir = parent;
	}
}

/**
 * Tell whether a path is a folder or file inside another, or the same path, by the platform's rules.
 * @param child The candidate path.
 * @param parent The containing folder.
 * @param platform The platform whose path rules apply.
 * @returns True when `child` is `parent` or below it.
 */
export function isInside(child: string, parent: string, platform: NodeJS.Platform): boolean {
	const inner = normaliseRoot(child, platform);
	const outer = normaliseRoot(parent, platform);
	return inner === outer || inner.startsWith(outer.endsWith('/') ? outer : `${outer}/`);
}

/**
 * Build a path in the checkout's own scratch folder, `<root>/tmp/…`.
 * @param root The checkout root, from {@link findCheckoutRoot}.
 * @param platform The platform whose path rules apply.
 * @param segments The path below `tmp/`.
 * @returns The absolute path.
 */
export function scratchPath(root: string, platform: NodeJS.Platform, ...segments: string[]): string {
	return pathFor(platform).join(root, 'tmp', ...segments);
}
