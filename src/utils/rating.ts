import { z } from 'astro/zod';

/**
 * A resource's rating, on the scale the site writes as "8.5/10" (owner decision 12, 2026-11-14): a grade from 1 to
 * 10 with at most one decimal. Optional: an unrated resource shows "n/a".
 */
export const ratingSchema = z
	.number()
	.min(1, 'Rating-ul nu poate avea mai puțin de nota 1')
	.max(10, 'Rating-ul nu poate avea mai mult de nota 10')
	.multipleOf(0.1, 'Rating-ul are cel mult o zecimală')
	.optional();
