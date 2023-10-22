/**
 * 
 * @param {string} collectionKey Name of the collection from which you want to extract data
 * @param {string} sortKey Attribute you want to sort by
 * @param {string} type Sort type {asc, desc}
 * @param {string} isDate If the data returned by the attribute set to sortKey is of type date
 * @returns {Type[]} A sorted list
 */

import { getCollection, type CollectionKey, type DataCollectionKey } from "astro:content";

type Props = {
	collectionKey: CollectionKey;
	sortKey: DataCollectionKey;
	type?: 'asc' | 'desc';
	isDate?: boolean;
}

export default async function getSortedItems({ collectionKey, sortKey, type = 'asc', isDate = false }: Props) {
	return (await getCollection(collectionKey)).sort((a, b) => {
		const { data: dataFromA } = a
		const { data: dataFromB } = b

		if (isDate) {
			if (type === 'asc')
				return (new Date(dataFromA[sortKey] as string).valueOf() - new Date(dataFromB[sortKey] as string).valueOf())
			return (new Date(dataFromB[sortKey] as string).valueOf() - new Date(dataFromA[sortKey] as string).valueOf())
		}

		if (type === 'asc')
			return dataFromA[sortKey] - dataFromB[sortKey]
		return dataFromB[sortKey] - dataFromA[sortKey]
	});
};