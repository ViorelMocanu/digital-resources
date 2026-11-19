import { MISSING_FILES, PAGES_WITHOUT_H1, PAGE_KINDS, sizesFor } from './known-gaps.ts';
import { builtPages, expect, test, withoutSlash } from './site.ts';
import { SITE_ROOT } from './server.ts';
import { join } from 'node:path';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const pages = builtPages();

/**
 * The pages that have a date of their own, and that date in ISO 8601, written by hand from the `modDate` of each
 * file in src/content/resources/ (all in UTC). Every other page prints no publication date.
 */
const DATED_PAGES: Readonly<Record<string, string>> = {
	'/r/complete-beginners-guide-to-information-architecture/': '2023-10-15T19:48:00.000Z',
	'/r/how-does-the-internet-work/': '2011-10-05T14:48:00.000Z',
	'/r/how-does-the-web-work/': '2023-10-12T20:48:00.000Z',
	'/r/odin-project-web-development/': '2011-10-05T14:48:00.000Z',
	'/r/resilient-web-design/': '2023-10-12T14:48:00.000Z',
};

// The narrow project and the accessibility test load only these pages, so one that left the build must not leave quietly.
test('the page of every kind is a built page', { tag: '@desktop-only' }, () => {
	expect(PAGE_KINDS.map((kind) => kind.path).filter((path) => !pages.includes(path))).toEqual([]);
});

for (const path of pages) {
	// Every page is loaded at the desktop size. The narrow project loads one page of each kind: what this test
	// checks does not depend on the width, apart from a script error that only a narrow layout could raise.
	test(`${path} loads with a title, a main heading, its head tags and no script error`, sizesFor(path), async ({ page, errors, narrow }) => {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		expect((await page.title()).trim()).not.toBe('');
		await expect(page.locator('main')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveCount(PAGES_WITHOUT_H1.includes(path) ? 0 : 1);
		// No script error and no missing file, beyond the files listed as missing today.
		expect(errors).toEqual(MISSING_FILES[path] ?? []);

		// The head of a page does not depend on the width, so it is checked once.
		if (narrow) return;
		await test.step('the head has a language, its own canonical address and the pre-launch robots tag', async () => {
			await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

			// Until launch every page asks search engines to stay away (the INDEXABLE switch in src/config.ts).
			const robots = page.locator('meta[name="robots"]');
			await expect(robots).toHaveCount(1);
			await expect(robots).toHaveAttribute('content', 'noindex, nofollow');

			const canonical = page.locator('link[rel="canonical"]');
			// The not-found page is served at every missing address, so it names no address of its own (the owner's
			// answer of 2026-11-15 on the Phase 5 findings). Until then it named /404.
			if (path === '/404') {
				await expect(canonical).toHaveCount(0);
				await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
				return;
			}
			await expect(canonical).toHaveCount(1);
			// The canonical address names the page as every internal link does, without the final slash; the home page
			// stays `/`. (Until Phase 5 it ended with a slash that the host's trailingSlash rule strips.)
			const expected = withoutSlash(path);
			const href = (await canonical.getAttribute('href')) ?? '';
			expect(new URL(href).pathname).toBe(expected);
			await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', href);
		});

		await test.step('the share tags name the page card: a JPEG of 1200 x 630 under 600 KB, with its alt text', async () => {
			const meta = (property: string) => page.locator(`meta[property="${property}"]`);
			const title = (await meta('og:title').getAttribute('content')) ?? '';
			const image = (await meta('og:image').getAttribute('content')) ?? '';
			// Every page has its own card, named after its address: `/` is `home`, `/front-end/html/` is `front-end/html`.
			expect(image).toBe(`https://resurse.dev/og/${path.replace(/^\/|\/$/g, '') || 'home'}.jpg`);
			const file = join(SITE_ROOT, new URL(image).pathname);
			const { format, width, height } = await sharp(file).metadata();
			expect({ format, width, height }).toEqual({ format: 'jpeg', width: 1200, height: 630 });
			// WhatsApp, the strictest of the platforms that publish a limit, shows no image over 600 KB.
			expect(statSync(file).size).toBeLessThan(600 * 1024);
			await expect(meta('og:image:type')).toHaveAttribute('content', 'image/jpeg');
			await expect(meta('og:image:width')).toHaveAttribute('content', '1200');
			await expect(meta('og:image:height')).toHaveAttribute('content', '630');
			expect((await meta('og:image:alt').getAttribute('content')) ?? '').toContain(title);
			// WhatsApp and LinkedIn need the description as an Open Graph tag too.
			const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
			await expect(meta('og:description')).toHaveAttribute('content', description);
			// X reads its tags by name; the fallback to property is not documented any more.
			await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
			await expect(page.locator('meta[property^="twitter:"]')).toHaveCount(0);
			// Dropped from Open Graph in 2011; an empty app id; a publisher that must be a Facebook page address.
			for (const gone of ['og:email', 'fb:app_id', 'article:publisher']) await expect(meta(gone)).toHaveCount(0);
			// The article:* dates belong to the article type, so a page with a date of its own is an article.
			await expect(meta('og:type')).toHaveAttribute('content', DATED_PAGES[path] === undefined ? 'website' : 'article');
		});

		await test.step('the head is printed as written, with the client router script once', async () => {
			await expect(page.locator('head')).not.toHaveAttribute('data-capo');
			await expect(page.locator('head script[src*="/ClientRouter."]')).toHaveCount(1);
		});

		await test.step('a page prints a publication date only when it has one, in ISO 8601', async () => {
			const date = DATED_PAGES[path];
			for (const property of ['article:published_time', 'article:modified_time']) {
				const tag = page.locator(`meta[property="${property}"]`);
				if (date === undefined) await expect(tag).toHaveCount(0);
				else await expect(tag).toHaveAttribute('content', date);
			}
		});
	});
}
