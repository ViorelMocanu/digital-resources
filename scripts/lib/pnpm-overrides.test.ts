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

	// Phase 5: a range that overlaps the fix still allows the vulnerable version below it (11.0.0 here), so the parent
	// has not caught up. Until then this case expected the line to be reported.
	it('keeps an override whose parent asks for a range that still allows a version below the fix', () => {
		const widened: Manifest[] = [{ name: 'linter', version: '2.0.0', dependencies: { matcher: '^11.0.0' } }];
		expect(staleOverrides({ 'linter>matcher': '^11.0.1' }, widened, {})).toEqual([]);
	});

	it('reports an override whose parent now asks for the fixed range itself', () => {
		const caughtUp: Manifest[] = [{ name: 'linter', version: '2.0.0', dependencies: { matcher: '^11.0.1' } }];
		expect(staleOverrides({ 'linter>matcher': '^11.0.1' }, caughtUp, {})).toEqual(['linter>matcher: linter@2.0.0 already asks for ^11.0.1']);
	});

	it('reports an override whose parent moved past the forced range', () => {
		const moved: Manifest[] = [{ name: 'linter', version: '3.0.0', dependencies: { matcher: '^12.0.0' } }];
		expect(staleOverrides({ 'linter>matcher': '^11.0.1' }, moved, {})).toEqual(['linter>matcher: linter@3.0.0 already asks for ^12.0.0']);
		const pinned: Manifest[] = [{ name: 'markdownlint', version: '0.43.0', dependencies: { re2js: '2.8.8' } }];
		expect(staleOverrides({ 'markdownlint>re2js': '2.8.7' }, pinned, {})).toEqual(['markdownlint>re2js: markdownlint@0.43.0 already asks for 2.8.8']);
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

	it('keeps reading after a comment that starts in the first column', () => {
		const text = ['overrides:', "    'a>b': '^1.0.0'", '# a note at the margin', "    'c>d': '^2.0.0'", ''].join('\n');
		expect(readOverrides(text)).toEqual({ 'a>b': '^1.0.0', 'c>d': '^2.0.0' });
	});

	it('refuses a line of the block it cannot read, so no override goes unchecked', () => {
		expect(() => readOverrides(['overrides:', '    a>b: ^1.0.0', ''].join('\n'))).toThrow('cannot read the override line: a>b: ^1.0.0');
		expect(() => readOverrides(['overrides:', '    "a>b": "^1.0.0"', ''].join('\n'))).toThrow('cannot read the override line: "a>b": "^1.0.0"');
		expect(() => readOverrides(['overrides:', "    'a>b': '^1.0.0' # why", ''].join('\n'))).toThrow("cannot read the override line: 'a>b': '^1.0.0' # why");
	});
});

describe('staleOverrides, selector forms', () => {
	it('reads a parent written with a version range by its name', () => {
		expect(staleOverrides({ 'linter@1>matcher': '^11.0.1' }, installed, {})).toEqual([]);
		expect(staleOverrides({ 'gone@1>matcher': '^11.0.1' }, installed, {})).toEqual(['gone@1>matcher: no installed package is named gone']);
	});

	it('reads a scoped parent, whose name starts with an at sign', () => {
		const scoped: Manifest[] = [{ name: '@scope/linter', version: '1.0.0', dependencies: { matcher: '^10.2.0' } }];
		expect(staleOverrides({ '@scope/linter>matcher': '^11.0.1' }, scoped, {})).toEqual([]);
		expect(staleOverrides({ '@scope/linter@1>matcher': '^11.0.1' }, scoped, {})).toEqual([]);
	});

	it('reports a bare name that no installed package asks for', () => {
		expect(staleOverrides({ matcher: '^11.0.1' }, installed, {})).toEqual([]);
		expect(staleOverrides({ vanished: '^1.0.0' }, installed, {})).toEqual(['vanished: no installed package asks for vanished']);
	});

	it('refuses a $name value the root package has no range for', () => {
		expect(() => staleOverrides({ 'plugin>framework': '$framework' }, installed, {})).toThrow('plugin>framework: the root package has no range for framework');
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
