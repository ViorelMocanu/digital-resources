// The share card of each page: its address, the alt text the head gives it, the kind of page it names, and how the
// build reads a card back from a built page.
import { cardFromHtml, cardKind, shareCardAlt, shareCardPath } from '../src/utils/shareCard';
import { describe, expect, it } from 'vitest';

describe('shareCardPath', () => {
	it('names the home page card home', () => {
		expect(shareCardPath('/')).toBe('/og/home.jpg');
		expect(shareCardPath('')).toBe('/og/home.jpg');
	});

	it('names every other card after the page address, with or without the final slash', () => {
		expect(shareCardPath('/front-end/html')).toBe('/og/front-end/html.jpg');
		expect(shareCardPath('/front-end/html/')).toBe('/og/front-end/html.jpg');
		expect(shareCardPath('front-end/2/')).toBe('/og/front-end/2.jpg');
		expect(shareCardPath('/r/resilient-web-design')).toBe('/og/r/resilient-web-design.jpg');
		expect(shareCardPath('/404')).toBe('/og/404.jpg');
	});
});

describe('shareCardAlt', () => {
	it('says what the card shows, with the page title', () => {
		expect(shareCardAlt('Contactează-ne acum')).toBe('Cardul paginii „Contactează-ne acum” de pe resurse.dev: titlul scris cu alb pe fundal închis, lângă sigla site-ului.');
	});
});

describe('cardKind', () => {
	it('names the kind of page from the template the page gives the layout', () => {
		expect(cardKind('SectionPage')).toBe('Secțiune');
		expect(cardKind('CategoryPage')).toBe('Categorie');
		expect(cardKind('SubcategoryPage')).toBe('Subcategorie');
		expect(cardKind('ResourcePage')).toBe('Resursă');
		expect(cardKind('TagIndex')).toBe('Etichete');
		expect(cardKind('FAQPage TextPage')).toBe('Pagină');
	});
});

describe('cardFromHtml', () => {
	// Written by hand in the form Layout.astro prints, with the entities Astro writes in attribute values.
	const html =
		'<html><head><meta property="og:title" content="Tag: &quot;Carte&quot; &amp; altele">' +
		'<meta name="resurse:card" content="{&quot;kind&quot;:&quot;Resursă&quot;,&quot;trail&quot;:[&quot;Front End&quot;],&quot;facts&quot;:[{&quot;text&quot;:&quot;10/10&quot;}]}">' +
		'</head><body></body></html>';

	it('reads the title and the card data a built page carries', () => {
		expect(cardFromHtml(html, 'r/resilient-web-design')).toEqual({
			path: '/r/resilient-web-design',
			title: 'Tag: "Carte" & altele',
			kind: 'Resursă',
			trail: ['Front End'],
			facts: [{ text: '10/10' }],
		});
	});

	it('gives the home page the path /', () => {
		expect(cardFromHtml(html, '')?.path).toBe('/');
	});

	it('returns nothing for a page without card data, such as a redirect page', () => {
		expect(cardFromHtml('<html><head><title>Redirecting</title></head></html>', 'old')).toBeUndefined();
	});
});
