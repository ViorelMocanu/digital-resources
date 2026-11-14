// The sort behind every list of the site. sortEntries is pure, so these tests use entries written by hand: under
// vitest the content collections are empty, and a test of getSortedItems itself could only ever see that.
import { byId, sortEntries } from '../src/utils/getSortedItems';
import { describe, expect, it } from 'vitest';

/**
 * Hand-written entries, in the order a loader might give them.
 * @param rows The id and data of each entry.
 * @returns The entries.
 */
const entries = (rows: [string, Record<string, unknown>][]) => rows.map(([id, data]) => ({ id, collection: 'sections', data }));
const ids = (list: readonly { id: string }[]) => list.map((entry) => entry.id);

// /r/ and /cauta/ list every resource by id.
it('byId orders entries by their id', () => {
	expect(
		ids(
			[
				...entries([
					['web', {}],
					['beginners', {}],
					['internet', {}],
				]),
			].sort(byId)
		)
	).toEqual(['beginners', 'internet', 'web']);
});

describe('sortEntries', () => {
	// 0 is a real sortOrder (src/content/sections/front-end.md), so a truthiness slip fails here.
	const sections = entries([
		['design', { sortOrder: 10 }],
		['back-end', { sortOrder: 2 }],
		['front-end', { sortOrder: 0 }],
	]);

	it('sorts numbers, lowest first by default', () => {
		expect(ids(sortEntries(sections, { sortKey: 'sortOrder', type: 'number' }))).toEqual(['front-end', 'back-end', 'design']);
	});

	it('sorts numbers, highest first when asked', () => {
		expect(ids(sortEntries(sections, { sortKey: 'sortOrder', type: 'number', order: 'desc' }))).toEqual(['design', 'back-end', 'front-end']);
	});

	it('sorts the free-text dates of the resource files, oldest first', () => {
		const resources = entries([
			['web-work', { modDate: '12 October 2023 20:48 UTC' }],
			['internet-work', { modDate: '05 October 2011 14:48 UTC' }],
			['beginners-guide', { modDate: '15 October 2023 19:48 UTC' }],
		]);
		expect(ids(sortEntries(resources, { sortKey: 'modDate', type: 'date' }))).toEqual(['internet-work', 'web-work', 'beginners-guide']);
	});

	it('returns a new list and leaves the given one as it was', () => {
		const before = ids(sections);
		sortEntries(sections, { sortKey: 'sortOrder', type: 'number' });
		expect(ids(sections)).toEqual(before);
	});

	it('puts entries without the value last, in both orders', () => {
		const resources = entries([
			['b', { modDate: '2023-10-12' }],
			['a', {}],
			['c', { modDate: '2011-10-05' }],
		]);
		expect(ids(sortEntries(resources, { sortKey: 'modDate', type: 'date' }))).toEqual(['c', 'b', 'a']);
		expect(ids(sortEntries(resources, { sortKey: 'modDate', type: 'date', order: 'desc' }))).toEqual(['b', 'c', 'a']);
	});

	it('orders entries with the same value by id, whatever order they came in', () => {
		const tied = entries([
			['odin-project-web-development', { modDate: '05 October 2011 14:48 UTC' }],
			['how-does-the-internet-work', { modDate: '05 October 2011 14:48 UTC' }],
		]);
		expect(ids(sortEntries(tied, { sortKey: 'modDate', type: 'date' }))).toEqual(['how-does-the-internet-work', 'odin-project-web-development']);
		const categories = entries([
			['b', { sortOrder: 0 }],
			['a', { sortOrder: 0 }],
		]);
		expect(ids(sortEntries(categories, { sortKey: 'sortOrder', type: 'number', order: 'desc' }))).toEqual(['a', 'b']);
	});

	it('refuses a key that no entry has in its data, the id included', () => {
		expect(() => sortEntries(sections, { sortKey: 'nope', type: 'number' })).toThrow('Invalid sortKey value: nope');
		expect(() => sortEntries(sections, { sortKey: '', type: 'number' })).toThrow('Invalid sortKey value: ');
		expect(() => sortEntries(sections, { sortKey: 'id', type: 'text' })).toThrow('Invalid sortKey value: id');
	});

	// A filtered list can be empty: the tag page of a tag no resource uses yet (t/platit).
	it('returns an empty list for an empty list', () => {
		expect(sortEntries([], { sortKey: 'modDate', type: 'date' })).toEqual([]);
	});
});
