import type { ShareCard } from './shareCardImage';

/**
 * The address of a page's share card, the image a link preview shows: `/` has `/og/home.jpg`, `/front-end/html` has
 * `/og/front-end/html.jpg`. The build draws one card for every built page (`src/integrations/shareCards.ts`).
 * @param pathname The page's path, with or without the slashes at either end.
 * @returns The card's path on the site.
 */
export function shareCardPath(pathname: string): string {
	return `/og/${pathname.replace(/^\/+|\/+$/g, '') || 'home'}.jpg`;
}

/**
 * The alt text of a share card: what the image shows, not a caption (Open Graph asks for a description of it).
 * @param title The page title the card shows.
 * @returns The text for `og:image:alt`.
 */
export function shareCardAlt(title: string): string {
	return `Cardul paginii „${title}” de pe resurse.dev: titlul scris cu alb pe fundal închis, lângă sigla site-ului.`;
}

/**
 * The chip a resource's card shows for its type, in the colour the site gives the type (`--accent-*` in
 * src/style/style.scss).
 */
export const RESOURCE_TYPE_CHIPS: Readonly<Record<'text' | 'video' | 'curs' | 'carte', { text: string; color: string }>> = {
	text: { text: 'Text', color: '#939' },
	video: { text: 'Video', color: '#f30' },
	curs: { text: 'Curs', color: '#f90' },
	carte: { text: 'Carte', color: '#12a' },
};

/** The kind of page a card names, by the first class of the template a page gives the layout. */
const KINDS: Readonly<Record<string, string>> = {
	SectionPage: 'Secțiune',
	CategoryPage: 'Categorie',
	SubcategoryPage: 'Subcategorie',
	ResourcePage: 'Resursă',
	TagIndex: 'Etichete',
};

/**
 * The kind of page, as the card names it.
 * @param template The classes the page gives the layout, such as 'FAQPage TextPage'.
 * @returns 'Secțiune', 'Categorie', 'Subcategorie', 'Resursă', 'Etichete', or 'Pagină' for every other page.
 */
export function cardKind(template: string): string {
	return KINDS[template.split(/\s+/)[0] ?? ''] ?? 'Pagină';
}

/**
 * Undoes the entities Astro writes in an attribute value.
 * @param value The attribute value as it stands in the HTML.
 * @returns The text.
 */
function unescapeAttribute(value: string): string {
	return value.replace(/&(quot|amp|lt|gt|#39|#x27);/g, (_, name: string) => ({ 'quot': '"', 'amp': '&', 'lt': '<', 'gt': '>', '#39': "'", '#x27': "'" })[name] ?? '');
}

/** The two head tags a card is read from, as Layout.astro writes them. */
const TITLE_TAG = /<meta property="og:title" content="([^"]*)"/;
const CARD_TAG = /<meta name="resurse:card" content="([^"]*)"/;

/**
 * Reads a page's share card back from its built HTML: the title from `og:title`, the rest from the `resurse:card`
 * tag the layout writes.
 * @param html The built page.
 * @param pathname The page's path as the build names it ('' for the home page, 'front-end/html' or with slashes).
 * @returns The card, or undefined for a page the layout did not write (a redirect page).
 */
export function cardFromHtml(html: string, pathname: string): ShareCard | undefined {
	const title = TITLE_TAG.exec(html)?.[1];
	const data = CARD_TAG.exec(html)?.[1];
	if (title === undefined || data === undefined) return undefined;
	const { kind, trail, facts } = JSON.parse(unescapeAttribute(data)) as Omit<ShareCard, 'path' | 'title'>;
	return { path: `/${pathname.replace(/^\/+|\/+$/g, '')}`, title: unescapeAttribute(title), kind, trail, facts };
}
