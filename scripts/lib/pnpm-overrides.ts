// Tells which overrides in pnpm-workspace.yaml no longer change anything, so a line cannot outlive its reason.
//
// An override is written against a fault in one package: a parent that pins or caps a vulnerable version. When the
// parent catches up, or leaves the install, the line keeps forcing a version on whatever comes next. The unit test
// beside this file runs the check on this repository, so `pnpm verify` fails on the day a line can go.
import { basename, join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { intersects, validRange } from 'semver';

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
 * selector and one quoted value per line.
 * @param text The file text.
 * @returns The overrides, by selector.
 */
export function readOverrides(text: string): Record<string, string> {
	const overrides: Record<string, string> = {};
	let inside = false;
	for (const line of text.split(/\r?\n/)) {
		if (/^\S/.test(line)) inside = line.startsWith('overrides:');
		const pair = inside ? /^\s+'([^']+)':\s*'([^']+)'\s*$/.exec(line) : null;
		if (pair?.[1] && pair[2]) overrides[pair[1]] = pair[2];
	}
	return overrides;
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
 * Find the overrides that no longer change anything.
 *
 * `parent>name` is stale when the parent is gone, no longer depends on `name`, or asks for a range that already
 * allows the forced one. `name@range` is stale when no installed package asks for `name` in that range; this form
 * cannot tell when the resolver would have picked a fixed version without help, so it only expires with its
 * dependants.
 * @param overrides The overrides, by selector.
 * @param manifests The installed packages.
 * @param rootRanges The root package's own ranges, for values written `$name`.
 * @returns One line per stale override; empty when every override still has work to do.
 */
export function staleOverrides(overrides: Record<string, string>, manifests: readonly Manifest[], rootRanges: Record<string, string>): string[] {
	const stale: string[] = [];
	for (const [selector, value] of Object.entries(overrides)) {
		const forced = value.startsWith('$') ? (rootRanges[value.slice(1)] ?? value) : value;
		const [first = '', second] = selector.split('>');

		if (second === undefined) {
			const at = first.lastIndexOf('@');
			if (at <= 0) continue;
			const name = first.slice(0, at);
			const selected = first.slice(at + 1);
			const asked = manifests.some((manifest) => overlap(declared(manifest, name), selected));
			if (!asked) stale.push(`${selector}: no installed package asks for ${name} in the range ${selected}`);
			continue;
		}

		const parents = manifests.filter((manifest) => manifest.name === first);
		const depending = parents.filter((manifest) => declared(manifest, second) !== undefined);
		if (parents.length === 0) {
			stale.push(`${selector}: no installed package is named ${first}`);
		} else if (depending.length === 0) {
			stale.push(`${selector}: ${first} no longer depends on ${second}`);
		} else {
			const caughtUp = depending.filter((manifest) => overlap(declared(manifest, second), forced));
			if (caughtUp.length === depending.length && caughtUp[0]) {
				stale.push(`${selector}: ${first}@${caughtUp[0].version} already asks for ${declared(caughtUp[0], second)}`);
			}
		}
	}
	return stale;
}
