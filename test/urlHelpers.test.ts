// Vitest unit test for highlightUrl function
import { highlightUrl } from '../src/utils/urlHelpers';
import { test } from 'vitest';

test('highlightUrl()', () => {
	const urlFragment = '/test';
	const standardClass = 'standard';
	const activeClass = 'active';
	const currentUrl = '/test/url';

	const result = highlightUrl(urlFragment, standardClass, activeClass, currentUrl);

	expect(result).toEqual([standardClass, activeClass]);
});

describe('highlightUrl', () => {
	// Returns an array with the standard class name when no URL matches are found
	it('should return an array with the standard class name when no URL matches are found', () => {
		const urlFragment = 'example';
		const standardClass = 'link';
		const activeClass = 'active';
		const currentUrl = 'https://www.example.com';

		const result = highlightUrl(urlFragment, standardClass, activeClass, currentUrl);

		expect(result).toEqual(['link']);
	});

	// Returns an array with the standard class name when the current URL is not provided and the window object is undefined
	it('should return an array with the standard class name when the current URL is not provided and the window object is undefined', () => {
		const urlFragment = 'example';
		const standardClass = 'link';
		const activeClass = 'active';
		const currentUrl = undefined;

		const result = highlightUrl(urlFragment, standardClass, activeClass, currentUrl);

		expect(result).toEqual(['link']);
	});

	// Returns an array with the standard class name when the current URL is not provided and the window object does not have a location property
	it('should return an array with the standard class name when the current URL is not provided and the window object does not have a location property', () => {
		const urlFragment = 'example';
		const standardClass = 'link';
		const activeClass = 'active';
		const currentUrl = undefined;

		const result = highlightUrl(urlFragment, standardClass, activeClass, currentUrl);

		expect(result).toEqual(['link']);
	});

	// Returns an array with the standard class name when the current URL is not provided and the window location does not start with the provided URL fragment
	it('should return an array with the standard class name when the current URL is not provided and the window location does not start with the provided URL fragment', () => {
		const urlFragment = 'example';
		const standardClass = 'link';
		const activeClass = 'active';
		const currentUrl = undefined;

		const result = highlightUrl(urlFragment, standardClass, activeClass, currentUrl);

		expect(result).toEqual(['link']);
	});
});
