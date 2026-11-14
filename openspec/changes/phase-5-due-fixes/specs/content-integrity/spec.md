# Spec Delta

## Purpose

What the content model accepts, what it refuses, and how it shows a resource, before real content arrives.

## ADDED Requirements

### Requirement: One rating scale

A rating SHALL be a number from 1 to 10 with at most one decimal, shown as `<rating>/10`, or `n/a` when a resource has none.

#### Scenario: Shown

- **WHEN** a resource rated 10 is shown
- **THEN** its rating reads `10/10`
- **AND** no built page shows a rating followed by ` (10)`

#### Scenario: Refused

- **WHEN** a resource is rated 10.1, 100, 8.55 or 0.9
- **THEN** the content schema refuses it

### Requirement: Broken references stop the build by name

A build SHALL stop with a message that names the file and the id when a reference does not resolve.

#### Scenario: A mistyped section

- **WHEN** a resource in `src/content/resources/a.md` names the section `front-ned`, which does not exist
- **THEN** the check reports `src/content/resources/a.md: section "front-ned" nu există în sections`

#### Scenario: Valid content

- **WHEN** every reference resolves
- **THEN** the check reports nothing

### Requirement: Optional fields are optional

A resource without `modDate`, without categories or without a type tag SHALL build.

#### Scenario: An undated resource

- **WHEN** resources dated 2023, undated and dated 2011 are sorted by date, oldest first
- **THEN** the order is 2011, 2023, undated

### Requirement: Lists keep one order

Two entries with the same sort value SHALL be ordered by id.

#### Scenario: A tie

- **WHEN** two resources with the same `modDate` are sorted, `odin-project-web-development` loaded first
- **THEN** `how-does-the-internet-work` comes first

### Requirement: Page links survive a digit

A numbered page link SHALL keep the list's address whole.

#### Scenario: A segment that starts with a digit

- **WHEN** the link to page 3 of `/design/3d-modelling` is built
- **THEN** it is `/design/3d-modelling/3`

### Requirement: An unreadable image stops the build

An image Astro could not resolve SHALL stop the build with a message that names the entry.

#### Scenario: A remote address

- **WHEN** the width rule gets the string `https://x.ro/a.jpg` for `resources/a`
- **THEN** it throws `resources/a: Imaginea nu a putut fi citită (https://x.ro/a.jpg)`
