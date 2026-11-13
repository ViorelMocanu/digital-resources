import { type Manifest, installedManifests, readOverrides, staleOverrides } from './pnpm-overrides.ts';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');

const installed: Manifest[] = [
	{ name: 'linter', version: '1.0.0', dependencies: { matcher: '^10.2.0' } },
	{ name: 'tracer', version: '2.0.0', dependencies: { globber: '^13.0.0' } },
	{ name: 'helper', version: '5.0.0', peerDependencies: { bundler: '^3.0.0||^4.0.0' } },
	{ name: 'plugin', version: '0.3.0', dependencies: { framework: '4.0.0' } },
];

describe('staleOverrides', () => {
	it('keeps an override whose parent still asks for a range the fixed version is outside of', () => {
		expect(staleOverrides({ 'linter>matcher': '^11.0.1', 'tracer>globber': '^14.0.2' }, installed, {})).toEqual([]);
	});

	it('reports an override whose parent now asks for the fixed range itself', () => {
		const caughtUp: Manifest[] = [{ name: 'linter', version: '2.0.0', dependencies: { matcher: '^11.0.0' } }];
		expect(staleOverrides({ 'linter>matcher': '^11.0.1' }, caughtUp, {})).toEqual(['linter>matcher: linter@2.0.0 already asks for ^11.0.0']);
	});

	it('reports an override whose parent is no longer installed', () => {
		expect(staleOverrides({ 'gone>matcher': '^11.0.1' }, installed, {})).toEqual(['gone>matcher: no installed package is named gone']);
	});

	it('reports an override whose parent no longer depends on the package', () => {
		expect(staleOverrides({ 'tracer>matcher': '^11.0.1' }, installed, {})).toEqual(['tracer>matcher: tracer no longer depends on matcher']);
	});

	it('keeps a version-selecting override while something asks for a version in the selected range', () => {
		expect(staleOverrides({ 'bundler@<4.59.0': '^4.59.0' }, installed, {})).toEqual([]);
	});

	it('reports a version-selecting override when nothing asks for a version in the selected range', () => {
		expect(staleOverrides({ 'matcher@^9': '^11.0.1' }, installed, {})).toEqual(['matcher@^9: no installed package asks for matcher in the range ^9']);
	});

	it("reads a $name value as the root package's own range for that name", () => {
		expect(staleOverrides({ 'plugin>framework': '$framework' }, installed, { framework: '^7.4.7' })).toEqual([]);
		expect(staleOverrides({ 'plugin>framework': '$framework' }, installed, { framework: '^4.0.0' })).toEqual(['plugin>framework: plugin@0.3.0 already asks for 4.0.0']);
	});
});

describe('readOverrides', () => {
	it('reads the quoted pairs under the overrides key and stops at the next key', () => {
		const text = [
			'minimumReleaseAge: 10080',
			'',
			'overrides:',
			'    # a comment',
			"    'a>b': '^1.0.0'",
			"    'c@<2': '^2.0.0'",
			'',
			'packageExtensions:',
			"    'd@1':",
			'        dependencies:',
			"            'e': 1.0.0",
			'',
		].join('\n');
		expect(readOverrides(text)).toEqual({ 'a>b': '^1.0.0', 'c@<2': '^2.0.0' });
	});
});

describe('this repository', () => {
	it('has no override that outlived its reason', () => {
		const overrides = readOverrides(readFileSync(resolve(repoRoot, 'pnpm-workspace.yaml'), 'utf8'));
		const root = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

		expect(Object.keys(overrides).length).toBeGreaterThan(0);
		expect(staleOverrides(overrides, installedManifests(repoRoot), { ...root.devDependencies, ...root.dependencies })).toEqual([]);
	});
});
