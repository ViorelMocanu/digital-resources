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
3. Run `pnpm exec openspec update` in your own terminal.
4. Review the diff. Port anything worth keeping from the stock skills into `.agents/` by hand.
5. Run `pnpm harness:sync`, then `pnpm harness:sync:check`. An orphan line is a file OpenSpec added that `.agents/` does not have: adopt it into `.agents/` or prune it.
