import { defineConfig } from 'astro/config';
import prefetch from "@astrojs/prefetch";
import webmanifest from "astro-webmanifest";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";
import { LANGUAGE_EXTENDED, SITE_DESCRIPTION, SITE_NAME, ACCENT_COLOR } from './src/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://resurse.dev',
	integrations: [
		prefetch({
			// Only prefetch links with an href that begins with `/resurse` or `.front-end`
			intentSelector: ["a[href^='/resurse']", "a[href^='/front-end']"]
		}),
		webmanifest({
			name: SITE_NAME,
			short_name: SITE_NAME,
			lang: LANGUAGE_EXTENDED,
			dir: 'ltr',
			icon: 'src/img/favicon.svg',
			description: SITE_DESCRIPTION,
			start_url: '/',
			theme_color: ACCENT_COLOR,
			background_color: ACCENT_COLOR,
			display: 'standalone',
			config: {
				outfile: 'site.webmanifest',
				createFavicon: true,
				insertFaviconLinks: false, // default - true
				insertThemeColorMeta: false, // default - true
				insertManifestLink: false, // default - true
				crossOrigin: 'anonymus',
				insertAppleTouchLinks: false,
				iconPurpose: ['badge', 'maskable', 'monochrome']
			}
		}),
		partytown({
			config: {
				debug: true,
				forward: ['dataLayer.push']
			}
		}),
		sitemap()
	]
});