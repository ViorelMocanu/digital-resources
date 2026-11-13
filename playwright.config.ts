import { defineConfig, devices } from '@playwright/test';

import { ORIGIN } from './e2e/server.ts';

// End-to-end tests of the built site. Run `pnpm build` first: the tests read and serve `.vercel/output/static`.
export default defineConfig({
	testDir: './e2e',
	// Starts the local server for the built site inside the test runner, and stops it at the end.
	globalSetup: './e2e/global-setup.ts',
	outputDir: './test-results',
	// One browser at a time. With several browsers running at once on the machine this suite was written on, page
	// loads stopped for 30 seconds at a time, in every worker together, and the cause was not found. One worker
	// runs the 190 tests in about a minute and a half.
	workers: 1,
	forbidOnly: Boolean(process.env['CI']),
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL: ORIGIN,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'desktop',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
		},
		{
			// The narrow layout has its own menu. The head of a page does not depend on the width, so it is checked once.
			name: 'mobile',
			use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
			testIgnore: /head\.spec\.ts/,
		},
	],
});
