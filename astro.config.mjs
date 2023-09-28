import { defineConfig } from 'astro/config';
import prefetch from "@astrojs/prefetch";

import webmanifest from "astro-webmanifest";

// https://astro.build/config
export default defineConfig({
	integrations: [prefetch({
		// Only prefetch links with an href that begins with `/resurse` or `.front-end`
		intentSelector: ["a[href^='/resurse']", "a[href^='/front-end']"]
	}), webmanifest({
		name: 'Resurse.dev',
		short_name: 'Resurse.dev',
		lang: 'ro-RO',
		dir: 'ltr',
		icon: 'src/img/favicon.svg',
		description: '@TODO',
		start_url: '/',
		theme_color: '#2f8ded',
		background_color: '#2f8ded',
		display: 'standalone',
		config: {
			outfile: 'site.webmanifest',
			createFavicon: true,
			insertFaviconLinks: false, // default - true
			insertThemeColorMeta: false, // default - true
			insertManifestLink: false, // default - true
			crossOrigin: 'anonymus',
			insertAppleTouchLinks: false,
			iconPurpose: ['badge', 'maskable', 'monochrome'],
		}
	})]
});