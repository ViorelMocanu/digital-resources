import { PAGES_WITHOUT_H1, PAGE_KINDS } from './known-gaps.ts';
import { builtPages, expect, test } from './site.ts';

const onePerKind = new Set(PAGE_KINDS.map((kind) => kind.path));

for (const path of builtPages()) {
	// Every page is loaded at the desktop size. The narrow project loads one page of each kind: what this test
	// checks does not depend on the width, apart from a script error that only a narrow layout could raise.
	const details = onePerKind.has(path) ? {} : { tag: '@desktop-only' };

	test(`${path} loads with a title, a main heading, its head tags and no script error`, details, async ({ page, errors, narrow }) => {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		expect((await page.title()).trim()).not.toBe('');
		await expect(page.locator('main')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveCount(PAGES_WITHOUT_H1.includes(path) ? 0 : 1);
		expect(errors).toEqual([]);

		// The head of a page does not depend on the width, so it is checked once.
		if (narrow) return;
		await test.step('the head has a language, its own canonical address and the pre-launch robots tag', async () => {
			await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

			const canonical = page.locator('link[rel="canonical"]');
			await expect(canonical).toHaveCount(1);
			// The canonical address always ends with a slash; the not-found page is served without one.
			const expected = path.endsWith('/') ? path : `${path}/`;
			expect(new URL((await canonical.getAttribute('href')) ?? '').pathname).toBe(expected);

			// Until launch every page asks search engines to stay away (the INDEXABLE switch in src/config.ts).
			const robots = page.locator('meta[name="robots"]');
			await expect(robots).toHaveCount(1);
			await expect(robots).toHaveAttribute('content', 'noindex, nofollow');
		});
	});
}
