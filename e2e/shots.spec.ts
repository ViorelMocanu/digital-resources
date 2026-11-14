import { builtPages, expect, test } from './site.ts';
import { sizesFor } from './known-gaps.ts';

// Compares every page with its committed reference screenshot. The references are taken in the CI workflow, on one
// fixed system, and compared only there: text is drawn differently on every system. Locally this file is left out
// (see `testIgnore` in playwright.config.ts).

/**
 * The file name of a page's screenshot: `/` is `home`, `/front-end/html/` is `front-end--html`.
 * @param path The page address.
 * @returns The name, without an extension.
 */
function shotName(path: string): string {
	return path.replace(/^\/|\/$/g, '').replaceAll('/', '--') || 'home';
}

for (const path of builtPages()) {
	test(`${path} looks like its reference screenshot`, sizesFor(path), async ({ page }) => {
		await page.goto(path);
		await expect(page).toHaveScreenshot(`${shotName(path)}.png`, { fullPage: true });
	});
}
