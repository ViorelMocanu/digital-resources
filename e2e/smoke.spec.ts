import { builtPages, expect, test } from './site.ts';
import { PAGES_WITHOUT_H1 } from './known-gaps.ts';

for (const path of builtPages()) {
	test(`${path} loads with a title, a main heading and no script error`, async ({ page, errors }) => {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		expect((await page.title()).trim()).not.toBe('');
		await expect(page.locator('main')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveCount(PAGES_WITHOUT_H1.includes(path) ? 0 : 1);
		expect(errors).toEqual([]);
	});
}
