import { ENV, URL, DEBUG } from './src/config';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import embeds from 'astro-embed/integration';
import mdx from '@astrojs/mdx';
import path from 'path';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
	site: URL || 'https://resurse.dev',
	// trailingSlash: 'always',
	// Every page is built ahead of time, so the deployment has no server function and no Node.js runtime to pin.
	output: 'static',
	// https://docs.astro.build/en/guides/prefetch/
	prefetch: {
		defaultStrategy: 'hover',
		prefetchAll: true, // opt out with data-astro-prefetch="false"
	},
	// https://vercel.com/docs/frameworks/astro
	adapter: vercel({
		webAnalytics: {
			enabled: true,
		},
	}),
	compressHTML: ENV !== 'local' && ENV !== 'development' ? true : false,
	redirects: {
		// '/old': '/new',
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
		embeds(),
		mdx(),
		/*
		serialize(item) {
			if (item.url.endsWith('resurse.dev/')) {
				item.priority = 1.0;
			} else if (item.url.endsWith('resurse.dev/r/')) {
				// @ts-expect-error they used a TS enum <smh>
				item.changefreq = 'daily';
				item.priority = 0.9;
			}
			return item;
		},
		*/
	],
});
