# Design

## Context

Three major versions lie between the installed Astro and the current one. Each brought breaking changes that touch this code: Astro 5 the Content Layer and the removal of `output: 'hybrid'`, Astro 6 the removal of the old collections and of `ViewTransitions`, Astro 7 Vite 8 with Lightning CSS and a new Markdown pipeline. The site is small (56 pages, 5 collections, one stylesheet) and static since Phase 1, and it has a baseline of built pages and screenshots.

## Decisions

### One landing, not three

-   **Chosen:** go from 4 to 7 in one step, with the three upgrade guides open and worked through in order.
-   **Rejected:** land Astro 5, then 6, then 7, each with its own comparison. It triples the comparison work, and the middle versions carry open alerts, so no intermediate state is worth deploying.
-   **Cost of the choice:** a failure is harder to attribute. The tasks answer that by making the build work first with the content migration alone, before anything else changes.

### Entry ids equal the old slugs

-   **Chosen:** every collection uses a `glob()` loader over its present folder. The id of an entry is its file name without the extension, which is what `.slug` returned. The five section files carry a `slug:` field in their frontmatter; the loader takes that field as the id, and it equals the file name in all five.
-   **Rejected:** a custom `generateId`. It is needed only if a generated id differs from today's slug, and the comparison of the address list decides that.
-   **Check:** the sitemap and the list of built pages are compared with the previous build before any other change is made.

### Keep the home page's demo embeds

-   **Chosen:** upgrade `astro-embed` and keep `astro-social-share`, so the home page stays as it is.
-   **Rejected:** remove both now, as the plan of 2026-11-11 suggested. That changes a page, and this phase promises it changes none. The home page is placeholder content that Phase 6 replaces.
-   **If `astro-social-share` 2.0.2 does not build on Astro 7:** try 2.2.0. If that fails too, stop and ask the owner; the alternatives are a small local component with the same markup, or removing the demo.

### Zod from Astro

-   **Chosen:** import `z` from `astro/zod` everywhere. The site then follows the Zod version Astro ships and declares no extra dependency.
-   **Rejected:** declare `zod` 4 directly. Two version ranges to keep in step for no gain.
-   **Data, not schema:** if Zod 4 rejects frontmatter that Zod 3 accepted (an empty `addDate`, a date as text), the content file is corrected and the schema stays strict. A schema change that loosens a rule is asked first.

### TypeScript 6, bundler resolution

-   **Chosen:** `moduleResolution: bundler` and paths relative to `tsconfig.json`, which is what Astro's own presets use.
-   **Rejected:** TypeScript 7, released on 2026-11-12. `@astrojs/check` does not accept it, and it is younger than seven days.

## Effect on the pages

-   **Page weight:** expected to stay within a few percent. Measured in the comparison, per page, and reported.
-   **Accessibility and SEO:** no markup is edited by hand. The head of every page is compared tag by tag (title, description, canonical, robots, Open Graph).
-   **Security headers:** `vercel.json` is not touched. If Astro 7 emits inline scripts the present policy blocks, the report names them; the policy is rewritten in Phase 5.
-   **View transitions:** `ClientRouter` replaces `ViewTransitions` with the same `fallback="none"`. Navigation and the mobile menu are checked by hand in one browser, because screenshots do not show them.

## Risks

| Risk                                                                 | Answer                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| An id differs from the old slug and an address changes               | The address list is compared first; a difference stops the work |
| Lightning CSS writes nested rules or range media queries differently | Screenshots of every page at 390 and 1440 pixels                |
| Zod 4 rejects present frontmatter                                    | `pnpm astro sync` early; correct the data                       |
| The old lint packages cannot read the new project                    | The smallest lint upgrade moves into this phase, reported       |
| Vercel builds with an old Node version                               | The owner sets 24.x before the push                             |
