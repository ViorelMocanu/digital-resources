import type { CollectionKeyEnum, Order, Type } from '@config';
import { type CollectionEntry } from 'astro:content';
import { collections } from './collections';

/**
 * Compares two strings based on the specified order and returns a numerical value indicating their relative order.
 * @param {string} a - The first string to compare.
 * @param {string} b - The second string to compare.
 * @param {Order} order - The order in which to compare the strings. It can be either 'asc' (ascending) or 'desc' (descending).
 * @returns {1|-1|0} A numerical value (-1, 0, or 1) indicating the relative order of the two input strings based on the specified order.
 * @throws {Error} Invalid order value. Expected 'asc' or 'desc'.
 */
function sortTexts(a: string, b: string, order: Order): 1 | -1 | 0 {
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
function sortDates(a: string, b: string, order: Order): number {
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
function sortNumbers(a: string, b: string, order: Order): number {
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

/**
 * Orders two entries by their id, for `Array.prototype.sort`.
 * @param {{ id: string }} a The first entry.
 * @param {string} a.id Its id.
 * @param {{ id: string }} b The second entry.
 * @param {string} b.id Its id.
 * @returns {1|-1|0} The order of the two ids.
 */
export const byId = (a: { id: string }, b: { id: string }): 1 | -1 | 0 => sortTexts(a.id, b.id, 'asc');

/** How to sort: the data field, the kind of value it holds and the direction. */
export type SortOptions = {
	sortKey: string;
	type: Type;
	order?: Order;
};

/**
 * Sorts entries by one field of their data. Entries without the field come last, in both orders, and entries with
 * the same value keep the order of their ids, so two builds always give the same list.
 * @param {readonly E[]} entries The entries; the list is not changed.
 * @param {SortOptions} options The field, the kind of value and the order ('asc' by default).
 * @returns {E[]} A new, sorted list.
 * @throws {Error} When the type is unknown, or no entry of a non-empty list has the field in its data.
 */
export function sortEntries<E extends { id: string; data: object }>(entries: readonly E[], { sortKey, type, order = 'asc' }: SortOptions): E[] {
	if (!Object.hasOwn(sortFunctions, type)) {
		throw new Error(`Invalid type value: ${type}`);
	}
	if (entries.length === 0) return [];
	if (!entries.some((entry) => Object.hasOwn(entry.data, sortKey))) {
		throw new Error(`Invalid sortKey value: ${sortKey}`);
	}

	// The key is only known when the function runs, so the compiler cannot tell which kind of value it names.
	// `type` says which comparison fits.
	const compare = sortFunctions[type] as (a: unknown, b: unknown, order: Order) => number;
	const valueOf = (entry: E) => (entry.data as Record<string, unknown>)[sortKey];
	return [...entries].sort((a, b) => {
		const [x, y] = [valueOf(a), valueOf(b)];
		if ((x === undefined) !== (y === undefined)) return x === undefined ? 1 : -1;
		const byValue = x === undefined ? 0 : compare(x, y, order);
		return byValue !== 0 ? byValue : byId(a, b);
	});
}

/**
 * Returns a whole content collection sorted by one field of its data (see sortEntries).
 * @async
 * @function getSortedItems
 * @param {SortOptions & { collectionKey: T }} root0 Property object
 * @param {CollectionKeyEnum} root0.collectionKey Name of the collection from which you want to extract data
 * @param {string} root0.sortKey Attribute you want to sort by
 * @param {Type} root0.type What is the value of the attribute you want to sort by {text, number, date}
 * @param {Order} [root0.order] Order type {asc, desc}, default 'asc'
 * @returns {Promise<CollectionEntry<CollectionKeyEnum>[]>} A sorted list containing CollectionEntries of the correct type
 */
export default async function getSortedItems<T extends CollectionKeyEnum>({ collectionKey, ...options }: SortOptions & { collectionKey: T }): Promise<CollectionEntry<T>[]> {
	const entries = await collections.all<T>(collectionKey);
	if (entries.length === 0) {
		throw new Error("Invalid input. Most likely, 'collectionKey' does not exist.");
	}
	return sortEntries(entries, options);
}
