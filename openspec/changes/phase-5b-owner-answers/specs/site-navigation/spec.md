# Spec Delta

## Purpose

The account page, the links that lead to it and the redirects of the host.

## ADDED Requirements

### Requirement: The account link leads to a page

`/login` SHALL be a built page that says accounts are not available yet, marks the header link, and is left out of the sitemap; no built page links an address the build does not hold.

#### Scenario: The account page

- **WHEN** `/login` is opened
- **THEN** its heading is `Contul tău pe resurse.dev` and its main text contains `Conturile nu sunt încă disponibile.`
- **AND** one `a.Login.Active` is on the page

#### Scenario: Dead links and the sitemap

- **WHEN** every link to the site from every built page is resolved against the build
- **THEN** none is missing
- **AND** no sitemap address is `/login`

### Requirement: Breadcrumb links are paths

Every breadcrumb link SHALL be a path of the site, as the other internal links are.

#### Scenario: Every built page

- **WHEN** every `a.BreadcrumbLink` of every built page is read
- **THEN** none starts with `http`

### Requirement: The host's redirects lead somewhere

Every redirect in `vercel.json` SHALL lead to a built page or to an address outside the site, and no response header SHALL name more than one origin in `Access-Control-Allow-Origin`.

#### Scenario: The host configuration

- **WHEN** `vercel.json` is read
- **THEN** every redirect destination that starts with `/` is a built page
- **AND** no `Access-Control-Allow-Origin` value holds a comma
