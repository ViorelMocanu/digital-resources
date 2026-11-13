/**
 * What is wrong with the site today and waits for Phase 5. The tests accept exactly these and fail on anything
 * else. They also fail when an entry here no longer happens, so the list cannot go stale: fix the page, then
 * remove the entry.
 */

/** Pages without a main heading. `/README/` is a stray Markdown file published as a page. */
export const PAGES_WITHOUT_H1: readonly string[] = ['/README/'];

/** One page of each kind, for the accessibility test. */
export const PAGE_KINDS: Readonly<Record<string, string>> = {
	'home': '/',
	'section': '/front-end/',
	'category': '/front-end/html/',
	'subcategory': '/front-end/html/semantica/',
	'resource list': '/r/',
	'resource': '/r/how-does-the-internet-work/',
	'tag list': '/t/',
	'tag': '/t/video/',
	'text page': '/faq/',
	'not found': '/404',
};

/** The axe rules each kind of page breaks today, by rule id. */
export const KNOWN_ACCESSIBILITY_FINDINGS: Readonly<Record<string, readonly string[]>> = {
	'home': ['label', 'region', 'skip-link'],
	'section': ['aria-allowed-role', 'heading-order', 'landmark-unique', 'region'],
	'category': ['aria-allowed-role', 'landmark-unique', 'region'],
	'subcategory': ['aria-allowed-role', 'landmark-unique', 'region'],
	'resource list': ['aria-allowed-role', 'heading-order', 'landmark-unique', 'region'],
	'resource': ['heading-order', 'region'],
	'tag list': ['region'],
	'tag': ['heading-order', 'region'],
	'text page': ['region'],
	'not found': ['region'],
};

/** What the narrow layout adds to the list above, by kind of page. */
export const KNOWN_NARROW_ONLY_FINDINGS: Readonly<Record<string, readonly string[]>> = {
	resource: ['color-contrast'],
};
