import { defineConfig } from 'astro/config';
import prefetch from "@astrojs/prefetch";
import webmanifest from "astro-webmanifest";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";
import compress from "astro-compress";
import { LANGUAGE_EXTENDED, SITE_DESCRIPTION, SITE_NAME, ACCENT_COLOR, GLOBAL_PUB_DATE } from './src/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://resurse.dev',
	integrations: [
		prefetch({
			// Only prefetch links with an href that begins with `/resurse` or `.front-end`
			intentSelector: ["a[href^='/resurse']", "a[href^='/front-end']"]
		}), webmanifest({
			name: SITE_NAME,
			short_name: SITE_NAME,
			lang: LANGUAGE_EXTENDED,
			dir: 'ltr',
			icon: 'public/favicon.svg',
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
		}), partytown({
			config: {
				debug: true,
				forward: ['dataLayer.push']
			}
		}), sitemap({
			customPages: ['https://resurse.dev/external-page2'],
			filter: (page) =>
				page !== 'https://resurse.dev/secret-vip-lounge-1/' &&
				page !== 'https://resurse.dev/secret-vip-lounge-2/' &&
				page !== 'https://resurse.dev/secret-vip-lounge-3/' &&
				page !== 'https://resurse.dev/secret-vip-lounge-4/',
			entryLimit: 10000,
			changefreq: 'weekly',
			priority: 0.7,
			lastmod: new Date(GLOBAL_PUB_DATE),
			i18n: {
				defaultLocale: 'ro',
				locales: {
					ro: 'ro-RO',
					en: 'en-US',
				},
			},
		})
	]
});