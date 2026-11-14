/**
 * What is wrong with the site today and waits for Phase 5. The tests accept exactly these and fail on anything
 * else. They also fail when an entry here no longer happens, so the list cannot go stale: fix the page, then
 * remove the entry.
 */

/** Pages without a main heading. `/README/` is a stray Markdown file published as a page. */
export const PAGES_WITHOUT_H1: readonly string[] = ['/README/'];

/**
 * Files a page asks for that the build does not hold, as the smoke test records them. The seven category pages name
 * their image by its path in the source tree, so the image is broken on the live site too.
 */
export const MISSING_FILES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
	[
		'/back-end/introducere-in-back-end/',
		'/front-end/css/',
		'/front-end/experienta-utilizatorului/',
		'/front-end/html/',
		'/front-end/introducere-in-front-end/',
		'/front-end/mobile-first-responsive-design/',
		'/front-end/unelte-utile-de-front-end/',
	].map((path) => [path, ['404 /src/content/sections/front-end.svg']])
);

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

/**
 * The test details that decide at which sizes a page is loaded: the page of each kind at both sizes, every other
 * page at the desktop size only (the narrow project leaves out the tests tagged `@desktop-only`).
 * @param path The page address.
 * @returns The details to pass to `test`.
 */
export function sizesFor(path: string): { tag?: string } {
	return PAGE_KINDS.some((kind) => kind.path === path) ? {} : { tag: '@desktop-only' };
}
