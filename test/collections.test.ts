import { type CollectionEntry, type CollectionKey } from 'astro:content';
import { expect, test, vi } from 'vitest';
import { cachedCollections } from '../src/utils/collections';

const tags = [
	{ id: 'video', collection: 'tags' },
	{ id: 'articol', collection: 'tags' },
];
const sections = [{ id: 'front-end', collection: 'sections' }];

/**
 * A loader that answers from the two lists above and counts its calls.
 * @returns The loader, as a mock.
 */
function fakeLoad() {
	return vi.fn(async (key: CollectionKey) => (key === 'tags' ? tags : sections) as unknown as CollectionEntry<CollectionKey>[]);
}

test('a kept collection is loaded once, however often it is asked for', async () => {
	const load = fakeLoad();
	const collections = cachedCollections(load as never, true);

	const first = await collections.all('tags');
	const second = await collections.all('tags');
	await collections.byId('tags');
	await collections.byId('tags');

	expect(first.map((entry) => entry.id)).toEqual(['video', 'articol']);
	expect(second).toBe(first);
	expect(load).toHaveBeenCalledTimes(1);
});

test('each collection is kept on its own', async () => {
	const load = fakeLoad();
	const collections = cachedCollections(load as never, true);

	expect((await collections.all('tags')).length).toBe(2);
	expect((await collections.all('sections')).length).toBe(1);
	expect(load).toHaveBeenCalledTimes(2);
});

test('byId finds an entry by its id and answers undefined for an unknown one', async () => {
	const collections = cachedCollections(fakeLoad() as never, true);
	const byId = await collections.byId('tags');

	expect(byId.get('articol')).toBe(tags[1]);
	expect(byId.get('nope')).toBeUndefined();
});

test('without keeping, every question loads again, so an edited file shows up while developing', async () => {
	const load = fakeLoad();
	const collections = cachedCollections(load as never, false);

	await collections.all('tags');
	await collections.all('tags');
	await collections.byId('tags');

	expect(load).toHaveBeenCalledTimes(3);
});
