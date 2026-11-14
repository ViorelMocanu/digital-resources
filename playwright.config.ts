import { defineConfig, devices } from '@playwright/test';

import { ORIGIN } from './e2e/server.ts';
import type { SiteOptions } from './e2e/site.ts';

const inPipeline = Boolean(process.env['CI']);

// End-to-end tests of the built site. Run `pnpm build` first: the tests read and serve `.vercel/output/static`.
export default defineConfig<SiteOptions>({
	testDir: './e2e',
	// Starts the local server for the built site inside the test runner, and stops it at the end.
	globalSetup: './e2e/global-setup.ts',
	// One browser at a time. With several browsers running at once on the machine this suite was written on, page
	// loads stopped for 30 seconds at a time, in every worker together, and the cause was not found. One worker
	// runs the suite in well under a minute.
	workers: 1,
	forbidOnly: inPipeline,
	// The screenshot comparison runs only where its references were taken: in the pipeline, which sets E2E_SHOTS.
	testIgnore: process.env['E2E_SHOTS'] ? [] : ['**/shots.spec.ts'],
	snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
	// In the pipeline a failure is marked on the commit and leaves a report to download.
	reporter: inPipeline ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		...devices['Desktop Chrome'],
		baseURL: ORIGIN,
		// Locally no trace is recorded: to see why a test failed, run it again with `--trace on`. The pipeline cannot
		// be asked again, so it keeps the trace of a failed test.
		trace: inPipeline ? 'retain-on-failure' : 'off',
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
