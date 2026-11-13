# Harness sync

Skills and workflows are written once, in `.agents/`, and copied into each tool's own folder by `scripts/sync-harness.ts`. The copies carry a header that names their source and are never edited by hand.

## Folders

| Folder                                      | Kind                     | Who edits it      |
| ------------------------------------------- | ------------------------ | ----------------- |
| `.agents/skills/<name>/`                    | Canonical skills         | People and agents |
| `.agents/workflows/*.md`                    | Canonical workflows      | People and agents |
| `.claude/skills/`, `.claude/commands/opsx/` | Generated copies         | The sync          |
| `.claude/settings.json`                     | Hand-made, not generated | People and agents |

Only the Claude Code target is configured today (`scripts/sync-harness.config.json`). The targets for the other tools arrive with the second harness part.

## Commands

| Command                   | What it does                                                           |
| ------------------------- | ---------------------------------------------------------------------- |
| `pnpm harness:sync`       | Rewrites every generated copy from `.agents/`                          |
| `pnpm harness:sync:check` | Fails when a copy is missing, stale or orphaned. Part of `pnpm verify` |
| `pnpm harness:sync:diff`  | Shows what a sync would change                                         |

An orphan is a generated file whose source is gone. The check reports it; `pnpm harness:sync --prune` removes it, and only when asked.

## The OpenSpec skills

-   The twelve `openspec-*` skills hold the stock text of the installed OpenSpec version (the `generatedBy` line in each says which), with a block of project rules on top. The block wins over the stock text.
-   Each `opsx-*` workflow is one sentence that hands over to its skill, so the instructions exist once.
-   The stock key `allowed-tools` is left out on purpose: OpenSpec commands go through the normal permission prompt and the guard.
-   The generated copies are excluded from the format check (`.prettierignore`); the sources in `.agents/` are formatted.

## A commit that changes a skill

It includes the source in `.agents/` and every generated copy. `pnpm harness:sync:check` passing is the proof.

## Upgrading OpenSpec

`openspec update` and `openspec init` rewrite the tool folders with stock text, so they are the owner's commands, and the guard blocks them for agents ([`guardrails.md`](guardrails.md)).

1. Start from a clean tree.
2. Raise the version of `@fission-ai/openspec` in `package.json`, once the release is at least seven days old, and install.
3. Run `pnpm openspec:port`. It rewrites the `openspec-*` skills and `opsx-*` workflows in `.agents/` from the installed package, with the project rules on top (`scripts/openspec-port.ts`). It does not run `openspec update`, so no tool folder is touched.
4. Run `pnpm exec prettier --write ".agents/**/*.md"`, then review the diff: it is exactly what the new version changed in the stock text.
5. If the package added a skill or a workflow, add its name to `include` in `scripts/sync-harness.config.json`.
6. Run `pnpm harness:sync`, then `pnpm verify`. An orphan line is a generated file whose source is gone: prune it when you have checked that.

Telemetry: `.claude/settings.json` sets `OPENSPEC_TELEMETRY=0` for Claude Code sessions. In your own terminal, `pnpm exec openspec config set telemetry.enabled false` switches it off for your user account.
