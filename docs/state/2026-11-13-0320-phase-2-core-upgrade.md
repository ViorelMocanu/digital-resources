---
state_id: 2026-11-13-0320-phase-2-core-upgrade
created: 2026-11-13T03:20+02:00
trigger: pause-point
task: Phase 2 of the upgrade, the core move to Astro 7, worked on alone through the night
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 957dbbf
working_tree: uncommitted; the list is in section 12
supersedes: 2026-11-13-0255-phase-2-core-upgrade
---

# State: Phase 2 built, the router fix being reworked as a package patch (2026-11-13 03:20)

## 1. Resume here

**Status:** everything in `docs/state/2026-11-13-0255-phase-2-core-upgrade.md` still holds (read its sections 3 and 6 for the decisions and the facts; they are not repeated here in full). Since then the navigation regression was understood and fixed once, and that first fix is being replaced by a cleaner one. The time in this file's name is approximate.

**The regression and its cause (verified):** `astro-capo` 0.0.1 builds the head with `head += await renderSlotToString(result, slots.default)`. Since Astro 5 that string holds no component scripts (they sit in the result's `chunks`), so the client router's script never reached pages that use `src/layouts/Layout.astro`. `/README/`, which uses a plain `<head>`, had the script.

**First fix (in the tree now, works, but fails lint):** `src/components/SortedHead.astro` renders the slot with `Astro.slots.render('default')` and passes it to `astro-capo` through `<Fragment set:html={html} />`; `Layout.astro` uses `<SortedHead>`. With it: `node tmp/work/nav-check.cjs .vercel/output/static` equals `tmp/phase2/nav-before.json` exactly, 112 of 112 screenshots identical, head tags equal and in the same order. But `pnpm verify` fails: `astro/no-set-html-directive` is an error in this repository, and silencing a check is not allowed.

**Second fix (in progress, the one to finish):** patch the package at its root with pnpm.

1. `pnpm patch astro-capo@0.0.1 --edit-dir tmp/patch-astro-capo` has been run; the folder exists and nothing in it is edited yet.
2. In `tmp/patch-astro-capo/src/Head.ts`: add `chunkToString` to the import from `astro/runtime/server/index.js`, and change the slot line to `head += chunkToString(result, await renderSlotToString(result, slots.default));`. `Astro.slots.render` does exactly this, and its output was shown to contain the scripts.
3. `pnpm patch-commit "G:\_Projects\digital-resources\tmp\patch-astro-capo"` (with `--config.ignore-scripts=true` if it installs). It writes `patches/astro-capo@0.0.1.patch` and a `patchedDependencies` entry in `pnpm-workspace.yaml`; add a comment there with the reason.
4. In `src/layouts/Layout.astro`: back to `import { Head } from 'astro-capo';` (sorted among the imports) and `<Head>` / `</Head>`; remove the `SortedHead` import.
5. `src/components/SortedHead.astro` is then unused. It was created by the agent in this session and never committed; remove it and say so in the report (or leave it and list it, if in doubt).
6. Rewrite `test/layoutHead.test.ts` for the patch: the patch file exists, `pnpm-workspace.yaml` names it, and the installed `node_modules/astro-capo/src/Head.ts` contains `chunkToString(result, await renderSlotToString(result, slots.default))`. Also fix its lint warning (`wrap-regex` at line 20).
7. Update `docs/lessons.md` L-008 ("Check" line), the proposal and `design.md` of the change (they describe `SortedHead.astro`), then rebuild and re-run: `nav-check`, `extract-site` and `compare-site`, `siteshots` and `compare-pixels`, `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm verify`.

**After that, in order:**

8. Tick the tasks in `openspec/changes/phase-2-core-upgrade/tasks.md` (all are verified except the ones the rework touches; 3.2 is done as "new file, old file emptied", 4.5 as "not needed"); validate with `--strict`.
9. `pnpm audit --prod --audit-level critical` (was exit 0), `pnpm audit` (was 68, none critical).
10. Milestone in `docs/change-log.md`; a final state file; the index row; the commit message checked with `pnpm exec commitlint --edit`; the final report with the open decisions.
11. If nothing blocks: Phase 3 (tooling) starts with its own OpenSpec change.

```text
Read docs/state/2026-11-13-0320-phase-2-core-upgrade.md in the digital-resources repository, then docs/state/2026-11-13-0255-phase-2-core-upgrade.md (sections 3, 4 and 6), AGENTS.md and openspec/changes/phase-2-core-upgrade/. You are the controller, working alone: the owner asked for autonomous work through the night and will make one large commit in the morning; stop only when a decision of the owner blocks all further work. Continue at "Second fix" step 2. Limits: never run a git write, never delete or move an owner's file (list it instead), never read an env file, never silence a check, scratch goes in tmp/, no workers except the web-fetch stand-in for reading documentation, pages must look and behave as before. Installs use pnpm with --config.ignore-scripts=true. Never write a script through a shell here-document or put backticks inside a double-quoted shell string: use the file tool. End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

Unchanged: "i need you to work autonomously for tonight and only stop when you are blocked from doing anything by decisions or insights you need from me - i will do a mega-commit when i wake up" (owner, 2026-11-13).

## 3. Decisions made

Those of the previous snapshot, plus, by the agent:

-   **The head sorter is fixed by a pnpm patch, not by a wrapper component.** Options: a wrapper with `set:html` (public API, but trips a lint error that only the owner may exempt); a wrapper through Astro's internal runtime (new internal-API use in this repository); a plain `<head>` (no hack, but the head order changes on 55 pages and the sorting the owner chose is lost); a one-line patch of the package (fixes the cause where it is, adds no new API use, and is visible as a patch file). The patch was chosen.
-   **The text scenario of `page-stability` now allows "a difference the proposal names"**, for the hidden "Play" label.
-   **`vitest.config.ts`:** the dead `packages/template/*` exclude is gone and `dist/**` is added, because Vitest 4 and later no longer exclude `dist` by default.
-   **`docs/lessons.md` has L-008:** an upgrade that kept every screenshot and lost page navigation.

## 4. Open decisions

Those of the previous snapshot (eight points), plus:

9. `astro-capo` is unmaintained since 2023 and reaches into Astro's internals; it has now needed a patch. Recommendation: A, keep it with the patch until Phase 5 extracts one shared head component, and decide there whether head sorting stays; B, replace it with a plain `<head>` now.

## 5. Plan

Unchanged: `tmp/upgrade-plan/plan.md`; Phase 2 in progress, Phase 3 tooling next.

## 6. Facts established

Those of the previous snapshot, plus, all verified in this run:

-   With the first fix in place: navigation results identical to the baseline; 112 of 112 screenshots identical; head tags equal and in equal order on the page checked (`/front-end/`); text equal apart from the hidden "Play" on the home page; HTML total 3,422,109 bytes against 3,160,253 before.
-   `pnpm coverage` runs on Vitest 5.1.0: 863 tests passed, 79.92 percent of statements.
-   The Vitest migration guides for versions 3, 4 and 5 were read (through a foreground `web-fetch` call). What applies here: `dist` is no longer excluded by default (handled); unawaited `rejects` assertions now fail (the suite passes); coverage reports only files a test loaded unless `coverage.include` is set (left as it is; a Phase 4 matter).
-   The last full `pnpm verify` that passed (exit 0, 859 tests, 16 lint warnings as before) was before the first fix; with the first fix it fails on the one lint error named above and has one new warning in `test/layoutHead.test.ts`.
-   `pnpm exec openspec validate phase-2-core-upgrade --strict`: valid after the proposal and design were amended.

## 7. Subagent and external research results

No worker. Foreground `web-fetch` calls only: the Astro upgrade guides for 5, 6 and 7, and the Vitest migration guides for 3, 4 and 5. Their relevant content is in section 6 of this and the previous snapshot.

## 8. Owner context and preferences

Unchanged.

## 9. Pending owner actions

Unchanged: review and commit; Vercel Node 24.x before the push; the open decisions.

## 10. Caveats and unverified claims

-   The second fix is not applied yet; until it is, `pnpm verify` fails on one lint error.
-   Unverified: that `pnpm patch-commit` works with install scripts off, and that the patched package survives `pnpm install --frozen-lockfile --ignore-scripts` on a clean checkout.
-   The proposal, `design.md` and L-008 currently describe `SortedHead.astro`; they must be rewritten for the patch.
-   Everything listed as unverified in the previous snapshot still is.

## 11. Suggested skills for the next session

`openspec-apply-change`; `superpowers:verification-before-completion` before the final report.

## 12. Files written or changed in this session

Those of the previous snapshot, plus:

-   Changed since: `src/layouts/Layout.astro` (uses `SortedHead`), `vitest.config.ts`, `docs/lessons.md`, `docs/state/README.md`, `openspec/changes/phase-2-core-upgrade/proposal.md`, `design.md` and `specs/page-stability/spec.md`.
-   New since: `src/components/SortedHead.astro` (to be removed again), `test/layoutHead.test.ts` (to be rewritten), `docs/state/2026-11-13-0255-phase-2-core-upgrade.md`, this file.
-   Local only: `tmp/patch-astro-capo/` (the open patch), `tmp/phase2/nav-before.json` and `nav-after.json`, `tmp/work/nav-check.cjs`.
