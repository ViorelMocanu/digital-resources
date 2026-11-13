# Tasks

## 1. Baseline

-   [x] 1.1 Build the tree as it is and keep the output as the comparison point; check: `pnpm build`, then copy the page list, the sitemap addresses, the visible text and the head tags of every page into `tmp/phase2/before/`
-   [x] 1.2 Take the screenshots of that build at 390 and 1440 pixels; check: `node tmp/work/siteshots.cjs .vercel/output/static tmp/phase2/shots-before` writes two files per page (taken twice; the two sets are identical)
-   [x] 1.3 Record the checks before the phase; check: `pnpm verify` exits 0, and the number of unit tests is noted (844)
-   [x] 1.4 Read the Astro upgrade guides for versions 5, 6 and 7 and the Vitest guides for 3, 4 and 5, and list in the report every item that applies to this code
-   [x] 1.5 Record how the built site behaves in a browser (navigation, back button, mobile menu); check: `node tmp/work/nav-check.cjs tmp/phase2/before/static`

## 2. Platform

-   [x] 2.1 Set `engines.node` to `>=24.16`, add `.nvmrc` with `24`, pin `packageManager`; check: `node --version` satisfies the floor and `pnpm --version` equals the pin
-   [x] 2.2 Make pnpm refuse a release younger than seven days (`minimumReleaseAge` in `pnpm-workspace.yaml`); check: the install picks `astro` 7.4.7 while 7.4.11 is the newest

## 3. Astro and the content migration, nothing else

-   [x] 3.1 Upgrade `astro`, `@astrojs/vercel`, `@astrojs/sitemap`, `@astrojs/check`, `sharp` and `astro-embed`, add `@astrojs/markdown-remark`, remove `@astrojs/mdx` and the direct `vite`; check: `pnpm install --frozen-lockfile --ignore-scripts` exits 0 on the new lockfile
-   [x] 3.2 Write the collection definitions in `src/content.config.ts` with `glob()` loaders and empty the old file to a note; check: `pnpm astro sync` exits 0
-   [x] 3.3 Replace `entry.render()` by `render(entry)` and `.slug` by `.id`; check: a search for `slug` in `src` shows only Markdown headings, route parameters and comments
-   [x] 3.4 Replace `ViewTransitions` by `ClientRouter` in both layouts; check: `git grep -n ViewTransitions -- src` finds nothing
-   [x] 3.5 Bring `astro.config.mjs` to the Astro 7 form (the adapter's entry point, the Markdown processor); check: `pnpm build` exits 0
-   [x] 3.6 Compare the addresses before anything else changes; check: the page list and the sitemap addresses equal those in `tmp/phase2/before/`
-   [x] 3.7 Keep the two image width rules, which the schema can no longer check; check: `pnpm exec vitest run test/imageRules.test.ts --reporter=dot`, written before the function
-   [x] 3.8 Make the analytics plugin use the site's Astro, so that one Astro is installed; check: `pnpm why astro` lists one version

## 4. Configuration, types and styles

-   [x] 4.1 Read the debug flag as text in `src/config.ts`; check: `pnpm exec vitest run test/envFlag.test.ts --reporter=dot`, written first and failing before the function existed
-   [x] 4.2 Import Zod from `astro/zod` and use the Zod 4 forms in the collection schemas; check: `pnpm astro sync` exits 0 and `pnpm test:unit` passes with no test changed
-   [x] 4.3 Upgrade `typescript` to 6.0.3 and update `tsconfig.json`; check: `pnpm typecheck` exits 0
-   [x] 4.4 Replace `sass` by `sass-embedded`; check: `pnpm build` exits 0 and the log has no Sass deprecation warning
-   [x] 4.5 Upgrade the two analytics packages only if the build fails with the old ones; check: `pnpm build` passes with the old ones, so neither was upgraded
-   [x] 4.6 Give `@astrojs/astro2tsx` its runtime, so that `astro check` starts; check: `pnpm astro check` reports 0 errors

## 5. Tests

-   [x] 5.1 Upgrade `vitest` and `@vitest/coverage-v8` to 5.1.0, drop the dead exclude in `vitest.config.ts` and exclude `dist`; check: `pnpm test:unit` passes, and the number of tests is at least the number noted in 1.3
-   [x] 5.2 Confirm the hook tests still run on the new runner; check: they are part of `pnpm test:unit`, which runs 14 files

## 6. Comparison

-   [x] 6.1 Addresses; check: the page list and the sitemap addresses equal the baseline (56 pages, 57 addresses)
-   [x] 6.2 Text and head; check: the head tags equal the baseline on every page, in the same order; the visible text is equal on 55 pages and has one hidden word more on the home page, named in the proposal
-   [x] 6.3 Screenshots; check: `node tmp/work/compare-pixels.cjs tmp/phase2/shots-before tmp/phase2/shots-after` reports 112 of 112 identical
-   [x] 6.4 Page weight; check: the HTML and CSS size of every page before and after, in the report
-   [x] 6.5 Navigation, the page transition and the mobile menu in a browser; check: `node tmp/work/nav-check.cjs .vercel/output/static` gives the same result as task 1.5, with no page error
-   [x] 6.6 Static output; check: `.vercel/output` has no `functions` folder and `config.json` has no route to `_render` or `_image`
-   [x] 6.7 Fix what 6.5 found: `astro-capo` dropped the client router's script; check: `pnpm exec vitest run test/layoutHead.test.ts --reporter=dot`, and 6.5 again

## 7. Close

-   [x] 7.1 `pnpm verify` exits 0
-   [x] 7.2 `pnpm audit --prod --audit-level critical` exits 0
-   [x] 7.3 `pnpm exec openspec validate phase-2-core-upgrade --strict` is valid
-   [x] 7.4 Scan the code next to the changes for regressions; write the state file and the entry in `docs/change-log.md`
