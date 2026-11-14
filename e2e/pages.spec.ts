import { builtPages, expect, test } from './site.ts';
import { readFileSync, statSync } from 'node:fs';
import { DEAD_LINKS } from './known-gaps.ts';
import { SITE_ROOT } from './server.ts';
import { join } from 'node:path';

/**
 * Whether the build holds a page or a file for an address, with or without its final slash.
 * @param address A path of the site, without query or fragment.
 * @returns True when the host would answer it from the build.
 */
function inBuild(address: string): boolean {
	const path = address.replace(/\/$/, '');
	return [join(SITE_ROOT, path, 'index.html'), join(SITE_ROOT, `${path}.html`), join(SITE_ROOT, path)].some(
		(file) => statSync(file, { throwIfNoEntry: false })?.isFile() === true
	);
}

/**
 * The HTML of a built page.
 * @param page The page address, as builtPages() gives it.
 * @returns The file's text.
 */
function htmlOf(page: string): string {
	return readFileSync(page === '/404' ? join(SITE_ROOT, '404.html') : join(SITE_ROOT, page, 'index.html'), 'utf8');
}

test('every link to the site leads to a built page or file, apart from the known dead links', { tag: '@desktop-only' }, () => {
	const dead = new Set<string>();
	for (const page of builtPages()) {
		for (const [, href = ''] of htmlOf(page).matchAll(/<a\b[^>]*?\shref="(\/(?!\/)[^"#?]*)/g)) {
			if (!inBuild(href)) dead.add(href);
		}
	}
	expect([...dead].sort()).toEqual([...DEAD_LINKS].sort());
});

test('no built page writes a rating over 10 as "(10)"', { tag: '@desktop-only' }, () => {
	const pages = builtPages().filter((page) => /class="InfoItemValue">[^<]* \(10\)</.test(htmlOf(page)));
	expect(pages).toEqual([]);
});

test.describe('the pages of Phase 5', { tag: '@desktop-only' }, () => {
	test('a resource page writes its rating over the scale', async ({ page }) => {
		// src/content/resources/how-does-the-web-work.md is rated 10.
		await page.goto('/r/how-does-the-web-work/');
		await expect(page.locator('.InfoItem:has(.IconRating) .InfoItemValue')).toHaveText('10/10');
	});

	test('a subcategory page shows its own text, not its category text', async ({ page }) => {
		// Hand-copied from src/content/subcategories/emmet.md and ide.md.
		await page.goto('/front-end/html/emmet/');
		await expect(page.locator('.HeroContent')).toHaveText('@TODO: Emmet');
		await expect(page.locator('.HeroContent')).not.toContainText('Lorem Ipsum');
		await page.goto('/front-end/unelte-utile-de-front-end/ide/');
		await expect(page.locator('.HeroContent')).toHaveText('@TODO: Integrated Development Environment');
	});

	test('a tag page marks the chip of its own tag, a resource page marks none', async ({ page }) => {
		await page.goto('/t/carte/');
		const active = page.locator('li.ResourceTag.Active');
		await expect(active).toHaveCount(1);
		await expect(active.locator('a')).toHaveAttribute('href', '/t/carte');
		// All five resources carry the tag free (src/content/resources/*.md).
		await page.goto('/t/free/');
		await expect(active).toHaveCount(5);
		await page.goto('/r/how-does-the-web-work/');
		await expect(active).toHaveCount(0);
	});

	for (const path of ['/termeni-si-conditii/', '/confidentialitate/', '/cookies/', '/faq/', '/contact/', '/front-end/']) {
		test(`the footer marks the link of ${path}`, async ({ page }) => {
			await page.goto(path);
			const active = page.locator('footer li.FooterItem.Active');
			await expect(active).toHaveCount(1);
			await expect(active.locator('a')).toHaveAttribute('href', path.replace(/\/$/, ''));
		});
	}

	test('a book shows the book icon, from its type, even with a second type tag', async ({ page }) => {
		// src/content/resources/resilient-web-design.md: type carte, tags carte and text; src/config.ts: carte is the book
		// icon (U+1F4D6), text the page icon (U+1F4C3). Escapes, as no file of this repository holds an emoji (AGENTS.md).
		await page.goto('/r/resilient-web-design/');
		await expect(page.locator('h1')).toContainText('\u{1F4D6}');
		await expect(page.locator('h1')).not.toContainText('\u{1F4C3}');
		await page.goto('/t/carte/');
		await expect(page.locator('a.ResourceLink[href="/r/resilient-web-design"]')).toContainText('\u{1F4D6}');
	});
});
