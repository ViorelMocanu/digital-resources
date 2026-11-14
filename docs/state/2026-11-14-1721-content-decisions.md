---
state_id: 2026-11-14-1721-content-decisions
created: 2026-11-14T17:21+02:00
trigger: pause-point
task: the owner's answers to the five content decisions; where the roadmap stands
agent: Claude Code, Claude Fable 5.2, via T3 Code
branch: main
head: 515b802
working_tree: clean apart from this file and its index row
supersedes: 2026-11-14-1650-phase-4-pipeline
---

# State: the content decisions are answered; six commits wait for the push (2026-11-14 17:21)

## 1. Resume here

**Status:** the owner committed the fifth simplify run as `515b802`. The tree is clean and `main` is six commits ahead of `origin/main`; nothing is pushed. The owner then answered the five decisions of the content phase (section 3) and asked where the roadmap stands. No code changed after `515b802`.

**Check receipts** (historical, 2026-11-14 about 17:00, at `f934586` plus the nine files that became `515b802`; not re-run after the commit): `pnpm verify` exit 0 with 892 tests; `pnpm build` exit 0; the build comparison shows 104 of 105 files the same, `index.html` different (it prints the README) and `rss.xml` gone; `pnpm test:e2e` 89 passed; the smoke test fails on a copy of the site without one style sheet (66 failed, 1 passed).

**Next actions, in order:**

1. The owner's push, after setting the Corepack variable in the Vercel project (section 9). Before it, the owner decides about the spreadsheet in the commit (section 4, item 1).
2. After the push: the pnpm version in the Vercel build log; the first run of `.github/workflows/ci.yml`; download its artifact `reference-screenshots` into `e2e/__screenshots__/` and commit; tick task 3.5 of `openspec/changes/phase-4-pipeline/tasks.md`.
3. Harness part two, then Phase 5, Phase 6, Phase 7 (section 5).

```text
Read docs/state/2026-11-14-1721-content-decisions.md in the digital-resources repository, then AGENTS.md. You are the controller. Check git status, git log and git rev-list --count origin/main..HEAD first: if main is still ahead of origin, the owner has not pushed, and nothing is owed but answers. If the push happened, ask for the pnpm version in the Vercel build log and the result of the first CI run, and help bring the reference screenshots into e2e/__screenshots__/. The next work is harness part two, then Phase 5: write each as an OpenSpec change first and start only when the owner says so. The content phase (Phase 7) comes after Phase 6; its decisions are in section 3. Limits: never run a git write, never delete or move a file without the owner's consent, never read an env file, never silence a check, scratch goes in tmp/, write files with the file tools and never through a here-document, the built pages must not change unless the change names the difference. Start pnpm test:e2e in the background and wait for it; never wrap it in a time limit. End with a report, a commit message checked with pnpm exec commitlint --edit, and the /simplify reminder.
```

## 2. Original request

Owner, 2026-11-14: "answers for earlier questions: all A except C4B - download every preview image, but again, be mindful of rate limiting. where are you in the development process for this mini-roadmap?"

## 3. Decisions made

The owner, 2026-11-14, on the five decisions of the content phase (the first option of each was the agent's recommendation):

- **C1, where the links live: A.** The spreadsheet stays the owner's inbox and is not committed; a script exports it to `data/`, which the site loads. Options not taken: commit the workbook and parse it at build time; one Markdown file per link.
- **C2, who writes the text: A.** Code decides everything a rule can decide; a model writes only the Romanian description and proposes type, level, tags and place, each with its evidence. Not taken: a model for everything; the owner by hand.
- **C3, how the model runs: A.** Shard files handed to workers through the agent harness, four at a time, with no API key and no new account. Not taken: a script on a paid batch interface; one long session.
- **C4, images: B.** Download every preview image and serve a resized local copy, with the same care for rate limits as the page fetch. Not taken: no images at first (the recommendation); remote images.
- **C5, dead links: A.** Mark and hide them, offer an archived copy, the owner decides per link. Not taken: drop silently; publish anyway.

What C4 = B adds to the plan: an image is one more request to a host, so images go through the same per-host queue as pages (one request at a time per host, a few seconds apart, `Retry-After` honoured, three tries, cached on disk so none is fetched twice). Many preview images sit on a content host other than the page's, and that host gets its own queue. Each image is checked (type, size limit), resized and converted once, and stored locally; the site never links a remote image. Open under it: where the image files live (in the repository they add weight to every clone; outside it the build needs another source), and that a preview image is someone else's work, so a host or an author who objects is honoured by removing it.

Earlier the same day: the owner's twenty answers (listed in `docs/state/2026-11-14-1536-phase-4-rest.md`, section 3) and the two commits `f934586` and `515b802`.

## 4. Open decisions

1. **The spreadsheet is in commit `f934586`, which is not pushed.** C1 = A says it is not committed. A (recommended): the owner takes it out of the unpushed history before the push and the folder is ignored. B: it stays in the repository after all. Once pushed, it stays in the public history.
2. Where downloaded preview images are stored (see C4 above).
3. The stalls with several browsers: a ten-minute trial with one shield of the machine's security software switched off (the web shield first, then the file shield, then the behaviour shield), while the agent runs `pnpm exec playwright test --workers=4`. Only then one narrow exception, never the project folder.
4. Making the CI workflow a required check for pull requests: a repository setting.
5. Whether a pipeline run with no reference screenshots should fail once the references are committed (today it takes new ones and warns).
6. Whether reference screenshots of all 56 pages are worth about 11 MB per update.

## 5. Plan

`tmp/upgrade-plan/plan.md` (local; section 13 holds the update of 2026-11-14). Where the roadmap stands:

| Part | State |
| --- | --- |
| Build fix, Phase 0 (baseline) | Done, pushed |
| Harness part one | Done, pushed |
| Phase 1 (prune, static output) | Done, pushed |
| Phase 2 (Astro 7, Node 24, TypeScript 6, vitest 5) | Done, committed, not pushed |
| Phase 3 (lint and commit tools, audit empty) | Done, committed, not pushed |
| Phase 4 (browser tests, pipeline, Dependabot) | Built and committed; open: the workflow's first run and the reference screenshots, both after the push |
| Review round on Phases 2 to 4 | Done; its fixes are committed |
| Harness part two (other vendors' hooks, checkout lock, guard blocks two more OpenSpec commands) | Not started |
| Phase 5 (due fixes) | Not started; its list is in `docs/state/2026-11-14-1616-phase-4-pipeline.md`, section 5: seven items from the owner's decisions and fifteen from the review |
| Phase 6 (content model, search, filters, sprite, launch) | Not started |
| Phase 7 (content from the owner's links) | Planned, decisions answered; steps in the same section 5 of that snapshot |

## 6. Facts established

Verified in this run, 2026-11-14 17:21, with `git log --oneline -3`, `git status --short`, `git rev-list --count origin/main..HEAD` and `git ls-files docs/resources`: HEAD is `515b802`; the tree is clean; `main` is six commits ahead of `origin/main`; the spreadsheet is a tracked file.

Historical, 2026-11-14, from this session: the spreadsheet holds 2,329 distinct links on 1,279 hosts, 1,074 of them with a single link; one link has an image address today. Vercel's documentation says an existing project keeps pnpm 9 unless `ENABLE_EXPERIMENTAL_COREPACK` is set to `1`.

## 7. Subagent and external research results

Four foreground reviewers ran in the fifth simplify run. Seven of their findings were applied (commit `515b802`); the skipped ones are in the report of that run: caching the test browser in the pipeline, one Playwright run for tests and screenshots, failing on missing references, one version selector for the minimatch override, a separate screenshot project, and smaller ones. None of the reviewers ran a check; their time savings are guesses.

## 8. Owner context and preferences

Unchanged: build and test first; options with the recommended one as A; no emojis; the owner makes every commit and push; no names from other repositories in tracked files; every claim labelled; visible changes wait for Phase 5; real content comes after the upgrade roadmap. New: the owner wants images on the resource cards, and names rate limits as a concern twice.

## 9. Pending owner actions

Before the push: the Corepack variable in the Vercel project; the decision on the spreadsheet in the commit. After the push: the Vercel build result, the CI run, the reference screenshots. Later: the security software trial, the required check.

## 10. Caveats and unverified claims

- Nothing was re-run after the commits `f934586` and `515b802`; the receipts are from the trees before them.
- Unverified: the CI workflow on GitHub, the Vercel build, Dependabot's handling of the overrides and the patch.
- The plan file is local; section 13 of it was not yet updated with C4 = B when this file was written.
- The private capture of this session in `tmp/compact-summaries/` was not copied here.

## 11. Suggested skills for the next session

`openspec-propose` for harness part two and for Phase 5.

## 12. Files written or changed in this session

Since `515b802`: this file and its index row in `docs/state/README.md`.
