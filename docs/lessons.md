# Lessons

Mistakes this project has already made, so that no agent makes them again. Read the entries for the area you are about to work in.

## The rule

- The **first** time a mistake happens, it gets an entry here and a rule in the right document.
- The **second** time, a note has failed. The mistake becomes a test, a lint rule or a hook, and the entry is updated to name that check.
- An entry is never deleted. When its check exists, its status changes from "rule" to "check".

## Format

```markdown
### L-000: <the mistake, in a few words>

- **Date and area:** YYYY-MM-DD, <harness | content | design | build | tests | security>
- **What happened:** <facts, with the file or commit that shows it>
- **Why it matters:** <what it cost or could have cost>
- **Do instead:** <the rule, and where it is written>
- **Check:** <the test, lint rule or hook that now prevents it, or "rule only" and the check to build if it happens again>
- **Status:** rule | check
```

## Entries

### L-001: a build that needed a package's install script

- **Date and area:** 2026-11-11, build
- **What happened:** a manifest plugin pulled in an image library whose binary arrives only through an install script, so the site could not be built after an install with scripts off. Commit `f7f92d8` replaced the plugin with a static manifest.
- **Why it matters:** install scripts are how a compromised package runs code on the machine; a build that depends on them forces them on.
- **Do instead:** install with `--frozen-lockfile --ignore-scripts`, and the build must work after it (`AGENTS.md`, Commands).
- **Check:** rule only. To build with the test and CI phase: a CI job that installs with scripts off and builds.
- **Status:** rule

### L-002: package scripts that downloaded an unpinned tool

- **Date and area:** 2026-11-11, build
- **What happened:** the lint scripts called `pnpx`, which downloads the latest release and ignores the lockfile. It fetched a new major version and failed on rules the config still used. Fixed in `f7f92d8`.
- **Why it matters:** the lint result did not depend on the repository, and unpinned code ran on every lint.
- **Do instead:** scripts call the locally installed binary (`AGENTS.md`, Always 2).
- **Check:** rule only. If it happens again: a unit test that fails on `pnpx`, `npx` or `dlx` in any package script.
- **Status:** rule

### L-003: scratch files that broke the checks

- **Date and area:** 2026-11-11, harness
- **What happened:** an agent's scratch folder was type-checked, linted and format-checked with the project, and produced thousands of errors that were not the project's.
- **Why it matters:** a red check that is not about the code hides the ones that are.
- **Do instead:** scratch lives only in `tmp/` (`AGENTS.md`, Always 8).
- **Check:** `tmp/` is in `.gitignore`, `.prettierignore`, the ESLint ignore list, the `tsconfig.json` exclude list and the Vitest exclude list.
- **Status:** check

### L-004: an image endpoint open to any remote host

- **Date and area:** 2026-11-11, security
- **What happened:** the image configuration allowed every `https` host, so the site's image endpoint would fetch and re-serve any remote image.
- **Why it matters:** it is the precondition of a published critical advisory, and it lets others use the site as a proxy.
- **Do instead:** remote image patterns always name a host; a static site needs no image endpoint at all.
- **Check:** rule only. To build with the fixes phase: a test that fails on a remote pattern without a hostname.
- **Status:** rule

### L-005: debug output in production

- **Date and area:** 2026-11-11, build
- **What happened:** every page shipped a line with the template name and the build time, and the homepage showed placeholder counters.
- **Why it matters:** it tells visitors the site is unfinished and tells everyone how old the build is.
- **Do instead:** debug output is rendered only in development.
- **Check:** rule only. To build with the test phase: an end-to-end test that fails on the debug element in the built pages.
- **Status:** rule

### L-006: a session compacted with only a scratch note as cover

- **Date and area:** 2026-11-11, harness
- **What happened:** the planning session was compacted before any state file existed; a note in the scratch folder and the compaction summary carried it.
- **Why it matters:** decisions made only in the chat are lost at a compaction.
- **Do instead:** write a state file at each trigger in `docs/state/README.md`.
- **Check:** `scripts/hooks/state-snapshot.mjs` warns at 350,000 tokens and captures the session before every compaction; its tests are in `scripts/hooks/state-snapshot.test.ts`.
- **Status:** check

### L-007: a command script written through a shell here-document

- **Date and area:** 2026-11-11, harness
- **What happened:** scripts written to disk through a here-document lost their backslashes, three times: regular expressions broke, and one patch script stopped before changing anything.
- **Why it matters:** a script that differs from what was written can do the wrong thing silently.
- **Do instead:** write a script with the file tool, then run it; keep here-documents for plain text without backslashes.
- **Check:** rule only. If it happens again: the worker brief gains the rule.
- **Second time, 2026-11-14:** a long Markdown section was appended to a scratch file through a here-document, and the shell refused the whole command over an apostrophe. Nothing was written, so nothing was lost. The worker brief now carries the rule (rule 8 of `docs/agent/worker-brief.md`). No hook checks it yet; a third time means the command guard refuses here-documents that write files.
- **Status:** rule

### L-008: an upgrade that kept every screenshot and lost page navigation

- **Date and area:** 2026-11-13, site, Astro 7 upgrade
- **What happened:** after the upgrade all 112 screenshots, the text and the head tags of every page matched the baseline, yet every link caused a full page load. `astro-capo` turns the head into text before sorting it, and since Astro 5 that step drops component scripts, so the client router's script never reached the page.
- **Why it matters:** a comparison of what pages look like says nothing about what they do. The regression would have shipped as "nothing changed".
- **Do instead:** compare behaviour as well as appearance after any upgrade: navigation, the back button and the mobile menu in a real browser, against the build before.
- **Check:** `astro-capo` is patched (`patches/astro-capo@0.0.1.patch`), and `test/layoutHead.test.ts` fails if the patch is dropped or not applied. Since 2026-11-13 the navigation test of the end-to-end suite (`e2e/navigation.spec.ts`, run with `pnpm test:e2e` after a build) fails when a link causes a full page load; it was run against a copy of the site without the router script and failed.
- **Status:** check

### L-009: a formatter upgrade that changed what the code means

- **Date and area:** 2026-11-14, tooling, Prettier 3.9 with the older Astro plugin
- **What happened:** the new Prettier was expected to change spacing only. It also dropped a type argument inside an Astro template (`CollectionEntry<'subcategories'>` became `CollectionEntry`), and it decoded an HTML entity in the label of a Markdown link definition while leaving the link that uses the label, which broke the link. The type check caught the first and markdownlint the second; a unit test caught a third effect, text that a script generates and a test compares.
- **Why it matters:** a formatter is trusted to be safe, so its diff is the one nobody reads. Both faults are still in the tool: the same input is damaged again.
- **Do instead:** after a formatter upgrade, run `pnpm verify` before reading anything, then read every change that is not in a Markdown file. Keep type annotations out of Astro templates (annotate in the component script), and write a character, not an entity, in a link label.
- **Check:** `pnpm verify` (the type check and markdownlint) caught both this time. Rule only for the two habits. If it happens again: a lint rule for annotations in templates.
- **Status:** rule
