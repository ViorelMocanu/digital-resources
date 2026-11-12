# Spec Delta

## Purpose

How resurse.dev is built and served: as static files only, from a locked install that runs no package script, and without an image proxy.

## ADDED Requirements

### Requirement: The build output is static

The build SHALL produce only static files. The deployment SHALL contain no server function.

#### Scenario: No function in the build output

-   **WHEN** `pnpm build` has finished
-   **THEN** `.vercel/output` has no `functions` folder
-   **AND** `.vercel/output/config.json` has no route to `_render` or `_image`

### Requirement: The build works without install scripts

The site SHALL build after `pnpm install --frozen-lockfile --ignore-scripts`.

#### Scenario: Clean install, then build

-   **WHEN** the dependencies are installed with a frozen lockfile and scripts off
-   **AND** `pnpm build` runs
-   **THEN** the build exits with code 0

### Requirement: No open image host list

The configuration SHALL NOT allow image optimisation for every remote host.

#### Scenario: No wildcard pattern

-   **WHEN** `astro.config.mjs` is read
-   **THEN** it holds no `remotePatterns` entry without a hostname

### Requirement: Only used packages are installed

`package.json` SHALL NOT list a package that no source file, config file or script uses.

#### Scenario: The nine removed packages

-   **WHEN** `package.json` is read
-   **THEN** it lists none of `@astrojs/partytown`, `@astrojs/rss`, `@sentry/astro`, `@vercel/analytics`, `astro-compress`, `lite-youtube-embed`, `node-html-parser`, `posthog-js` and `csv-parser`
-   **AND** `pnpm typecheck` and `pnpm build` pass

#### Scenario: No Partytown files are shipped

-   **WHEN** `pnpm build` has finished
-   **THEN** the static output has no `~partytown` folder
-   **AND** no built file contains the text `~partytown`
