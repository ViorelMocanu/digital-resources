/**
 * What the end-to-end tests share: the list of built pages, and a page that cannot reach the network.
 */

import { test as base, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SITE_ROOT } from './server.ts';

/** The folder the local server serves. */
const BUILD = SITE_ROOT;

/**
 * List every HTML file under a folder.
 * @param dir The folder.
 * @returns The absolute paths.
 */
function htmlFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return htmlFiles(path);
		return entry.name.endsWith('.html') ? [path] : [];
	});
}

/**
 * The address of every built page, as the host serves it: `/`, `/despre/`, `/404`.
 * @returns The addresses, sorted.
 */
export function builtPages(): string[] {
	if (!existsSync(join(BUILD, 'index.html'))) throw new Error(`No built site in ${BUILD}. Run "pnpm build" first.`);
	return htmlFiles(BUILD)
		.map((file) => `/${relative(BUILD, file).split(sep).join('/')}`.replace(/index\.html$/, '').replace(/\.html$/, ''))
		.sort();
}

/** The script errors a page raised, collected by the `errors` fixture. */
export type PageErrors = string[];

/**
 * `page` is cut off from everything but the local server, so a test needs no network and loads no third party.
 * `errors` collects the uncaught script errors of the page.
 */
export const test = base.extend<{ errors: PageErrors }>({
	page: async ({ page, baseURL }, use) => {
		await page.route(
			(url) => !url.href.startsWith(baseURL ?? ''),
			(route) => route.abort()
		);
		await use(page);
	},
	errors: async ({ page }, use) => {
		const errors: PageErrors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await use(errors);
	},
});

export { expect };
