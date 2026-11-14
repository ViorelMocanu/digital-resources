// Vitest unit test for getFormattedDate function
import { dateTextSchema, formatRating, getFormattedDate, toIsoDateTime } from '../src/utils/resourceMeta';
import { test } from 'vitest';

describe('dateTextSchema', () => {
	it.each(['15 October 2023 19:48 UTC', '2023-10-11T19:35:55+03:00', '2023-10-12'])('accepts %s', (text) => {
		expect(dateTextSchema.safeParse(text).success).toBe(true);
	});

	it.each(['', 'not a date', '2022-13-01'])('refuses %j', (text) => {
		expect(dateTextSchema.safeParse(text).success).toBe(false);
	});
});

describe('formatRating', () => {
	it('writes the number over the scale, with its decimal when it has one', () => {
		expect(formatRating(8.5)).toBe('8.5/10');
		expect(formatRating(10)).toBe('10/10');
		expect(formatRating(1)).toBe('1/10');
	});

	it('writes n/a for a resource without a rating', () => {
		expect(formatRating(undefined)).toBe('n/a');
	});
});

describe('toIsoDateTime', () => {
	// The resource files write modDate as free text in UTC; the meta tags need ISO 8601.
	it('turns the free-text date of a resource into ISO 8601', () => {
		expect(toIsoDateTime('15 October 2023 19:48 UTC')).toBe('2023-10-15T19:48:00.000Z');
		expect(toIsoDateTime('05 October 2011 14:48 UTC')).toBe('2011-10-05T14:48:00.000Z');
	});

	it('turns an offset into UTC', () => {
		expect(toIsoDateTime('2023-10-11T19:35:55+03:00')).toBe('2023-10-11T16:35:55.000Z');
	});

	it('refuses a value that is not a date, naming it', () => {
		expect(() => toIsoDateTime('not a date')).toThrow('not a date');
	});
});

test('getFormattedDate()', () => {
	// Midnight UTC: dates print as the day in UTC, and new Date(2022, 1, 1) would be local midnight, the day before
	// in UTC east of Greenwich.
	const date = new Date(Date.UTC(2022, 1, 1));
	const dateString = '2022-02-01';

	expect(getFormattedDate(date)).toBe(dateString);
	expect(getFormattedDate(dateString)).toBe(dateString);
	expect(getFormattedDate('')).toBe('Missing date');
});

describe('getFormattedDate', () => {
	// Returns a formatted date string when given a valid Date object.
	it('should return a formatted date string when given a valid Date object', () => {
		const date = new Date('2022-01-01');
		const result = getFormattedDate(date);
		expect(result).toBe('2022-01-01');
	});

	// Returns a formatted date string when given a valid ISO string.
	it('should return a formatted date string when given a valid ISO string', () => {
		const isoString = '2022-01-01T00:00:00.000Z';
		const result = getFormattedDate(isoString);
		expect(result).toBe('2022-01-01');
	});

	// Returns 'Missing date' when no date is provided.
	it('should return "Missing date" when no date is provided', () => {
		const result = getFormattedDate('');
		expect(result).toBe('Missing date');
	});

	// Returns a formatted date string when given the earliest possible Date object.
	it('should return a formatted date string when given the earliest possible Date object', () => {
		const date = new Date(-8640000000000000);
		const result = getFormattedDate(date);
		expect(result).toBe('-271821-04-20');
	});

	// Returns a formatted date string when given the latest possible Date object.
	it('should return a formatted date string when given the latest possible Date object', () => {
		const date = new Date(8640000000000000);
		const result = getFormattedDate(date);
		expect(result).toBe('275760-09-13');
	});

	// Returns 'Malformed date' when given an ISO string with an invalid month.
	it('should return "Malformed date" when given an ISO string with an invalid month', () => {
		const isoString = '2022-13-01T00:00:00.000Z';
		const result = getFormattedDate(isoString);
		expect(result).toBe('Time not specified');
	});
});
