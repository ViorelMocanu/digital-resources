# Tasks

## 1. Frontmatter parser

-   [x] 1.1 Export `FRONTMATTER` and `dropFrontmatterKeys` from `scripts/sync-harness.ts` and use them in `portSkill`; check: `pnpm exec vitest run scripts/openspec-port.test.ts scripts/sync-harness.test.ts --reporter=dot` (155 passed)

## 2. Browser suite

-   [x] 2.1 Head checks become a step of the desktop smoke test; the narrow project runs the smoke test on the ten page kinds; traces off; check: `pnpm test:e2e` exits 0 (88 passed, about 37 seconds; 190 before)
-   [x] 2.2 The suite still catches a broken site; check: against `tmp/phase4/broken` the navigation and accessibility tests fail (4 failed), and against a copy whose FAQ page lost its robots tag (`node tmp/work/s5-break-head.cjs`) the smoke test fails (1 failed, 65 passed)

## 3. Collections

-   [x] 3.1 `src/utils/collections.ts` with its unit test; check: `pnpm exec vitest run test/collections.test.ts --reporter=dot` (4 passed)
-   [x] 3.2 `Header` and `ResourceList` use it, and `Footer` through `getSortedItems`; check: `pnpm build`, then all 106 built files equal the build before the change

## 4. Overrides

-   [x] 4.1 `scripts/lib/pnpm-overrides.ts` and its test, which reports made-up stale lines and passes on this repository; check: `pnpm exec vitest run scripts/lib/pnpm-overrides.test.ts --reporter=dot` (9 passed)
-   [x] 4.2 Scope the `minimatch` override to its four parents; check: `pnpm install --frozen-lockfile --ignore-scripts` exits 0, the lockfile holds minimatch 11.0.5 and 3.1.5 only, `pnpm audit` reports nothing, `pnpm lint` reports no problem

## 5. Closing checks

-   [x] 5.1 `pnpm verify` exits 0, with 885 tests in 17 files
-   [x] 5.2 `pnpm build` exits 0 and all built files equal the build before the change
-   [x] 5.3 `pnpm test:e2e` exits 0, 88 passed
-   [x] 5.4 `pnpm exec openspec validate phase-4-e2e-followups --strict` is valid
-   [x] 5.5 The change log has its entry
