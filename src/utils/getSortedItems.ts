/**
 * 
 * @param {string} collectionKey Name of the collection from which you want to extract data
 * @param {string} sortKey Attribute you want to sort by
 * @param {string} type What is the value of the attribute you want to sort by {text, number, date}
 * @param {string} order Order type {asc, desc}, default 'asc'
 * @returns {ReturnType[]} A sorted list
 */

import { type CollectionKey, getCollection } from "astro:content";

type Props = {
	collectionKey: CollectionKey;
	sortKey: string;
	type: 'text' | 'number' | 'date';
	order?: 'asc' | 'desc';
}

function sortText(a: string, b: string, order: 'asc' | 'desc') {
	switch (order) {
		case 'asc':
			return a < b ? -1 : 1;
		case 'desc':
			return a > b ? -1 : 1;
	}
}

function sortDate(a: string, b: string, order: 'asc' | 'desc') {
	switch (order) {
		case 'asc':
			return (new Date(a).valueOf() - new Date(b).valueOf());
		case 'desc':
			return (new Date(b).valueOf() - new Date(a).valueOf());
	}
}

function sortNumber(a: string, b: string, order: 'asc' | 'desc') {
	switch (order) {
		case 'asc': return Number(a) - Number(b);
		case 'desc': return Number(b) - Number(a);
	}
}

const sortFunctions = {
	text: sortText,
	date: sortDate,
	number: sortNumber
};


export default async function getSortedItems<ReturnType>({ collectionKey, sortKey, type, order = 'asc' }: Props) {
	return (await getCollection(collectionKey)).sort((a, b) => {
		const { data: { [sortKey as keyof typeof a.data]: sortValueFromA } } = a;
		const { data: { [sortKey as keyof typeof b.data]: sortValueFromB } } = b;
		return sortFunctions[type](sortValueFromA, sortValueFromB, order);
	}) as ReturnType[];
};  