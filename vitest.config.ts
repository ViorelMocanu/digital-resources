// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { configDefaults } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
	test: {
		exclude: [...configDefaults.exclude, 'packages/template/*'],
		globals: true,
	},
});
