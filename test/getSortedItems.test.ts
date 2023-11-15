// Vitest unit test for getSortedItems function
import { type CollectionKey, type DataCollectionKey } from 'astro:content';
import getSortedItems from '../src/utils/getSortedItems';

describe('getSortedItems', () => {
	/*
	// Returns a sorted list of CollectionEntries of the correct type, given valid input parameters
	it('should return a sorted list of CollectionEntries when given valid input parameters', async () => {
		// Arrange
		const collectionKey = 'tags';
		const sortKey = 'publishDate';
		const type = 'date';
		const order = 'desc';

		// Act
		const result = await getSortedItems({ collectionKey, sortKey, type, order });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveProperty('collection', collectionKey);
	});

	// Sorts the list in ascending order by default, if no order parameter is provided
	it('should sort the list in ascending order by default when no order parameter is provided', async () => {
		// Arrange
		const collectionKey = 'categories';
		const sortKey = 'sortOrder';
		const type = 'number';

		// Act
		const result = await getSortedItems({ collectionKey, sortKey, type });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveProperty('collection', collectionKey);
	});

	// Sorts the list by text values, given a valid text type parameter
	it('should sort the list by text values when given a valid text type parameter', async () => {
		// Arrange
		const collectionKey = 'categories';
		const sortKey = 'slug';
		const type = 'text';
		const order = 'desc';

		// Act
		const result = await getSortedItems({ collectionKey, sortKey, type, order });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveProperty('collection', collectionKey);
	});
	*/

	// Throws an error if the input collectionKey parameter is undefined or does not exist
	it('should throw an error if the input collectionKey parameter is undefined or does not exist', async () => {
		// Arrange
		const collectionKey = 'invalidCollection' as CollectionKey;
		const sortKey = 'slug';
		const type = 'text';
		const order = 'asc';

		// Act & Assert
		await expect(getSortedItems({ collectionKey, sortKey, type, order })).rejects.toThrowError();
	});

	// Throws an error if the input sortKey parameter is undefined or does not exist
	it('should throw an error if the input sortKey parameter is undefined or does not exist', async () => {
		// Arrange
		const collectionKey = 'categories';
		const sortKey = '' as DataCollectionKey;
		const type = 'text';
		const order = 'asc';

		// Act & Assert
		await expect(getSortedItems({ collectionKey, sortKey, type, order })).rejects.toThrowError();
	});
});
