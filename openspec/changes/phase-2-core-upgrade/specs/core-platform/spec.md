# Spec Delta

## Purpose

The runtime and the core packages resurse.dev is built with, and what an install and an audit of them must show.

## ADDED Requirements

### Requirement: The site builds on supported major versions

The site SHALL build with Astro 7, on Node 24 or newer. The manifest SHALL state the Node floor and the pnpm version.

#### Scenario: Installed versions

-   **WHEN** `pnpm ls astro typescript vitest --depth 0` runs after a locked install
-   **THEN** it lists `astro` 7, `typescript` 6 and `vitest` 5

#### Scenario: Declared runtime

-   **WHEN** `package.json` is read
-   **THEN** `engines.node` is `>=24.16`
-   **AND** `packageManager` names one exact pnpm version
-   **AND** `.nvmrc` holds `24`

### Requirement: The build still works without install scripts

The site SHALL build after `pnpm install --frozen-lockfile --ignore-scripts`, and the output SHALL stay static.

#### Scenario: Clean install, then build

-   **WHEN** the dependencies are installed with a frozen lockfile and scripts off
-   **AND** `pnpm build` runs
-   **THEN** the build exits with code 0
-   **AND** `.vercel/output` has no `functions` folder

### Requirement: No critical advisory in what the site ships

The packages the built site depends on SHALL carry no critical advisory.

#### Scenario: Audit of the production dependencies

-   **WHEN** `pnpm audit --prod --audit-level critical` runs
-   **THEN** it exits with code 0

### Requirement: One copy of each core tool

The manifest SHALL NOT declare a package that Astro already provides or that no file uses.

#### Scenario: Removed packages

-   **WHEN** `package.json` is read
-   **THEN** it lists none of `vite`, `sass`, `@astrojs/mdx` and `zod`

### Requirement: The checks pass on the new versions

The project's own checks SHALL pass on the upgraded stack, with no test removed or weakened.

#### Scenario: Verify

-   **WHEN** `pnpm verify` runs
-   **THEN** it exits with code 0
-   **AND** the number of unit tests that ran is at least the 844 that ran before the phase
