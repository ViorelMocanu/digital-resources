# Design: share cards

## Choice

Every page needs its own card, made at build time, with no network call and no runtime function.

|  | A (built) | B (rejected) | C (rejected) |
| --- | --- | --- | --- |
| Where the card data comes from | The layout writes it into the page's head (`resurse:card`: kind, trail, facts); a build step reads each built page | An endpoint, `src/pages/og/[...card].jpg.ts`, lists the pages from the content collections | `astro-og-canvas` |
| Coverage | Every built page, list pages after the first included, by construction | Repeats the routing of categories and subcategories; titles of the 13 other pages kept twice | As B |
| Drift between page and card | None: the card is read from the page's own HTML | Possible; no test could see it in a JPEG | As B |
| Cost | About 100 bytes of head per page | None in the page | A 26 MB CanvasKit package and a network font by default |

Rendering: `satori` 0.63.2 draws the card as SVG with the text as paths; `sharp` turns it into JPEG. `@vercel/og` was rejected (it pins an older satori and can reach font and emoji CDNs); `@resvg/resvg-js` was not needed.

## Details

- **Format:** JPEG, quality 88, 4:4:4. WhatsApp shows no image over 600 KB; Facebook reads only JPEG, PNG and GIF. About 32 KB per card (23 to 49 KB; 1.8 MB for the 56 cards of this build).
- **Font:** the site's own `public/font/atkinson-hyperlegible-*.woff2`, unaltered (satori reads WOFF2 since 0.55.0). The font's licence says "without derivatives or alteration", so the files are not converted.
- **Missing glyphs:** a card whose text has a character the font lacks stops the build and names it (`loadAdditionalAsset` throws). Phase 7 cleans titles at import or adds a fallback font.
- **Logo:** the paths of `public/favicon.svg` with their dark-theme colours, drawn once as a PNG data URI (the file's colours come from a media query the renderer does not read).
- **Build step:** `src/integrations/shareCards.ts`, on `astro:build:done`, the hook the sitemap uses, eight cards at a time. 56 cards in this build.

## Effect

Page weight, accessibility, SEO and headers: see the proposal's Impact. Build time: the cards of 56 pages took under a second on the development machine; about 2,300 pages would take roughly a minute without a cache (Phase 7).
