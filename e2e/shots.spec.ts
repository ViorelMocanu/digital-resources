import { expect, test } from './site.ts';
import { PAGE_KINDS } from './known-gaps.ts';

// Compares one page of each kind, at both sizes, with its committed reference screenshot (the owner's answer of
// 2026-11-15: 20 images; the build comparison covers every page). The references are taken in the CI workflow, on
// one fixed system, and compared only there: text is drawn differently on every system. Locally this file is left
// out (see `testIgnore` in playwright.config.ts).

/**
 * The file name of a page's screenshot: `/` is `home`, `/front-end/html/` is `front-end--html`.
 * @param path The page address.
 * @returns The name, without an extension.
 */
function shotName(path: string): string {
	return path.replace(/^\/|\/$/g, '').replaceAll('/', '--') || 'home';
}

for (const { kind, path } of PAGE_KINDS) {
	test(`${path} (${kind}) looks like its reference screenshot`, async ({ page }) => {
		await page.goto(path);
		await expect(page).toHaveScreenshot(`${shotName(path)}.png`, { fullPage: true });
	});
}
