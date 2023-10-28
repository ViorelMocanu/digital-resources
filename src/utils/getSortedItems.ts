import { type CollectionEntry, type DataCollectionKey, getCollection } from 'astro:content';
import type { CollectionKeyEnum, Order, Type } from '../config';

/**
 * Compares two strings based on the specified order and returns a numerical value indicating their relative order.
 * @param {string} a - The first string to compare.
 * @param {string} b - The second string to compare.
 * @param {Order} order - The order in which to compare the strings. It can be either 'asc' (ascending) or 'desc' (descending).
 * @returns {number} A numerical value (-1, 0, or 1) indicating the relative order of the two input strings based on the specified order.
 * @throws {Error} Invalid order value. Expected 'asc' or 'desc'.
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
 * Checks if a given string is a valid date.
 * @example
 * const date1 = '2022-01-01';
 * const date2 = 'invalid date';
 * console.log(isValidDate(date1)); // true
 * console.log(isValidDate(date2)); // false
 * @param {string} dateString - The string to be checked if it represents a valid date.
 * @returns {boolean} A boolean indicating whether the input string represents a valid date (`true`) or not (`false`).
 */
function isValidDate(dateString: string): boolean {
	return !isNaN(Date.parse(dateString));
}

/**
 * Compare two date strings and sort them in either ascending or descending order.
 * @param {string} a - The first date string to compare.
 * @param {string} b - The second date string to compare.
 * @param {Order} order - The sorting order, either 'asc' for ascending or 'desc' for descending.
 * @returns {number} A number representing the difference between the two dates. A positive value indicates that `a` is greater than `b` in ascending order, while a negative value indicates the opposite.
 * @throws {Error} If either `a` or `b` is an invalid date string.
 * @throws {Error} If the `order` value is invalid.
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
 * Sorts two numbers based on the specified order.
 * @example
 * const result = sortNumbers('3.14', '2.71', 'asc');
 * console.log(result); // Output: 0.43
 * @param {string} a - The first number in string format.
 * @param {string} b - The second number in string format.
 * @param {Order} order - The order in which the numbers should be sorted. It can be either 'asc' for ascending order or 'desc' for descending order.
 * @returns {number} The difference between the two input numbers based on the specified order.
 * @throws {Error} If either 'a' or 'b' is not a valid number in string format, or if the order value is invalid.
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
 * A function built to return any Astro Content Collection sorted by the provided sortKey parameter.
 * @async
 * @function getSortedItems
 * @param {GetSortedItemsProps} root0 Property object
 * @param {CollectionKeyEnum} root0.collectionKey Name of the collection from which you want to extract data
 * @param {string} root0.sortKey Attribute you want to sort by
 * @param {Type} [root0.type] What is the value of the attribute you want to sort by {text, number, date}
 * @param {Order} [root0.order] Order type {asc, desc}, default 'asc'
 * @returns {Promise<CollectionEntry<CollectionKeyEnum>[]>} A sorted list containing CollectionEntries of the correct type
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
