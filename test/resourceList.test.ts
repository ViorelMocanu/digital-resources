// The schema lets a resource leave out its categories and subcategories (nullish), and every list page must still
// build. Rendered through Astro's container API, as a list page renders the component.
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import ResourceList from '../src/components/ResourceList.astro';

/**
 * A resource as a content file could hold it.
 * @param data Replaces fields of its data.
 * @returns The entry.
 */
function resource(data: Record<string, unknown>) {
	return {
		id: 'x',
		collection: 'resources',
		data: {
			title: 'X',
			url: 'https://x.ro/',
			language: 'ro',
			addDate: '',
			description: 'X',
			section: { id: 'front-end', collection: 'sections' },
			type: 'carte',
			mandatory: false,
			tags: [],
			...data,
		},
	};
}

/**
 * Renders a resource list of one resource.
 * @param data Replaces fields of the resource's data.
 * @returns The HTML.
 */
async function render(data: Record<string, unknown>): Promise<string> {
	const container = await AstroContainer.create();
	return container.renderToString(ResourceList, { props: { resources: [resource(data)] } });
}

describe('a resource list', () => {
	it('renders a resource with an empty category list', async () => {
		expect(await render({ categories: [], subcategories: [] })).toContain('class="ResourceLink" href="/r/x"');
	});

	it('renders a resource with subcategories and no categories', async () => {
		expect(await render({ categories: undefined, subcategories: [{ id: 'emmet', collection: 'subcategories' }] })).toContain('class="ResourceLink" href="/r/x"');
	});

	it('shows the icon of the type field when no tag gives the type', async () => {
		// The book icon, U+1F4D6, written as an escape: no file of this repository holds an emoji (AGENTS.md).
		expect(await render({ categories: null })).toContain('\u{1F4D6}');
	});
});
