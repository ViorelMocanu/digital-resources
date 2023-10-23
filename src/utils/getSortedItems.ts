/**
 * A function built to return any Astro Content Collection sorted by the provided sortKey parameter.
 * 
 * @astroProps
 * @prop {CollectionKey} collectionKey Name of the collection from which you want to extract data
 * @prop {DataCollectionKey} sortKey Attribute you want to sort by
 * @prop {string} [type] Sort type {asc, desc}
 * @prop {boolean} [isDate] If the data returned by the attribute set to sortKey is of type date
 * @returns {Promise<CollectionEntry<typeof collectionKey>[]>} A sorted list containing CollectionEntries of the correct type
 */

import { type CollectionEntry, type CollectionKey, type DataCollectionKey, getCollection } from "astro:content";

type Props = {
	collectionKey: CollectionKey;
	sortKey: DataCollectionKey;
	type?: 'asc' | 'desc';
	isDate?: boolean;
}

export default async function getSortedItems ({ collectionKey, sortKey, type = 'asc', isDate = false }: Props): Promise<CollectionEntry<typeof collectionKey>[]> {
	const unsorted = await getCollection(collectionKey);
	if (typeof unsorted === 'undefined') return unsorted;
	return unsorted.sort((a, b) => {
		const { data: { [sortKey]: sortValueFromA = 0 } } = a;
		const { data: { [sortKey]: sortValueFromB = 0 } } = b;

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