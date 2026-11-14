import { PAGE_KINDS, findingsOf } from './known-gaps.ts';
import { expect, test } from './site.ts';
import AxeBuilder from '@axe-core/playwright';

for (const { kind, path, findings, narrowOnly = [] } of PAGE_KINDS) {
	test(`${kind} (${path}) breaks no accessibility rule beyond the known ones`, async ({ page, narrow }) => {
		// A missing page would be answered with the not-found page, whose findings could equal the listed ones.
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		const found = findingsOf(await new AxeBuilder({ page }).analyze());
		const known = [...findings, ...(narrow ? narrowOnly : [])].sort();

		// Equal lists, by rule and element: a new finding fails the test, so does one element fixed while another of
		// the same rule breaks, and so does a known finding that was fixed but is still listed.
		expect(found).toEqual(known);
	});
}

test('an element outside every landmark is reported by its own selector', { tag: '@desktop-only' }, async ({ page }) => {
	await page.goto('/faq/');
	await page.evaluate(() => {
		const probe = document.createElement('p');
		probe.id = 'probe';
		probe.textContent = 'Text outside every landmark';
		document.body.append(probe);
	});
	expect(findingsOf(await new AxeBuilder({ page }).analyze())).toContain('region #probe');
});
