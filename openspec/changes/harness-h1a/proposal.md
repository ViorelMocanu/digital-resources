# Harness, part one

This change records work that was built on 2026-11-11 and 2026-11-12, before the `openspec/` folder existed. It is written after the fact so that the trail is complete.

## Why

The repository had no agent instructions, no guard against git writes, and nothing that survives a session compaction. The upgrade of the site runs over many sessions and touches every page, so the rules, the checks and the state trail had to exist before the first phase.

## What Changes

-   One agent contract, `AGENTS.md`, with a thin `CLAUDE.md` for Claude Code.
-   A command guard (`scripts/hooks/guard.ts`) that blocks every git command that is not read-only, `openspec init` and `openspec update`, and commands that read an env file. Its tests run with the unit tests.
-   A state hook (`scripts/hooks/state-snapshot.mjs`) that warns before a compaction and never blocks one.
-   Claude Code settings that wire both hooks and deny reading and editing env files.
-   State snapshots in `docs/state/`, a worker brief, guardrail and sync notes in `docs/agent/`, `docs/lessons.md` and `docs/change-log.md`.
-   A sync engine (`scripts/sync-harness.ts`) that generates each tool's copy of the skills and workflows from `.agents/`. Only the Claude Code target is configured.
-   OpenSpec: the CLI as a development dependency (`@fission-ai/openspec` 1.16.1), twelve skills and twelve workflows in `.agents/`, `openspec/config.yaml`, and this change.
-   Two small fixes that the first `/simplify` run left open: the Node floor in `package.json` rises to the version the hook scripts need, and a unit test ties the web manifest to the site config.

Visitors see no change: no page, style or script of the site is touched.

## Capabilities

### New Capabilities

None. The change alters no behaviour of the site, so `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

-   New development dependency: `@fission-ai/openspec` 1.16.1. No runtime dependency changes.
-   `pnpm verify` now also checks that the generated copies are fresh.
-   `engines.node` rises from `>18.19` to `>=22.18`.
-   Out of scope, for the second harness part: hooks and generated files for the other agent tools, the checkout lock around package scripts, the stricter policy for the inherited guard tests, and the missing verbs in the guard's fallback list.
-   Waits for the owner: every commit.
