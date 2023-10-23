/**
 * A function built to return any Astro Content Collection sorted by the provided sortKey parameter.
 * 
 * @param {string} collectionKey Name of the collection from which you want to extract data
 * @param {string} sortKey Attribute you want to sort by
 * @param {string} [type] Sort type {asc, desc}
 * @param {string} [isDate] If the data returned by the attribute set to sortKey is of type date
 * @returns {Promise<CollectionEntry<typeof collectionKey>[]>} A sorted list containing CollectionEntries of the correct type
 */

import { getCollection, type CollectionEntry, type CollectionKey, type DataCollectionKey } from "astro:content";

type Props = {
	collectionKey: CollectionKey;
	sortKey: DataCollectionKey;
	type?: 'asc' | 'desc';
	isDate?: boolean;
}

export default async function getSortedItems ({collectionKey, sortKey, type = 'asc', isDate = false}: Props): Promise<CollectionEntry<typeof collectionKey>[]> {
	return (await getCollection(collectionKey)).sort((a, b) => {
		const { data: { [sortKey]: sortValueFromA } } = a;
		const { data: { [sortKey]: sortValueFromB } } = b;

		if (isDate) {
			if (type === 'asc')
				return (new Date(sortValueFromA).valueOf() - new Date(sortValueFromB).valueOf());
			return (new Date(sortValueFromB).valueOf() - new Date(sortValueFromA).valueOf());
		}

		if (type === 'asc')
			return sortValueFromA - sortValueFromB;
		return sortValueFromB - sortValueFromA;
	});
};