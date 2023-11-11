import { type CollectionEntry, type DataCollectionKey, getCollection } from 'astro:content';
import type { CollectionKeyEnum, Order, Type } from '../config';


/**
 *
 * @param a
 * @param b
 * @param order
 */
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

/**
 *
 * @param dateString
 */
function isValidDate(dateString: string): boolean {
	return !isNaN(Date.parse(dateString));
}

/**
 *
 * @param a
 * @param b
 * @param order
 */
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

/**
 *
 * @param a
 * @param b
 * @param order
 */
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

type GetSortedItemsProps<T extends CollectionKeyEnum> = {
	collectionKey: T;
	sortKey: string;
	type: Type;
	order?: Order;
};

/**
 *
 * @param root0
 * @param root0.collectionKey
 * @param root0.sortKey
 * @param root0.type
 * @param root0.order
 */
export default async function getSortedItems<T extends CollectionKeyEnum>({ collectionKey, sortKey, type, order = 'asc' }: GetSortedItemsProps<T>): Promise<CollectionEntry<T>[]> {
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
	const unsorted = await getCollection<T>(collectionKey);
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
	});
}
