/// <reference types="vitest" />
import { configDefaults, getViteConfig } from 'astro/config';

export default getViteConfig({
	test: {
		exclude: [...configDefaults.exclude, 'packages/template/*'],
		globals: true,
	},
});