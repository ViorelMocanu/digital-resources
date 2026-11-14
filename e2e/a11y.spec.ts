import { expect, test } from './site.ts';
import AxeBuilder from '@axe-core/playwright';
import { PAGE_KINDS } from './known-gaps.ts';

for (const { kind, path, findings, narrowOnly = [] } of PAGE_KINDS) {
	test(`${kind} (${path}) breaks no accessibility rule beyond the known ones`, async ({ page, narrow }) => {
		// A missing page would be answered with the not-found page, whose findings could equal the listed ones.
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		const results = await new AxeBuilder({ page }).analyze();
		const found = [...new Set(results.violations.map((violation) => violation.id))].sort();
		const known = [...findings, ...(narrow ? narrowOnly : [])].sort();

		// Equal lists: a new finding fails the test, and so does a known one that was fixed but is still listed.
		expect(found).toEqual(known);
	});
}
