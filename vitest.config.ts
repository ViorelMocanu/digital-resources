/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
	test: {
		// tmp/ is agent scratch space: a stale copy of a test there must never run in place of the real one.
		// e2e/ holds the Playwright tests, which run against a build with pnpm test:e2e.
		exclude: [...configDefaults.exclude, 'tmp/**', '.vercel/**', 'dist/**', 'e2e/**'],
		globals: true,
	},
});
