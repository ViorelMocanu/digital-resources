# Tasks

Every fix lists its failing test first. A test that asserted the old, faulty behaviour is changed in its own task, with the reason. The detail of each item (locations, page difference, expected values) is in the read-only map of 2026-11-14 summarised in the proposal.

## 1. Baseline

- [x] 1.1 Record `pnpm verify` and `pnpm build`, and keep a copy of the build output for the comparison in 8.3: verify exit 0, 1,059 passed, 1 skipped, 0 warnings; build exit 0, 56 pages, 105 files, copied to `tmp/compare/p5-before/` (2026-11-14)

## 2. Pages and navigation

- [x] 2.1 Test first (`e2e/pages.spec.ts`): the subcategory text of `/front-end/html/emmet/` and `/front-end/unelte-utile-de-front-end/ide/`; then `render(subcategory)`
- [x] 2.2 Test first: every internal link of every built page leads to a built page, `/login` listed as a known gap; then `/t`, `/r` in the three places
- [x] 2.3 Test first: active chips on `/t/carte/` (1) and `/t/free/` (5), none on a resource page; then `highlightUrl` with `t/` in `ResourceTagList.astro`
- [x] 2.4 Test first: one active footer item on each of the five footer pages and on `/front-end/`; then the five fragments without a leading slash
- [x] 2.5 Test first: the book icon (U+1F4D6) on `/r/resilient-web-design/` and its card on `/t/carte/`; then the icon from `data.type` in both places, `ExtendedResource.type` removed
- [x] 2.6 `MISSING_FILES` emptied first (the smoke test fails on the seven category pages); then `image()` for the category image and its `.src`. Check (2.1 to 2.6): the 9 new tests and the 2 smoke cases failed first; after the fix `pnpm build` exit 0 and `pnpm exec playwright test pages smoke --project=desktop` 67 passed; the build comparison shows only the named differences (2026-11-14)

## 3. Head and SEO

- [x] 3.1 Test first (`e2e/sitemap.spec.ts`): every sitemap address is a built page and `external-page2` is not one; then the custom page and the filter leave `astro.config.mjs`
- [x] 3.2 Test first: `toIsoDateTime` in `test/resourceMeta.test.ts`, and the resource page's ISO `article:published_time`; then the conversion in `r/[slug].astro`
- [x] 3.3 Test first: undated pages print neither `article:*` tag; then the build-time default, `__DATE__` and `GLOBAL_PUB_DATE` go
- [x] 3.4 Test first: `getFormattedDate` in three time zones (its own test file); then the UTC getters. Separate step: the old test's local-time `new Date(2022, 1, 1)` becomes `Date.UTC`, with the reason
- [x] 3.5 Separate step, with the reason: the smoke test's canonical expectation changes from "ends with a slash" to "without the final slash", and `og:url` must equal it; the sitemap test refuses slashed addresses. Then `trailingSlash: 'never'`
- [x] 3.6 Test first: `/README/` is not a built page and not in the sitemap, `PAGES_WITHOUT_H1` empty; then delete `src/pages/README.md` (owner decision 15)
- [x] 3.7 Separate step, with the reason: `test/layoutHead.test.ts` is rewritten, because its subject (the patch) goes; it and a smoke step expect no `astro-capo` and no `data-capo`. Then remove the patch entry, `pnpm remove astro-capo`, and `<head>` in `Layout.astro`. Check (3.1 to 3.7): each new or changed test failed first; after the fixes `pnpm build` exit 0 (55 pages), `pnpm exec playwright test pages smoke sitemap navigation` 82 passed in both projects, the date tests 16 passed, the head test 2 passed; the stylesheet is byte-identical under its new chunk name; the lockfile lost only the astro-capo entries; the build output holds the 308 redirect from the slashed form (2026-11-14)

## 4. Content model

- [x] 4.1 Test first: `formatRating` and `ratingSchema` (`test/rating.test.ts`), and `10/10` on a resource page; then the schema module, the display in both places and the five stored values
- [x] 4.2 Test first: `findBrokenReferences` (`test/contentIntegrity.test.ts`) and a source test that the resource route calls `assertContentIntegrity(`; then the module and the call
- [x] 4.3 Test first: sorting with an undated resource, and a tie broken by id (`test/getSortedItems.sorting.test.ts`); then one comparator, the three inline comparators replaced
- [x] 4.4 Test first: categories absent or empty and a missing type tag render; then the guards in `r/[slug].astro`, `ResourceList.astro` and `ResourceLocationList.astro`, and the `modDate` refine
- [x] 4.5 Test first: `pageUrl` (`test/pagination.test.ts`); then `Pagination.astro` builds its links from the first address
- [x] 4.6 Test first: the width rule throws a named message for an unresolved image; then the check in `imageRules.ts`. Check (4.5, 4.6): both new tests failed first, then pass (pagination 3, image rule 5); eslint on the changed files exit 0; pnpm typecheck 0 errors, 0 warnings, 2 hints (the two toThrowError hints left with the old sort test) (2026-11-14)

## 5. Tests and tooling

- [x] 5.1 Test first: `sortEntries` with hand-written entries; then the pure function inside `getSortedItems`, and the old test file rewritten without the commented-out block. Check (4.1 to 4.4 and 5.1): each new test failed first; then the unit tests pass (rating 18, reference check 8, sort 9, resource list 3 through Astro's container API), `pnpm build` exit 0, `pnpm exec playwright test pages smoke sitemap navigation` 84 passed in both projects; 49 places on 19 pages read 10/10 instead of 100 (10); /r/ and the tag lists keep their order (2026-11-14). The `?? []` guard in the resource route has no test that failed first: the route renders a real content entry
- [x] 5.2 Test first: `highlightUrl` decides from its argument alone, with a stubbed `window`; then the window branch goes, `currentUrl` is required, `Avatar.astro` passes its path; the three duplicate tests become one per case. Check: the window-stub test failed first (it returned active), then 3 passed; eslint exit 0 (2026-11-14). The three identical tests went: they all ran the removed branch
- [x] 5.3 Test first: a probe outside every landmark is reported by element; then the accessibility test and `PAGE_KINDS` compare rule and element. Check: pnpm exec playwright test a11y 21 passed (10 kinds at both sizes and the probe); the lists were taken from one run and four selectors spot-checked in the built HTML (#hero, .HeroVisual, .Breadcrumbs, fieldset[role=search]); transition-scope hashes are masked, as they change with any component edit. The probe test was written with findingsOf in one step and never seen failing (2026-11-14)
- [x] 5.4 Separate step, with the reason: the overrides test's expectation at lines 20-23 changes; then new cases first and `caughtUp` with `minVersion` and `gte`. Check: the two new cases failed first; then 17 passed, the repository case included, so no override of pnpm-workspace.yaml is reported under the stricter rule; eslint exit 0 (2026-11-14)
- [x] 5.5 Test first: the formatted port output equals the committed skills; then the port formats its output, one re-baseline with `pnpm openspec:port` and `pnpm harness:sync`, and step 4 of `docs/agent/harness-sync.md`. Check: the drift test failed first (portedFiles missing), then on exactly the 11 skills the map named; after pnpm openspec:port and pnpm harness:sync, 22 files changed (11 skills and their copies, 176 lines removed, 12 added: 82 blank lines and 6 table lines each), and scripts/openspec-port.test.ts with scripts/sync-harness.test.ts 156 passed (2026-11-14)
- [x] 5.6 Lint first: the `property-no-deprecated` exception goes (3 errors); then the three `clip` declarations and the unused `.visually-hidden` rule go. Check: with the exception removed, pnpm lint:css failed with exactly 3 errors (91:11, 92:58, 94:16); after the fix it passes. .visually-hidden has no user: the home page's match is the embed's own lyt-visually-hidden class (2026-11-14)
- [x] 5.7 Test first (`scripts/formatter.test.ts`): a type argument in a template survives formatting; then `prettier-plugin-astro` 1.1.2, `pnpm format:fix`, and every non-Markdown change read (L-009). Check: the type-argument test failed on 0.14.1 and passes on 1.1.2. The first reformat was not output-neutral: 1.x formats for Astro 7's default `compressHTML: 'jsx'` (a whitespace run holding a newline is dropped), while this site builds with `compressHTML: true` (one space kept), so it put spaces inside links and before the full stop of the copyright line; the screenshots of 55 pages at 1440 and 390 pixels differed in 110 of 110 (a build against itself: 0). Test first: a second case formats a paragraph with links and compares its visible text; it failed (`Autorul proiectului {' '} și{' '} comunitatea proiectului .`), then passed with `"astroCompressHTML": "html"` in `.prettierrc`. The spaces the first pass had left inside 25 elements went back to the last commit's tight form, and the resource description paragraph too; `pnpm format:fix` then changed nothing. `pnpm build` exit 0, 55 pages; against the build before the reformat: screenshots 0 of 110 differ; the HTML differs only in whitespace at the inner edges of the "mark as not done" button (`ResourceStatus`) and `h2.ListNavTitle` (never drawn) and one final semicolon in an inline style on the home page (2026-11-14)

## 6. Documents

- [x] 6.1 `docs/lessons.md` L-008 names the new head check; `docs/change-log.md` gets the milestone and its retrospective. Done: L-008's check line names the rewritten `test/layoutHead.test.ts` and the smoke head step; L-009 records its second occurrence and becomes a check (`scripts/formatter.test.ts`); the milestone entry is at the top of `docs/change-log.md` (2026-11-14)

## 7. Owner items (not built)

- [x] 7.1 The share image, the Vercel analytics script, `/login` and the subcategory images are decided by the owner. Decided 2026-11-15: share cards generated for every page, the analytics script stays, a `/login` placeholder page, subcategory images through the same pipeline when one exists; built in `openspec/changes/phase-5b-owner-answers/`
- [x] 7.2 The owner consents to deleting `src/layouts/LayoutMarkdown.astro`, `src/components/MarkdownTOC.astro`, `patches/astro-capo@0.0.1.patch` and `src/vite-env.d.ts`, or keeps them. Decided 2026-11-15: archived, not deleted, in `tmp/archive/2026-11-15-phase-5/` (task 4.1 of `phase-5b-owner-answers`)

## 8. Final checks

- [x] 8.1 `pnpm verify:fix`, then `pnpm verify`, with 0 warnings. Check: the first `pnpm verify:fix` failed in `tsc` (TS2307: the new container test imports an `.astro` file, which plain `tsc` cannot read; `astro check` passed); `test/astro-components.d.ts` declares such imports with the type `renderToString` takes. Then `pnpm verify:fix` exit 0 and `pnpm verify` exit 0: no lint warning, typecheck 0 errors, 0 warnings, 2 hints, 1,113 unit tests passed and 1 skipped in 26 files, harness mirrors and formatting clean; at 59ff5fb + 122 changed paths (2026-11-14)
- [x] 8.2 `pnpm build` passes. Check: exit 0, 55 pages (2026-11-14)
- [x] 8.3 The build compared with the copy from 1.1: every differing file is one the proposal names, with the difference it names. Check: `node tmp/work/final-diff.mjs tmp/compare/p5-before .vercel/output/static` (head compared as a set of tags, body as a sequence, hashes masked): `/README/` gone (3.6); on 55 pages the plain `<head>` and the stylesheet under a new chunk name (3.7); 54 canonicals and `og:url` without the final slash, and with them the last breadcrumb link and the Speed Insights `data-pathname` (3.5; the proposal now names the last two); the build-time `article:*` dates gone from 50 undated pages and ISO dates on the 5 resource pages (3.3, 3.2); `10/10` in 49 places (4.1); the 14 subcategory texts in place of the placeholder (2.1); `/t` and `/r` links (2.2); 24 active chips (2.3); 5 active footer items (2.4); the book icon (2.5); 7 category images (2.6); one semicolon in an inline style (5.7). The stylesheet differs only by the three rules of 5.6. `node tmp/work/ws-gaps.mjs` against the build before the reformat: 6 whitespace gaps, all at the inner edges of a button or a heading (5.7) (2026-11-14)
- [x] 8.4 `pnpm test:e2e` passes. Check: exit 0, 105 passed in 46.6 s, against the build of 8.2, at 59ff5fb + 122 changed paths (2026-11-14)
- [x] 8.5 `pnpm exec openspec validate phase-5-due-fixes --strict` passes. Check: "Change 'phase-5-due-fixes' is valid" (2026-11-14)
