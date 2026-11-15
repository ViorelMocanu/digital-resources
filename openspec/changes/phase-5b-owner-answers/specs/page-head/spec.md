# Spec Delta

## Purpose

What the head of each page tells link previews, and the day a page prints.

## ADDED Requirements

### Requirement: Every page has its own share card

Every built page SHALL name its own share card in `og:image`: a JPEG of 1200 x 630 pixels under 600 KB, at a full address under `/og/`, with its type, size and an alt text that contains the page title.

#### Scenario: Any built page

- **WHEN** a built page is opened
- **THEN** `og:image` is `https://resurse.dev/og/<page path>.jpg`, or `https://resurse.dev/og/home.jpg` for the home page
- **AND** that file is in the build, a JPEG of 1200 x 630 under 600 KB
- **AND** `og:image:type` is `image/jpeg` and `og:image:alt` contains `og:title`

#### Scenario: A character the font lacks

- **WHEN** a card is drawn for a title with a Cyrillic letter
- **THEN** the drawing fails with a message that names the text

### Requirement: The share tags are the ones platforms read

A page SHALL write `og:description` equal to its description, write the `twitter:*` tags with `name=`, write no `og:email`, `fb:app_id` or `article:publisher`, and use `og:type` `article` exactly when it prints a date of its own.

#### Scenario: Any built page

- **WHEN** a built page is opened
- **THEN** `og:description` equals the `description` meta tag
- **AND** `meta[name="twitter:card"]` is `summary_large_image` and no `meta[property^="twitter:"]` exists
- **AND** none of `og:email`, `fb:app_id`, `article:publisher` exists
- **AND** `og:type` is `article` on the five resource pages and `website` on every other page

### Requirement: The not-found page names no address of its own

The not-found page SHALL have no canonical link and no `og:url`.

#### Scenario: Not found

- **WHEN** `/404` is opened
- **THEN** it has no `link[rel="canonical"]` and no `og:url`

### Requirement: Dates print as the day in Bucharest

A printed date SHALL be the day in Europe/Bucharest, whatever the build machine's time zone.

#### Scenario: Late evening

- **WHEN** a date is formatted with the process time zone set to `UTC`, `America/New_York` or `Asia/Tokyo`
- **THEN** `2022-01-01T22:00:00Z` prints as `2022-01-02` and `2022-01-01T21:59:00Z` as `2022-01-01`
- **AND** `2022-07-01T21:00:00Z` prints as `2022-07-02`
