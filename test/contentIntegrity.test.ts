// Astro does not check that a referenced id exists: a typo drops a resource from a list without a word, or stops the
// build with a TypeError that names neither the file nor the id. The check names both.
import { type Content, findBrokenReferences } from '../src/utils/contentIntegrity';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const RESOURCE = 'src/content/resources/a.md';

/**
 * A valid set: one section with one category, which has one subcategory, and one resource that uses all of them.
 * @param change Replaces parts of the set.
 * @returns The set.
 */
function content(change: Partial<Content> = {}): Content {
	return {
		resources: [
			{
				id: 'a',
				filePath: RESOURCE,
				data: { section: { id: 'front-end' }, categories: [{ id: 'html' }], subcategories: [{ id: 'emmet' }], tags: [{ id: 'video' }] },
			},
		],
		sections: [{ id: 'front-end', filePath: 'src/content/sections/front-end.md', data: { categories: [{ id: 'html' }] } }],
		categories: [{ id: 'html', filePath: 'src/content/categories/html.md', data: { subcategories: [{ id: 'emmet' }] } }],
		subcategories: [{ id: 'emmet', data: {} }],
		tags: [{ id: 'video', data: {} }],
		...change,
	};
}

/**
 * The valid set with its one resource changed.
 * @param data Replaces fields of the resource's data.
 * @returns The set.
 */
function withResource(data: Partial<Content['resources'][number]['data']>): Content {
	const [resource] = content().resources;
	return content({ resources: [{ ...resource!, data: { ...resource!.data, ...data } }] });
}

describe('findBrokenReferences', () => {
	it('reports nothing for a valid set', () => {
		expect(findBrokenReferences(content())).toEqual([]);
	});

	it('names the file and the id of a mistyped section', () => {
		expect(findBrokenReferences(withResource({ section: { id: 'front-ned' } }))).toEqual([`${RESOURCE}: section "front-ned" nu există în sections`]);
	});

	it('names a mistyped category, subcategory and tag of a resource', () => {
		expect(findBrokenReferences(withResource({ categories: [{ id: 'htm' }] }))).toEqual([`${RESOURCE}: categories "htm" nu există în categories`]);
		expect(findBrokenReferences(withResource({ subcategories: [{ id: 'emet' }] }))).toEqual([`${RESOURCE}: subcategories "emet" nu există în subcategories`]);
		expect(findBrokenReferences(withResource({ tags: [{ id: 'vidoe' }] }))).toEqual([`${RESOURCE}: tags "vidoe" nu există în tags`]);
	});

	it('names a mistyped category of a section and a mistyped subcategory of a category', () => {
		const sections = [{ id: 'front-end', filePath: 'src/content/sections/front-end.md', data: { categories: [{ id: 'html' }, { id: 'csss' }] } }];
		expect(findBrokenReferences(content({ sections }))).toEqual(['src/content/sections/front-end.md: categories "csss" nu există în categories']);
		const categories = [{ id: 'html', filePath: 'src/content/categories/html.md', data: { subcategories: [{ id: 'emmet' }, { id: 'emet' }] } }];
		expect(findBrokenReferences(content({ categories }))).toEqual(['src/content/categories/html.md: subcategories "emet" nu există în subcategories']);
	});

	it('names a category that exists but is not listed under the resource section', () => {
		const categories = [...content().categories, { id: 'php', data: {} }];
		expect(findBrokenReferences({ ...withResource({ categories: [{ id: 'php' }] }), categories })).toEqual([`${RESOURCE}: categoria "php" nu este în secțiunea "front-end"`]);
	});

	it('accepts a resource without categories or subcategories', () => {
		expect(findBrokenReferences(withResource({ categories: null, subcategories: undefined }))).toEqual([]);
	});

	it('reports every broken reference, in the order of the input, and names an entry without a file by its id', () => {
		const resources = [
			{ id: 'b', data: { section: { id: 'nope' }, tags: [{ id: 'video' }] } },
			{ id: 'c', filePath: 'src/content/resources/c.md', data: { section: { id: 'front-end' }, tags: [{ id: 'gone' }] } },
		];
		expect(findBrokenReferences(content({ resources }))).toEqual([
			'resources/b: section "nope" nu există în sections',
			'src/content/resources/c.md: tags "gone" nu există în tags',
		]);
	});
});

it('the resource route runs the check before it lists its pages', () => {
	const route = readFileSync(new URL('../src/pages/r/[slug].astro', import.meta.url), 'utf8');
	expect(route).toMatch(/export async function getStaticPaths\(\) \{\s*await assertContentIntegrity\(\);/);
});
