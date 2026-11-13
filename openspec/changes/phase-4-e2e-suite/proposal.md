# Phase 4, first part: the end-to-end suite

## Why

Phase 2 showed what the unit tests and the screenshots cannot see: after the upgrade every page looked right, and every link caused a full page load (`docs/lessons.md`, L-008). The check that found it is a scratch script that borrows a browser from outside the repository, so nobody else can run it and no hook or pipeline ever will. `package.json` already has a `test:e2e` script that calls Playwright, but Playwright is not installed and no test exists.

This change gives the repository its own browser tests of the built site. A visitor sees no change: no page, style or script of the site is touched.

It is the first part of Phase 4. The rest of that phase (committed screenshots, the CI workflow, the dependency bot, removing old workflows) needs the owner and is not in this change.

## What Changes

Added, as development dependencies, at versions at least seven days old on 2026-11-13:

-   `@playwright/test` 1.65.0.
-   `@axe-core/playwright` 4.14.0.

New files:

-   `playwright.config.ts`: two sizes of one browser (Chromium at 1440 and at 390 pixels wide), tests in `e2e/`, one worker.
-   `scripts/serve-static.ts`: a small server for the build output, with no dependency and with its own unit test. The Vercel adapter has no preview command for a static build. The test runner starts the server inside itself (`e2e/global-setup.ts`), so nothing is left on the port when a run is stopped.
-   `e2e/`: the tests.
    -   Smoke: every built page answers, has one main heading and a title, and raises no script error.
    -   Head: every page has a language, a canonical address and the pre-launch `noindex` tag.
    -   Navigation: a header link, a resource card, a tag, the logo and the back button all move between pages without a full page load, at both sizes; the mobile menu button opens the menu. This is the check of L-008.
    -   Accessibility: the axe engine on one page of each kind. Findings that exist today are written down by rule and by page kind in one file, and the test fails on anything new. Fixing the existing ones is Phase 5.

Changed:

-   `vitest.config.ts` leaves `e2e/` to Playwright.
-   `eslint.config.js` treats `e2e/` like the scripts folder (types in signatures, not in comments).
-   `.gitignore` and `.prettierignore` gain Playwright's two output folders.
-   `docs/lessons.md`: the check of L-008 now names the navigation test.

The tests block every request that leaves the local server, so they need no network and exercise no third party.

Found during the work:

-   **Several browsers at once do not work on the machine the suite was written on.** With four or sixteen workers, page loads stopped for 30 seconds at a time, in every worker together, about once every dozen tests. It happened with the server started three different ways, and the server had answered every request it received. With one worker no load ever stopped: four full runs of 190 tests, about 75 seconds each, the last three with every test passing. The cause was not found after three attempts, so the config sets one worker and says why. Whether a pipeline shows the same is not known.
-   The findings of the accessibility engine today, by rule: `region` on every kind of page, `heading-order` on four, `landmark-unique` and `aria-allowed-role` on four, `label` and `skip-link` on the home page, and `color-contrast` on the resource page at the narrow size. They are listed in `e2e/known-gaps.ts`.
-   One page has no main heading: `/README/`, a stray Markdown file published as a page. It is listed in the same file.
-   Both proofs were made against a broken copy of the built site: without the router script the navigation test fails at both sizes, and with an image that has no text alternative the accessibility test fails.
-   The variable `E2E_SITE_ROOT` points the suite at another copy of a built site; that is how the proofs were run.

## How it is run

`pnpm build`, then `pnpm test:e2e`. The suite is not part of `pnpm verify`, which stays the fast check: the suite needs a build and a browser.

## Out of scope

-   Screenshot comparison inside the suite. Screenshots depend on the fonts of the machine, so they belong in the pipeline, with one fixed system.
-   The CI workflow, the dependency bot, and the removal of the disabled workflows.
-   Any fix of an accessibility finding.
-   A new row for the suite in the command table of `AGENTS.md`: that file changes only with the owner.

## Waits for the owner

-   The browser on any other machine. Playwright uses its own downloaded Chromium; this machine already had the revision that 1.65.0 asks for. Elsewhere it is fetched once with `pnpm exec playwright install chromium`.
-   The parallel hang described above, if more than one worker is wanted.
-   The rest of Phase 4, and the row in `AGENTS.md`.

## Impact

-   `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `scripts/serve-static.ts`, `e2e/`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `.prettierignore`, `docs/lessons.md`.
-   The pages: none.
