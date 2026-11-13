// astro-capo's <Head> lost every component script placed inside it on Astro 5 and later (lesson L-008): the client
// router's script never reached the page and every navigation became a full page load. No screenshot shows that.
// The fix is a pnpm patch of the package. These tests fail if the patch is dropped, renamed or not applied.
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the patch file exists and pnpm is told to apply it', () => {
	expect(existsSync(new URL('../patches/astro-capo@0.0.1.patch', import.meta.url))).toBe(true);
	expect(read('../pnpm-workspace.yaml')).toContain('astro-capo@0.0.1: patches/astro-capo@0.0.1.patch');
});

test('the installed astro-capo keeps the scripts of the head', () => {
	expect(read('../node_modules/astro-capo/src/Head.ts')).toContain('head += chunkToString(result, await renderSlotToString(result, slots.default));');
});

test('the layout still puts the client router inside the sorted head', () => {
	const layout = read('../src/layouts/Layout.astro');
	expect(layout).toContain("import { Head } from 'astro-capo';");
	expect(layout).toMatch(/<Head>[\s\S]*<ClientRouter fallback="none" \/>[\s\S]*<\/Head>/);
});
