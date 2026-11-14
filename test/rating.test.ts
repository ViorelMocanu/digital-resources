// The rating scale (owner decision 12, 2026-11-14): 1 to 10, at most one decimal, written "8.5/10".
import { describe, expect, it } from 'vitest';
import { ratingSchema } from '../src/utils/rating';

describe('ratingSchema', () => {
	it.each([1, 8.5, 9.9, 10, undefined])('accepts %s', (value) => {
		expect(ratingSchema.safeParse(value).success).toBe(true);
	});

	// 100 is the old stored value, 11 comes from the workbook's 110, 0.9 is under the lowest grade.
	it.each([10.1, 100, 8.55, 11, 0.9, 0, -0.1])('refuses %s', (value) => {
		expect(ratingSchema.safeParse(value).success).toBe(false);
	});
});
