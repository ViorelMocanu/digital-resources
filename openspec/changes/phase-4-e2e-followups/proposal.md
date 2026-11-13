# Phase 4 follow-ups: the findings of the fourth simplify run the owner approved

## Why

The fourth simplify run (2026-11-13, `docs/change-log.md`) left five findings for the owner, because each one reached past the code under review or traded something. The owner approved all five on 2026-11-13. This change builds four of them; the fifth is recorded here and built with the pipeline.

A visitor sees no change: the built pages stay byte for byte the same.

## What Changes

1. **One frontmatter parser.** `scripts/openspec-port.ts` had its own parser, for Unix line endings only. It now calls the two helpers of `scripts/sync-harness.ts` (`FRONTMATTER`, `dropFrontmatterKeys`), which become exports. The ported text is the same.
2. **A faster browser suite.**
    - The head checks (language, canonical address, robots tag) move into the desktop smoke test as a step, so each page is loaded once on the desktop, not twice. `e2e/head.spec.ts` is emptied to a note and listed for deletion, since an agent does not delete files.
    - The narrow project runs the smoke test on one page of each kind (the ten of `e2e/known-gaps.ts`), not on all 56.
    - Traces are off. A failing test is run again with `--trace on`.
    - What is lost: a script error that only happens at the narrow width on a page that is not one of the ten kinds, and the trace of a failure that does not happen again.
3. **Collections fetched once.** `Header`, `Footer` and `ResourceList` each fetched and sorted or scanned their collections again on every render. A new module, `src/utils/collections.ts`, fetches each collection once per build and keeps it by id.
4. **Overrides that expire.** `scripts/lib/pnpm-overrides.ts` reads `pnpm-workspace.yaml`, `pnpm-lock.yaml` and the manifests of the installed packages; its unit test fails when an override no longer changes anything, so a line cannot outlive its reason. The `minimatch` override is scoped to the four packages that ask for the old version.
    - Added as development dependencies, to compare version ranges: `semver` 7.8.6 (already in the lockfile under other tools) and `@types/semver` 7.8.0, both older than seven days.
    - A limit: an override written `name@range` (today only `rollup@<4.59.0`) is reported only when nothing asks for that package in that range any more. The check cannot tell when the resolver would pick a fixed version without help.

Found during the work:

-   `e2e/head.spec.ts` is emptied to a note and waits for the owner's deletion.
-   The collections are kept only in a build. While developing, every use fetches again, so an edited file still shows up at once.
-   The overrides check found its own first mistake: a package that does not depend on the overridden one counted as asking for any version. The hand-written cases caught it before the check was trusted.

## Not in this change

5. **The navigation test as a gate** (owner's decision A, 2026-11-13): it runs in the CI workflow, which is the rest of Phase 4, not in the pre-push hook.
6. The JSDoc type rules for TypeScript files: the owner did not pick this finding.

## How it is checked

-   `pnpm verify`, `pnpm build`, and the byte comparison of the build against the build before the change.
-   `pnpm test:e2e`, and the same broken copy of the site as before: the navigation, accessibility and smoke tests must still fail on it.
-   `pnpm audit` after the lockfile moves.

## Impact

-   `scripts/sync-harness.ts`, `scripts/openspec-port.ts`, `e2e/`, `playwright.config.ts`, `src/utils/collections.ts` and its test, `src/utils/getSortedItems.ts`, two components, `scripts/lib/pnpm-overrides.ts` and its test, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
-   The pages: none.
