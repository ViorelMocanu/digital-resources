# Spec Delta

## Purpose

What must stay the same for a visitor of resurse.dev when the tools under the site change.

## ADDED Requirements

### Requirement: Every address stays

An upgrade SHALL NOT add, remove or rename a page.

#### Scenario: Built pages

-   **WHEN** the list of HTML files in the build output is compared with the list from the build before the phase
-   **THEN** the two lists are equal

#### Scenario: Sitemap

-   **WHEN** the addresses in the built sitemap are compared with those of the build before the phase
-   **THEN** the two lists are equal

### Requirement: Every page looks the same

Every page SHALL look as it did before the upgrade, on a phone and on a desktop screen.

#### Scenario: Screenshots

-   **WHEN** a full-page screenshot of every page is taken at 390 and at 1440 pixels wide
-   **AND** each is compared with the screenshot from the build before the phase
-   **THEN** no screenshot differs in size
-   **AND** no screenshot differs in more than 0.1 percent of its pixels

### Requirement: Every page says the same

The text a visitor or a search engine reads SHALL be unchanged.

#### Scenario: Visible text

-   **WHEN** the text of the `body` of every built page, with tags removed and white space collapsed, is compared with the build before the phase
-   **THEN** it is equal on every page

#### Scenario: Head

-   **WHEN** the title, the description, the canonical link, the robots tag and the Open Graph tags of every built page are compared with the build before the phase
-   **THEN** they are equal on every page

### Requirement: Navigation between pages still works

Moving between pages SHALL work as before, with the page transition and the mobile menu.

#### Scenario: Checked by hand

-   **WHEN** the built site is opened in one browser
-   **AND** a link in the header, a resource card and the mobile menu are used
-   **THEN** each leads to its page with no error in the console
