# Tasks

Tasks 1 to 3 were done and checked before this file existed; their receipts are in `docs/state/` and `docs/change-log.md`.

## 1. Contract and documents

-   [x] 1.1 Write `AGENTS.md` and `CLAUDE.md`
-   [x] 1.2 Write `docs/state/README.md`, the worker brief, the guardrail and sync notes, `docs/lessons.md` and `docs/change-log.md`

## 2. Hooks

-   [x] 2.1 Add the command guard with its tests; check: `pnpm exec vitest run scripts/hooks`
-   [x] 2.2 Add the state hook with its tests
-   [x] 2.3 Wire both in `.claude/settings.json` and deny env files; check: a git write sent through the shell tool is blocked

## 3. Sync engine

-   [x] 3.1 Add `scripts/sync-harness.ts`, its config and tests; check: `pnpm harness:sync:check`
-   [x] 3.2 Add the sync check to `pnpm verify`

## 4. OpenSpec

-   [x] 4.1 Add the CLI at 1.16.1 as a development dependency
-   [x] 4.2 Port the twelve stock skills into `.agents/skills/` with the project rules on top, and write twelve workflows that hand over to them
-   [x] 4.3 List them in `scripts/sync-harness.config.json` and generate the Claude Code copies; check: `pnpm harness:sync:check`
-   [x] 4.4 Write `openspec/config.yaml`; check: `pnpm exec openspec list --json` reports a root
-   [x] 4.5 Create this change and `phase-1-prune-static`; check: `pnpm exec openspec validate <change> --strict` for both

## 5. Small fixes

-   [x] 5.1 Raise `engines.node` to `>=22.18`
-   [x] 5.2 Add a unit test that fails when `public/site.webmanifest` and `src/config.ts` disagree on the name, the description or the colour
-   [x] 5.3 Format `docs/agent/posthog.md`; check: `pnpm format`

## 6. Final checks

-   [x] 6.1 `pnpm verify` passes
-   [x] 6.2 `pnpm build` passes and the pages are unchanged by this change
