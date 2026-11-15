/**
 * What is wrong with the site today and waits for Phase 5. The tests accept exactly these and fail on anything
 * else. They also fail when an entry here no longer happens, so the list cannot go stale: fix the page, then
 * remove the entry.
 */

/** Pages without a main heading. */
export const PAGES_WITHOUT_H1: readonly string[] = [];

/** Files a page asks for that the build does not hold, as the smoke test records them, by page. */
export const MISSING_FILES: Readonly<Record<string, readonly string[]>> = {};

/**
 * Addresses of the site that built pages link to and the build does not hold. Empty since 2026-11-15: `/login` is a
 * placeholder page (the owner's answer D1 B), so any dead link fails the test.
 */
export const DEAD_LINKS: readonly string[] = [];

/**
 * What axe found, one line per rule and element, so two faults of one rule count twice and a fixed element cannot
 * hide a new one.
 * @param results The result of an axe run.
 * @param results.violations The broken rules, each with the elements that break it.
 * @returns Lines such as 'region #hero', sorted.
 */
export function findingsOf(results: { violations: readonly { id: string; nodes: readonly { target: readonly unknown[] }[] }[] }): string[] {
	// The transition scope is a hash of the component's source, so any edit to a component would change it.
	const stable = (selector: string) => selector.replace(/\[data-astro-transition-scope="[^"]*"\]/g, '[data-astro-transition-scope]');
	return results.violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id} ${stable(node.target.flat().join(' >>> '))}`)).sort();
}

/** The home page prints the repository README, whose task list has 24 checkboxes without a label. */
const README_CHECKBOXES = Array.from({ length: 24 }, (_, i) => `.task-list-item:nth-child(${i + 1}) > input[type="checkbox"]`);

/** Every element of the resource page that sits outside a landmark: its hero and its information list. */
const RESOURCE_PAGE_REGIONS = [
	'.HeroResourceLink',
	'.HeroVisual',
	'.IconEnglish > .SROnly',
	'.IconRating > .SROnly',
	'.IconTime > .SROnly',
	...[1, 2, 3, 8].flatMap((n) => [`.InfoItem:nth-child(${n}) > .InfoItemLabel > .IconType.Icon > .SROnly`, `.InfoItem:nth-child(${n}) > .InfoItemLabel > .InfoItemText`]),
	'.InfoItem:nth-child(8) > strong',
	'.InfoItemAuthor > .InfoItemLabel > .IconType.Icon > .SROnly',
	'.InfoItemAuthor > .InfoItemLabel > .InfoItemText',
	'.InfoItemLangText',
	'.InfoItemStandalone.InfoItem:nth-child(4) > .InfoItemLabel > .IconType.Icon > .SROnly',
	'.InfoItemStandalone.InfoItem:nth-child(4) > .InfoItemLabel > .InfoItemText',
	'.InfoItemTags > .InfoItemLabel > .IconType.Icon > .SROnly',
	'.InfoItemTags > .InfoItemLabel > .InfoItemText',
	'.InfoItemValuePrice',
	'.InfoList > .InfoItem:nth-child(4) > .InfoItemLabel > .IconType.Icon > .SROnly',
	'.InfoList > .InfoItem:nth-child(4) > .InfoItemLabel > .InfoItemText',
	'.ResourceLocationList',
	'.ResourceTags',
	'.Type-obligatoriu',
	'.Type-video',
	'a[title="Vizitează site-ul autorului"]',
	'li[data-astro-transition-scope] > .InfoItemLabel > .InfoItemText',
	'li[data-astro-transition-scope] > strong',
	'li[data-astro-transition-scope] > .InfoItemLabel > .InfoItemText',
	'li[data-astro-transition-scope] > strong',
	'p[data-astro-transition-scope]',
	'section',
].map((selector) => `region ${selector}`);

/** One kind of page, for the accessibility test. */
export interface PageKind {
	kind: string;
	/** One page of this kind. */
	path: string;
	/** What the page breaks today, by rule and element, as `findingsOf` writes it. */
	findings: readonly string[];
	/** What the narrow layout adds to `findings`. */
	narrowOnly?: readonly string[];
}

export const PAGE_KINDS: readonly PageKind[] = [
	{ kind: 'home', path: '/', findings: [...README_CHECKBOXES.map((checkbox) => `label ${checkbox}`), 'region #skip', 'region .Framework', 'skip-link #skip'] },
	{
		kind: 'section',
		path: '/front-end/',
		findings: [
			'aria-allowed-role fieldset[role="search"]',
			'heading-order h4[data-astro-transition-scope]',
			'landmark-unique .Breadcrumbs',
			'landmark-unique .ResourceItem:nth-child(1) > aside',
			'region h1',
			'region section',
		],
	},
	{
		kind: 'category',
		path: '/front-end/html/',
		findings: ['aria-allowed-role fieldset[role="search"]', 'landmark-unique .Breadcrumbs', 'region .HeroVisual', 'region h1', 'region section'],
	},
	{
		kind: 'subcategory',
		path: '/front-end/html/semantica/',
		findings: ['aria-allowed-role fieldset[role="search"]', 'landmark-unique .Breadcrumbs', 'region h1', 'region section'],
	},
	{
		kind: 'resource list',
		path: '/r/',
		findings: [
			'aria-allowed-role fieldset[role="search"]',
			'heading-order h4[data-astro-transition-scope]',
			'landmark-unique .ResourceItem:nth-child(1) > aside',
			'region h1',
			'region section',
		],
	},
	{
		kind: 'resource',
		path: '/r/how-does-the-internet-work/',
		findings: ['heading-order h5', ...RESOURCE_PAGE_REGIONS],
		narrowOnly: ['color-contrast .Type-obligatoriu', 'color-contrast .Type-video'],
	},
	{ kind: 'tag list', path: '/t/', findings: ['region #hero', 'region section'] },
	{ kind: 'tag', path: '/t/video/', findings: ['heading-order h4', 'region #hero', 'region section'] },
	{ kind: 'text page', path: '/faq/', findings: ['region #hero', 'region section'] },
	{ kind: 'not found', path: '/404', findings: ['region #hero', 'region section'] },
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
