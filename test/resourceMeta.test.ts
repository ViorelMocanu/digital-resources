// Vitest unit test for getFormattedDate function
import { getFormattedDate } from '../src/utils/resourceMeta';
import { test } from 'vitest';

test('getFormattedDate()', () => {
	const date = new Date(2022, 1, 1);
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
