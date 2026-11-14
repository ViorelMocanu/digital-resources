import { ENV, URL, DEBUG } from './src/config';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import embeds from 'astro-embed/integration';
import path from 'path';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import vercel from '@astrojs/vercel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
	site: URL || 'https://resurse.dev',
	// Addresses without the final slash, as every internal link writes them and as vercel.json serves them. The adapter
	// writes the redirect from the slashed form into the build output.
	trailingSlash: 'never',
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
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src'),
			},
		},
	},
	markdown: {
		// The remark and rehype pipeline the site has always used. Astro's newer default processor may write the same Markdown as different HTML.
		processor: unified({
			remarkRehype: {
				footnoteLabel: 'Note de subsol',
				footnoteBackLabel: 'Înapoi la conținut',
			},
		}),
		syntaxHighlight: 'shiki',
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
			entryLimit: 10000,
			changefreq: 'weekly',
			priority: 0.7,
			i18n: {
				defaultLocale: 'ro',
				locales: {
					ro: 'ro-RO',
					en: 'en-US',
				},
			},
		}),
		embeds(),
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
