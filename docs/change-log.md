# Change log

The project's milestones, newest first. It answers "what happened, and what did we learn"; `docs/state/` holds the detail and `docs/lessons.md` holds the mistakes.

## Rules

1. **Each major milestone gets an entry with a short retrospective:** what was delivered, what went well, what to do differently, what comes next. A milestone is a finished phase, a review round, a launch, or a decision that changes the plan.
2. **Each `/simplify` run records its range** in the table below: the base commit, the end commit, the date, and what it covered. A run covers everything changed since the previous run's end, committed or not. If the table is empty, the agent asks the owner for the base before it starts.
3. Entries are added, never rewritten. A correction is a new entry that names the old one.
4. An entry states facts with their evidence: a commit, a file, a command and its result. No secrets and no personal details: the repository is public.

## Simplify runs

| Date | Base commit | End commit | Covered |
| --- | --- | --- | --- |
| 2026-11-11 | `cce652e` | `07e2491` plus the uncommitted fixes of this run | The build fix (`f7f92d8`) and the first harness part (`07e2491`). The next run starts at the commit that holds these fixes. |
| 2026-11-12 | `b6bb524` (holds the fixes of the run above) | `9637f04` plus the uncommitted fix of this run | The static output switch and the disabled deep scan (`9637f04`). The next run starts at the commit that holds this fix. |
| 2026-11-13 | `080cb3c` (holds the fix of the run above) | `f72a0b4` plus the uncommitted fix of this run | Harness part one's OpenSpec content and Phase 1 (`f72a0b4`), with four foreground reviewers. One fix: `openspec/config.yaml` no longer repeats `AGENTS.md`. The next run starts at the commit that holds this fix. |
| 2026-11-13 | `9ff8be8` (holds the fix of the run above) | `5fec300` plus the uncommitted fixes of this run | The port script (`957dbbf`), Phases 2 and 3 and the end-to-end suite (`53a7117`), the lint fixes (`5fec300`), with four foreground reviewers. Fixes: one source for the served folder, the port and the built-site check; the network block compares origins; one `narrow` option per project; one table of page kinds; the notice hooks return 0 in their shared function; `requireMinWidth` builds its message from the minimum. The next run starts at the commit that holds these fixes. |

## Milestones

### 2026-11-13: the approved findings of the fourth simplify run are built

**Delivered**

-   Four of the five findings the owner approved, as `openspec/changes/phase-4-e2e-followups/`, all tasks ticked. The fifth, the navigation test as a gate, goes into the CI workflow by the owner's decision.
-   The browser suite runs 88 tests in about 37 seconds (190 tests and about 70 seconds before): each page is loaded once at the desktop size with its head checks as a step, the narrow project loads one page of each kind, and no trace is recorded.
-   `src/utils/collections.ts` fetches each collection once per build for the header, the footer and the resource lists. All 106 built files equal the build before.
-   `scripts/lib/pnpm-overrides.ts` and its test fail `pnpm verify` when an override has nothing left to override. The `minimatch` override names its four parents. `pnpm audit` still reports nothing.
-   The port script uses the harness sync's frontmatter parser.

**What went well**

-   The overrides check was wrong at first (a package without the dependency counted as asking for any version), and its hand-written cases said so before it ran on the repository.
-   Each reduction of the suite was followed by a broken copy of the site: without the router script, with an image without a text alternative, and with a page without its robots tag. All three still fail.

**What to do differently**

-   A first survey of the installed packages started one process per package and ran for five minutes. A survey of many files is one script, written with the file tool.
-   pnpm's store keeps packages of earlier installs and shortens long folder names. What is installed is read from the lockfile; the store is only where the manifests are.

**Next**

The rest of Phase 4: the CI workflow (with the navigation test as its gate), committed screenshots and the dependency bot.

### 2026-11-13: the end-to-end suite exists (Phase 4, first part)

**Delivered**

-   `pnpm test:e2e` runs 190 browser tests of the built site with Playwright 1.65.0: every page loads with a title and a main heading and no script error, every head has its language, canonical address and `noindex` tag, navigation works without full page loads at two sizes, and the axe engine finds nothing beyond a written list. The change is `openspec/changes/phase-4-e2e-suite/`, all tasks ticked.
-   The lesson of Phase 2 (L-008) has its check: against a copy of the site without the router script the navigation test fails.
-   `scripts/serve-static.ts` serves the build output for the tests, with 9 unit tests. `pnpm verify` exit 0 with 871 tests; the built pages are unchanged; `pnpm audit` still reports nothing.

**What went well**

-   Each test was shown to fail before it was trusted: a broken copy of the site made the navigation test and the accessibility test fail.
-   Today's accessibility findings became a list the test holds both ways: a new finding fails, and so does a listed one that no longer happens.

**What to do differently**

-   A run stopped from outside left its test runners alive, and they disturbed the next hour of diagnosis. A long run is started in the background and waited for, never cut short with a time limit around it.
-   More than one browser at a time made page loads stop for 30 seconds on this machine. Three ways of starting the server did not change it and the cause is not known; the suite runs with one worker. This is an open problem, not a solved one.
-   Two scratch runs loaded pages without blocking outside requests, so the browser asked three third-party hosts the pages name (an analytics script and two status badges). Scratch browser runs block outside requests from the first line.

**Next**

The owner's decisions; then the rest of Phase 4 (the pipeline, committed screenshots, the dependency bot) and the second harness part.

### 2026-11-13: Phase 3 finished, the tools are current and the audit is empty

**Delivered**

-   The linters and commit tools moved to their current lines: `eslint` 9 to 10.14.0 with `typescript-eslint` 8.72.1, `eslint-plugin-astro` 3.2.1 and `eslint-plugin-jsdoc` 65.4.4; `stylelint` 16 to 17.16.0; `markdownlint-cli` 0.50.0; commitlint 21.2.4. The change is `openspec/changes/phase-3-tooling/`, all tasks ticked.
-   `eslint.config.js` states its shared rules once. ESLint covers the same 77 files and reports the same 16 warnings.
-   The git hooks are light: the pre-commit hook lints and checks the format, the pre-push hook runs `pnpm verify`, and no hook builds the site or rewrites a file.
-   `pnpm audit` reports no known vulnerability (68 before the phase), through in-range updates and five commented overrides in `pnpm-workspace.yaml`.
-   The pages did not change: all 106 built files equal the build before the phase. `pnpm verify` exit 0 with 862 tests.

**What went well**

-   The comparison was made stricter before it was used. Two builds of one tree turned out to differ in asset names and in a build time printed in every page; with those two set aside the comparison is byte for byte, and it caught the next point at once.
-   The prettier upgrade was tried and measured instead of applied: the new Astro plugin changed the HTML of every page, so it was taken back and left as a decision.

**What to do differently**

-   The three state snapshots written earlier this night carry times ahead of the system clock (the newest says 03:45; the clock said 03:12 after it). The time in a snapshot name is read from the clock at the moment of writing, not estimated.
-   The plan named versions (stylelint 18, prettier 3.9) months before the work. A plan names the line to reach; the version is chosen on the day, by age and by trial.

**Next**

The owner's decisions (the prettier upgrade, activating the hooks), then the second harness part and Phase 4: the end-to-end suite, CI and the dependency bot.

### 2026-11-13: Phase 2 finished, the site runs on Astro 7

**Delivered**

-   The core moved in one step: `astro` 4.16.7 to 7.4.7, the Vercel adapter 7 to 11, `typescript` 5 to 6, `vitest` 2 to 5, `sharp` 0.33 to 0.35, `sass` replaced by `sass-embedded`, Node floor 24. The collections use the Content Layer. The change is `openspec/changes/phase-2-core-upgrade/`, all tasks ticked.
-   Against the build before the phase: the same 56 pages and 57 sitemap addresses, the same head tags in the same order, 112 of 112 screenshots identical, and the same behaviour in a browser run over navigation, the back button and the mobile menu. One hidden word is new on the home page (a "Play" label for screen readers, from the embed package).
-   `pnpm verify` exit 0 with 862 tests; `pnpm audit` reports no critical advisory (68 in all, 3 in what the site ships, all under a build tool of the adapter).
-   pnpm now refuses any release younger than seven days (`pnpm-workspace.yaml`).

**What went well**

-   The order of work paid off: the content migration was built and compared before anything else changed, so the first Astro 7 build already matched the baseline pixel for pixel, and each later step had one cause.
-   The browser run found what no screenshot could: the head sorter had dropped the client router's script, and every link had become a full page load (`docs/lessons.md`, L-008).

**What to do differently**

-   The behaviour check was the last comparison to run. It belongs in the baseline step of every phase, next to the screenshots, and in the end-to-end suite of Phase 4.
-   `pnpm dedupe` was used to repair one peer dependency and moved `prettier` six minor versions on the way. A narrow fix (`packageExtensions`) was the right tool from the start.
-   One shell command put backticks inside a double-quoted string and lost them, the mistake L-007 already describes. Text with backticks goes through the file tool.

**Next**

Phase 3, the tooling: eslint 10, stylelint 18, prettier 3.9, commitlint 21, the husky hooks, and overrides for the three advisories left under the adapter's build tool.

### 2026-11-12: harness part one and Phase 1 finished

**Delivered**

-   The first harness part is complete: twelve OpenSpec skills and workflows in `.agents/` with their Claude Code copies, `openspec/config.yaml`, and the changes `harness-h1a` and `phase-1-prune-static`, both valid under `openspec validate --strict`.
-   Phase 1 is complete: nine unused packages removed, the image host wildcard removed, every page marked `noindex, nofollow` through one switch in `src/config.ts`, the debug line and the placeholder view count removed, the two test resources deleted with the owner's consent.
-   The site is static and live since `9637f04`; the open image endpoint answers 404.
-   `pnpm verify` passes for the first time: 815 unit tests, 24 generated files fresh, format clean.

**What went well**

-   The phase was checked in two steps. After the package removal alone, all 116 screenshots matched the baseline, so every later difference could be traced to a named change: 32 pages stayed identical, 24 pages that show resources changed, 2 pages were removed.
-   A spec scenario caught its own mistake: "no page contains the text partytown" failed on a page that only mentions the package in prose, and was rewritten to test for the shipped files.

**What to do differently**

-   The static switch went in before its change folder existed. An urgent fix still gets its change written in the same session, as happened here, not later.
-   The stock OpenSpec text was ported with a scratch script. If the port is needed again at the next OpenSpec upgrade, the script moves into `scripts/` with a test.

**Next**

Phase 2, the core upgrade (Astro 7.4, Node 24, TypeScript 6, vitest 5), written as an OpenSpec change before any code.

### 2026-11-11: plan approved, build fixed, first harness part started

**Delivered**

-   A scan of the repository and its 226 dependency alerts, and a phased upgrade plan with the owner's decisions on it.
-   The build works again after an install with scripts off (commit `f7f92d8`): the manifest plugin was replaced by a static manifest, and the lint scripts call the local stylelint.
-   The first harness part, in progress: the command guard with a read-only git policy, the state hook, the Claude Code settings, the agent contract and these documents. State: `docs/state/2026-11-11-1521-harness-h1a.md`.

**What went well**

-   A baseline of every built page and 116 screenshots was recorded before the first change, so "nothing changed" is a comparison, not an opinion.
-   The hook scripts came with their tests; running those on this repository's older test runner settled in minutes whether they could be adopted now.

**What to do differently**

-   Write the first state file at the start of long work, not when the hook asks (`docs/lessons.md`, L-006).
-   Write scripts with the file tool, never through a here-document (L-007).

**Next**

Finish the first harness part (the OpenSpec skills and workflows, and one change per phase), then Phase 1: remove unused dependencies and switch to static output.
