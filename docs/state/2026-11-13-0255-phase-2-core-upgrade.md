---
state_id: 2026-11-13-0255-phase-2-core-upgrade
created: 2026-11-13T02:55+02:00
trigger: pause-point
task: Phase 2 of the upgrade, the core move to Astro 7, worked on alone through the night
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 957dbbf
working_tree: uncommitted; the list is in section 12
supersedes: 2026-11-12-2227-phase-1-prune-static
---

# State: Phase 2 mostly built, one regression open (2026-11-13 02:55)

## 1. Resume here

**Status:** the site builds on Astro 7.4.7 with the content migration done, and `pnpm verify` passed on it. One regression is open and must be fixed before the phase is called done: **the client router no longer takes over navigation**. The time in this file's name is approximate (taken from the last build log, not from a clock call).

**The open regression, as far as it is understood:**

-   `node tmp/work/nav-check.cjs <static dir>` drives a browser through header link, resource card, back, tag link and logo at 1440 and 390 pixels.
-   On the build before the phase every step stays in the same document (`sameDocument: true`, 2 full page loads). On the new build every step is a full page load (`sameDocument: false`, 7 loads), and at 390 pixels the browser logs "Transition was aborted because of invalid state. ViewTransition opt-in disabled" twice.
-   The built page has the two `astro-view-transitions` meta tags, but **no script tag for the client router**. The file `_astro/ClientRouter.astro_astro_type_script_index_0_lang.*.js` is in the output and no page references it. Before the phase the router came in through a bundled `hoisted.*.js`.
-   First suspect: `astro-capo` 0.0.1 (`<Head>` in `src/layouts/Layout.astro`, last published 2023), which reorders the children of the head and may drop a script Astro 7 renders differently. Check `LayoutMarkdown.astro` too: it does not use `astro-capo`, so if `/README/` has the router script, the suspect is confirmed.
-   Screenshots and text cannot see this, which is why task 6.5 exists.

**Next actions, in order:**

1. Find why the router script is missing and fix it; re-run `node tmp/work/nav-check.cjs .vercel/output/static` and compare with `tmp/phase2/nav-before.json` (the only accepted difference is none).
2. Re-run the comparison set after the fix: `pnpm build`, `node tmp/work/extract-site.cjs .vercel/output/static tmp/phase2/after-N.json`, `node tmp/work/compare-site.cjs tmp/phase2/before/site.json tmp/phase2/after-N.json`, `node tmp/work/siteshots.cjs .vercel/output/static tmp/phase2/shots-after`, `node tmp/work/compare-pixels.cjs tmp/phase2/shots-before tmp/phase2/shots-after`.
3. Read the Vitest guides for versions 3, 4 and 5 (task 1.4, the Vitest half) and note what applies; the tests already pass on 5.1.0.
4. Update `openspec/changes/phase-2-core-upgrade/` for what the work changed against the proposal (section 3 below), then tick the tasks that are verified.
5. `pnpm verify`, `pnpm audit --prod --audit-level critical`, `pnpm exec openspec validate phase-2-core-upgrade --strict`.
6. Write the milestone in `docs/change-log.md`, a new state file, the commit message (checked with `pnpm exec commitlint --edit`), and the final report.
7. If time remains and nothing blocks: Phase 3 (tooling) starts with its own OpenSpec change.

```text
Read docs/state/2026-11-13-0255-phase-2-core-upgrade.md in the digital-resources repository, then AGENTS.md and openspec/changes/phase-2-core-upgrade/. You are the controller, working alone: the owner asked for autonomous work through the night and will make one large commit in the morning; stop only when a decision of the owner blocks all further work. Continue at "Next actions" step 1: the client router script is missing from the built pages. Limits: never run a git write, never delete or move a file (list it for the owner instead), never read an env file, scratch goes in tmp/, no workers except the web-fetch stand-in for reading documentation, pages must look and behave as before. Installs use pnpm with --config.ignore-scripts=true. End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

The owner, 2026-11-13, after the Phase 2 proposal was written: "i need you to work autonomously for tonight and only stop when you are blocked from doing anything by decisions or insights you need from me - i will do a mega-commit when i wake up".

Earlier in the same session the owner answered three open points: OpenSpec telemetry off; the "(10)" after the rating is not remembered, look in older design files; move the port script into `scripts/`. All three were done and committed by the owner as `957dbbf`.

## 3. Decisions made

By the owner: the autonomous run (above). No answer was given to the eight points listed in the previous report (section 4), so none of them was acted on.

By the agent during the work, each for the owner to overrule:

-   **The collection config was not moved.** A new `src/content.config.ts` was written, and `src/content/config.ts` was reduced to a three-line stub that says it is no longer read. Astro 7 ignores the old file when the new one exists (read in `node_modules/astro/dist/content/utils.js`). The old file waits for the owner's consent to be deleted.
-   **`pnpm-workspace.yaml` is new** and holds three settings: `minimumReleaseAge: 10080` (seven days, so pnpm itself refuses younger releases), an exception for the pinned `@fission-ai/openspec@1.16.1` (five days old on 2026-11-13), an override that makes `astro-simpleanalytics-plugin` use the site's Astro, and a package extension for `@astrojs/astro2tsx@0.1.3`. Each has a comment with its reason.
-   **The analytics plugin was not upgraded.** Every version of it lists one exact Astro as its own dependency (0.3.17 lists 4.15.6), which installed a second, vulnerable Astro. The override removes that copy; the plugin's version and its output stay.
-   **Two image width rules moved out of the schema.** In the Content Layer a schema sees an image only as a path, so `image().refine(width >= N)` fails for every entry. The rules (100 pixels for a section image, 1000 for a local resource image) are now checked where the section page and the resource page are built, through `src/utils/imageRules.ts`, with the same messages. A build still fails on a narrow image.
-   **The Markdown pipeline stays the old one** (`processor: unified(...)` from `@astrojs/markdown-remark`), because Astro 7's new default processor may write the same Markdown as different HTML.
-   **`compressHTML` keeps its explicit value**, so Astro 7's new default (`'jsx'`) does not apply.
-   **Vitest was upgraded early**, because version 2 cannot start with Astro 7's Vite config.
-   **TypeScript 6** needed `moduleResolution: bundler` at once: without it no Astro type resolves.
-   **Loose props in two paginated routes:** `finalPagination` got the type `{ props: any; params: any }[]`, the pattern the third route already used, because Astro 7 infers `unknown` there.
-   **`prettier` was put back to 3.3.3** after `pnpm dedupe` had moved it to 3.9.10; the format tooling belongs to Phase 3.
-   **Four vulnerable transitive packages were updated inside their ranges** (`rollup`, `picomatch`, `mdast-util-to-hast`, `ajv`).

## 4. Open decisions

Carried over from the report of 2026-11-13, unanswered:

1. Consent to delete `src/content/config.ts` (now a stub; it was "consent to move" before).
2. The Vercel project's Node version must be 24.x before Phase 2 is pushed. Astro 7 needs Node 22.23.4 or newer.
3. The "(10)" after each rating is a placeholder vote count (the old mock-up shows "4.5 (10)" on every card). Recommendation: A, remove it in Phase 5 and settle the scale in Phase 6; B, remove it now.
4. Two dead files, `src/utils/csp-hash.ts` and `src/pages/rss.xml.ts`: A, delete; B, keep.
5. Sample entries in the sitemap config: A, remove in Phase 5; B, now.
6. `openspec feedback` and `openspec install` in the guard and `AGENTS.md`: A, in harness part two; B, leave.
7. `partytown={false}` in `Analytics.astro`: A, remove; B, leave.

New:

8. The home page's YouTube embed now carries a hidden "Play" label for screen readers, from `astro-embed` 0.14.0, the first version that accepts Astro 7. It is not visible. Recommendation: A, accept; B, pin the markup back with a local component.

## 5. Plan

`tmp/upgrade-plan/plan.md` (local). Done: build fix, Phase 0, harness part one, Phase 1. In progress: Phase 2 (this file). Next: Phase 3 tooling (eslint 10, stylelint 18, prettier 3.9, commitlint 21, husky hooks, overrides for `glob` and `minimatch` under `@vercel/nft`), harness part two, Phase 4 tests and CI, Phase 5 due fixes, Phase 6 product.

## 6. Facts established

All verified in this run unless marked.

-   **Versions installed** (pnpm chose them under the seven-day rule): `astro` 7.4.7, `@astrojs/vercel` 11.0.20, `@astrojs/sitemap` 3.7.4, `@astrojs/markdown-remark` 7.3.6, `@astrojs/check` 0.9.12, `sharp` 0.35.5, `astro-embed` 0.14.0, `sass-embedded` 1.107.1, `typescript` 6.0.3, `vitest` and `@vitest/coverage-v8` 5.1.0. Removed: `@astrojs/mdx`, `vite` (direct), `sass`. The lockfile holds one `astro` and one `vite` (8.3.6).
-   **Baseline** at `957dbbf`: `pnpm verify` exit 0 with 844 tests; `pnpm build` exit 0, 56 pages; 112 screenshots, taken twice and identical to each other.
-   **On the new stack**, before the regression was found: `pnpm verify` exit 0 (lint 0 errors and the same 16 warnings as before, `astro check` 0 errors, 859 tests in 13 files, 24 generated files fresh, format clean); `pnpm build` exit 0, 56 pages; `pnpm install --frozen-lockfile --ignore-scripts` exit 0.
-   **Comparison with the baseline:** the same 56 pages and the same 57 sitemap addresses; head tags equal on every page; links and images equal; visible text equal on 55 pages, and on the home page one added word ("Play", hidden, see decision 8); 112 of 112 screenshots identical pixel for pixel.
-   **Page weight:** HTML 3,160,253 to 3,416,224 bytes over 56 pages (plus 8 percent, about 4 to 5 KB a page), because Astro 5 and later render each component's script where it is declared instead of one bundled file; script tags went from 224 to 387. Linked CSS went down slightly.
-   **Static output:** `.vercel/output` has no `functions` folder; it has an empty `server` folder; `config.json` has no route to `_render` or `_image`.
-   **Audit:** `pnpm audit --prod --audit-level critical` exit 0. `pnpm audit` reports 68 in all, none critical (7 low, 22 moderate, 39 high); production has 3 left (`rollup`, `glob`, `minimatch`, all under `@vercel/nft`, a build tool of the adapter).
-   **GitHub alerts on 2026-11-13, before this phase:** 191 open, 8 critical (222 and 9 before Phase 1; 31 closed against an estimate of about 26).
-   **Astro 7 facts read from the installed package or the upgrade guides:** the adapter is imported from `@astrojs/vercel` (the `/static` entry is gone); a legacy `src/content/config.ts` alone throws `LegacyContentConfigError`; the glob loader's id is the `slug` frontmatter field if present, else the path-based slug; `image().refine()` cannot see the image; `import.meta.env` values are never coerced; scripts are no longer hoisted.
-   **Not a regression:** the tweet on the home page did not render before either (only its CSS was in the page); the new version logs the failed fetch (HTTP 403 from the embed service) where the old one was silent.
-   **A warning that stays:** "`markdown.remarkPlugins` ... are deprecated" comes from the `astro-embed` integration, not from this repository's config.

## 7. Subagent and external research results

No worker was used. Three foreground `web-fetch` calls read the Astro upgrade guides for versions 5, 6 and 7 (`docs.astro.build/en/guides/upgrade-to/v5/`, `/v6/`, `/v7/`); the items that apply are in section 6 and in the decisions of section 3. Unverified parts of those reports: none were relied on without a check against the installed package or a build.

## 8. Owner context and preferences

Unchanged: build and test first; options side by side with the recommended one as A; no emojis; the owner makes every commit; tracked files never name the owner's other repositories; every claim labelled. New: the owner wants long autonomous runs to continue until a decision blocks all work.

## 9. Pending owner actions

-   Review and commit (one large commit was announced).
-   Set the Vercel project's Node version to 24.x before pushing Phase 2.
-   Answer the open decisions in section 4.

## 10. Caveats and unverified claims

-   **The phase is not done:** the client router regression in section 1 is open.
-   Unverified: the Vercel deployment of this tree, and the alert count after a push.
-   Unverified: the Vitest upgrade guides were not read yet; the suite passes.
-   The screenshot tool blocks every third-party request, so embeds and analytics are not exercised.
-   `node_modules/.pnpm` still holds folders of removed versions; the lockfile is the truth, and a fresh install will not have them.
-   `@astrojs/check` reports an unmet peer for TypeScript 6 from two packages under it; `astro check` runs and passes.
-   The private capture of this session in `tmp/compact-summaries/` was not copied here.

## 11. Suggested skills for the next session

`openspec-apply-change` for the rest of the tasks; `superpowers:systematic-debugging` for the router regression.

## 12. Files written or changed in this session

-   Changed: `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `tsconfig.json`, `src/config.ts`, `src/env.d.ts`, `src/content/config.ts` (now a stub), `src/utils/getSortedItems.ts`, both layouts, `src/components/` (`Footer`, `Header`, `ResourceActionList`, `ResourceList`, `ResourceLocationList`, `ResourceTagList`, `ResourceTOC`), `src/pages/r/[slug].astro`, `src/pages/t/[slug].astro`, `src/pages/t/index.astro`, and the three paginated routes under `src/pages/[section]/`.
-   New: `.nvmrc`, `pnpm-workspace.yaml`, `src/content.config.ts`, `src/utils/imageRules.ts`, `src/utils/envFlag.ts`, `test/imageRules.test.ts`, `test/envFlag.test.ts`, this file.
-   Not yet updated for the work: `openspec/changes/phase-2-core-upgrade/` (tasks unticked, proposal not amended), `docs/change-log.md`, the index in `docs/state/README.md` (done with this file).
-   Local only: `tmp/phase2/` (baseline, extracts, screenshots, navigation results), `tmp/work/extract-site.cjs`, `compare-site.cjs`, `compare-pixels.cjs`, `nav-check.cjs`, `p2-slug-to-id.cjs`, `p2-render.cjs`, logs in `tmp/work/logs/p2-*.log`.
