/**
 * What the end-to-end tests share: the list of built pages, the address form the links use, and a page that cannot
 * reach the network.
 */

import { ORIGIN, SITE_ROOT } from './server.ts';
import { test as base, expect } from '@playwright/test';
import { assertBuiltSite } from '../scripts/serve-static.ts';
import { readdirSync } from 'node:fs';

/**
 * The address of every built page, as the host serves it: `/`, `/despre/`, `/404`.
 * @returns The addresses, sorted.
 */
export function builtPages(): string[] {
	assertBuiltSite(SITE_ROOT);
	return readdirSync(SITE_ROOT, { recursive: true, encoding: 'utf8' })
		.filter((file) => file.endsWith('.html'))
		.map((file) => `/${file.replaceAll('\\', '/')}`.replace(/index\.html$/, '').replace(/\.html$/, ''))
		.sort();
}

/**
 * A page's path without its final slash; the home page stays `/`.
 * @param path A path of the site.
 * @returns The path as the internal links write it.
 */
export function withoutSlash(path: string): string {
	return path === '/' ? path : path.replace(/\/$/, '');
}

/**
 * Addresses the hosting platform answers itself (its analytics and speed scripts). They are not files of the build,
 * so the local server cannot have them: like every other address outside the site, they are not requested at all.
 */
const HOST_PROVIDED = '/_vercel/';

/** What a project of `playwright.config.ts` says about itself. */
export interface SiteOptions {
	/** True when the project's width shows the narrow layout, the one with the menu button. */
	narrow: boolean;
}

/**
 * `page` is cut off from everything but the local server, so a test needs no network and loads no third party.
 * `errors` collects what went wrong while the page loaded: uncaught script errors, and files of the site itself
 * that the server could not give (a style sheet, a script or an image that is missing from the build).
 */
export const test = base.extend<SiteOptions & { errors: string[] }>({
	narrow: [false, { option: true }],
	page: async ({ page }, use) => {
		await page.route(
			(url) => url.origin !== ORIGIN || url.pathname.startsWith(HOST_PROVIDED),
			(route) => route.abort()
		);
		await use(page);
	},
	errors: async ({ page }, use) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('response', (response) => {
			const url = new URL(response.url());
			if (url.origin === ORIGIN && response.status() >= 400) errors.push(`${response.status()} ${url.pathname}`);
		});
		await use(errors);
	},
});

export { expect };
