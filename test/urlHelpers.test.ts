// Vitest unit test for highlightUrl function
import { test, vi } from 'vitest';
import { highlightUrl } from '../src/utils/urlHelpers';

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

	// The helper decides from its argument alone: every caller is a template rendered at build time, where there is
	// no window. A browser window must not change the answer, even for an empty path (the home page gives one).
	it('ignores a browser window when the current path is empty', () => {
		vi.stubGlobal('window', { location: { href: 'https://resurse.dev/front-end/' } });
		try {
			expect(highlightUrl('https://resurse.dev/front-end', 'link', 'active', '')).toEqual(['link']);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
