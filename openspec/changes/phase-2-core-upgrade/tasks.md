# Tasks

## 1. Baseline

-   [ ] 1.1 Build the tree as it is and keep the output as the comparison point; check: `pnpm build`, then copy the page list, the sitemap addresses, the visible text and the head tags of every page into `tmp/phase2/before/`
-   [ ] 1.2 Take the screenshots of that build at 390 and 1440 pixels; check: `node tmp/work/siteshots.cjs .vercel/output/static tmp/phase2/shots-before` writes two files per page
-   [ ] 1.3 Record the checks before the phase; check: `pnpm verify` exits 0, and the number of unit tests is noted
-   [ ] 1.4 Read the Astro upgrade guides for versions 5, 6 and 7 and the Vitest guides for 3, 4 and 5, and list in the report every item that applies to this code

## 2. Platform

-   [ ] 2.1 Set `engines.node` to `>=24.16`, add `.nvmrc` with `24`, pin `packageManager`; check: `node --version` satisfies the floor and `pnpm --version` equals the pin
-   [ ] 2.2 Confirm each target version is at least seven days old on the day of the install; check: `pnpm view <package> time --json`, the dates go into the report

## 3. Astro and the content migration, nothing else

-   [ ] 3.1 Upgrade `astro`, `@astrojs/vercel`, `@astrojs/sitemap`, `@astrojs/check`, `sharp` and `astro-embed`, add `@astrojs/markdown-remark`, remove `@astrojs/mdx` and the direct `vite`; check: `pnpm install --frozen-lockfile --ignore-scripts` exits 0 on the new lockfile
-   [ ] 3.2 Move the collection definitions to `src/content.config.ts` with `glob()` loaders (the move needs the owner's consent); check: `pnpm astro sync` exits 0
-   [ ] 3.3 Replace `entry.render()` by `render(entry)` and `.slug` by `.id`; check: `git grep -n "\.slug\b" -- src` shows only lines that read a frontmatter field, each listed in the report
-   [ ] 3.4 Replace `ViewTransitions` by `ClientRouter` in both layouts; check: `git grep -n ViewTransitions -- src` finds nothing
-   [ ] 3.5 Bring `astro.config.mjs` to the Astro 7 form (Markdown options, removed options); check: `pnpm build` exits 0 with no deprecation warning from the config
-   [ ] 3.6 Compare the addresses before anything else changes; check: the page list and the sitemap addresses equal those in `tmp/phase2/before/`. A difference stops the work

## 4. Configuration, types and styles

-   [ ] 4.1 Compare environment values as strings in `src/config.ts`; check: a unit test, written first, that fails on the old comparison
-   [ ] 4.2 Import Zod from `astro/zod` and use the Zod 4 forms; check: `pnpm exec vitest run test/resourceMeta.test.ts --reporter=dot` passes with no test changed
-   [ ] 4.3 Upgrade `typescript` to 6.0.3 and update `tsconfig.json`; check: `pnpm typecheck` exits 0
-   [ ] 4.4 Replace `sass` by `sass-embedded`; check: `pnpm build` exits 0 and the log has no Sass deprecation warning
-   [ ] 4.5 Upgrade the two analytics packages only if the build fails with the old ones; check: `pnpm build`

## 5. Tests

-   [ ] 5.1 Upgrade `vitest` and `@vitest/coverage-v8` to 5.1.0 and drop the dead exclude in `vitest.config.ts`; check: `pnpm test:unit` passes, and the number of tests is at least the number noted in 1.3
-   [ ] 5.2 Confirm the hook tests still run on the new runner; check: `pnpm exec vitest run scripts --reporter=dot`

## 6. Comparison

-   [ ] 6.1 Addresses; check: the page list and the sitemap addresses equal the baseline
-   [ ] 6.2 Text and head; check: the visible text and the head tags of every page equal the baseline
-   [ ] 6.3 Screenshots; check: `node tmp/work/compare-shots.cjs tmp/phase2/shots-before tmp/phase2/shots-after` reports no size difference and no page above 0.1 percent of pixels; every page that differs at all is looked at by eye
-   [ ] 6.4 Page weight; check: the HTML and CSS size of every page before and after, as a table in the report
-   [ ] 6.5 Navigation, the page transition and the mobile menu in one browser on `pnpm preview`; check: no console error, written down with the pages visited
-   [ ] 6.6 Static output; check: `.vercel/output` has no `functions` folder and `config.json` has no route to `_render` or `_image`

## 7. Close

-   [ ] 7.1 `pnpm verify` exits 0
-   [ ] 7.2 `pnpm audit --prod --audit-level critical` exits 0
-   [ ] 7.3 `pnpm exec openspec validate phase-2-core-upgrade --strict` is valid
-   [ ] 7.4 Scan the code next to the changes for regressions; write the state file and the entry in `docs/change-log.md`
