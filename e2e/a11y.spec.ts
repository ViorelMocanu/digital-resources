import { KNOWN_ACCESSIBILITY_FINDINGS, KNOWN_NARROW_ONLY_FINDINGS, PAGE_KINDS } from './known-gaps.ts';
import { expect, test } from './site.ts';
import AxeBuilder from '@axe-core/playwright';

for (const [kind, path] of Object.entries(PAGE_KINDS)) {
	test(`${kind} (${path}) breaks no accessibility rule beyond the known ones`, async ({ page }, testInfo) => {
		await page.goto(path);
		const results = await new AxeBuilder({ page }).analyze();
		const found = [...new Set(results.violations.map((violation) => violation.id))].sort();
		const narrow = testInfo.project.name === 'mobile' ? (KNOWN_NARROW_ONLY_FINDINGS[kind] ?? []) : [];
		const known = [...(KNOWN_ACCESSIBILITY_FINDINGS[kind] ?? []), ...narrow].sort();

		// Equal lists: a new finding fails the test, and so does a known one that was fixed but is still listed.
		expect(found).toEqual(known);
	});
}
