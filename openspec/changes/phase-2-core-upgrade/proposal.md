# Phase 2: core upgrade to Astro 7

## Why

The site runs on Astro 4.16.7, which is three major versions behind and no longer gets fixes. On 2026-11-13 the repository has 191 open dependency alerts, 8 of them critical; 42 name `astro` itself, and most of the rest (`vite`, `devalue`, `sharp`, `vitest`, `esbuild`, `rollup`) come in through the packages this phase upgrades. The fixes exist only on the current major lines. This phase moves the core of the site to those lines in one step, and it must leave every page looking as it does today.

## What Changes

Versions are the newest releases that were at least seven days old on 2026-11-13 (read from the registry that day). A newer patch may be taken when the work starts, if it has reached seven days by then.

Upgraded:

- `astro` 4.16.7 to 7.4.7 (every `astro` alert is fixed from 7.3.2 on).
- `@astrojs/vercel` 7.8.2 to 11.0.20, still the static adapter.
- `@astrojs/sitemap` 3.2.1 to 3.7.4.
- `@astrojs/check` 0.9.4 to 0.9.12, moved to `devDependencies`.
- `sharp` 0.33.5 to 0.35.5.
- `typescript` 5.6.3 to 6.0.3. Not 7: `@astrojs/check` accepts only 5 and 6.
- `vitest` and `@vitest/coverage-v8` 2.1.3 to 5.1.0.
- `astro-embed` 0.7.4 to 0.14.0, the first line that accepts Astro 7. The home page still renders its demo embeds.
- `@vercel/speed-insights` 1.0.12 and `astro-simpleanalytics-plugin` 0.3.17 stay as they are: both build on Astro 7. Whether these tools stay at all is the analytics decision of Phase 5.

Added:

- `@astrojs/markdown-remark` 7.3.6, which Astro 7 asks for as a peer.

Replaced:

- `sass` 1.80.3 by `sass-embedded` 1.107.1. The build log shows the old package's deprecated API warning.

Removed:

- `@astrojs/mdx` 3.1.8: the repository has no `.mdx` file.
- `vite` as a direct dependency: Astro brings its own copy, and one copy is enough.

Platform:

- Node 24: `engines.node` becomes `>=24.16`, and an `.nvmrc` says `24`.
- pnpm is pinned in `packageManager` to the version in use (10.33.2).

Code changes the new versions force:

- Content collections move to the Content Layer: `src/content/config.ts` becomes `src/content.config.ts` with `glob()` loaders, `entry.render()` becomes `render(entry)` in 5 places, and `.slug` becomes `.id` in 82 places across 14 files. Each entry keeps the id it has today as its slug, so no address changes.
- `ViewTransitions` becomes `ClientRouter` in both layouts.
- The Markdown options in `astro.config.mjs` move to the form Astro 7 expects.
- `src/config.ts` compares environment values as strings, because Astro no longer converts them.
- `src/utils/resourceMeta.ts` imports Zod from `astro/zod` instead of an undeclared package, and the schemas use the Zod 4 forms.
- `tsconfig.json` drops `baseUrl`, writes its paths relative to the file and uses `moduleResolution: bundler`.
- `vitest.config.ts` drops an exclude for a folder that does not exist.

Found during the work on 2026-11-13, and added to this change:

- A new `pnpm-workspace.yaml` holds the pnpm settings, each with its reason beside it:
    - `minimumReleaseAge` of seven days, so that pnpm itself refuses a younger release.
    - One exception to it, for the pinned `@fission-ai/openspec` 1.16.1.
    - An override that makes `astro-simpleanalytics-plugin` use the site's Astro. The plugin lists one exact, old Astro as its own dependency, which installed a second, vulnerable copy.
    - A package extension that gives `@astrojs/astro2tsx` 0.1.3 its runtime. Without it `astro check` crashed on start.
- The two image width rules (100 pixels for a section image, 1000 for a local resource image) move from the collection schema to `src/utils/imageRules.ts`, called where the section page and the resource page are built. In the Content Layer a schema sees an image only as a path. A narrow image still stops the build, with the same message.
- A one-line pnpm patch of `astro-capo` 0.0.1, in `patches/`. Unpatched, it drops the client router's script from the head on Astro 7, and every link becomes a full page load.
- Four vulnerable packages deep in the tree (`rollup`, `picomatch`, `mdast-util-to-hast`, `ajv`) are updated inside the ranges their parents allow.
- `src/content/config.ts` is not moved. A new `src/content.config.ts` is written, and the old file is emptied to a note; Astro 7 ignores it. Deleting it waits for the owner.

What a visitor sees change: nothing. Every page must look exactly as before, at the same address.

What changes without a visible effect: the YouTube embed on the home page gains a hidden "Play" label for screen readers, which comes with `astro-embed` 0.14.0. The generated HTML, CSS and script files differ in their bytes, because Astro 7 and Vite 8 write them differently (attribute names, file hashes, CSS minified by Lightning CSS). The comparison in this phase is therefore the list of addresses, the visible text of every page, and the screenshots; each kind of byte difference is named in the report.

## Capabilities

### New Capabilities

- `core-platform`: the runtime and the core packages the site is built with, and what an install and an audit must show.
- `page-stability`: what must stay the same for a visitor across an upgrade.

### Modified Capabilities

None.

## Impact

- `package.json`, `pnpm-lock.yaml`, `.nvmrc` (new), `pnpm-workspace.yaml` (new), `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/content.config.ts` (new), `src/config.ts`, `src/utils/`, both layouts, and the 14 components and pages that read collections.
- No file moves and none is deleted. `src/content/config.ts` stays as an empty note until the owner deletes it.
- Dependency alerts: the plan of 2026-11-11 expects about 119 to close, among them every critical one. The real number is read after the owner pushes.
- Lint tooling stays as it is until Phase 3. If the present `eslint` setup cannot parse the upgraded project at all, the smallest upgrade that makes `pnpm lint` run again moves into this phase, and the report says so.
- Out of scope: the lint, format and commit tooling (Phase 3); Playwright and CI (Phase 4); the security headers, the sitemap's sample entries, the analytics decision, the placeholder texts and the "(10)" after each rating (Phase 5); the content model and search (Phase 6). Removing the demo embeds from the home page is also out of scope, because it changes the page.
- Waits for the owner:
    - Every commit.
    - Before the push: the Vercel project's Node version set to 24.x. Astro 7 does not run on Node 20 or older, so a deployment with the old setting fails.
    - Consent to delete the emptied `src/content/config.ts`.
