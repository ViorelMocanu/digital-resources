# Spec Delta

## Purpose

What a visitor reads and follows on the pages of resurse.dev: each page's own text, links that lead somewhere, the mark on the current item, the icon of a resource and the images a page asks for.

## ADDED Requirements

### Requirement: A subcategory page shows its own text

A subcategory page SHALL print the body of its own Markdown file, not the body of its category.

#### Scenario: Emmet

- **WHEN** `/front-end/html/emmet/` is opened
- **THEN** the hero text is `@TODO: Emmet`, the body of `src/content/subcategories/emmet.md`
- **AND** it does not contain `Lorem Ipsum`

### Requirement: Internal links lead to a page

Every link from a built page to an address of the site SHALL lead to a built page or file, apart from the addresses listed as known gaps.

#### Scenario: Every built page

- **WHEN** every `a[href^="/"]` of every built page is resolved against the build output, with a missing trailing slash allowed
- **THEN** the only addresses without a page are the known gaps (`/login` until the owner decides)

### Requirement: The current item is marked

The tag chip of the current tag and the footer link of the current page SHALL carry the class `Active`.

#### Scenario: A tag page

- **WHEN** `/t/free/` is opened
- **THEN** five chips `li.ResourceTag.Active` are on the page, one per resource that has the tag

#### Scenario: A footer page

- **WHEN** each of `/termeni-si-conditii/`, `/confidentialitate/`, `/cookies/`, `/faq/` and `/contact/` is opened
- **THEN** exactly one `footer li.FooterItem.Active` is on the page, and its link is that page's address

### Requirement: The icon follows the resource's type

The icon after a resource's title SHALL be the icon of its `type` field.

#### Scenario: A book with two type tags

- **WHEN** `/r/resilient-web-design/` is opened (type `carte`, tags `carte` and `text`)
- **THEN** its heading contains the book icon (U+1F4D6) and not the page icon (U+1F4C3)

### Requirement: Every image a page asks for exists

A page SHALL ask only for files that the build holds.

#### Scenario: Category pages

- **WHEN** each of the seven category pages is opened
- **THEN** no request answers 404
