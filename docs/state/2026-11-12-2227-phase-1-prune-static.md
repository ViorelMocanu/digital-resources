---
state_id: 2026-11-12-2227-phase-1-prune-static
created: 2026-11-12T22:27+02:00
trigger: pause-point
task: Finish harness part one (OpenSpec content) and Phase 1 of the upgrade (prune and static output)
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 080cb3c
working_tree: uncommitted; the list is in section 12
supersedes: 2026-11-12-1933-harness-h1a
---

# State: harness part one and Phase 1 finished (2026-11-12 22:27)

## 1. Resume here

**Status:** harness part one and Phase 1 are built and checked, uncommitted. Both OpenSpec changes are complete and valid. The work is handed back to the owner.

**Check receipts**, all at `080cb3c` plus the working tree in section 12:

-   `pnpm verify`: exit 0. Lint 0 errors (16 warnings, all older); `astro check` 0 errors; 10 test files, 815 tests passed; "All 24 generated files are fresh"; format clean.
-   `pnpm build`: exit 0, 56 pages, no `functions` folder.
-   `pnpm install --frozen-lockfile --ignore-scripts`: exit 0 on the new lockfile.
-   `pnpm exec openspec validate harness-h1a --strict` and `... phase-1-prune-static --strict`: both valid.
-   Screenshots after the package removal only: 116 of 116 identical to `tmp/baseline/shots`.
-   Screenshots after all of Phase 1: 64 identical (32 pages), 48 different (24 pages that show resources: listings, resource pages, tag pages, search), 4 missing (the two deleted test pages at two widths).
-   Built HTML after the package removal only: 57 of 58 pages identical once the Partytown snippet is masked; the last differs by one line break.
-   Spec scenarios on the built output: 0 routes to `_render` or `_image`; 0 files with `~partytown`; 56 of 56 pages carry `noindex, nofollow`; 0 pages with `TemporaryMessage`; 0 pages with `7895`; no `/r/test` page; 56 addresses in the sitemap, none a test page.

**Next actions, in order:**

1. The owner reviews and commits.
2. After the push: read the alert count (`gh api .../dependabot/alerts`) and compare with the plan's estimate of about 26 closed.
3. Phase 2, the core upgrade: write the OpenSpec change `phase-2-core-upgrade` first (`/opsx-propose`), then the code.

```text
Read docs/state/2026-11-12-2227-phase-1-prune-static.md in the digital-resources repository, then AGENTS.md. You are the controller. Continue at "Next actions" step 2 if the owner has pushed, else wait for the owner's word. Phase 2 starts with an OpenSpec change, not with code. Limits: never run a git write (the owner commits), never delete or move a file without consent, never read an env file, scratch goes in tmp/, no workers unless the owner asks, pages must look as before unless a change names the difference. The local plan is tmp/upgrade-plan/plan.md. End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

The owner asked for a page of every open decision, then answered: "all A except N2B". That means: finish harness part one, then Phase 1 (N1 A); delete the two test resources (N2 B); format `docs/agent/posthog.md` (N3 A); `/simplify` reviews inline for a small diff and with four foreground reviewers for a large one (N4 A); raise the Node floor now (G3 A); add the manifest test now (G4 A); everything else at its later phase.

## 3. Decisions made

By the owner, 2026-11-12: N1 A, N2 B, N3 A, N4 A, and A for G1 to G7, S1 and S2 (the wording of each is in `docs/state/2026-11-12-1933-harness-h1a.md`, section 4). The four agent choices listed there stand, as the owner did not overrule them. Earlier decisions D1 to D19 are unchanged.

By the agent, for the owner to overrule:

-   Each `opsx-*` workflow hands over to its skill instead of repeating the text, so about 180 KB of instructions exist once, not twice.
-   The stock key `allowed-tools` is left out of the skills, so OpenSpec commands keep the normal permission prompt.
-   The skills forbid `openspec feedback` and `openspec install`, which reach outside the machine. OpenSpec commands in this session ran with its telemetry switched off through the environment (`OPENSPEC_TELEMETRY=0`).
-   `noindex` is one switch, `INDEXABLE` in `src/config.ts`.
-   `astro-embed`, `astro-social-share` and `@astrojs/mdx` stay until a later phase: the home page still renders the first two.

## 4. Open decisions

-   Whether OpenSpec telemetry should be switched off for every session, for example in the Claude Code settings. Recommendation: A, yes. It is a settings change, so it waits for the owner.
-   The resource rating shows a fixed "(10)" after the value (`ResourceList.astro`, `r/[slug].astro`). Whether that is the scale or a placeholder vote count is unknown. Recommendation: A, the owner says which; if a placeholder, it goes in Phase 5.
-   The Back End section now lists no resource, because its only entry was a test. Recommendation: A, leave it until the catalogue data arrives in Phase 6.

## 5. Plan

`tmp/upgrade-plan/plan.md` (local, gitignored). Done: build fix, Phase 0, harness part one, Phase 1. Next: Phase 2 core upgrade (Astro 7.4, Node 24, TypeScript 6, vitest 5), Phase 3 tooling, harness part two, Phase 4 tests and CI, Phase 5 due fixes, Phase 6 product. After every phase: check receipts, a retrospective in `docs/change-log.md`, `docs/lessons.md`.

## 6. Facts established

-   Verified: every receipt in section 1.
-   Verified (`git diff -- pnpm-lock.yaml`): the package removal added no new version to the lockfile; the 19 added lines are moved entries.
-   Verified: both imports of removed packages in `src/pages/rss.xml.ts` and `src/utils/csp-hash.ts` sit inside comments, so the files stay and still compile.
-   Verified (2026-11-12, before this work): 222 open alerts, 9 critical; the live image endpoint answers 404.
-   Verified: `git status` shows the previous snapshot and its index row as staged. The agent staged nothing.

## 7. Subagent and external research results

None. No worker was used.

## 8. Owner context and preferences

Unchanged: build and test first; options side by side with the recommended one as A; no emojis; the owner makes every commit; tracked files never name the owner's other repositories; every claim labelled.

## 9. Pending owner actions

-   Review and commit.
-   Set `INDEXABLE` to `true` at launch.
-   Phase 2: set the Vercel project's Node version to 24.x.

## 10. Caveats and unverified claims

-   Unverified: how many alerts close. The count is read after the push.
-   Unverified: the Vercel deployment of this tree. The local build output has no function, as before.
-   The stock skill text was produced by calling the OpenSpec package's own template functions from a scratch script, not by `openspec init` or `update`. The script lives in `tmp/work/` and is not tracked.
-   The stock text still describes `openspec init` and store selection; the rules block on top of each skill overrides it.
-   The 24 changed pages were compared by screenshot count and two were looked at by eye, not all 24.
-   `README.md` and `src/pages/README.md` still name two removed packages in an old to-do list.

## 11. Suggested skills for the next session

`openspec-propose` for the Phase 2 change.

## 12. Files written or changed in this session

-   Changed: `.prettierignore`, `astro.config.mjs`, `docs/agent/posthog.md` (format only), `docs/agent/harness-sync.md`, `docs/change-log.md`, `docs/state/README.md`, `package.json`, `pnpm-lock.yaml`, `scripts/sync-harness.config.json`, `src/config.ts`, `src/layouts/Layout.astro`, `src/layouts/LayoutMarkdown.astro`, `src/components/ResourceList.astro`, `src/pages/r/[slug].astro`, `src/style/style.scss`.
-   New: `.agents/skills/openspec-*` (12), `.agents/workflows/opsx-*.md` (12), `.claude/skills/` and `.claude/commands/opsx/` (24 generated files), `openspec/config.yaml`, `openspec/changes/harness-h1a/`, `openspec/changes/phase-1-prune-static/`, `test/webmanifest.test.ts`, `docs/state/2026-11-12-1933-harness-h1a.md`, this file.
-   Deleted, with the owner's consent: `src/content/resources/test.md`, `src/content/resources/test2.md`.
-   Local only: `tmp/phase1/`, `tmp/openspec-stock/`, `tmp/work/openspec-port.mjs`, `tmp/work/openspec-stock.mjs`, `tmp/work/compare-html-strip.cjs`.
