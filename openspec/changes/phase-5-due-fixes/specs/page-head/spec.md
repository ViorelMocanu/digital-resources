# Spec Delta

## Purpose

What the head of each page and the sitemap tell search engines and link previews.

## ADDED Requirements

### Requirement: The sitemap lists only real pages

Every address in the sitemap SHALL be a built page, written without a trailing slash apart from the home page.

#### Scenario: Sitemap addresses

- **WHEN** every `<loc>` of every sitemap named in `sitemap-index.xml` is read
- **THEN** each one is a built page
- **AND** none of them ends with `/` apart from `https://resurse.dev/`
- **AND** `https://resurse.dev/external-page2` and `https://resurse.dev/README/` are not among them

### Requirement: The canonical address matches the internal links

The canonical link and `og:url` of a page SHALL name the page without a trailing slash, as the internal links do; the home page keeps `/`.

#### Scenario: Canonical

- **WHEN** a built page is opened
- **THEN** its canonical path is its address without the final slash, or `/` for the home page
- **AND** `og:url` equals the canonical address

### Requirement: Dates are real dates

A page SHALL print `article:published_time` and `article:modified_time` only when it has a date of its own, and then in ISO 8601.

#### Scenario: A page without a date

- **WHEN** `/`, `/faq/`, `/front-end/`, `/t/video/` or `/404` is opened
- **THEN** the page has neither tag

#### Scenario: A resource page

- **WHEN** `/r/how-does-the-internet-work/` is opened
- **THEN** `article:published_time` is `2011-10-05T14:48:00.000Z`

#### Scenario: The time zone of the build

- **WHEN** a date is formatted for a page with the process time zone set to `UTC`, `America/New_York` or `Asia/Tokyo`
- **THEN** `2022-01-01` prints as `2022-01-01` in each

### Requirement: The head is printed as written

The head SHALL be printed in source order, without a sorter, and keep the client router.

#### Scenario: Head

- **WHEN** a built page is opened
- **THEN** its `head` has no `data-capo` attribute
- **AND** the client router's script is in it once

### Requirement: No stray page

`/README/` SHALL not be a page.

#### Scenario: Built pages

- **WHEN** the built pages are listed
- **THEN** `/README/` is not among them
