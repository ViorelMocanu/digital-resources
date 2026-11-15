---
state_id: 2026-11-15-1855-phase-5b-owner-answers
created: 2026-11-15T18:30+02:00
trigger: pause-point
task: apply the owner's answers to the Phase 5 decision page, build the share cards, write the walkthroughs
agent: Claude Code, Claude Opus 5.5, via T3 Code
branch: main
head: 6545861
working_tree: uncommitted changes since 6545861 (git status lists them); four files moved to tmp/archive/ with the owner's consent
supersedes: 2026-11-14-2053-phase-5-due-fixes
---

# State: the owner's answers of 15 November, half built (2026-11-15 18:30)

## 1. Resume here

**Status:** the owner committed all of Phase 5 as `6545861` and answered the decision page. Built and tested so far (each test first): D1 B `/login` placeholder page, out of the sitemap; D4 the four unused files moved to `tmp/archive/2026-11-15-phase-5/` (gitignored, with a README; git history keeps them); D5 `--max-warnings=0` in `pnpm lint:js`; D6 item 5 dates printed in Bucharest time; section 4 screenshot references for one page per kind (20) and a CI step that fails when `e2e/__screenshots__/REFERENCES.txt` is committed without images; the Phase 5 findings `vercel.json` placeholder redirect and multi-origin CORS headers removed, the last breadcrumb link written as a path, the dead sitemap `i18n` block removed, the emoji markers in `src/config.ts` removed. Share cards (D2): `satori` 0.63.2 added (exact), `src/utils/shareCardImage.ts` (renderer, JPEG 1200x630), `src/utils/shareCard.ts` (path, alt text, kind, reading a card back from built HTML), the head tags in `src/layouts/Layout.astro` rewritten, unit tests pass (13).

**Not done yet:** the layout must write the `resurse:card` meta tag (kind from the template, trail from the breadcrumb labels without the last, facts from a new prop the resource page passes: type chip and rating); the integration `src/integrations/shareCards.ts` (`astro:build:done`: read each built page, `cardFromHtml`, `renderShareCard`, write `og/<path>.jpg` into `dir`) and its entry in `astro.config.mjs`; the resource page's `template` must be checked (the kind map expects `ResourcePage`). Then: build, `pnpm exec playwright test smoke` (the share-tag step was seen failing first: 56 failed), full checks, page comparison against `tmp/compare/p5b-before/`, the OpenSpec change `openspec/changes/phase-5b-owner-answers/` (proposal, design, specs, tasks), the docs, the decision page `tmp/decisions/phase-5b.html`, the report.

**Next action:** finish the two items above, then the checks.

```text
Read docs/state/2026-11-15-1855-phase-5b-owner-answers.md in the digital-resources repository, then AGENTS.md. You are the controller. Finish the share cards (layout meta tag, build integration), build, run pnpm exec playwright test smoke, then pnpm verify:fix, pnpm verify, pnpm build and pnpm test:e2e (in the background, waited on), compare the build with tmp/compare/p5b-before/, write the OpenSpec change phase-5b-owner-answers and validate it strictly, update docs/change-log.md, and build the decision page tmp/decisions/phase-5b.html (walkthroughs from the research in section 7, the D6 detail, why astro-capo went, why UTC was chosen first). Limits: never run a git write, never delete or move a file without the owner's consent, never read an env file, never edit .codex/config.toml, .gemini/settings.json or .cursor/mcp.json, never silence a check, scratch goes in tmp/, write files with the file tools and never through a here-document. End with a report, a commit message checked with pnpm exec commitlint --edit (covering everything since 6545861), and the /simplify reminder (base 515b802).
```

## 2. Original request

Owner, 2026-11-15, answering the Phase 5 decision page: "1.3 - where should I add `ENABLE_EXPERIMENTAL_COREPACK` exactly? walk me through this step by step / 3 - all A except 1B, 2 neither - you need to build a capability to autogenerate og images for all pages based either on the resource itself or on a visual template centered around the site's design and content, 3B, 4A but archive them in a gitignored folder, don't delete, and tell me why astro capo is no longer used, 6.5 why UTC? it's supposed to be Bucharest time / EET - anyway, you need to fix and build all items in 6, but give me more details on each so i can help you decide / 4 - all A / 5 - walk me through how I can do these step by step / 6 - if you don't fix these, add them to the other phases where appropriate". The owner also invoked the workflow skill and has ultracode on: workflows are allowed in this session (the earlier "no subagents or workflows" rule is superseded).

## 3. Decisions made

- Owner, 2026-11-15: D1 B (a `/login` placeholder page; its text is the agent's draft, for the owner to edit); D2 neither A nor B: share images generated for every page; D3 B (Vercel Web Analytics stays); D4 A, archived not deleted; D5 A; D6 all A except item 5, which becomes Bucharest time; D7 A; section 4 all A.
- Agent, 2026-11-15: the archive folder is `tmp/archive/2026-11-15-phase-5/` (already excluded by every tool; a root folder would need five config edits). Cards are JPEG (WhatsApp's 600 KB limit; Facebook reads only JPEG, PNG and GIF). The cards use the site's own WOFF2 fonts unaltered (satori reads WOFF2 since 0.55.0); converting them to TTF was rejected because the font's licence text says "without derivatives or alteration". A card whose text has a character the font lacks stops the build, naming it. Cards are drawn from the built pages by a build step (the same hook the sitemap uses), not by an endpoint that would repeat the routing of categories and subcategories. Resource pages get `og:type` article (they carry `article:*` dates). The not-found page has no canonical and no `og:url`. The PostHog items (eight silenced type checks in a vendor snippet, default persistence) go to Phase 6 as an analytics decision.

## 4. Open decisions

For the owner, on the next decision page: the `/login` text; the card design; the D6 items with their detail; analytics (PostHog persistence against "stores nothing about visitors" in AGENTS.md); where the Phase 5 findings that are not fixed now go (Phase 6: real copy for the `@TODO` pages and the home title, "Data adăugării" printing `modDate`, the commented-out section images, the CSP rewrite tested on a preview, PostHog).

## 5. Plan

Finish this round (section 1), then Phase 6 through `/opsx-explore`, then Phase 7.

## 6. Facts established

- Verified in this run: baseline build at `6545861`, 55 pages, copied to `tmp/compare/p5b-before/`; `pnpm typecheck` 0 errors 0 warnings 2 hints and `pnpm test:unit` 1,118 passed and 1 skipped, before the share-card work; the sitemap files are byte-identical to the baseline after the `/login` filter and the `i18n` removal.
- Verified: `openspec update --dry-run` exists in OpenSpec 1.16.1 (read in `node_modules/@fission-ai/openspec/dist/cli/index.js`); the guard still blocks it for agents.
- Verified: with `--max-warnings=0`, a file with one warning exits 1, also with `--quiet`.
- Verified: Node prints dates in proleptic Gregorian with an era; the Bucharest formatter keeps the extreme-date tests unchanged.

## 7. Subagent and external research results

Workflow `wf_d0d005e3-ce6` (16 agents, research then a skeptical check per topic); the full results are in its journal under the session's workflow folder, and the parts that matter are summarised here as they are used. Share images: satori 0.63.2 (2026-10-20), 23 packages, no install script; WOFF2 read since 0.55.0; text drawn as paths; sharp draws the SVG; about 25 to 35 ms per card; Astro has no built-in generator. Share tags: full https image URL; JPEG under 600 KB (WhatsApp); `og:description` required by WhatsApp and LinkedIn; `twitter:*` by `name=`; `og:email` dropped from Open Graph in 2011; `fb:app_id` only for retired insights; `article:publisher` must be a Facebook page URL; `og:image:alt` should describe the image (X limit 420 characters). The walkthrough topics (Vercel Corepack variable, Codex, Antigravity and Grok hook trust, GitHub required check, Avast shields, astro-capo) are in the same journal, for the decision page.

## 8. Owner context and preferences

Unchanged: unassisted until blocked, then one local HTML page; options with A first; one commit message for everything since the owner's last commit (`6545861`), checked with commitlint, no double quotes, no backticks, no AI attribution; `pnpm verify:fix` then `pnpm verify` before a commit message; the `/simplify` reminder (base `515b802`: no run is recorded after it). New: step-by-step walkthroughs for everything only the owner can do.

## 9. Pending owner actions

`ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel before the push; the push; the first CI run and its reference screenshots; CI as a required check after its first green run; trusting the hooks in Codex, Antigravity and Grok; the security software trial; `pnpm exec openspec update --dry-run` (optional); the commit of this round.

## 10. Caveats and unverified claims

- Scratch scripts in this run were written with here-documents (`tmp/work/intl-probe.mjs`, `tmp/work/ci-logic/run.sh`, `tmp/work/fonts/convert.py`), against the repository rule; scratch only, nothing tracked.
- The time in this file's name (18:55) is wrong: it was estimated because the hook asks for the file before any other tool call, and the clock read 18:30 right after. The name stays (a rename is a move); the created field holds the clock time.
- The research timings for satori come from upstream benchmarks; only the sharp half was measured locally by the research agent.

## 11. Suggested skills for the next session

`openspec-explore` for Phase 6.

## 12. Files written or changed in this session

Since `6545861`: `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `vercel.json`, `.github/workflows/ci.yml`, `src/config.ts`, `src/layouts/Layout.astro`, `src/components/Breadcrumbs.astro`, `src/pages/404.astro`, `src/pages/login.astro` (new), `src/utils/resourceMeta.ts`, `src/utils/shareCard.ts` (new), `src/utils/shareCardImage.ts` (new), `e2e/known-gaps.ts`, `e2e/pages.spec.ts`, `e2e/sitemap.spec.ts`, `e2e/shots.spec.ts`, `e2e/smoke.spec.ts`, `test/resourceMeta.test.ts`, `test/resourceMeta.timezone.test.ts`, `test/vercelConfig.test.ts` (new), `test/shareCard.test.ts` (new), `test/shareCardImage.test.ts` (new), `docs/lessons.md`, this file and its index row. Moved, with consent: `src/layouts/LayoutMarkdown.astro`, `src/components/MarkdownTOC.astro`, `patches/astro-capo@0.0.1.patch`, `src/vite-env.d.ts`.
