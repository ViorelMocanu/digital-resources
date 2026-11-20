# Phase 5b: the owner's answers of 15 November

## Why

The owner answered the Phase 5 decision page on 2026-11-15. Most answers take the recommended option. Four do not: the account link gets a placeholder page (D1 B); every page gets its own share image, drawn at build time, instead of one image from the owner or none (D2); the Vercel analytics script stays (D3 B); and dates print in Bucharest time, not UTC (D6, item 5). The owner also asked to archive the four unused files instead of deleting them, and to fix the findings Phase 5 listed or place them in later phases.

## What Changes

What a visitor sees:

- **`/login`** is a page: it says accounts are not ready yet and links to all resources. The header link is marked on it. It is not in the sitemap. The text is a draft for the owner.
- **Share cards.** Every page has its own 1200 x 630 JPEG at `/og/<page path>.jpg` (the home page: `/og/home.jpg`), in the site's dark theme, font and logo. It shows the kind of page, the trail, the title, the address, and for a resource its type and rating. About 32 KB each (23 to 49 KB).
- **Share tags.** `og:image` is the page's card as a full address, with `og:image:type`, its size and an alt text; `og:description` is added; `twitter:*` tags are written with `name=`; `og:email`, the empty `fb:app_id` and `article:publisher` go; `og:type` is `article` on a page with a date of its own; the not-found page has no canonical and no `og:url`.
- **Dates** print as the day in Bucharest (EET, UTC+2; EEST, UTC+3). No printed date changes today. The `article:*` tags keep the instant in UTC.
- **Breadcrumbs.** The last link is a path of the site, not a full address (27 pages).

What the build and the checks do:

- A lint warning fails `pnpm lint:js`, `pnpm verify` and the CI workflow (`--max-warnings=0`).
- Reference screenshots: one page of each kind at both widths (20 images), not every page. The CI step that takes references writes `e2e/__screenshots__/REFERENCES.txt`; once that file is committed, a run that finds it without images fails.
- `vercel.json`: the placeholder redirect `/old-url-path/` and the `Access-Control-Allow-Origin` header that listed eight origins (browsers refuse a list) go, with its `Access-Control-Allow-Methods`.
- The sitemap integration's unused `i18n` block goes; the sitemap is byte-identical apart from leaving out `/login`.
- The stop-sign emoji markers leave the comments of `src/config.ts`.
- Four CodeQL alerts in the scripts (owner, 2026-11-20): the static server for the browser tests checks containment with `path.relative`, a shape CodeQL recognises; the formatter test helper removes tags until nothing changes; the harness sync also strips a comment that ends in `--!>`. Only the last changes an output, and only for a header no config uses.
- A second audit check in CI (owner, 2026-11-20, option 2A): `pnpm audit:bulk` sends every production version in `pnpm-lock.yaml` to the registry's bulk advisory endpoint, so a renamed copy that pnpm 10's audit drops is still checked. It runs after `pnpm audit --prod` and needs the network, like that step; `pnpm verify` does not run it.
- Greetings (owner, 2026-11-20, option 1A): the workflow thanks the opener of a first issue only. GitHub blocks `pull_request_target` in public repositories from 2026-12-02, and that trigger was the only way to greet a pull request from a fork.
- `engines.node` is `^24.16.0` instead of `>=24.16` (owner, 2026-11-16, option A of the Node pin page). Vercel turns an open range into the newest Node it offers (26), while the CI tests run on Node 24 (`.nvmrc`). A caret range keeps Vercel on Node 24, which still ships the Corepack that `ENABLE_EXPERIMENTAL_COREPACK` needs, and keeps the 24.16 minimum. The Phase 2 spec line follows.

Files archived with the owner's consent (moved to `tmp/archive/2026-11-15-phase-5/`, gitignored, with a README; git history keeps them): `src/layouts/LayoutMarkdown.astro`, `src/components/MarkdownTOC.astro`, `patches/astro-capo@0.0.1.patch`, `src/vite-env.d.ts`.

## Dependencies

- Added: `satori` 0.63.2, exact (published 2026-10-20; 19 new packages in the lockfile; none has an install script). It draws the cards; `sharp` 0.35.5, already a dependency, turns them into JPEG.
- Overridden: `satori>fflate` to 0.7.5 in `pnpm-workspace.yaml` (owner, 2026-11-19, option 1A of the before-push page). satori pins fflate 0.7.3, which has a moderate advisory (GHSA-px8p-9vwx-vf98, an endless loop in `unzipSync`), so `pnpm audit --prod` failed every CI run and the build and browser tests never ran there. satori calls only `inflateSync`; 0.7.5 is the fix on the same line. Remove the override when satori asks for 0.7.5 or later itself.
- Overridden: `@vercel/routing-utils>path-to-regexp` to 6.3.0 (owner, 2026-11-20: fix every open security alert). routing-utils, under the Vercel adapter, pins 6.1.0 exactly (GHSA-9wv6-86v2-598j, high) and also carries 6.3.0 under an alias. pnpm 10's audit keys the tree it sends by real package name, so the alias hid 6.1.0 from `pnpm audit --prod`; `test/lockfileAdvisories.test.ts` now guards it. The one pattern the site sends routing-utils compiles the same in both versions, and `config.json` is unchanged. Remove the override when routing-utils asks for 6.3.0 or later itself.
- Not changed: the local Unsupported engine warning (owner, 2026-11-19, option 2A). It appears only on a machine whose Node is outside `^24.16.0` and changes no exit code; CI runs Node 24 and does not print it.

## Placed in later phases

| Finding | Phase | Why there |
| --- | --- | --- |
| The `@TODO` text on tag pages, stub pages and the home page title | 6 | Real copy for the stub pages is Phase 6 scope |
| "Data adăugării" prints `modDate` | 6 | Needs a date-added field in the content model |
| The commented-out section images | 6 | Content model |
| The stale hosts of the Content-Security-Policy | 6 | A rewrite must be tested on a Vercel preview before launch |
| Vercel's Ignored Build Step builds production only (`exit 1` when `VERCEL_ENV` is production, `exit 0` otherwise), so no preview is ever built (found in the build log of 2026-11-16) | 6 | The CSP test above needs a preview; the setting is the owner's |
| PostHog: eight silenced type checks in the vendor snippet, default persistence (a cookie and storage) | 6 | An analytics decision (decision page, N3) |
| Preview images stored in the repository as WebP (owner, section 4 A) | 7 | Part of the content import |
| A resource's own preview image on its card; a content-hash card cache | 7 | Need the downloaded images and the 2,300 pages |
| Astro 7's build warning that `markdown.remarkPlugins`, `rehypePlugins` and `remarkRehype` are deprecated (found 2026-11-16) | 6 | The Markdown setup changes with the content model |

## Waiting for the owner

The `/login` text, the card design, the PostHog choice, the card cache (decision page N1 to N4); the walkthroughs: the Vercel variable before the push, the first CI run and its references, CI as a required check, trusting the hooks in Codex, Antigravity and Grok, the OpenSpec dry run, the security software trial.

## Impact

- Pages: as listed; the build comparison with `6545861` names every difference.
- Page weight: about 400 bytes more per page in the head (the card tag, `og:description`, the image type); 56 card files, 1.8 MB, fetched only by link previews.
- Accessibility: no visible change apart from the `/login` page.
- SEO: every page is still `noindex` until launch.
- Security headers: the CORS pair goes; it never worked, as a list of origins is refused by browsers, and nothing reads the site from another origin.
