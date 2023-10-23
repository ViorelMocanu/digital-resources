// Vitest unit test for getSortedItems function
import { type CollectionEntry, type CollectionKey, type DataCollectionKey, getCollection } from "astro:content";
import { expectTypeOf, test } from 'vitest';
import getSortedItems from '../src/utils/getSortedItems';

test('getSortedItems()', () => {
	const collectionKey = "sections";
	const sortKey = "sortOrder" as DataCollectionKey;
	var x = getCollection(collectionKey) as CollectionEntry<"sections"> & never;

	expectTypeOf(getSortedItems({ collectionKey, sortKey})).toEqualTypeOf(x);
});

describe('code snippet', () => {

	// Returns a sorted list of CollectionEntries based on provided sortKey
	it('should return a sorted list of CollectionEntries based on the provided sortKey', async () => {
		const collectionKey = 'categories';
		const sortKey = 'sortOrder' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey });
		let prevItem = sortedItems[0];
		const isSorted = sortedItems.every((item, index) => {
			if (index === 0) return true;
			prevItem = sortedItems[index - 1];
			if (typeof prevItem === 'undefined') return false;
			return item.data[sortKey] >= prevItem.data[sortKey];
		});
		expect(isSorted).toBe(true);
	});

	// Sorts CollectionEntries in ascending order by default
	it('should sort CollectionEntries in ascending order by default', async () => {
		const collectionKey = 'categories';
		const sortKey = 'sortOrder' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey });
		let prevItem = sortedItems[0];
		const isSorted = sortedItems.every((item, index) => {
			if (index === 0) return true;
			prevItem = sortedItems[index - 1];
			if (typeof prevItem === 'undefined') return false;
			return item.data[sortKey] >= prevItem.data[sortKey];
		});
		expect(isSorted).toBe(true);
	});

	// Can sort CollectionEntries in descending order
	it('should sort CollectionEntries in descending order', async () => {
		const collectionKey = 'categories';
		const sortKey = 'sortOrder' as DataCollectionKey;
		const type = 'desc' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey, type });
		let prevItem = sortedItems[0];
		const isSorted = sortedItems.every((item, index) => {
			if (index === 0) return true;
			prevItem = sortedItems[index - 1];
			if (typeof prevItem === 'undefined') return false;
			return item.data[sortKey] <= prevItem.data[sortKey];
		});
		expect(isSorted).toBe(true);
	});

	// Returns an empty array if the provided collectionKey does not exist
	it('should return an empty array if the provided collectionKey does not exist', async () => {
		const collectionKey = 'nonexistent' as CollectionKey;
		const sortKey = 'sortOrder' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey });
		expect(sortedItems).toBeUndefined();
	});

	// Returns an unsorted list if sortKey does not exist in CollectionEntry data
	it('should return an unsorted list if sortKey does not exist in CollectionEntry data', async () => {
		const collectionKey = 'categories';
		const sortKey = 'nonexistent' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey });
		let prevItem = sortedItems[0];
		const isSorted = sortedItems.every((item, index) => {
			if (index === 0) return true;
			prevItem = sortedItems[index - 1];
			if (typeof prevItem === 'undefined') return false;
			return item.data[sortKey] >= prevItem.data[sortKey];
		});
		expect(isSorted).toBe(false);
	});

	// Returns an unsorted list if sortValue is not a number or a valid date string
	it('should return an unsorted list if sortValue is not a number or a valid date string', async () => {
		const collectionKey = 'categories';
		const sortKey = 'title' as DataCollectionKey;
		const sortedItems = await getSortedItems({ collectionKey, sortKey });
		let prevItem = sortedItems[0];
		const isSorted = sortedItems.every((item, index) => {
			if (index <= 0) return true;
			prevItem = sortedItems[index - 1];
			if (typeof prevItem === 'undefined') return false;
			return item.data[sortKey] >= prevItem.data[sortKey];
		});
		expect(isSorted).toBe(false);
	});
});
