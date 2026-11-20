import { type Advisory, type ListRoot, collectVersions, matchFindings, postBulk, queryAdvisories, run } from './audit-bulk.ts';
import { describe, expect, it } from 'vitest';

/**
 * An advisory as the bulk endpoint returns it, with only the fields that differ between tests given.
 * @param id The advisory id.
 * @param range The vulnerable versions.
 * @returns The advisory.
 */
function advisory(id: number, range: string): Advisory {
	return { id, url: `https://github.com/advisories/GHSA-test-${id}`, title: `Advisory ${id}`, severity: 'high', vulnerable_versions: range };
}

/**
 * A fetch that answers each call with the next of the given responses and records the request bodies. An error in
 * the list is thrown, as fetch does when the network fails.
 * @param responses The responses, in order.
 * @returns The fetch and the bodies it received.
 */
function scriptedFetch(responses: readonly (Response | Error)[]): { fetch: typeof fetch; bodies: unknown[] } {
	const bodies: unknown[] = [];
	let call = 0;
	const fake = (async (_url: string | URL | Request, init?: RequestInit) => {
		bodies.push(JSON.parse(String(init?.body)));
		const response = responses[call++];
		if (!response) throw new Error('no response left');
		if (response instanceof Error) throw response;
		return response;
	}) as typeof fetch;
	return { fetch: fake, bodies };
}

const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

// The shape of pnpm list --prod --json --depth Infinity: one root per project; each dependency keyed by the name it is
// installed under, with its real name in from. A renamed copy (an alias) keeps its real name there.
const TREE: ListRoot[] = [
	{
		dependencies: {
			parent: {
				from: 'parent',
				version: '1.0.0',
				dependencies: {
					'shared': { from: 'shared', version: '6.1.0' },
					'shared-updated': { from: 'shared', version: '6.3.0' },
					'@scope/leaf': { from: '@scope/leaf', version: '2.0.0' },
				},
			},
			other: {
				from: 'other',
				version: '3.0.0',
				dependencies: { shared: { from: 'shared', version: '6.1.0' } },
			},
			local: { from: 'local', version: 'link:../local' },
		},
		optionalDependencies: { maybe: { from: 'maybe', version: '0.1.0' } },
		unsavedDependencies: { hoisted: { from: 'hoisted', version: 'link:node_modules/.pnpm/hoisted@1.0.0/node_modules/hoisted' } },
	},
];

describe('collectVersions', () => {
	it('keeps both versions of a package when one is installed under another name', () => {
		expect(collectVersions(TREE).shared).toEqual(['6.1.0', '6.3.0']);
	});

	it('lists every registry package once, sorted, with optional dependencies and without links or hoisted copies', () => {
		expect(collectVersions(TREE)).toEqual({
			'@scope/leaf': ['2.0.0'],
			'maybe': ['0.1.0'],
			'other': ['3.0.0'],
			'parent': ['1.0.0'],
			'shared': ['6.1.0', '6.3.0'],
		});
	});
});

describe('matchFindings', () => {
	it('reports only the versions inside an advisory range', () => {
		const findings = matchFindings({ shared: ['6.1.0', '6.3.0'] }, { shared: [advisory(1, '>=4.0.0 <6.3.0')] });
		expect(findings.map((finding) => `${finding.name}@${finding.version} ${finding.advisory.id}`)).toEqual(['shared@6.1.0 1']);
	});

	it('reports nothing for an advisory that matches no locked version', () => {
		expect(matchFindings({ shared: ['6.3.0'] }, { shared: [advisory(1, '>=4.0.0 <6.3.0')] })).toEqual([]);
	});

	it('reads a range in the loose form, as npm and pnpm 11 do', () => {
		const findings = matchFindings({ old: ['1.0.0', '2.0.0'] }, { old: [advisory(5, '<1.2.3beta')] });
		expect(findings.map((finding) => `${finding.name}@${finding.version}`)).toEqual(['old@1.0.0']);
	});

	it('fails on an advisory whose range cannot be read, instead of dropping it', () => {
		expect(() => matchFindings({ shared: ['6.1.0'] }, { shared: [advisory(2, 'every version before the fix')] })).toThrow('advisory 2 for shared');
	});

	it('fails on an advisory without a range', () => {
		const withoutRange = { id: 3, url: 'https://github.com/advisories/GHSA-test-3', title: 'Advisory 3', severity: 'high' } as unknown as Advisory;
		expect(() => matchFindings({ shared: ['6.1.0'] }, { shared: [withoutRange] })).toThrow('advisory 3 for shared');
	});

	it('fails when the advisories of a package are not a list', () => {
		expect(() => matchFindings({ shared: ['6.1.0'] }, { shared: advisory(4, '<7.0.0') as unknown as Advisory[] })).toThrow('shared');
	});
});

describe('queryAdvisories', () => {
	it('sends the names in batches and merges the answers', async () => {
		const sent: unknown[] = [];
		const answers = await queryAdvisories({ a: ['1.0.0'], b: ['2.0.0'], c: ['3.0.0', '3.1.0'] }, 2, async (body) => {
			sent.push(body);
			return 'c' in body ? { c: [advisory(3, '<3.1.0')] } : {};
		});
		expect(sent).toEqual([{ a: ['1.0.0'], b: ['2.0.0'] }, { c: ['3.0.0', '3.1.0'] }]);
		expect(answers).toEqual({ c: [advisory(3, '<3.1.0')] });
	});
});

describe('postBulk', () => {
	it('tries once more after a server error, then returns the answer', async () => {
		const { fetch, bodies } = scriptedFetch([json({}, 503), json({ a: [advisory(1, '<2.0.0')] })]);
		expect(await postBulk({ a: ['1.0.0'] }, fetch)).toEqual({ a: [advisory(1, '<2.0.0')] });
		expect(bodies).toEqual([{ a: ['1.0.0'] }, { a: ['1.0.0'] }]);
	});

	it('tries once more after a network error', async () => {
		const { fetch, bodies } = scriptedFetch([new TypeError('fetch failed'), json({})]);
		expect(await postBulk({ a: ['1.0.0'] }, fetch)).toEqual({});
		expect(bodies).toHaveLength(2);
	});

	it('tries once more after too many requests (429)', async () => {
		const { fetch, bodies } = scriptedFetch([json({}, 429), json({ a: [advisory(1, '<2.0.0')] })]);
		expect(await postBulk({ a: ['1.0.0'] }, fetch)).toEqual({ a: [advisory(1, '<2.0.0')] });
		expect(bodies).toHaveLength(2);
	});

	it('fails on an answer that is not an object, so an empty list or null cannot pass as clean', async () => {
		await expect(postBulk({ a: ['1.0.0'] }, scriptedFetch([json([])]).fetch)).rejects.toThrow('other than an object');
		await expect(postBulk({ a: ['1.0.0'] }, scriptedFetch([json(null)]).fetch)).rejects.toThrow('other than an object');
	});

	it('fails with the status when the registry keeps refusing', async () => {
		const { fetch } = scriptedFetch([json({}, 503), json({}, 503)]);
		await expect(postBulk({ a: ['1.0.0'] }, fetch)).rejects.toThrow('HTTP 503');
	});

	it('does not try again after a refusal that another try cannot change', async () => {
		const { fetch, bodies } = scriptedFetch([json({}, 400), json({})]);
		await expect(postBulk({ a: ['1.0.0'] }, fetch)).rejects.toThrow('HTTP 400');
		expect(bodies).toHaveLength(1);
	});
});

describe('run', () => {
	const clean = async () => ({});

	it('passes when no advisory matches, and says how much it checked', async () => {
		expect(await run(JSON.stringify(TREE), clean)).toEqual({ exitCode: 0, lines: ['No known advisory in 6 versions of 5 production packages.'] });
	});

	it('fails and names the package, the version and the advisory when one matches', async () => {
		const result = await run(JSON.stringify(TREE), async () => ({ shared: [advisory(7, '>=4.0.0 <6.3.0')] }));
		expect(result).toEqual({
			exitCode: 1,
			lines: ['1 known advisory in the production packages:', 'shared@6.1.0: high, Advisory 7 (>=4.0.0 <6.3.0) https://github.com/advisories/GHSA-test-7'],
		});
	});

	it('fails when the input is not the JSON of pnpm list', async () => {
		expect((await run('WARN something\n[]', clean)).exitCode).toBe(1);
	});

	it('fails when the tree holds no package, so a missing lockfile cannot pass', async () => {
		expect(await run('[{}]', clean)).toEqual({ exitCode: 1, lines: ['The production tree is empty: pnpm-lock.yaml is missing or lists no production dependency.'] });
	});
});
