// Advisories that pnpm 10's audit cannot see. Its audit sends the registry a tree in which each package's
// dependencies are keyed by their real name, so when one package depends on two versions of the same package and
// one of them sits under an alias, the alias overwrites the other and the registry never hears of it.
// @vercel/routing-utils (under the Vercel adapter) depends on path-to-regexp 6.1.0 and on 6.3.0 under the alias
// path-to-regexp-updated, which hid 6.1.0 (GHSA-9wv6-86v2-598j, high) from pnpm audit --prod in CI. An override in
// pnpm-workspace.yaml removes 6.1.0; this test keeps it from coming back unnoticed.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import semver from 'semver';

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');

/**
 * Every version of a package that the lockfile holds.
 * @param name The package name.
 * @returns The versions, without duplicates.
 */
function lockedVersions(name: string): string[] {
	const key = new RegExp(`^ {2}'?${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}@(\\d+\\.\\d+\\.\\d+)'?:`, 'gm');
	return [...new Set([...lockfile.matchAll(key)].map((match) => match[1] ?? ''))];
}

describe('advisories that pnpm audit cannot see', () => {
	it('holds path-to-regexp, so the check below has something to check', () => {
		expect(lockedVersions('path-to-regexp').length).toBeGreaterThan(0);
	});

	it('holds no path-to-regexp in the range of GHSA-9wv6-86v2-598j', () => {
		const vulnerable = lockedVersions('path-to-regexp').filter((version) => semver.satisfies(version, '>=4.0.0 <6.3.0'));
		expect(vulnerable).toEqual([]);
	});
});
