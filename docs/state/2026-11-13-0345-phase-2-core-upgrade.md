---
state_id: 2026-11-13-0345-phase-2-core-upgrade
created: 2026-11-13T03:45+02:00
trigger: pause-point
task: Phase 2 of the upgrade, the core move to Astro 7, worked on alone through the night
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 957dbbf
working_tree: uncommitted; the list is in section 12
supersedes: 2026-11-13-0320-phase-2-core-upgrade
---

# State: Phase 2 finished and checked, uncommitted (2026-11-13 03:45)

## 1. Resume here

**Status:** Phase 2 is built and checked. Every task of `openspec/changes/phase-2-core-upgrade/` is ticked and the change is valid under `--strict`. Nothing is committed. The time in this file's name is approximate.

**Check receipts**, all at `957dbbf` plus the working tree in section 12:

-   `pnpm verify`: exit 0. Lint 0 errors (16 warnings, the same as before the phase); `astro check` 0 errors; 14 test files, 862 tests passed; "All 24 generated files are fresh"; format clean.
-   `pnpm install --frozen-lockfile --ignore-scripts`: exit 0, and the build after it works (the pnpm patch is applied by the locked install).
-   `pnpm build`: exit 0, 56 pages; `.vercel/output` has no `functions` folder (it has an empty `server` folder); `config.json` has no route to `_render` or `_image`.
-   `node tmp/work/compare-site.cjs tmp/phase2/before/site.json tmp/phase2/after-6.json`: 56 and 56 pages, 57 and 57 sitemap addresses, 0 head tag differences, 0 link differences, 0 image differences, 1 text difference (the hidden "Play" on the home page). Head tag order equal on all 56 pages.
-   `node tmp/work/compare-pixels.cjs tmp/phase2/shots-before tmp/phase2/shots-after`: 112 of 112 identical.
-   `node tmp/work/nav-check.cjs .vercel/output/static`: identical to `tmp/phase2/nav-before.json` (same-document navigation at both widths, no page error).
-   `pnpm audit --prod --audit-level critical`: exit 0. `pnpm audit --prod`: 3 (1 high, 2 moderate: `rollup`, `glob`, `minimatch` under `@vercel/nft`). `pnpm audit`: 68, none critical.
-   `pnpm exec openspec validate phase-2-core-upgrade --strict`: valid.
-   `pnpm why astro`: one version, 7.4.7.

**Next actions, in order:**

1. The owner reviews and commits (a commit message is in `tmp/work/commitmsg-phase2.txt`, checked with commitlint).
2. Before the push: the Vercel project's Node version set to 24.x.
3. Phase 3, the tooling, starts with its own OpenSpec change (`phase-3-tooling`): eslint 10 with `typescript-eslint` and `eslint-plugin-astro` 3, `eslint-plugin-jsdoc`, stylelint 18, markdownlint-cli, prettier 3.9 with its Astro plugin, commitlint 21, the husky hooks rewritten, and overrides for `rollup`, `glob` and `minimatch` under `@vercel/nft`. The promise of that phase: the built HTML does not change at all. The agent may start it in the same night if no decision blocks it.

```text
Read docs/state/2026-11-13-0345-phase-2-core-upgrade.md in the digital-resources repository, then AGENTS.md. Phase 2 is finished and uncommitted. You are the controller, working alone: the owner asked for autonomous work through the night and makes one large commit in the morning; stop only when a decision of the owner blocks all further work. If the owner has not spoken, continue with Phase 3 (tooling): write the OpenSpec change phase-3-tooling first, from tmp/upgrade-plan/plan.md (Phase 3 and the table in section 4), then apply it. Limits: never run a git write, never delete or move an owner's file (list it instead), never read an env file, never silence a check, scratch goes in tmp/, no workers except the web-fetch stand-in for reading documentation, the built pages must not change. Installs use pnpm with --config.ignore-scripts=true; pnpm refuses releases younger than seven days. Never put backticks inside a double-quoted shell string: use the file tool. Compare behaviour (node tmp/work/nav-check.cjs) as well as screenshots. End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

"i need you to work autonomously for tonight and only stop when you are blocked from doing anything by decisions or insights you need from me - i will do a mega-commit when i wake up" (owner, 2026-11-13).

## 3. Decisions made

By the agent, each for the owner to overrule. The first eleven are described in full in `docs/state/2026-11-13-0255-phase-2-core-upgrade.md`, section 3; in short:

-   The collection config was not moved: new `src/content.config.ts`, old file emptied to a note.
-   New `pnpm-workspace.yaml`: seven-day release age, one exception (`@fission-ai/openspec@1.16.1`), an override so the analytics plugin uses the site's Astro, a package extension for `@astrojs/astro2tsx@0.1.3`, and the patch below.
-   The analytics plugin and `@vercel/speed-insights` were not upgraded.
-   The two image width rules moved from the schema to `src/utils/imageRules.ts`.
-   The Markdown pipeline stays the old one (`unified`); `compressHTML` keeps its explicit value.
-   TypeScript 6 with bundler resolution; loose props in two paginated routes, as the third already had.
-   `prettier` stays at 3.3.3 until Phase 3; four vulnerable transitive packages were updated inside their ranges.
-   **The head sorter is fixed by a pnpm patch** (`patches/astro-capo@0.0.1.patch`, one line), not by a wrapper component: a wrapper needed `set:html`, which is a lint error here. The wrapper file the agent had created (`src/components/SortedHead.astro`, never committed) was removed again by the agent.
-   The text scenario of the `page-stability` spec allows "a difference the proposal names".
-   `vitest.config.ts` excludes `dist/**` (Vitest 4 and later no longer do by default).

## 4. Open decisions

1. Consent to delete `src/content/config.ts` (emptied to a note; Astro 7 ignores it).
2. The Vercel project's Node version: 24.x before the push.
3. The "(10)" after each rating, a placeholder vote count: A, remove in Phase 5 and settle the scale in Phase 6; B, remove now.
4. Two dead files, `src/utils/csp-hash.ts` and `src/pages/rss.xml.ts`: A, delete; B, keep. The second causes a build warning ("No API Route handler exists for the method GET for the route /rss.xml").
5. Sample entries in the sitemap config: A, remove in Phase 5; B, now.
6. `openspec feedback` and `openspec install` in the guard and `AGENTS.md`: A, in harness part two; B, leave.
7. `partytown={false}` in `Analytics.astro`: A, remove; B, leave.
8. The hidden "Play" label on the home page's YouTube embed: A, accept; B, pin the old markup with a local component.
9. `astro-capo`, unmaintained since 2023 and now patched: A, keep it with the patch until Phase 5 extracts one shared head component; B, replace it with a plain `<head>` now.

## 5. Plan

`tmp/upgrade-plan/plan.md` (local). Done: build fix, Phase 0, harness part one, Phase 1, Phase 2. Next: Phase 3 tooling, harness part two, Phase 4 tests and CI, Phase 5 due fixes, Phase 6 product.

## 6. Facts established

Verified in this run: every receipt in section 1, and:

-   Installed: `astro` 7.4.7, `@astrojs/vercel` 11.0.20, `@astrojs/sitemap` 3.7.4, `@astrojs/markdown-remark` 7.3.6, `@astrojs/check` 0.9.12, `sharp` 0.35.5, `astro-embed` 0.14.0, `sass-embedded` 1.107.1, `typescript` 6.0.3, `vitest` 5.1.0. Removed: `@astrojs/mdx`, `vite` (direct), `sass`.
-   Page weight: HTML 3,160,253 to 3,422,109 bytes over 56 pages (plus 8 percent), because component scripts are no longer bundled into one file; linked CSS slightly smaller.
-   `pnpm coverage` works on the new runner (79.92 percent of statements).
-   Before this phase GitHub showed 191 open alerts, 8 critical.
-   The old lint packages still read the upgraded project; nothing from Phase 3 had to move forward.
-   Build warnings that remain and are not new problems: the `/rss.xml` route warning (old); the `markdown.remarkPlugins` deprecation, raised by the `astro-embed` integration; a failed fetch of the demo tweet (HTTP 403), which the old version hid.

## 7. Subagent and external research results

No worker. Foreground `web-fetch` calls read the Astro upgrade guides (5, 6, 7) and the Vitest migration guides (3, 4, 5). What applied is in the decisions above and in the previous two snapshots.

## 8. Owner context and preferences

Unchanged: build and test first; options with the recommended one as A; no emojis; the owner makes every commit; no names from other repositories in tracked files; every claim labelled; long autonomous runs continue until a decision blocks all work.

## 9. Pending owner actions

Review and commit; Vercel Node 24.x before the push; the nine open decisions.

## 10. Caveats and unverified claims

-   Unverified: the Vercel deployment of this tree (Node setting, pnpm patch on their builder), and the alert count after a push.
-   The screenshot and navigation tools block every third-party request, so embeds and analytics are not exercised.
-   `node_modules/.pnpm` still holds folders of removed versions; the lockfile has one `astro` and one `vite`.
-   `@astrojs/check` reports an unmet peer for TypeScript 6 from two packages under it; `astro check` runs and passes.
-   The navigation check lives in `tmp/` (it borrows a browser from outside the repository), so it is not part of `pnpm verify`; `test/layoutHead.test.ts` covers the patch only.
-   The private capture of this session in `tmp/compact-summaries/` was not copied here.

## 11. Suggested skills for the next session

`openspec-propose` for `phase-3-tooling`, then `openspec-apply-change`.

## 12. Files written or changed in this session

-   Changed: `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/config.ts`, `src/env.d.ts`, `src/content/config.ts` (emptied to a note), `src/utils/getSortedItems.ts`, both layouts, seven components (`Footer`, `Header`, `ResourceActionList`, `ResourceList`, `ResourceLocationList`, `ResourceTagList`, `ResourceTOC`), `src/pages/r/[slug].astro`, `src/pages/t/[slug].astro`, `src/pages/t/index.astro`, the three paginated routes under `src/pages/[section]/`, `docs/lessons.md`, `docs/change-log.md`, `docs/state/README.md`, and the change folder `openspec/changes/phase-2-core-upgrade/`.
-   New: `.nvmrc`, `pnpm-workspace.yaml`, `patches/astro-capo@0.0.1.patch`, `src/content.config.ts`, `src/utils/imageRules.ts`, `src/utils/envFlag.ts`, `test/imageRules.test.ts`, `test/envFlag.test.ts`, `test/layoutHead.test.ts`, three state files of 2026-11-13 (0255, 0320, this one).
-   Created and removed again by the agent: `src/components/SortedHead.astro`.
-   Local only: `tmp/phase2/`, `tmp/patch-astro-capo/`, `tmp/work/extract-site.cjs`, `compare-site.cjs`, `compare-pixels.cjs`, `nav-check.cjs`, `p2-slug-to-id.cjs`, `p2-render.cjs`, `commitmsg-phase2.txt`, logs in `tmp/work/logs/p2-*.log`.
