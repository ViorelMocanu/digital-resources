# Tasks

## 1. Baseline

- [x] 1.1 Keep the build before the change as the comparison point; check: the build of Phase 3 in `tmp/phase3/before/static` is reused, since no site file changed after it
- [x] 1.2 Record the checks before the change; check: `pnpm verify` exits 0 with 862 tests

## 2. Tools

- [x] 2.1 Add `@playwright/test` 1.65.0 and `@axe-core/playwright` 4.14.0; check: `pnpm install --frozen-lockfile --ignore-scripts` exits 0 and `pnpm audit` still reports nothing
- [x] 2.2 Find out whether the browser this version needs is present; check: the revision it asks for (1254) is in the local browser cache, and the first run starts a browser
- [x] 2.3 Write `scripts/serve-static.ts` with its unit test first; check: `pnpm exec vitest run scripts/serve-static.test.ts --reporter=dot`
- [x] 2.4 Write `playwright.config.ts` (one worker, the server started inside the runner), keep `e2e/` out of Vitest, and ignore Playwright's output folders; check: `pnpm test:unit` runs the same test files as before plus the new unit test

## 3. Tests

- [x] 3.1 Smoke test over every built page; check: `pnpm test:e2e e2e/smoke.spec.ts`
- [x] 3.2 Head test over every built page; check: `pnpm test:e2e e2e/head.spec.ts`
- [x] 3.3 Navigation test at both sizes; check: `pnpm test:e2e e2e/navigation.spec.ts`
- [x] 3.4 Prove the navigation test catches L-008; check: against a copy of the output with the router script removed (`node tmp/work/p4-break-site.cjs`, then `E2E_SITE_ROOT`), the navigation test fails at both sizes
- [x] 3.5 Accessibility test with the findings of today written down; check: `pnpm test:e2e e2e/a11y.spec.ts`, and the same broken copy, whose home page has an image without a text alternative, makes it fail

## 4. Closing checks

- [x] 4.1 `pnpm verify` exits 0, with 871 tests in 15 files
- [x] 4.2 `pnpm build` exits 0 and all built files equal those of 1.1
- [x] 4.3 `pnpm test:e2e` exits 0, run twice: 190 passed each time
- [x] 4.4 `pnpm exec openspec validate phase-4-e2e-suite --strict` is valid
- [x] 4.5 The milestone is in `docs/change-log.md` and a state snapshot exists
