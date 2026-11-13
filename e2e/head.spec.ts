import { builtPages, expect, test } from './site.ts';

for (const path of builtPages()) {
	test(`${path} has a language, its own canonical address and the pre-launch robots tag`, async ({ page }) => {
		await page.goto(path);
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
}
