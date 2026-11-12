# Tasks

## 1. Baseline

-   [x] 1.1 Record the built pages and screenshots before the phase (58 pages, 116 screenshots in `tmp/baseline/`)
-   [x] 1.2 Build the current tree once more as the comparison point for this change; check: `pnpm build`

## 2. Static output (done before this change was written)

-   [x] 2.1 Replace the manifest plugin with `public/site.webmanifest`; check: build after an install with scripts off
-   [x] 2.2 Switch to static output with the static Vercel adapter; check: no `functions` folder in `.vercel/output`
-   [x] 2.3 Render the account link at build time

## 3. Packages

-   [x] 3.1 Remove the Partytown integration and the commented-out lines that name removed packages from `astro.config.mjs`
-   [x] 3.2 Remove the nine packages with `pnpm remove --config.ignore-scripts=true`; check: `pnpm typecheck`, `pnpm build`
-   [x] 3.3 Remove `image.remotePatterns`; check: `pnpm build`

## 4. Pre-launch visibility

-   [x] 4.1 Add the launch switch to `src/config.ts` and use it for the robots meta tag in both layouts
-   [x] 4.2 Remove the debug line from both layouts and its style rule
-   [x] 4.3 Remove the hardcoded view count from the resource cards and the resource page
-   [x] 4.4 Delete `src/content/resources/test.md` and `test2.md` (owner's consent of 2026-11-12)

## 5. Final checks

-   [x] 5.1 Every scenario of both specs holds on the built output
-   [x] 5.2 Screenshots: pages that should not change are identical to the comparison point; the others differ only as the proposal says
-   [x] 5.3 `pnpm verify` and `pnpm build` pass
-   [x] 5.4 `pnpm exec openspec validate phase-1-prune-static --strict` passes
