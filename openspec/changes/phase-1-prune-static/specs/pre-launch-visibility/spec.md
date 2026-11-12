# Spec Delta

## Purpose

What visitors and search engines get from resurse.dev while the site is unfinished: no indexing, no debug output, no test entries and no invented numbers.

## ADDED Requirements

### Requirement: Pages are not indexed before launch

Every built page SHALL ask search engines not to index it, until the launch switch in `src/config.ts` is turned.

#### Scenario: Robots meta tag before launch

-   **WHEN** the site is built with the launch switch off
-   **THEN** every built HTML page has a robots meta tag whose content is `noindex, nofollow`

### Requirement: No debug output on pages

A built page SHALL NOT carry the template name, the build time or the environment name as debug text.

#### Scenario: The debug line is gone

-   **WHEN** `pnpm build` has finished
-   **THEN** no built page contains the text `TemporaryMessage`

### Requirement: No test entries in the catalogue

The catalogue SHALL hold no test resource.

#### Scenario: Test pages do not exist

-   **WHEN** `pnpm build` has finished
-   **THEN** the static output has no page at `/r/test` or `/r/test2`
-   **AND** the sitemap lists neither address

### Requirement: No invented numbers

A page SHALL NOT show a number that is not backed by data.

#### Scenario: No placeholder view count

-   **WHEN** `pnpm build` has finished
-   **THEN** no built page contains the text `7895`
