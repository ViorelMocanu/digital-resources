import type { AstroIntegration } from 'astro';
/*
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { readFile } from 'node:fs/promises';

const createCspHash = async (s: string) => {
	const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
	const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

	return `'sha256-${hashBase64}'`;
};
*/

export const astroCSPHashGenerator: AstroIntegration = {
	name: 'astro-csp-hash-generator',
	hooks: {
		/*
		'astro:build:done': async ({ dir, pages, logger }) => {
			let hashes = [];
			for (let i = 0; i < pages.length; i++) {
				const filePath = fileURLToPath(`${dir.href}${pages[i]?.pathname}index.html`);

				try {
					const root = parse(await readFile(filePath, { encoding: 'utf-8' }));
					const scripts = root.querySelectorAll('script');

					for (let j = 0; j < scripts.length; j++) {
						const s = scripts[j];
						if (s !== undefined && s?.textContent !== undefined) {
							const hash = await createCspHash(s?.textContent);
							hashes.push(hash);
						}
					}
				} catch (e) {
					logger.error(`Cannot read file ${filePath}: ${e}`);
				}
			}
			logger.info(hashes.join(' '));
		},
		*/
	},
};
