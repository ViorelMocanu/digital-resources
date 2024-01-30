import { ENV, LANGUAGE_EXTENDED, SITE_DESCRIPTION, SITE_NAME, ACCENT_COLOR, URL, DEBUG } from './src/config';
import { defineConfig, squooshImageService } from 'astro/config';
//import { astroCSPHashGenerator } from './src/utils/csp-hash';
import { fileURLToPath } from 'url';
//import { loadEnv } from 'vite';
//import compress from 'astro-compress';
import mdx from '@astrojs/mdx';
import path from 'path';
import partytown from '@astrojs/partytown';
//import sentry from "@sentry/astro";
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';
import webmanifest from 'astro-webmanifest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
//const { VITE_SENTRY_AUTH_TOKEN } = loadEnv(import.meta.env.PUBLIC_SENTRY_AUTH_TOKEN ?? process.env.PUBLIC_SENTRY_AUTH_TOKEN, process.cwd(), "");

// https://astro.build/config
export default defineConfig({
	site: URL || 'https://resurse.dev',
	output: 'hybrid',
	// https://vercel.com/docs/frameworks/astro
	adapter: vercel({
		webAnalytics: {
			enabled: true,
		},
		maxDuration: 8,
		edgeMiddleware: true,
	}),
	compressHTML: ENV !== 'local' && ENV !== 'development' ? true : false,
	redirects: {
		// '/old': '/new',
	},
	image: {
		service: squooshImageService(),
		remotePatterns: [{
			protocol: 'https'
		}]
	},
	vite: {
		logLevel: DEBUG ? 'info' : 'silent',
		define: {
			__DATE__: `'${new Date().toISOString()}'`,
		},
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src'),
			},
		},
	},
	markdown: {
		syntaxHighlight: 'shiki',
		remarkRehype: {
			footnoteLabel: 'Note de subsol',
			footnoteBackLabel: 'Înapoi la conținut',
		},
		shikiConfig: {
			// Choose from Shiki's built-in themes (or add your own)
			// https://github.com/shikijs/shiki/blob/main/docs/themes.md
			theme: 'github-dark',
			// Add custom languages
			// Note: Shiki has countless langs built-in, including .astro!
			// https://github.com/shikijs/shiki/blob/main/docs/languages.md
			langs: [],
			// Enable word wrap to prevent horizontal scrolling
			wrap: true,
		},
	},
	integrations: [
		webmanifest({
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
				iconPurpose: ['badge', 'maskable', 'monochrome'],
			},
		}),
		partytown({
			config: {
				debug: true,
				forward: ['dataLayer.push'],
			},
		}),
		sitemap({
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
		mdx(),
		/*compress({
			CSS: true,
			HTML: true,
			Image: false,
			JavaScript: true,
			SVG: true,
			Logger: 1,
		}),*/
		//astroCSPHashGenerator,
		/*
		sentry({
			dsn: "https://344f761c5efeb4b9ea6b08942c01f5b6@o4506599007911936.ingest.sentry.io/4506661195808768",
			// @ts-ignore
			sourceMapsUploadOptions: {
				project: "resurse-dev",
				// @ts-ignore
				authToken: VITE_SENTRY_AUTH_TOKEN,
				telemetry: false,
			},
		}),
		*/
	],
});
