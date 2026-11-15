// The share card image: what it shows, its size and format, and the characters it refuses.
import { describe, expect, it } from 'vitest';
import { fitTitle, renderShareCard, shareCardTree } from '../src/utils/shareCardImage';
import sharp from 'sharp';

const CARD = {
	path: '/r/resilient-web-design',
	title: 'Resilient Web Design',
	kind: 'Resursă',
	trail: ['Front End', 'Introducere în Front End'],
	facts: [{ text: 'Carte', color: '#12a' }, { text: '10/10' }],
};

describe('shareCardTree', () => {
	it('puts the title, the kind, the trail, the facts and the address on the card', () => {
		const text = JSON.stringify(shareCardTree(CARD, 'data:image/png;base64,'));
		for (const part of ['Resilient Web Design', 'Resursă', 'Front End › Introducere în Front End', 'Carte', '10/10', 'resurse.dev/r/resilient-web-design']) {
			expect(text).toContain(part);
		}
	});

	it('writes the home page address as the site name alone', () => {
		expect(JSON.stringify(shareCardTree({ ...CARD, path: '/' }, ''))).not.toContain('resurse.dev/"');
	});
});

describe('fitTitle', () => {
	it('keeps a short title whole, in the largest size', () => {
		expect(fitTitle('Resilient Web Design')).toEqual({ text: 'Resilient Web Design', size: 76 });
	});

	it('cuts a title longer than 110 characters at a word, with an ellipsis, in the smallest size', () => {
		const words = Array.from({ length: 30 }, (_, i) => `cuvânt${i}`).join(' ');
		const { text, size } = fitTitle(words);
		expect(size).toBe(52);
		expect(text.endsWith('…')).toBe(true);
		expect(text.length).toBeLessThanOrEqual(111);
		expect(words.startsWith(text.slice(0, -1))).toBe(true);
		expect(text.slice(0, -1).endsWith(' ')).toBe(false);
	});
});

describe('renderShareCard', () => {
	it('draws a JPEG of 1200 x 630 under 600 KB', async () => {
		const image = await renderShareCard(CARD);
		const { format, width, height } = await sharp(image).metadata();
		expect({ format, width, height }).toEqual({ format: 'jpeg', width: 1200, height: 630 });
		expect(image.length).toBeLessThan(600 * 1024);
	}, 30_000);

	it('refuses a character the font lacks and names it, so a card never shows an empty box', async () => {
		await expect(renderShareCard({ ...CARD, title: 'Учебник HTML' })).rejects.toThrow(/Учебник/);
	}, 30_000);
});
