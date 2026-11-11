/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
	test: {
		// tmp/ is agent scratch space: a stale copy of a test there must never run in place of the real one.
		exclude: [...configDefaults.exclude, 'packages/template/*', 'tmp/**', '.vercel/**'],
		globals: true,
	},
});
