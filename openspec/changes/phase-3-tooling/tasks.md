# Tasks

## 1. Baseline

- [x] 1.1 Keep the build of the tree before the phase as the comparison point; check: `pnpm build`, then the output is copied to `tmp/phase3/before/static`. A second build of the same tree equals it in all 106 files (`node tmp/work/p3-html-diff.cjs`), once asset names and build times are set aside
- [x] 1.2 Record the checks before the phase; check: `pnpm verify` exits 0; the lint result (0 errors, 16 warnings) and the number of tests (862) are noted
- [x] 1.3 Record the advisories before the phase; check: `pnpm audit` (68) and `pnpm audit --prod` (3)

## 2. Formatter

- [x] 2.1 Try `prettier` 3.9.10 and `prettier-plugin-astro` 1.1.2; check: `pnpm format` then lists 72 files (24 components and 48 Markdown files)
- [x] 2.2 Measure what the new layout of the components does to the pages; check: with the 24 components reformatted, `node tmp/work/p3-html-diff.cjs` finds 57 of 106 built files changed (line breaks inside inline elements)
- [x] 2.3 Take the upgrade back, restore the 24 files and pin both packages exactly; check: `pnpm format` exits 0 and `git status` shows no component changed by this phase

## 3. Linters

- [x] 3.1 Upgrade `eslint`, `eslint-plugin-astro`, `eslint-plugin-jsdoc`, add `typescript-eslint` and `astro-eslint-parser`, remove the two `@typescript-eslint` packages; check: `pnpm why eslint` lists one version
- [x] 3.2 Decide the accessibility plugin by running it; check: the six `control-has-associated-label` warnings in `src/components/CommentList.astro` are still reported under ESLint 10, so `eslint-plugin-jsx-a11y` stays (at 6.10.2)
- [x] 3.3 Rewrite `eslint.config.js` with the shared rules stated once; check: `pnpm lint:js` exits 0 with the same 16 warnings
- [x] 3.4 Upgrade `stylelint` to 17.16.0 and its config to 17.0.0, and allow the four existing findings by name; check: `pnpm lint:css` exits 0
- [x] 3.5 Upgrade `markdownlint-cli`; check: `pnpm lint:md` exits 0
- [x] 3.6 Quote the globs in the lint and format scripts; check: ESLint covers the same 77 files and prettier the same 202 files as before (the lists are compared)
- [x] 3.7 Prove each linter still fails on a bad file; check: scratch files in `tmp/phase3/bad/` make `eslint` (a script and a component), `stylelint`, `markdownlint` and `prettier --check` exit non-zero

## 4. Commit tools and hooks

- [x] 4.1 Upgrade `@commitlint/cli`, `@commitlint/config-conventional` and `husky`; check: `pnpm exec commitlint --edit` accepts a good message (exit 0) and rejects a bad one (exit 1)
- [x] 4.2 Rewrite `pre-commit`, `pre-push` and `commit-msg` without the deprecated helper; check: `sh -e .husky/pre-commit` and `sh -e .husky/commit-msg <file>` exit 0, and no hook file mentions `husky.sh`
- [x] 4.3 Make `post-checkout` and `post-merge` end cleanly when the lockfile did not change; check: `sh -e .husky/post-merge` exits 0 (it exited 1 before), and `sh -e .husky/post-checkout <a> <b>` exits 0 with and without a lockfile change

## 5. Advisories

- [x] 5.1 Move `rollup` under `@vercel/nft` to a fixed version; check: `pnpm audit --prod` no longer lists it
- [x] 5.2 Override `glob` under `@vercel/nft`; check: `pnpm why glob minimatch --prod` shows 14.0.3 and 11.0.5, `pnpm audit --prod` reports none, and `pnpm build` exits 0
- [x] 5.3 Close what is left among the development tools (in-range updates, then three overrides); check: `pnpm audit` reports no known vulnerability, and ESLint still covers the same 77 files with the same result

## 6. Closing checks

- [x] 6.1 `pnpm install --frozen-lockfile --ignore-scripts` exits 0 on the final lockfile
- [x] 6.2 `pnpm verify` exits 0, with 862 tests
- [x] 6.3 `pnpm build` exits 0 with 56 pages, and all 106 built files equal those of 1.1
- [x] 6.4 `pnpm exec openspec validate phase-3-tooling --strict` is valid
- [x] 6.5 The milestone is in `docs/change-log.md` and a state snapshot exists
