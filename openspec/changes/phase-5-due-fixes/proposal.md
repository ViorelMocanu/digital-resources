# Phase 5: the fixes that are due

## Why

Phases 1 to 4 had to leave every page exactly as it was, so the faults they found were listed, not fixed. The owner chose to batch every visible fix in this phase (2026-11-14). The faults come from three places: the owner's decisions of 2026-11-14 (items 12 to 18 of that day), the four-reviewer round on Phases 2 to 4, and a read-only map of each item made on 2026-11-14 by four readers and four skeptics, which gives each item its locations, its fix, its page difference and the failing test to write first.

Real content arrives after this upgrade (Phase 7). Several faults are harmless with five resources and would break the build, or hide a resource without a word, with two thousand. They are fixed now, while a mistake costs one page.

## What Changes

Each item names what a visitor sees change. An item marked "default" rests on an owner choice that is still open; it is built on the recommended option, which the owner can still change (see Open choices).

### Pages and navigation

- **Subcategory text.** The 14 subcategory pages show their own text, not their category's (`render(subcategory)`). Visitors see the one-line placeholders those files hold today.
- **Dead links.** The breadcrumb of the 11 tag pages links `/t`, not `/taguri`; the home page links `/r`, not `/resurse`; a resource without a category links `/r`. The tag chip of the current tag is marked active on 10 tag pages.
- **Footer.** The footer link of the current page is marked active on the five legal and help pages.
- **Type icon** (default). The icon after a resource's title comes from its `type` field. The book "Resilient Web Design" shows the book icon (U+1F4D6) instead of the page icon (U+1F4C3) on 13 pages. A resource without a type tag no longer stops the build.
- **Category images** (default). The seven category pages load their hero image through Astro's image pipeline instead of a source path that never loaded. The placeholder logo becomes visible on those seven pages.

### Head and SEO

- **Sitemap.** The made-up address `https://resurse.dev/external-page2` and the filter for four pages that do not exist leave `astro.config.mjs`.
- **Publication date** (default). Pages without a date of their own stop printing the build time as `article:published_time` and `article:modified_time`; the two tags go from 50 pages. `__DATE__` and the unused `GLOBAL_PUB_DATE` go.
- **Resource dates.** The five resource pages print both tags as ISO 8601 (`2011-10-05T14:48:00.000Z`), not as free text.
- **Dates in UTC** (default). The date printed on a resource page no longer depends on the build machine's time zone. No printed date changes today.
- **Trailing slash.** `trailingSlash: 'never'`. The canonical address, `og:url` and the sitemap name each page without the final slash, as every internal link already does; the adapter writes the redirect from the slashed form. 55 pages change their canonical; the home page keeps `/`. Two other addresses the pages write of themselves follow: the last breadcrumb link, and the address Speed Insights reports for the page (`data-pathname` of `vercel-speed-insights`), so that dashboard lists `/faq` where it listed `/faq/`.
- **`/README/`** is deleted (owner decision 15). The page and its sitemap entry leave the build: 56 pages become 55.
- **Head sorter.** `astro-capo` is removed, with its patch entry. The head prints in source order, without `data-capo`. No visible change is expected; the navigation test is the gate (L-008).

### Content model

- **Rating** (default). One scale, 1 to 10 with at most one decimal, written `8.5/10` (owner decision 12). The five stored `100` become `10`; 49 places on 19 pages read `10/10` instead of `100 (10)`; a resource without a rating shows `n/a`.
- **Reference check** (default). The build stops with a message that names the file and the id when a section, category, subcategory or tag id does not exist, or a resource's category is not in its section. Today every reference resolves, so no page changes.
- **Optional fields.** A resource without `modDate`, without categories or without a type tag no longer stops the build; an undated resource is listed after the dated ones (default).
- **Stable order.** Every list sorts by its value, then by id, so two builds give the same order. `/r/` and `/cauta/` keep their order by id (default), which equals today's build.
- **Pagination.** Page links are built from the list's first address, so a path segment that starts with a digit (`3d-modelling`) no longer breaks them. No built list has more than one page today.
- **Image rule.** An image Astro could not resolve stops the build with a message, instead of passing the width check.

### Tests and tooling (no page changes)

- `getSortedItems` gains a pure `sortEntries`, so its tests can fail for the right reason.
- `highlightUrl` loses a branch that only ran at build time with `window` undefined (default); its three identical tests become one per real case.
- The accessibility test compares findings by rule and element, not by rule id alone (default).
- The overrides check treats a parent as caught up only when its lowest accepted version reaches the fix (default).
- The OpenSpec port formats its own output, with a drift test; the 11 ported skills lose 82 blank lines and one table re-pads, once (default).
- The `clip` declarations go and their lint exception with them; `-webkit-text-size-adjust` and its exception stay (default; owner decision 16).

### Dependencies

- Removed: `astro-capo` 0.0.1, with its `patchedDependencies` entry in `pnpm-workspace.yaml`.
- Upgraded: `prettier-plugin-astro` 0.14.1 to 1.1.2 (default), behind a test that fails on 0.14.1 because it drops a type argument (L-009). `@astrojs/compiler` 2.10.3 leaves the install. `.prettierrc` gains `"astroCompressHTML": "html"`: the 1.x line assumes Astro 7's default `compressHTML: 'jsx'`, and without the setting it moves link text in ways that show a space on this site, which builds with `compressHTML: true`. Every page is compared with the previous build after the reformat.

## Open choices, built on the recommended default

The owner can change any of these; each is one place in the code. The decision page lists them side by side.

1. Rating: `100` becomes `10` (not removed); `10/10` (not `10.0/10`); a missing rating shows `n/a` (the row stays); the lowest rating is 1 (not 0).
2. Type icon: the `type` field decides (not the first type tag).
3. Category images: Astro's image pipeline (not a copy in `public/`, not removing the image fields).
4. Undated pages print no publication date (not their entry's `publishDate`, not an invented global date).
5. Dates print in UTC (not Europe/Bucharest).
6. Reference check: a pure function called in the resource route, with the two extra rules (not a schema refine, not a unit test only).
7. Undated resources stay allowed and sort last (not a required `modDate`).
8. `/r/` and `/cauta/` sort by id (not by date).
9. `highlightUrl` decides from its argument alone.
10. Accessibility findings by rule and element (not by count).
11. Overrides: caught up when the parent's floor reaches the fix (not `semver.subset`).
12. The port formats its output (not a separate format step).
13. `-webkit-text-size-adjust` stays (not replaced, not doubled).
14. `prettier-plugin-astro` 1.1.2 (not staying on 0.14.1 with a check, not leaving `.astro` files unformatted).

## Waiting for the owner

- **The share image.** `og:image` is `../public/ogimage.jpg`, a relative path to a file that does not exist, on every page. The fix needs a 1200x630 image from the owner (recommended), or the image tags dropped.
- **The Vercel analytics script.** Every page loads `/_vercel/insights/script.js` through the adapter's `webAnalytics` option. Removing it (recommended) stops whatever the Vercel dashboard shows; that is the owner's to decide.
- **`/login`.** Every page links `/login`, which does not exist; it is not on the Phase 5 list. Until decided, the dead-link test lists it as a known gap.
- **The same image fix for subcategories.** No subcategory has an image today, so it is outside item 5.
- **Deletions** that need consent, each left in place and unused until then: `src/layouts/LayoutMarkdown.astro` and `src/components/MarkdownTOC.astro` (only `/README/` used them), `patches/astro-capo@0.0.1.patch` (no longer listed), and `src/vite-env.d.ts` (it declares only `__DATE__`).

## Out of scope

Found by the map and listed for the owner, not fixed here: the placeholder redirect in `vercel.json`, its multi-origin `Access-Control-Allow-Origin` and stale CSP hosts, the absolute last breadcrumb link on 27 pages, the canonical of the not-found page, the `@TODO` text on tag pages and the home page title, eight silenced type checks in `PostHog.astro`, PostHog's default persistence, the dead sitemap `i18n` block, the `twitter:*` tags written with `property=`, empty `og:image:alt` and `fb:app_id`, "Data adăugării" printing `modDate`, the commented-out section images. The real content of Phase 7 and its typed content model (Phase 6).

## Impact

- Pages: as listed above; the build comparison names every difference, and nothing else may differ.
- Page weight: a few bytes less per page (the sorter's attribute, two meta tags); the seven category pages load one SVG they failed to load before.
- Accessibility: the active footer link and tag chip use the accent colour, about 6.2:1 on the background (computed by hand; the accessibility test confirms).
- SEO: every page is still `noindex` until launch. Canonicals match the internal links; the sitemap holds only real pages.
- Security headers: none change.
