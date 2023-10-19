import { defineConfig } from 'astro/config';
import AstroPWA from "@vite-pwa/astro";
import prefetch from "@astrojs/prefetch";
import webmanifest from "astro-webmanifest";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";
import { LANGUAGE_EXTENDED, SITE_DESCRIPTION, SITE_NAME, ACCENT_COLOR, URL, DEBUG } from './src/config';

// https://astro.build/config
export default defineConfig({
	image: {
		remotePatterns: [{ protocol: "https" }],
	},
	site: URL || "https://resurse.dev",
	vite: {
		logLevel: DEBUG ? 'info' : 'silent',
		define: {
			__DATE__: `'${new Date().toISOString()}'`,
		},
	},
	integrations: [
		prefetch({
			// Only prefetch links with an href that begins with `/resurse` or `.front-end`
			intentSelector: ["a[href^='/resurse']"]
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
				insertFaviconLinks: true, // default - true
				insertThemeColorMeta: false, // default - true
				insertManifestLink: true, // default - true
				crossOrigin: 'anonymous',
				insertAppleTouchLinks: true,
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
			//lastmod: new Date(GLOBAL_PUB_DATE),
			i18n: {
				defaultLocale: 'ro',
				locales: {
					ro: 'ro-RO',
					en: 'en-US',
				},
			},
		}),
		// AstroPWA({
		// 	mode: 'development',
		// 	base: '/',
		// 	scope: '/',
		// 	includeAssets: ['favicon.svg'],
		// 	registerType: 'autoUpdate',
		// 	manifest: {
		// 		name: SITE_NAME,
		// 		short_name: SITE_NAME,
		// 		theme_color: ACCENT_COLOR,
		// 		icons: [
		// 		{
		// 			src: 'icon-192x192.png',
		// 			sizes: '192x192',
		// 			type: 'image/png',
		// 		},
		// 		{
		// 			src: 'icon-512x512.png',
		// 			sizes: '512x512',
		// 			type: 'image/png',
		// 		},
		// 		{
		// 			src: 'icon-512x512.png',
		// 			sizes: '512x512',
		// 			type: 'image/png',
		// 			purpose: 'any maskable',
		// 		},
		// 		],
		// 	},
		// 	workbox: {
		// 		navigateFallback: '/404',
		// 		globPatterns: ['**/*.{css,js,html,svg,png,ico,woff2}'],
		// 	},
		// 	devOptions: {
		// 		enabled: true,
		// 		navigateFallbackAllowlist: [/^\/404$/],
		// 	},
		// })
	]
});
