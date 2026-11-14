import { z } from 'astro/zod';

/**
 * A date written as text in a content file ('15 October 2023 19:48 UTC' or ISO 8601). The schema refuses text a
 * JavaScript date cannot read, so the build names the file instead of failing later in a sort.
 */
export const dateTextSchema = z.string().refine((text) => !Number.isNaN(Date.parse(text)), 'Data nu poate fi citită');

/**
 * Formats a given date into the 'YYYY-MM-DD' format, as the day in UTC, so the build machine's time zone cannot
 * change it.
 * @function getFormattedDate
 * @param {Date | string} date - The date to be formatted. Can be a Date object or a string.
 * @returns {string} The formatted date string. If the date cannot be read, returns 'Time not specified'.
 */
export function getFormattedDate(date: Date | string): string {
	if (!date) return 'Missing date';
	if (typeof date !== 'string' && !(date instanceof Date)) return 'Malformed date object';
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return 'Time not specified';

	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

/**
 * Writes a rating over its scale, with a dot for the decimal: 8.5 becomes '8.5/10'.
 * @param rating The rating, from 1 to 10, or undefined for an unrated resource.
 * @returns The text to show, or 'n/a' when there is no rating.
 */
export function formatRating(rating: number | undefined): string {
	return rating === undefined ? 'n/a' : `${rating}/10`;
}

/**
 * Turns a date into ISO 8601 in UTC, the form the `article:*_time` meta tags need.
 * @param value A date, or a text a JavaScript date can read ('15 October 2023 19:48 UTC').
 * @returns The ISO 8601 text, for example '2023-10-15T19:48:00.000Z'.
 * @throws {Error} When the value is not a date, so the build stops and names it.
 */
export function toIsoDateTime(value: Date | string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Data nu poate fi citită: ${String(value)}`);
	return date.toISOString();
}
