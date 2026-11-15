import { cardFromHtml, shareCardPath } from '../utils/shareCard';
import { dirname, join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { renderShareCard } from '../utils/shareCardImage';

/** How many cards are drawn at once: drawing is CPU work, and sharp runs on its own threads. */
const AT_ONCE = 8;

/**
 * The built HTML file of a page.
 * @param root The build output folder.
 * @param pathname The page's path as the build names it: '' for the home page, '404', 'front-end/html'.
 * @returns The file's text, or undefined when the build holds no HTML file for it.
 */
async function builtHtml(root: string, pathname: string): Promise<string | undefined> {
	const path = pathname.replace(/^\/+|\/+$/g, '');
	for (const file of [join(root, path, 'index.html'), join(root, `${path}.html`)]) {
		try {
			return await readFile(file, 'utf8');
		} catch {
			// Not this form; try the next.
		}
	}
	return undefined;
}

/**
 * Draws the share card of every built page into `og/` of the build output, after the pages are written: the same
 * hook the sitemap uses, so the cards land where the pages are. Each card is read back from its page's HTML, so it
 * shows exactly the title and trail the page has, and every page, list pages after the first included, gets one.
 * @returns The integration.
 */
export default function shareCards(): AstroIntegration {
	return {
		name: 'resurse-share-cards',
		hooks: {
			'astro:build:done': async ({ dir, pages, logger }) => {
				const root = fileURLToPath(dir);
				const queue = pages.map((page) => page.pathname);
				let drawn = 0;
				const worker = async () => {
					for (let pathname = queue.shift(); pathname !== undefined; pathname = queue.shift()) {
						const html = await builtHtml(root, pathname);
						const card = html === undefined ? undefined : cardFromHtml(html, pathname);
						if (card === undefined) continue;
						const file = join(root, shareCardPath(pathname));
						await mkdir(dirname(file), { recursive: true });
						await writeFile(file, await renderShareCard(card));
						drawn += 1;
					}
				};
				await Promise.all(Array.from({ length: AT_ONCE }, worker));
				logger.info(`${drawn} share cards drawn into og/`);
			},
		},
	};
}
