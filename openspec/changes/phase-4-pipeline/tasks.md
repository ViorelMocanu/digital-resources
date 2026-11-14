# Tasks

## 1. The owner's decisions

- [x] 1.1 Delete `src/content/config.ts`, `e2e/head.spec.ts`, `src/utils/csp-hash.ts` and `src/pages/rss.xml.ts`; remove `partytown={false}`; check: `pnpm build`, then the build comparison shows `rss.xml` gone and nothing else changed by these steps
- [x] 1.2 `AGENTS.md` names `pnpm test:e2e`; `README.md` names today's tools and versions; check: the home page is the one built file that differs (it prints the README)
- [x] 1.3 The two JSDoc type rules are off for every `.ts` file; check: `pnpm lint` reports no problem, and the printed rule set of a file in `src/` differs from before only in those two rules (a reviewer compared nine files)
- [x] 1.4 Prettier 3.9.10 with the Astro plugin unchanged; the two things it damaged repaired by hand; the port script's rules block follows the new list markers; check: `pnpm verify` exits 0

## 2. The review round

- [x] 2.1 Four foreground reviewers read the upgrade for bugs; their findings are in the state snapshot of 2026-11-14
- [x] 2.2 The smoke test records files of the site that are missing; check: against a copy without one style sheet (`node tmp/work/s6-break-asset.cjs`) the smoke test fails on every page that uses it (66 failed, 1 passed)
- [x] 2.3 The seven category pages with a broken image are listed in `e2e/known-gaps.ts`; the accessibility test checks the status of its page; a test checks that the page of every kind is built; check: `pnpm test:e2e` exits 0 (89 passed)
- [x] 2.4 The local server answers "not found" to an address with a null byte; check: the new unit test failed before the fix and passes after
- [x] 2.5 The overrides check refuses a line it cannot read and handles three more selector forms; check: six new unit tests failed before the fix and pass after (`pnpm exec vitest run scripts/lib/pnpm-overrides.test.ts scripts/serve-static.test.ts --reporter=dot`, 25 passed)
- [x] 2.6 The undeclared `zod` import is gone; any `.env.*` file is ignored; the exception to the seven-day rule is removed; check: `pnpm install --frozen-lockfile --ignore-scripts` exits 0 and `pnpm verify` exits 0

## 3. The pipeline

- [x] 3.1 `.github/workflows/ci.yml`, every action pinned to the commit of a release older than seven days; check: the inputs used were read from each action's own definition at that release
- [x] 3.2 `e2e/shots.spec.ts`, left out locally; check: with a scratch configuration that writes to `tmp/`, 66 screenshots are taken, a second run matches all 66, and a copy of the site with one changed colour fails (65 failed, 1 passed: the one page without a main heading)
- [x] 3.3 `.github/dependabot.yml` with the seven-day cooldown, direct dependencies only, one grouped pull request; check: the option names were read from GitHub's reference on 2026-11-14
- [x] 3.4 `static.yml` and `_studio.yml` deleted (both were disabled on GitHub); the scan and greeting workflows pinned to commits, the scan without its two unused permissions
- [ ] 3.5 The first run of the workflow on GitHub is green; the owner downloads the reference screenshots from it and commits them; the next run compares against them

## 4. Final checks

- [x] 4.1 `pnpm verify`, `pnpm build`, the build comparison, `pnpm test:e2e`, `pnpm audit`: receipts in the state snapshot
- [x] 4.2 `pnpm exec openspec validate phase-4-pipeline --strict`
