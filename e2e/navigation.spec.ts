import { expect, test } from './site.ts';
import type { Page } from '@playwright/test';

/**
 * Leave a mark on the document. A full page load makes a new document and the mark is gone; a navigation by the
 * client router keeps the document and the mark.
 * @param page The page.
 */
async function markDocument(page: Page): Promise<void> {
	await page.evaluate(() => {
		(globalThis as Record<string, unknown>)['e2eMark'] = 'same document';
	});
}

/**
 * Read the mark back.
 * @param page The page.
 * @returns True while the document is still the one that was marked.
 */
async function sameDocument(page: Page): Promise<boolean> {
	return page.evaluate(() => (globalThis as Record<string, unknown>)['e2eMark'] === 'same document');
}

// The check of docs/lessons.md, L-008: after an upgrade every page looked right and every link reloaded the page.
test('links move between pages without a full page load, and the back button works', async ({ page, errors, isMobile, viewport }) => {
	await page.goto('/');
	await markDocument(page);

	if (isMobile || (viewport?.width ?? 0) < 600) {
		const trigger = page.locator('#menuTrigger');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	}

	await page.locator('#menu a[href="/front-end"]').click();
	await page.waitForURL('**/front-end');
	await expect(page.locator('h1')).toHaveText('Resurse de Front End Development');
	expect(await sameDocument(page)).toBe(true);

	const card = page.locator('a.ResourceLink').first();
	const cardAddress = (await card.getAttribute('href')) ?? '';
	expect(cardAddress).toMatch(/^\/r\/[a-z0-9-]+$/);
	await card.click();
	await page.waitForURL(`**${cardAddress}`);
	await expect(page.locator('h1')).toHaveCount(1);
	expect(await sameDocument(page)).toBe(true);

	await page.goBack();
	await page.waitForURL('**/front-end');
	await expect(page.locator('h1')).toHaveText('Resurse de Front End Development');
	expect(await sameDocument(page)).toBe(true);

	await page.locator('a.ResourceTagLink').first().click();
	await page.waitForURL(/\/t\/[a-z0-9-]+$/);
	await expect(page.locator('h1')).toContainText('Tag:');
	expect(await sameDocument(page)).toBe(true);

	await page.locator('a.Logo').click();
	await page.waitForURL((url) => url.pathname === '/');
	await expect(page.locator('h1')).toHaveText('Resurse digitale: Resurse.dev');
	expect(await sameDocument(page)).toBe(true);

	expect(errors).toEqual([]);
});
