import { z } from 'zod';

/**
 * Formats a given date into the 'YYYY-MM-DD' format.
 * @param {Date | string} date - The date to be formatted. Can be a Date object or a string.
 * @returns {string} The formatted date string. If the date is malformed, returns 'Malformed date'.
 */
export function getFormattedDate (date: Date | string): string {
	if (!date) return 'Missing date';
	if (typeof date !== 'string' && !(date instanceof Date)) return 'Malformed date object';
	if (typeof date === 'string' && !z.date().safeParse(date)) return 'Malformed date string';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return 'Time not specified';

	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	
	return `${year}-${month}-${day}`;
};
