# Tasks

Every fix lists its failing test first.

## 1. Baseline

- [x] 1.1 Build at `6545861` and keep a copy for the comparison in 6.3. Check: `pnpm build` exit 0, 55 pages, copied to `tmp/compare/p5b-before/` (2026-11-15)

## 2. Answers that change the site

- [x] 2.1 D1 B. Test first: `DEAD_LINKS` emptied, a `/login` test (heading, text, marked link) and a sitemap test without `/login`; then `src/pages/login.astro` and the sitemap filter. Check: the dead-link and `/login` tests failed first, then the sitemap test once the page existed; after the fix 18 passed; the sitemap files are byte-identical to the baseline (2026-11-15)
- [x] 2.2 D6 item 5. Separate step, with the reason: the test that pinned the UTC day changes to the Bucharest day (the owner changed the choice); new winter and summer cases. Then `getFormattedDate` prints the day in Europe/Bucharest. Check: 6 cases failed first (two in each of three zones); then 27 passed, the extreme-date tests unchanged (2026-11-15)
- [x] 2.3 D2 and the share tags. Test first: a smoke step for every page (card address, JPEG 1200 x 630 under 600 KB, alt text, `og:description`, `twitter:*` by name, no `og:email`, `fb:app_id`, `article:publisher`, `og:type` by date) and the not-found canonical as a separate step with the reason; unit tests for the card path, alt text, kind, reading a card back, the title fit, the JPEG and the refused glyph. Then `satori` 0.63.2, `src/utils/shareCard.ts`, `src/utils/shareCardImage.ts`, `src/integrations/shareCards.ts`, the layout's head. Check: the smoke run failed first on 56 of 57 tests; then 77 passed in smoke, pages and sitemap; 56 cards drawn; three looked at, and the first build's cards had the chip and footer cut off, fixed with `box-sizing: border-box` (2026-11-15)
- [x] 2.4 Section 6 findings. Test first: breadcrumb links are paths, redirects lead to built pages, no list in `Access-Control-Allow-Origin`; then `Breadcrumbs.astro` writes paths, the placeholder redirect and the CORS pair leave `vercel.json`. Check: the three tests failed first, then passed (the methods test is a guard that cannot fail before the fix); the `i18n` block left the sitemap with the files byte-identical; the emoji markers left `src/config.ts` (2026-11-15)

## 3. Answers that change the checks

- [x] 3.1 D5 A: `--max-warnings=0` in `pnpm lint:js`. Check: a file with one warning exits 0 without the flag and 1 with it, `--quiet` included; the flag then caught four warnings in this change's own files (2026-11-15)
- [x] 3.2 Section 4: reference screenshots for one page of each kind (20); the CI step's `REFERENCES.txt` marker. Check: `E2E_SHOTS=1 pnpm exec playwright test shots --list` lists 20 tests; the step's script simulated with `pnpm` stubbed in four states (none: takes, marker only: fails, images: compares, update: takes) (2026-11-15)

## 4. Files archived with consent

- [x] 4.1 Move `src/layouts/LayoutMarkdown.astro`, `src/components/MarkdownTOC.astro`, `patches/astro-capo@0.0.1.patch`, `src/vite-env.d.ts` to `tmp/archive/2026-11-15-phase-5/` with a README (owner, D4: archive, do not delete). Check: no reference to them outside themselves; typecheck 0 errors after the move (2026-11-15)

## 5. Documents

- [x] 5.1 `docs/lessons.md` L-010 becomes a check; Phase 5's group 7 points here; the change-log milestone; the findings placed in Phases 6 and 7 (proposal table and the local plan) (2026-11-15)

## 6. Final checks

- [x] 6.1 `pnpm verify:fix`, then `pnpm verify`, with 0 warnings. Check: both exit 0; typecheck 0 errors 2 hints; 1,131 unit tests passed, 1 skipped, 29 files (2026-11-15)
- [x] 6.2 `pnpm build` and `pnpm test:e2e`. Check: build exit 0, 56 pages, 56 cards; browser tests exit 0, 110 passed (2026-11-15)
- [x] 6.3 The build compared with the copy from 1.1. Check: `node tmp/work/final-diff.mjs tmp/compare/p5b-before .vercel/output/static`: the head tags of 2.3 on 55 pages, the card tag, the breadcrumb paths (2.4), `og:type` on 5 pages, `/login` added; and on 7 category pages the hero file is named `security.<hash>.svg` instead of `marketing.<hash>.svg`: the two source files are byte-identical, so the bundler keeps one copy and its name follows the build order (2026-11-15)
- [x] 6.4 `pnpm exec openspec validate phase-5b-owner-answers --strict` passes. Check: "Change 'phase-5b-owner-answers' is valid" (2026-11-15)

## 7. After the walkthroughs began

- [x] 7.1 Node pin A (owner, 2026-11-16). Test first: `test/nodeVersion.test.ts` (`engines.node` is `^24.16.0` and names the `.nvmrc` major); then `package.json` and the Phase 2 spec line. Check: the two tests failed first (received `>=24.16`), then passed; `pnpm verify:fix` and `pnpm verify` exit 0 (1,133 passed, 1 skipped, 30 files; 0 warnings); `pnpm build` exit 0, 56 pages; `pnpm install --frozen-lockfile --ignore-scripts` exit 0, with an Unsupported engine warning on this machine's Node 26.12.1; both changes valid with `openspec validate --strict` (2026-11-16)
- [x] 7.2 Audit fix 1A (owner, 2026-11-19): the override `'satori>fflate': '0.7.5'` in `pnpm-workspace.yaml`, then `pnpm install --ignore-scripts`. The regression check is the CI step `pnpm audit --prod`, which failed on every run before (run 43920111153 at `f1871bf`: fflate 0.7.3 via satori, GHSA-px8p-9vwx-vf98). Check, at `05743d8` plus 4 changed files: the lockfile diff is the override line and the fflate entries only, the same as in the trial copy; `pnpm install --frozen-lockfile --ignore-scripts` exit 0; `pnpm audit --prod` "No known vulnerabilities found"; `pnpm verify` exit 0 (1,134 passed, 1 skipped, 30 files); `pnpm build` exit 0, 56 pages and 56 share cards; against the build before, every file identical except the known name swap of the two identical section icons (7 pages, equal once the name is swapped; Phase 6); `pnpm test:e2e` 110 passed; the change valid with `openspec validate --strict` (2026-11-19)
- [x] 7.3 Engine warning 2A (owner, 2026-11-19): no change. Check: the CI log of run 43920111153 shows Node 24.22.2 and no Unsupported engine line; on Node 24.15.0 at `e52747e`, `pnpm verify`, `pnpm build` and `pnpm test:e2e` (110) exit 0, and the build is byte-identical to the one built on Node 26.12.1 (2026-11-19)
