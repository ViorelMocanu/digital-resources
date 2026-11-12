# Phase 1: prune and go static

## Why

The site carried a server function it did not need, nine packages no code uses, and placeholder content that search engines can index. The server function is gone since 2026-11-12 (an urgent fix, made before this change was written, because deployments failed). This change finishes the phase: it removes the unused packages and their dependency alerts, closes the image host wildcard, and keeps the unfinished site out of search results until launch.

## What Changes

Already done and live (commits `f7f92d8`, `9637f04`, `080cb3c`), recorded here:

-   Static output with the static Vercel adapter; the account link in the header is rendered at build time.
-   A static `public/site.webmanifest` replaces the manifest plugin, so the build works after an install with scripts off.

Still to do:

-   Remove nine unused packages: `@astrojs/partytown` 2.1.2, `@astrojs/rss` 4.0.9, `@sentry/astro` 8.34.0, `@vercel/analytics` 1.3.1, `astro-compress` 2.3.3, `lite-youtube-embed` 0.3.3, `node-html-parser` 6.1.13, `posthog-js` 1.174.2, `csv-parser` 3.0.0. No package is added or upgraded.
-   Remove the Partytown integration from `astro.config.mjs`, and the commented-out lines there that name removed packages.
-   Remove `image.remotePatterns`, which allowed every https host.
-   Mark every page `noindex, nofollow` through one switch in `src/config.ts`, to be turned at launch.
-   Remove the debug line (template name, build time, environment) from both layouts and its style rule.
-   Remove the hardcoded view count of 7895 from the resource cards and the resource page.
-   Delete the two test resources, `src/content/resources/test.md` and `test2.md`. The owner agreed to this deletion on 2026-11-12.

What a visitor sees change:

-   The pages `/r/test` and `/r/test2` are gone, and the two entries leave every listing, tag page and the sitemap.
-   Resource cards and resource pages no longer show a "Vizualizări" count.
-   Nothing else. Every other page must look exactly as before.

What changes in the HTML without a visible effect: the Partytown snippet and its files are gone, the robots meta tag says `noindex, nofollow`, and the hidden debug line is gone.

## Capabilities

### New Capabilities

-   `static-delivery`: how the site is built and served: static files only, from an install with scripts off, with no image proxy.
-   `pre-launch-visibility`: what the public and search engines get while the site is unfinished.

### Modified Capabilities

None. No spec exists yet.

## Impact

-   `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `src/config.ts`, both layouts, `src/components/ResourceList.astro`, `src/pages/r/[slug].astro`, `src/style/style.scss`, and the two deleted resources.
-   Dependency alerts: the plan of 2026-11-11 expects about 26 to close, one of them critical. The real number is read after the owner pushes.
-   Out of scope: `astro-embed` and `astro-social-share` (the home page still renders them; removing them changes the page), `@astrojs/mdx`, every version upgrade (Phase 2), the security headers in `vercel.json` (Phase 5), and the other files on the deletion list, which the owner keeps for now.
-   Waits for the owner: every commit, and turning the `noindex` switch at launch.
