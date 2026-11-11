# Guardrails

The hooks and deny rules that stop the commands the owner keeps for themselves. Each script's opening comment is the full description; this page is the short version and the place the block messages point to.

**A guardrail, not a sandbox.** The guard reads the command text an agent sends to its shell tool. A script that runs git itself, a command built at run time, or an agent that edits a settings file gets past it. The rules in [`AGENTS.md`](../../AGENTS.md) apply in full; the hooks are a floor under them. A command the owner types in their own terminal never reaches a hook.

## The command guard

`node scripts/hooks/guard.ts claude` runs before a Bash or PowerShell call whose text names `git`, `openspec`, `.env`, `pnpm`, `npx`, `pwsh`, `powershell` or `bash`, and before every Monitor call.

| Rule | Blocks | Allows |
| --- | --- | --- |
| git | Every call that is not a read: add, commit, push, pull, fetch, merge, rebase, reset, restore, checkout, switch, stash, clean, rm, mv, and branch, tag, remote or config changes. A subcommand the guard does not know counts as a write | `status`, `log`, `diff`, `show`, `blame`, `grep`, `ls-files`, `rev-parse` and similar; the listing forms of `branch`, `tag`, `stash`, `remote`, `config`, `worktree`; `clean -n`; `apply --check` |
| OpenSpec | `openspec update` and `openspec init` aimed at this checkout, through every launcher | Every other subcommand; a target under `tmp/` |
| Env | A command that names `.env` or a `.env.*` file other than `.env.example` as something to read, copy or move | `.env.example`; listing and testing commands; `node --env-file`; the pattern of a search |

-   The rules apply to each command of a line on its own, through wrappers such as `bash -c`, `pwsh -Command`, `cmd /c`, `env` and the package runners, and through `git -c alias.*`.
-   A line the guard cannot read safely (unbalanced quotes, a command built at run time) gets a raw-text check instead: a git write word, an OpenSpec rewrite or an env file name anywhere in it blocks. Split such a line into plain commands.
-   A block exits 2 with three lines: what was blocked, why, and what to do instead. Do not work around it; give the owner the exact command.
-   Anything the guard cannot parse at all is allowed (it fails open), so a change in a tool's hook format never blocks unrelated work.

The git policy is set in `defaultGuardDeps` in `scripts/hooks/guard.ts` (`gitPolicy: "read-only"`). The script also carries a gate for a checkout lock (`scripts/checkout-lock.ts`); no package script uses that lock yet, so the gate never fires.

Comments in the hook scripts cite design and task numbers such as "design D3". They are the numbering of the design the scripts were first written under and have no further record in this repository; the comment text around each one says what it means.

## Env files

`.claude/settings.json` denies the Read and Edit tools on `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production` and `.env.test`. Each file is named, so `.env.example` stays readable.

## The state hook

`node scripts/hooks/state-snapshot.mjs <mode>` backs up the triggers in [`docs/state/README.md`](../state/README.md). It never blocks a tool call, a prompt or a compaction, and it writes only under `tmp/compact-summaries/`.

| Mode            | Runs on                                 | What it does                                                                                         |
| --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pressure`      | After every tool call and prompt        | At 350,000 tokens, and every 40,000 after that while no snapshot is current, asks for a state file   |
| `pre-compact`   | Before a manual or automatic compaction | Saves a word-for-word capture, with secrets removed by pattern; records the size of an automatic one |
| `post-compact`  | After a compaction                      | Keeps a copy of the compaction summary                                                               |
| `session-start` | The first turn after a compaction       | Names the snapshot that covers the session, or asks for one                                          |

## Which tools have hooks

Claude Code only, for now. Hooks for the other tools that can run here are part of the second harness part, after the tooling upgrade. Until then every other tool works on the written rules alone.

## The owner's switches

| To do this                           | Do this                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Run a blocked command                | Type it in your own terminal: no hook runs there                                                                |
| Let an agent run an OpenSpec rewrite | Start the tool with `RESURSE_GUARD_ALLOW=openspec` in its environment; each use is logged in `tmp/agent-state/` |
| Turn every hook off                  | `"disableAllHooks": true` in `.claude/settings.local.json` (gitignored)                                         |

An agent that meets a block reports it; it does not flip a switch.

## Tests

`pnpm exec vitest run scripts` runs the guard, parser, hook input and state hook tests. They build their throwaway repositories and transcripts under `tmp/`.
