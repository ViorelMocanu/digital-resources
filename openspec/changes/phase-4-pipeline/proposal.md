# Phase 4, the rest: the pipeline, the review round and the owner's decisions of 2026-11-14

## Why

The upgrade to Astro 7 sits in four commits that are not pushed, and nothing outside the owner's machine has ever checked this repository: no workflow runs lint, tests or a build. On 2026-11-14 the owner answered twenty pending decisions. This change builds the ones that are due now: a pipeline that gates every push and pull request, a dependency bot that waits as long as pnpm does, a review of the upgrade before it is pushed, and a set of small clean-ups.

## What Changes

### The pipeline

1. **`.github/workflows/ci.yml`** runs on every push to `main`, every pull request and on request: a locked install without install scripts, `pnpm verify`, `pnpm audit --prod`, the build, the browser tests (navigation, smoke, accessibility), and the screenshot comparison. The navigation test is part of the browser tests, so a link that causes a full page load fails the run (the owner's decision of 2026-11-13). Every action is pinned to a commit.
2. **Screenshots are compared in the pipeline only** (decision 3). `e2e/shots.spec.ts` compares every page at the desktop size and one page of each kind at the narrow size with a committed reference in `e2e/__screenshots__/`: 66 images. Locally the file is left out, because text is drawn differently on every system.
    - There are no references yet, and they can only be taken on the runner. A run that finds none takes them, compares nothing, says so in a warning and keeps them as a download. The owner commits them once; from then on every run compares. The same happens when the workflow is started by hand with "update screenshots".
3. **Dependabot** (decision 2) proposes only the dependencies named in `package.json`, waits until a release is seven days old (the wait pnpm keeps), and groups minor and patch updates into one weekly pull request. The wait does not apply to security updates; GitHub's documentation says so.
4. **Old workflows.** `static.yml` (a GitHub Pages deploy with pnpm 8) and `_studio.yml` (a product the site no longer uses, pinned to Node 20) were disabled by hand on GitHub and are deleted, as the decision page said. The scan workflow loses two permissions it never needed, and it and the greeting workflow are pinned to commits.

### The review round (decision 4)

Four reviewers read the upgrade for bugs on 2026-11-14: the site code, the build and dependency setup, the tests, and the scripts with the lint configuration. Fixed in this change:

5. **The smoke test passed on a build with a missing file.** It now records every file of the site itself that the server cannot give. This found a real fault at once: seven category pages ask for their image by its path in the source tree. The fault is older than the upgrade; it is listed in `e2e/known-gaps.ts` and waits for Phase 5.
6. **A page could leave the build unnoticed.** The accessibility test now checks that its page answers 200 (a missing page was answered with the not-found page, whose findings can equal the listed ones), and a new test checks that the page of every kind is still built.
7. **The local server crashed on an address with a null byte.** It answers "not found".
8. **The overrides check skipped lines it could not read.** It now refuses them. It also reads a parent written with a version range, checks a bare package name, and refuses a `$name` value the root package has no range for.
9. **`zod` was imported without being a dependency**, in a line that could never be true. The line and the import are removed.
10. **Any `.env.*` file is ignored by git**, not only four names. `.env.example` stays tracked.
11. The exception to the seven-day rule for the OpenSpec package is removed: the pinned version is old enough now.

Not fixed here, by the owner's rule that visible changes wait for Phase 5: the faults the review found on the pages themselves. They are listed in the state snapshot of this change.

### The owner's decisions

12. Deleted with the owner's consent: `src/content/config.ts` and `e2e/head.spec.ts` (both held only a note), `src/utils/csp-hash.ts` (imported nowhere) and `src/pages/rss.xml.ts` (one large comment).
13. `partytown={false}` is removed from the analytics component.
14. `AGENTS.md` names `pnpm test:e2e` in its command table. `README.md` names today's tools, Node 24.16 and pnpm 10.
15. The two JSDoc type rules are off for every `.ts` file: the compiler checks the types in the signature, and nothing checks a copy in a comment.
16. **Prettier 3.9.10** (decision 18, B), the newest release older than seven days; the Astro plugin stays at 0.14.1. It rewrote the list markers of 56 Markdown files and added brackets in one inline script.
    - It also damaged two things, both repaired by hand and recorded as lesson L-009: it dropped a type argument inside an Astro template (the annotation was redundant and is removed), and it decoded an entity in the label of a link definition while leaving the link that uses it (the link now holds the character itself).
    - The rules block of the port script and its test carry the new list markers.

## What a visitor sees

- The home page prints the repository's README, so its tool list changed with it.
- `/rss.xml` is gone from the build. It was never a feed: the build wrote a copy of the not-found page under that name. The address now answers 404.
- Nothing else: the other 104 built files are byte for byte the build before.

## Not in this change

- Decisions 11 to 17 and 19: the guard change belongs to harness part two; the rating written as "8.5/10", the sitemap address, the publication date, the `/README/` page, the two style properties and the head sorter belong to Phase 5.
- Decision 20, the stalls with several browsers at once: measured here, not solved (see the state snapshot).
- Making the pipeline a required check for pull requests: a setting of the repository, the owner's.

## How it is checked

- `pnpm verify`, `pnpm build`, the byte comparison with the build before, `pnpm test:e2e`, `pnpm audit`.
- Each new check is shown to fail: the smoke test on a copy of the site without one style sheet, the screenshot comparison on a copy with one changed colour, the unit tests before their fixes.
- The workflow itself cannot be run on this machine. Its first run on GitHub is its test.

## Impact

- New: `.github/workflows/ci.yml`, `e2e/shots.spec.ts`. After the first run: 66 reference images in `e2e/__screenshots__/` (about 11 MB on this machine; every later update adds as much to the history).
- Changed: `.github/dependabot.yml`, two workflows, `playwright.config.ts`, the browser tests, `scripts/serve-static.ts`, `scripts/lib/pnpm-overrides.ts`, `eslint.config.js`, `package.json` and the lockfile (Prettier), `pnpm-workspace.yaml`, `.gitignore`, and the formatting of 56 Markdown files.
- Deleted: six files, named above.
