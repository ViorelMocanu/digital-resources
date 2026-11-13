/**
 * What is wrong with the site today and waits for Phase 5. The tests accept exactly these and fail on anything
 * else. They also fail when an entry here no longer happens, so the list cannot go stale: fix the page, then
 * remove the entry.
 */

/** Pages without a main heading. `/README/` is a stray Markdown file published as a page. */
export const PAGES_WITHOUT_H1: readonly string[] = ['/README/'];

/** One kind of page, for the accessibility test. */
export interface PageKind {
	kind: string;
	/** One page of this kind. */
	path: string;
	/** The axe rules the page breaks today, by rule id. */
	findings: readonly string[];
	/** What the narrow layout adds to `findings`. */
	narrowOnly?: readonly string[];
}

export const PAGE_KINDS: readonly PageKind[] = [
	{ kind: 'home', path: '/', findings: ['label', 'region', 'skip-link'] },
	{ kind: 'section', path: '/front-end/', findings: ['aria-allowed-role', 'heading-order', 'landmark-unique', 'region'] },
	{ kind: 'category', path: '/front-end/html/', findings: ['aria-allowed-role', 'landmark-unique', 'region'] },
	{ kind: 'subcategory', path: '/front-end/html/semantica/', findings: ['aria-allowed-role', 'landmark-unique', 'region'] },
	{ kind: 'resource list', path: '/r/', findings: ['aria-allowed-role', 'heading-order', 'landmark-unique', 'region'] },
	{ kind: 'resource', path: '/r/how-does-the-internet-work/', findings: ['heading-order', 'region'], narrowOnly: ['color-contrast'] },
	{ kind: 'tag list', path: '/t/', findings: ['region'] },
	{ kind: 'tag', path: '/t/video/', findings: ['heading-order', 'region'] },
	{ kind: 'text page', path: '/faq/', findings: ['region'] },
	{ kind: 'not found', path: '/404', findings: ['region'] },
];
