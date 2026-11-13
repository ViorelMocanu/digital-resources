---
state_id: 2026-11-13-1728-phase-4-e2e-followups
created: 2026-11-13T17:28+02:00
trigger: pause-point
task: build the findings of the fourth simplify run that the owner approved
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 24d034b
working_tree: uncommitted; the list is in section 12
supersedes: 2026-11-13-0418-phase-4-e2e-suite
---

# State: the approved simplify findings are built and checked, uncommitted (2026-11-13 17:28)

## 1. Resume here

**Status:** the change `phase-4-e2e-followups` is built, checked and fully ticked. Nothing is committed. Since the previous snapshot the owner committed the night's work (`53a7117`), the lint fixes (`5fec300`) and the fourth simplify run (`24d034b`), and set the Vercel project's Node version to 24.x.

**Check receipts**, all at `24d034b` plus the working tree in section 12:

-   `pnpm install --frozen-lockfile --ignore-scripts`: exit 0.
-   `pnpm verify`: exit 0. Lint reports no problem; 17 test files, 885 tests passed; "All 24 generated files are fresh"; format clean.
-   `pnpm build`: exit 0, 56 pages.
-   `node tmp/work/p3-html-diff.cjs tmp/phase3/before/static .vercel/output/static`: 106 files, 106 the same.
-   `pnpm test:e2e`: exit 0, "88 passed" in about 37 seconds.
-   Against `tmp/phase4/broken`: the navigation and accessibility specs fail (4 failed, 18 passed). Against `tmp/phase4/nohead` (the FAQ page without its robots tag): the smoke spec fails (1 failed, 65 passed).
-   `pnpm audit`: "No known vulnerabilities found".
-   `pnpm exec openspec validate phase-4-e2e-followups --strict`: valid.

**Next actions, in order:**

1. The owner reviews and commits. A commit message is in `tmp/work/commitmsg-followups.txt`, checked with commitlint.
2. The rest of Phase 4, once the owner says so: the CI workflow with the navigation test as its gate, committed screenshots, the dependency bot.

```text
Read docs/state/2026-11-13-1728-phase-4-e2e-followups.md in the digital-resources repository, then AGENTS.md. The change phase-4-e2e-followups is finished and uncommitted; the owner makes the commit. You are the controller. The next work is the rest of Phase 4 (a CI workflow that runs pnpm verify, the build and pnpm test:e2e with the navigation test as a gate; committed screenshots compared in the pipeline; the dependency bot): write it as an OpenSpec change first and start only when the owner has said so. Limits: never run a git write, never delete or move a file (list it instead), never read an env file, never silence a check, scratch goes in tmp/, the built pages must not change unless the change names the difference. Installs use pnpm with --config.ignore-scripts=true; pnpm refuses releases younger than seven days. Checks: pnpm verify, pnpm build, node tmp/work/p3-html-diff.cjs against the previous build, pnpm test:e2e (one worker; start it in the background and wait, never wrap it in a time limit). End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

"i agree with: Load each page once for the smoke and head tests; run the mobile smoke test on 10 pages instead of 56; turn traces off / Reuse the harness sync's frontmatter parser in the port script / A check that notices when a pnpm override is no longer needed; narrower scope for the `minimatch` override / Run the navigation test where upgrades are gated / Repeated collection fetches in `ResourceList`, `Header`, `Footer`. what is next?" Then, to the question where the navigation test should gate: "A" (in the CI workflow, with the rest of Phase 4). Owner, 2026-11-13.

## 3. Decisions made

-   2026-11-13, the owner: the five findings above are approved. The JSDoc type rules for TypeScript files were not picked and stay as they are.
-   2026-11-13, the owner: the navigation test gates in the CI workflow (A), not in the pre-push hook (B).
-   2026-11-13, the agent: `semver` and `@types/semver` added as development dependencies for the overrides check. Options: a hoisted, undeclared import (breaks when hoisting changes), or a hand-written range comparison (error-prone).
-   2026-11-13, the agent: the collections are kept only in a build, not while developing, so an edited content file still shows at once.
-   2026-11-13, the agent: the narrow project skips tests by a tag (`@desktop-only`), so no test shows as skipped.
-   2026-11-13, the agent: the `minimatch` override names four parents, not two: the installed manifests show four packages asking for version 10.

## 4. Open decisions

1. Consent to delete two emptied files: `src/content/config.ts` and `e2e/head.spec.ts`.
2. The go-ahead for the rest of Phase 4 (workflow file, screenshots, dependency bot); where screenshots are compared: A, in the pipeline only; B, also locally.
3. The JSDoc type rules for TypeScript files: A, leave; B, turn the two type rules off for every `.ts` file.
4. Still open from `docs/state/2026-11-13-0418-phase-4-e2e-suite.md`, section 4: items 3 to 15 and 17 there (the placeholder vote count, two dead files, sitemap samples, the OpenSpec commands in the guard, `partytown={false}`, the "Play" label, `astro-capo`, prettier, two style properties, the review round, the build time as publication time, the `/README/` page, a row for `pnpm test:e2e` in `AGENTS.md`, the parallel stops).

## 5. Plan

`tmp/upgrade-plan/plan.md` (local). Done: build fix, Phase 0, harness part one, Phases 1, 2 and 3, the tests of Phase 4 and their follow-ups. Next: the rest of Phase 4 (pipeline, screenshots, dependency bot), the review round, harness part two, Phase 5 (due fixes), Phase 6 (product).

## 6. Facts established

Verified in this run: every receipt in section 1, and:

-   The suite: 67 desktop tests (56 smoke with head checks, 10 accessibility, 1 navigation) and 21 narrow ones (10 smoke, 10 accessibility, 1 navigation).
-   Four installed packages of the lockfile ask for minimatch 10: `eslint` 10.14.0, `@eslint/config-array` 0.23.5, `@typescript-eslint/typescript-estree` 8.72.1, `markdownlint-cli` 0.50.0. After the change the lockfile holds minimatch 11.0.5 and 3.1.5.
-   `node_modules/.pnpm` holds packages of earlier installs (an older eslint and vite among them) and shortens long folder names to a hash.
-   The Vercel project's Node version is 24.x (historical, 2026-11-13, the owner's screenshot).

## 7. Subagent and external research results

Four foreground reviewers ran in the fourth simplify run, earlier in this session; their findings are the source of this change. Their GAPS: none of them ran a check, and their time estimates were not measured. No worker was started for this change.

## 8. Owner context and preferences

Unchanged: build and test first; options with the recommended one as A; no emojis; the owner makes every commit; no names from other repositories in tracked files; every claim labelled.

## 9. Pending owner actions

Review and commit; `pnpm exec husky` once to activate the hooks; the decisions of section 4.

## 10. Caveats and unverified claims

-   Unverified: the Vercel deployment of this tree, and how the suite behaves on another machine or in a pipeline.
-   The narrow project no longer loads 46 of the 56 pages, and no trace is kept of a failure.
-   The overrides check reads `node_modules`, so it needs an install; an override written `name@range` expires only with its dependants.
-   The collections module was not seen failing before it was written: it is new code, not a fix. Its effect on build time was not measured.
-   The git hooks were run by hand, never by git.
-   The private capture of this session in `tmp/compact-summaries/` was not copied here.

## 11. Suggested skills for the next session

`openspec-propose` for the rest of Phase 4.

## 12. Files written or changed in this session

Uncommitted, for this change:

-   New: `openspec/changes/phase-4-e2e-followups/`, `src/utils/collections.ts`, `test/collections.test.ts`, `scripts/lib/pnpm-overrides.ts`, `scripts/lib/pnpm-overrides.test.ts`, this file.
-   Changed: `e2e/smoke.spec.ts`, `e2e/head.spec.ts` (emptied to a note), `playwright.config.ts`, `scripts/openspec-port.ts`, `scripts/sync-harness.ts`, `src/components/Header.astro`, `src/components/ResourceList.astro`, `src/utils/getSortedItems.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `docs/change-log.md`, `docs/state/README.md`.

Local only: `tmp/phase4/nohead/`, `tmp/work/s5-*.cjs`, `tmp/work/s5-lock-before.yaml`, `tmp/work/logs/s5-*.log`, `tmp/work/commitmsg-followups.txt`.
