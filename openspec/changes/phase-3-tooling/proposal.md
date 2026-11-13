# Phase 3: tooling

## Why

After Phase 2 the site itself is current, and the tools around it are not. On 2026-11-13 `pnpm audit` lists 68 advisories, none critical: 3 under the adapter's build tool and 65 under the linters and the commit tools, which are one or more major versions behind. The git hooks are also wrong for daily work: the pre-commit hook builds the whole site, the pre-push hook rewrites files while pushing, and two hooks load a helper file that husky 9 has deprecated.

This phase brings the tools to their current lines. A visitor sees no change at all: the built pages must stay identical, byte for byte apart from the two things every build changes (the name part of hashed asset addresses, and the build time printed in each page's head).

## What Changes

Versions are the newest releases that were at least seven days old on 2026-11-13 (read from the registry that day). pnpm enforces that age itself (`pnpm-workspace.yaml`).

Upgraded:

-   `eslint` 9.13 to 10.14.0.
-   `eslint-plugin-astro` 1.3 to 3.2.1, with `astro-eslint-parser` 3.2.0 named as a direct dependency (the config imports it).
-   `eslint-plugin-jsdoc` 50.4 to 65.4.4.
-   `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` 8.10 are replaced by the single package `typescript-eslint` 8.72.1, which holds both.
-   `eslint-plugin-jsx-a11y` 6.10.0 to 6.10.2, its newest release.
-   `stylelint` 16.10 to 17.16.0 and `stylelint-config-standard-scss` 13.1 to 17.0.0. Not 18: the 18 line of the config was one day old on 2026-11-13.
-   `markdownlint-cli` 0.42 to 0.50.0.
-   `@commitlint/cli` and `@commitlint/config-conventional` 19.5 to 21.2.4.
-   `husky` 9.1.6 to 9.1.7.

Not upgraded, and why:

-   `prettier` stays at 3.3.3 and `prettier-plugin-astro` at 0.14.1, both now pinned exactly. The upgrade to 3.9.10 and 1.1.2 was tried on 2026-11-13 and taken back, for two reasons:
    -   The new Astro plugin lays out 24 components differently, and the new layout puts line breaks inside inline elements (the skip link, breadcrumb labels). That changed the built HTML of all 56 pages, which this phase must not do.
    -   The new prettier writes Markdown list items with one space after the marker instead of three. That would rewrite 48 Markdown files, among them `AGENTS.md` and the state snapshots, which are not rewritten without the owner.
-   Neither version has a known advisory. The upgrade is a decision for the owner (see below).

Found during the work:

-   `eslint-plugin-jsx-a11y` declares support for ESLint up to 9 only, so pnpm prints an unmet peer warning. Its rules run correctly under ESLint 10: the six warnings in `src/components/CommentList.astro` are reported as before, and a scratch component without an `alt` text fails. It stays; the fork was not needed.
-   ESLint 10 still ships the formatting rules (`indent`, `semi`, `brace-style` and the others), so all of them stay as they are.
-   The old config spread a `typescript-eslint` preset that has no rules at its top level, so it added nothing. The new config leaves it out; the rules in force are the same.
-   stylelint 17 reports four things in `src/style/style.scss` that 16 did not. The styles are not changed in this phase, so the config allows exactly these, and Phase 5 decides about them:
    -   `-webkit-text-size-adjust`: the config already allowed `text-size-adjust`; stylelint 17 compares the name with its prefix, so the prefixed name is added to the same list.
    -   `clip`, three times, in the rules that hide text visually. The new rule `property-no-deprecated` stays on for every other property.
-   The `post-checkout` and `post-merge` hooks stopped with an error whenever the lockfile had not changed, because husky 9 runs hooks in strict mode. They now end cleanly in both cases.
-   The hooks are not active on a machine that installs with scripts off, because husky installs itself from a `postinstall` script. Activating them is one command for the owner (see below).

Configuration:

-   `eslint.config.js` states the shared rules once instead of three times. The rules and their levels stay as they are: ESLint covers the same 77 files and reports the same 16 warnings and no error.
-   The lint and format scripts in `package.json` quote their globs, so that the tool expands them, not the shell. The command-line ignore patterns of the ESLint script are gone; the config file already ignores the same folders.

Git hooks (`.husky/`):

-   `pre-commit` runs the linters and the format check. It no longer builds the site or type-checks.
-   `pre-push` runs `pnpm verify`. It no longer rewrites files.
-   `commit-msg` runs commitlint without the deprecated helper.
-   `post-checkout` and `post-merge` keep their one job (a note when the lockfile changed).

Advisories, all through `overrides` in `pnpm-workspace.yaml`, each with its reason beside it:

-   Under `@vercel/nft` (the file tracer of the Vercel adapter, which a static build never runs): `glob` 13 to 14, which brings `minimatch` 11, and `rollup` 4.24 to a fixed 4.x.
-   Among the development tools: `re2js` 2.8.6 to 2.8.7 and `katex` 0.16 to 0.18 under `markdownlint`, and `minimatch` 10 to 11 under `eslint`.
-   Five more (`brace-expansion`, `minimatch` 3, `js-yaml`, `fast-uri`) were fixed by updating inside the ranges their parents allow.
-   `pnpm audit` reports no known vulnerability after this phase.

## Out of scope

-   Any change to a page, a component's behaviour or a style.
-   New lint rules beyond what the upgraded presets turn on.
-   `lint-staged` or any other new tool for the hooks. The pre-commit hook checks the whole project, which takes seconds.
-   The end-to-end suite, CI and the dependency bot (Phase 4).
-   `stylelint` 18 (waits for its config to age).
-   The `README.md`, which still names the old lint packages (Phase 5 rewrites it).

## Waits for the owner

-   The commit. The hooks run on the owner's commits, so their first real run is his.
-   Activating the hooks on a machine that installs with scripts off: `pnpm exec husky`, once. It sets a git config value, so an agent does not run it.
-   The prettier upgrade: whether to take the new layout of Astro components (and check the pages again, since their HTML changes), and whether to reformat every Markdown file.
-   Nothing is deleted or moved in this phase. `.husky/functions.sh` stays in use.

## Impact

-   `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `eslint.config.js`, `.stylelintrc.json`, and five files in `.husky/`.
-   No source file of the site.
-   The pages: none. Checked by comparing the build with the build before the phase.
