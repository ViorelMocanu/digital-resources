/**
 * A function built to return any Astro Content Collection sorted by the provided sortKey parameter.
 *
 * @astroProps
 * @prop {CollectionKeyEnum} collectionKey Name of the collection from which you want to extract data
 * @prop {string} sortKey Attribute you want to sort by
 * @prop {Type} [type] What is the value of the attribute you want to sort by {text, number, date}
 * @prop {Order} [order] Order type {asc, desc}, default 'asc'
 * @returns {Promise<CollectionEntry<typeof collectionKey>[]>} A sorted list containing CollectionEntries of the correct type
 */

import { type CollectionEntry, type DataCollectionKey, getCollection } from 'astro:content';
import type { CollectionKeyEnum, Order, Type } from '../config';

type Props = {
	collectionKey: CollectionKeyEnum;
	sortKey: string;
	type: Type;
	order?: Order;
};

function sortTexts(a: string, b: string, order: Order) {
	switch (order) {
		case 'asc':
			return a < b ? -1 : a > b ? 1 : 0;
		case 'desc':
			return a > b ? -1 : a < b ? 1 : 0;
		default:
			throw new Error("Invalid order value. Expected 'asc' or 'desc'.");
	}
}

function isValidDate(dateString: string): boolean {
	return !isNaN(Date.parse(dateString));
}

function sortDates(a: string, b: string, order: Order) {
	if (!isValidDate(a) || !isValidDate(b)) {
		throw new Error('Invalid date strings');
	}
	const dateA = new Date(a);
	const dateB = new Date(b);
	switch (order) {
		case 'asc':
			return dateA.valueOf() - dateB.valueOf();
		case 'desc':
			return dateB.valueOf() - dateA.valueOf();
		default:
			throw new Error(`Invalid order value: ${order}`);
	}
}

function sortNumbers(a: string, b: string, order: Order) {
	const numA = parseFloat(a);
	const numB = parseFloat(b);

	if (isNaN(numA) || isNaN(numB)) {
		throw new Error(`Invalid input. Both 'a' and 'b' must be valid numbers in string format, and ${isNaN(numA) ? "'a'" : "'b'"} is not.`);
	}

	switch (order) {
		case 'asc':
			return numA - numB;
		case 'desc':
			return numB - numA;
		default:
			throw new Error(`Invalid order value: ${order}`);
	}
}

const sortFunctions = {
	text: sortTexts,
	date: sortDates,
	number: sortNumbers,
};

export default async function getSortedItems({ collectionKey, sortKey, type, order = 'asc' }: Props): Promise<CollectionEntry<CollectionKeyEnum>[]> {
	if (typeof collectionKey !== 'string') {
		throw new Error("Invalid input. Expected 'collectionKey' to be a string.");
	}
	if (typeof sortKey !== 'string' && typeof sortKey !== 'number') {
		throw new Error("Invalid input. Expected 'sortKey' to be a string or number.");
	}
	if (typeof type !== 'string') {
		throw new Error("Invalid input. Expected 'type' to be a string.");
	}
	if (typeof order !== 'undefined' && typeof order !== 'string') {
		throw new Error("Invalid input. Expected 'order' to be a string.");
	}
	if (!sortFunctions.hasOwnProperty(type)) {
		throw new Error(`Invalid type value: ${type}`);
	}
	const unsorted = await getCollection(collectionKey);
	if (typeof unsorted === 'undefined' || !unsorted[0]) {
		throw new Error("Invalid input. Most likely, 'collectionKey' does not exist.");
	}
	if (!unsorted[0].hasOwnProperty(sortKey) && !unsorted[0].data.hasOwnProperty(sortKey)) {
		throw new Error(`Invalid sortKey value: ${sortKey}`);
	}
	return unsorted.sort((a, b) => {
		const {
			data: { [sortKey as DataCollectionKey]: sortValueFromA },
		} = a;
		const {
			data: { [sortKey as DataCollectionKey]: sortValueFromB },
		} = b;
		return sortFunctions[type](sortValueFromA, sortValueFromB, order);
	}) as CollectionEntry<CollectionKeyEnum>[];
}
