import { builtPages, expect, test } from './site.ts';
import { SITE_ROOT } from './server.ts';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * The addresses one sitemap file lists.
 * @param file The file's path in the build.
 * @returns Every `<loc>` value, in file order.
 */
function locsOf(file: string): string[] {
	return [...readFileSync(join(SITE_ROOT, file), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');
}

/**
 * A page's path without its final slash; the home page stays `/`.
 * @param path A path of the site.
 * @returns The path as the internal links write it.
 */
function withoutSlash(path: string): string {
	return path === '/' ? path : path.replace(/\/$/, '');
}

test.describe('the sitemap', { tag: '@desktop-only' }, () => {
	// The index names the sitemap files, so a renamed file does not hide its addresses.
	const addresses = locsOf('sitemap-index.xml').flatMap((sitemap) => locsOf(new URL(sitemap).pathname));

	test('has addresses', () => {
		expect(addresses.length).toBeGreaterThan(10);
	});

	test('lists only built pages', () => {
		const pages = new Set(builtPages().map(withoutSlash));
		expect(addresses.map((address) => withoutSlash(new URL(address).pathname)).filter((path) => !pages.has(path))).toEqual([]);
	});

	test('names every page but the home page without a final slash, as the links do', () => {
		expect(addresses.filter((address) => new URL(address).pathname !== '/' && address.endsWith('/'))).toEqual([]);
	});

	test('leaves out /login, a placeholder with nothing to find', () => {
		expect(addresses.filter((address) => new URL(address).pathname === '/login')).toEqual([]);
	});
});

test('the stray /README/ page is not built', { tag: '@desktop-only' }, () => {
	expect(builtPages()).not.toContain('/README/');
});
