import { defineConfig, devices } from '@playwright/test';

import { ORIGIN } from './e2e/server.ts';
import type { SiteOptions } from './e2e/site.ts';

// End-to-end tests of the built site. Run `pnpm build` first: the tests read and serve `.vercel/output/static`.
export default defineConfig<SiteOptions>({
	testDir: './e2e',
	// Starts the local server for the built site inside the test runner, and stops it at the end.
	globalSetup: './e2e/global-setup.ts',
	// One browser at a time. With several browsers running at once on the machine this suite was written on, page
	// loads stopped for 30 seconds at a time, in every worker together, and the cause was not found. One worker
	// runs the suite in well under a minute.
	workers: 1,
	forbidOnly: Boolean(process.env['CI']),
	reporter: [['list']],
	use: {
		...devices['Desktop Chrome'],
		baseURL: ORIGIN,
		// No trace is recorded. To see why a test failed, run it again with `--trace on`.
	},
	projects: [
		{
			name: 'desktop',
			use: { viewport: { width: 1440, height: 900 } },
		},
		{
			// The narrow layout has its own menu. It skips the tests tagged as needing only one width.
			name: 'mobile',
			use: { viewport: { width: 390, height: 844 }, narrow: true },
			grepInvert: /@desktop-only/,
		},
	],
});
