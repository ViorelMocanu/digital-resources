import { ENV, LANGUAGE_EXTENDED, SITE_DESCRIPTION, SITE_NAME, ACCENT_COLOR, URL, DEBUG } from './src/config';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
// import compress from 'astro-compress';
// import mdx from '@astrojs/mdx';
import path from 'path';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import webmanifest from 'astro-webmanifest';
import vercel from '@astrojs/vercel/serverless';
const __dirname = path.dirname(fileURLToPath(import.meta.url));


// https://astro.build/config
export default defineConfig({
	site: URL || 'https://resurse.dev',
	output: 'hybrid',
	compressHTML: ENV !== 'local' && ENV !== 'development' ? true : false,
	prefetch: {
		defaultStrategy: 'viewport'
	},
	redirects: {
		// '/old': '/new',
	},
	image: {
		remotePatterns: [{
			protocol: 'https'
		}]
	},
	vite: {
		logLevel: DEBUG ? 'info' : 'silent',
		define: {
			__DATE__: `'${new Date().toISOString()}'`
		},
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src')
			}
		}
	},
	markdown: {
		syntaxHighlight: 'shiki',
		remarkRehype: {
			footnoteLabel: 'Note de subsol',
			footnoteBackLabel: 'Înapoi la conținut'
		},
		shikiConfig: {
			// Choose from Shiki's built-in themes (or add your own)
			// https://github.com/shikijs/shiki/blob/main/docs/themes.md
			theme: 'github-dark',
			// Add custom languages
			// Note: Shiki has countless langs built-in, including .astro!
			// https://github.com/shikijs/shiki/blob/main/docs/languages.md
			// import customLang from './custom.tmLanguage.json'
			langs: [
				// customLang,
			],
			// Enable word wrap to prevent horizontal scrolling
			wrap: true
		}
	},
	i18n: {
		defaultLocale: 'ro',
		locales: ['ro'],
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
				insertFaviconLinks: true,
				insertThemeColorMeta: false,
				insertManifestLink: true,
				crossOrigin: 'anonymous',
				insertAppleTouchLinks: true,
				iconPurpose: ['badge', 'maskable', 'monochrome']
			}
		}),
		partytown({
			config: {
				debug: true,
				forward: ['dataLayer.push']
			}
		}),
		sitemap({
			customPages: ['https://resurse.dev/external-page2'],
			filter: page => {
				return page !== 'https://resurse.dev/dashboard/' && page !== 'https://resurse.dev/secret-vip-lounge-2/';
			},
			entryLimit: 10000,
			changefreq: 'weekly',
			priority: 0.7,
			//lastmod: new Date(GLOBAL_PUB_DATE),
			i18n: {
				defaultLocale: 'ro',
				locales: {
					ro: 'ro-RO'
				}
			}
		}),
		/*
		mdx(),
		compress({
			CSS: true,
			HTML: {
				removeAttributeQuotes: false
			},
			Image: false,
			JavaScript: true,
			SVG: true,
			Logger: 1
		})
		*/
	],
	adapter: vercel()
});