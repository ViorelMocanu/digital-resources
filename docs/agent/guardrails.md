# Guardrails

The hooks and deny rules that stop the commands the owner keeps for themselves. Each script's opening comment is the full description; this page is the short version and the place the block messages point to.

**A guardrail, not a sandbox.** The guard reads the command text an agent sends to its shell tool. A script that runs git itself, a command built at run time, or an agent that edits a settings file gets past it. The rules in [`AGENTS.md`](../../AGENTS.md) apply in full; the hooks are a floor under them. A command the owner types in their own terminal never reaches a hook.

## The command guard

`node scripts/hooks/guard.ts claude` runs before every Bash, PowerShell and Monitor call. A command it has no rule for passes without a message.

| Rule | Blocks | Allows |
| --- | --- | --- |
| git | Every call that is not a read: add, commit, push, pull, fetch, merge, rebase, reset, restore, checkout, switch, stash, clean, rm, mv, and branch, tag, remote or config changes. A subcommand the guard does not know counts as a write | `status`, `log`, `diff`, `show`, `blame`, `grep`, `ls-files`, `rev-parse` and similar; the listing forms of `branch`, `tag`, `stash`, `remote`, `config`, `worktree`; `clean -n`; `apply --check` |
| OpenSpec | `openspec update` and `openspec init` aimed at this checkout; `openspec feedback` (its text leaves the machine) and `openspec install` (a binary outside the lockfile) wherever they run; through every launcher | Every other subcommand; `--help`; `update` or `init` aimed under `tmp/` |
| Env | A command that names `.env` or a `.env.*` file other than `.env.example` as something to read, copy or move | `.env.example`; listing and testing commands; `node --env-file`; the pattern of a search |

- The rules apply to each command of a line on its own, through wrappers such as `bash -c`, `pwsh -Command`, `cmd /c`, `env` and the package runners, and through `git -c alias.*`.
- A line the guard cannot read safely (unbalanced quotes, a command built at run time) gets a raw-text check instead: a git write word, an OpenSpec rewrite or an env file name anywhere in it blocks. Split such a line into plain commands.
- A block exits 2 with three lines: what was blocked, why, and what to do instead. Do not work around it; give the owner the exact command.
- Anything the guard cannot parse at all is allowed (it fails open), so a change in a tool's hook format never blocks unrelated work.

The git policy is set in `defaultGuardDeps` in `scripts/hooks/guard.ts` (`gitPolicy: "read-only"`). The script also carries the gate of the checkout lock (below).

## The checkout lock

`build`, `test:e2e`, `verify:fix`, `lint:fix`, `format:fix`, `harness:sync` and `openspec:port` run through `node scripts/checkout-lock.ts`, so two of them never run at once in one checkout. A second run exits 75 at once and names the holder's label, pid and start time. A run started by a locked run (`verify:fix` calling `pnpm harness:sync`) runs inside its parent's lock. In CI and on Vercel the wrapper only runs the command. The read-only scripts (`verify`, `lint`, `format`, `typecheck`, the checks) never take the lock.

While a run holds it, the guard also blocks the raw forms of the same work for other agents: pnpm commands that change `node_modules` or the lockfile, `astro build`, `playwright test`, a `serve` of the build output, `node scripts/serve-static.ts`, `sync-harness.ts` (not `--check` or `--diff`), `openspec-port.ts`, and repo-wide fixers.

- Exit 75 means busy: wait and run the command again, or ask the owner for a worktree. Never stop a process you did not start.
- `node scripts/checkout-lock.ts --probe` prints the holder, or nothing when the lock is free. Never set `RESURSE_CHECKOUT_LOCK` yourself and never copy a token from the probe.
- Known gaps: a killed wrapper leaves its command running unlocked; `pnpm lint:js --fix` and the other single fixers run unlocked; the `.astro/` folder that `typecheck` writes is not locked; on Windows an extra argument with `"` or `%` is refused with exit 2.

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

Every hook file calls the same guard with the tool's name, so each tool gets the same rules in its own output format. Verified here by feeding each tool's documented payload to the hook command through the platform shell (`scripts/hooks/hook-config.test.ts`). Run live, besides Claude Code: Antigravity IDE 2.7.0 on 2026-11-20 (the pointer arrived, `git push --dry-run` was denied, `git status` ran); Codex on 2026-11-20 (the pointer arrived, the guard blocked a probe command, and its rules forbid `git push` offline; the live `git push` probe is still to do). Grok has not run them yet.

| Tool | Files | Guard | State | The owner's one-time step |
| --- | --- | --- | --- | --- |
| Claude Code | `.claude/settings.json` | Every shell call | `state-snapshot.mjs` (above) | None |
| Codex | `.codex/hooks.json` | Shell and patch tools | Pointer at every session start, with a line after a compaction | Trust the project, then each hook in the native Codex TUI (`/hooks`); again after every edit of the file |
| Antigravity | `.agents/hooks.json` | Shell and file tools | Pointer at session start | Accept the workspace trust prompt |
| Grok | `.grok/hooks/guards.json`; it also runs the Claude hooks | Shell and file tools | None: its session-start output reaches nobody | Trust the folder |
| Copilot CLI | Reads the Claude settings | Every shell call | None | None |
| Cursor | None | None | None | Rules only |

The pointer (`scripts/hooks/state-pointer.ts`) names `AGENTS.md`, the index in `docs/state/README.md` and its top row. Codex and Antigravity deny with exit 0 and JSON; an exit code other than 0 lets the call through in both, so a guard that crashes fails open there.

## The owner's switches

| To do this                                  | Do this                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Run a blocked command                       | Type it in your own terminal: no hook runs there                                                                |
| Let an agent run a blocked OpenSpec command | Start the tool with `RESURSE_GUARD_ALLOW=openspec` in its environment; each use is logged in `tmp/agent-state/` |
| Turn every hook off                         | `"disableAllHooks": true` in `.claude/settings.local.json` (gitignored)                                         |

An agent that meets a block reports it; it does not flip a switch.

## Tests

`pnpm exec vitest run scripts` runs the guard, parser, hook input and state hook tests. They build their throwaway repositories and transcripts under `tmp/`.
