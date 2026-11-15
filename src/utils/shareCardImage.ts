// Relative, not '@config': the build step that draws the cards is loaded with astro.config.mjs, before the aliases.
import { SITE_NAME } from '../config';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

/** What a share card shows. */
export interface ShareCard {
	/** The page's path: `/` for the home page. Printed at the foot of the card. */
	path: string;
	title: string;
	/** What kind of page it is, in a chip at the top right: 'Resursă', 'Categorie'. */
	kind: string;
	/** Where the page sits, above the title: section, then category. */
	trail: readonly string[];
	/** Short facts in chips at the foot: the type of a resource, its rating. */
	facts: readonly { text: string; color?: string }[];
}

/** One element of the tree satori draws: a plain object in place of JSX. */
interface CardNode {
	type: string;
	props: { style?: Record<string, string | number>; children?: string | CardNode | (string | CardNode)[]; src?: string; width?: number; height?: number };
}

const WIDTH = 1200;
const HEIGHT = 630;
const FONT = 'Atkinson Hyperlegible';
// The site's dark theme (src/style/style.scss): --dark-150, --dark-200, --light-600, --medium-500, --accent-400.
const COLOR = { background: '#0a0a0a', chip: '#222', muted: '#bdbdbd', faint: '#888', accent: '#2f8ded', text: '#fff' };
/** A title longer than this is cut at a word, so the card never runs out of room. */
const TITLE_LIMIT = 110;

/**
 * The title as the card prints it, and its size: the shorter the title, the larger it is drawn.
 * @param title The page title.
 * @returns The text, cut at a word with an ellipsis past 110 characters, and its font size in pixels.
 */
export function fitTitle(title: string): { text: string; size: number } {
	const size = title.length <= 36 ? 76 : title.length <= 72 ? 64 : 52;
	if (title.length <= TITLE_LIMIT) return { text: title, size };
	const cut = title.slice(0, TITLE_LIMIT);
	const space = cut.lastIndexOf(' ');
	return { text: `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`, size };
}

/**
 * Shorthand for one element of the tree.
 * @param type The element: 'div', 'span' or 'img'.
 * @param style Its style, in the subset of CSS satori draws.
 * @param children Its text or elements.
 * @returns The element.
 */
function node(type: string, style: Record<string, string | number>, children?: CardNode['props']['children']): CardNode {
	return { type, props: children === undefined ? { style } : { style, children } };
}

/**
 * The tree of elements of a card, in the site's dark theme: the logo and site name, the kind of page, the trail, the
 * title, the facts and the address.
 * @param card What the card shows.
 * @param logo The logo as a data URI.
 * @returns The tree satori draws.
 */
export function shareCardTree(card: ShareCard, logo: string): CardNode {
	const { text, size } = fitTitle(card.title);
	const address = `${SITE_NAME}${card.path.replace(/\/+$/, '')}`;
	const chip = (fact: { text: string; color?: string }) =>
		node('span', { fontSize: 28, fontWeight: 700, padding: '6px 16px', borderRadius: 8, background: fact.color ?? COLOR.chip, color: COLOR.text }, fact.text);

	return node(
		'div',
		{
			display: 'flex',
			flexDirection: 'column',
			width: WIDTH,
			height: HEIGHT,
			// The padding and the top border are inside the card's size, not added to it.
			boxSizing: 'border-box',
			padding: '48px 64px 52px',
			background: COLOR.background,
			borderTop: `12px solid ${COLOR.accent}`,
			color: COLOR.text,
			fontFamily: FONT,
		},
		[
			node('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
				node('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
					{ type: 'img', props: { src: logo, width: 72, height: 72, style: { width: 72, height: 72 } } },
					node('span', { fontSize: 36, fontWeight: 700 }, SITE_NAME),
				]),
				node('span', { fontSize: 28, fontWeight: 700, padding: '6px 20px', borderRadius: 999, border: `2px solid ${COLOR.accent}`, color: COLOR.accent }, card.kind),
			]),
			node('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
				...(card.trail.length > 0 ? [node('div', { display: 'flex', fontSize: 30, color: COLOR.muted, marginBottom: 18 }, card.trail.join(' › '))] : []),
				node('div', { display: 'flex', fontSize: size, fontWeight: 700, lineHeight: 1.15 }, text),
			]),
			node('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }, [
				node('div', { display: 'flex', gap: 12 }, card.facts.map(chip)),
				node('span', { fontSize: 26, color: COLOR.faint }, address.length > 60 ? `${address.slice(0, 59)}…` : address),
			]),
		]
	);
}

/** The two weights of the site's font, read from the files the site serves. Satori reads WOFF2. */
const fonts = (['regular', 'bold'] as const).map((weight) => ({
	name: FONT,
	data: readFileSync(join(process.cwd(), `public/font/atkinson-hyperlegible-${weight}.woff2`)),
	weight: weight === 'bold' ? (700 as const) : (400 as const),
	style: 'normal' as const,
}));

/** The logo's colours in the site's dark theme, by the class each path has in public/favicon.svg. */
const LOGO_FILLS: Readonly<Record<string, string>> = { light: '#FDFDFD', medium: '#333333', dark: COLOR.accent };

let logoPromise: Promise<string> | undefined;

/**
 * The logo of public/favicon.svg in its dark-theme colours, drawn once as a PNG data URI: the file's own colours
 * come from a style sheet with a media query, which the card renderer does not read.
 * @returns The data URI.
 */
function logoDataUri(): Promise<string> {
	logoPromise ??= (async () => {
		const source = readFileSync(join(process.cwd(), 'public/favicon.svg'), 'utf8');
		const paths = [...source.matchAll(/<path class="(\w+)" d="([^"]+)"/g)].map(([, kind = '', d = '']) => `<path d="${d}" fill="${LOGO_FILLS[kind] ?? COLOR.text}"/>`);
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">${paths.join('')}</svg>`;
		const png = await sharp(Buffer.from(svg)).resize(144, 144).png().toBuffer();
		return `data:image/png;base64,${png.toString('base64')}`;
	})();
	return logoPromise;
}

/**
 * Draws a share card as a JPEG of 1200 x 630: under WhatsApp's 600 KB limit, in a format every platform reads.
 * @param card What the card shows.
 * @returns The image.
 * @throws {Error} When the text has a character the site's font lacks, naming the text, so the build stops instead
 *   of printing an empty box.
 */
export async function renderShareCard(card: ShareCard): Promise<Buffer> {
	const svg = await satori(shareCardTree(card, await logoDataUri()), {
		width: WIDTH,
		height: HEIGHT,
		fonts,
		// Satori asks for another font only when no loaded font has a character; the card has no fallback font.
		loadAdditionalAsset: async (code: string, segment: string) => {
			throw new Error(`Cardul paginii ${card.path} are caractere pe care fontul site-ului nu le are (${code}): „${segment}” în „${card.title}”`);
		},
	});
	return sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}
