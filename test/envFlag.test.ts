import { expect, test } from 'vitest';
import { envFlag } from '../src/utils/envFlag';

// Astro no longer turns the text of an environment variable into a boolean or a number, so "false" would count as on.
test.each([
	['true', true],
	['1', true],
	['yes', true],
	[true, true],
	['false', false],
	['FALSE', false],
	['0', false],
	['', false],
	[' ', false],
	[false, false],
	[0, false],
	[undefined, false],
	[null, false],
])('the value %j reads as %s', (value, expected) => {
	expect(envFlag(value)).toBe(expected);
});
