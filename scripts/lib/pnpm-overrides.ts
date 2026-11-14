// Tells which overrides in pnpm-workspace.yaml no longer change anything, so a line cannot outlive its reason.
//
// An override is written against a fault in one package: a parent that pins or caps a vulnerable version. When the
// parent catches up, or leaves the install, the line keeps forcing a version on whatever comes next. The unit test
// beside this file runs the check on this repository, so `pnpm verify` fails on the day a line can go.
import { basename, join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gte, intersects, minVersion, validRange } from 'semver';

/** The part of a package's manifest the check reads. */
export interface Manifest {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

/**
 * Read the `overrides` block of a pnpm-workspace.yaml. It reads the form this repository writes: one quoted
 * selector and one quoted value per line, with comments on lines of their own. Any other line of the block is
 * refused, so an override written another way cannot go unchecked.
 * @param text The file text.
 * @returns The overrides, by selector.
 */
export function readOverrides(text: string): Record<string, string> {
	const overrides: Record<string, string> = {};
	let inside = false;
	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
		if (/^\S/.test(line)) {
			inside = line.startsWith('overrides:');
			continue;
		}
		if (!inside) continue;
		const pair = /^\s+'([^']+)':\s*'([^']+)'\s*$/.exec(line);
		if (!pair?.[1] || !pair[2]) throw new Error(`cannot read the override line: ${line.trim()}`);
		overrides[pair[1]] = pair[2];
	}
	return overrides;
}

/**
 * Split `name@range` into its two parts. The at sign that opens a scoped name is part of the name.
 * @param text A package name with an optional range.
 * @returns The name, and the range when there is one.
 */
function splitRange(text: string): [name: string, range: string | undefined] {
	const at = text.lastIndexOf('@');
	return at > 0 ? [text.slice(0, at), text.slice(at + 1)] : [text, undefined];
}

/**
 * List the folders directly inside a folder, leaving out links to folders elsewhere.
 * @param dir The folder.
 * @returns The absolute paths.
 */
function realFolders(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(dir, entry.name));
}

/**
 * Read the manifest of every package the lockfile installs.
 * @param root The repository root, with `pnpm-lock.yaml` and `node_modules/`.
 * @returns The manifests. A package of the lockfile that is not on disk (another platform's binary) is left out.
 */
export function installedManifests(root: string): Manifest[] {
	const packagesBlock = /^packages:\n([\s\S]*?)\n\S/m.exec(readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8').replaceAll('\r\n', '\n'))?.[1] ?? '';
	const locked = new Set([...packagesBlock.matchAll(/^ {2}'?((?:@[^/@'\s]+\/)?[^@'\s]+@[^':\s]+)'?:$/gm)].map((match) => match[1]));

	// Each folder of the store holds one package as a real folder, beside links to what it depends on. The store
	// can also hold packages of earlier installs, so only what the lockfile names is kept.
	const store = join(root, 'node_modules', '.pnpm');
	const manifests = new Map<string, Manifest>();
	for (const folder of readdirSync(store)) {
		const modules = join(store, folder, 'node_modules');
		if (!existsSync(modules)) continue;
		const own = realFolders(modules).flatMap((dir) => (basename(dir).startsWith('@') ? realFolders(dir) : [dir]));
		for (const dir of own) {
			const file = join(dir, 'package.json');
			if (!existsSync(file)) continue;
			const manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
			const key = `${manifest.name}@${manifest.version}`;
			if (locked.has(key)) manifests.set(key, manifest);
		}
	}
	return [...manifests.values()];
}

/**
 * The range a package declares for one of its dependencies, of any kind.
 * @param manifest The package.
 * @param dependency The dependency's name.
 * @returns The range, or undefined when the package does not depend on it.
 */
function declared(manifest: Manifest, dependency: string): string | undefined {
	return manifest.dependencies?.[dependency] ?? manifest.optionalDependencies?.[dependency] ?? manifest.peerDependencies?.[dependency];
}

/**
 * Tell whether two ranges share a version. A range semver cannot read (a link, an alias) shares nothing.
 * @param a One range.
 * @param b The other.
 * @returns True when some version satisfies both.
 */
function overlap(a: string | undefined, b: string): boolean {
	return a !== undefined && validRange(a) !== null && validRange(b) !== null && intersects(a, b);
}

/**
 * Tell whether a parent's range has caught up with an override: its lowest version is at or above the forced range's
 * lowest. A range that only overlaps the forced one still allows the vulnerable versions below the fix. This assumes
 * the vulnerable versions lie below the fix, as they do for every override this repository writes.
 * @param asked The parent's range.
 * @param forced The override's range.
 * @returns True when the parent alone keeps out every version below the fix.
 */
function caughtUp(asked: string | undefined, forced: string): boolean {
	if (asked === undefined || validRange(asked) === null || validRange(forced) === null) return false;
	const [askedFloor, forcedFloor] = [minVersion(asked), minVersion(forced)];
	return askedFloor !== null && forcedFloor !== null && gte(askedFloor, forcedFloor);
}

/**
 * Find the overrides that no longer change anything.
 *
 * `parent>name` is stale when the parent is gone, no longer depends on `name`, or asks for a range whose lowest
 * version reaches the forced one's (see caughtUp); a range written after the parent is not looked at. `name@range` is stale when no installed
 * package asks for `name` in that range, and a bare `name` when none asks for it at all; these two forms cannot tell
 * when the resolver would have picked a fixed version without help, so they only expire with their dependants.
 * @param overrides The overrides, by selector.
 * @param manifests The installed packages.
 * @param rootRanges The root package's own ranges, for values written `$name`.
 * @returns One line per stale override; empty when every override still has work to do.
 */
export function staleOverrides(overrides: Record<string, string>, manifests: readonly Manifest[], rootRanges: Record<string, string>): string[] {
	const stale: string[] = [];
	for (const [selector, value] of Object.entries(overrides)) {
		const forced = value.startsWith('$') ? rootRanges[value.slice(1)] : value;
		if (forced === undefined) throw new Error(`${selector}: the root package has no range for ${value.slice(1)}`);
		const [left = '', second] = selector.split('>');
		const [first, selected] = splitRange(left);

		if (second === undefined) {
			const asked = manifests.some((manifest) => (selected === undefined ? declared(manifest, first) !== undefined : overlap(declared(manifest, first), selected)));
			if (!asked) stale.push(`${selector}: no installed package asks for ${first}${selected === undefined ? '' : ` in the range ${selected}`}`);
			continue;
		}

		const parents = manifests.filter((manifest) => manifest.name === first);
		const depending = parents.filter((manifest) => declared(manifest, second) !== undefined);
		if (parents.length === 0) {
			stale.push(`${selector}: no installed package is named ${first}`);
		} else if (depending.length === 0) {
			stale.push(`${selector}: ${first} no longer depends on ${second}`);
		} else if (depending.every((manifest) => caughtUp(declared(manifest, second), forced))) {
			const [example] = depending;
			if (example) stale.push(`${selector}: ${first}@${example.version} already asks for ${declared(example, second)}`);
		}
	}
	return stale;
}
