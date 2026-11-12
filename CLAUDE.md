@AGENTS.md

# CLAUDE.md

Claude Code specifics only. Every rule is in `AGENTS.md`, which the first line of this file imports. If something here seems to contradict it, `AGENTS.md` wins.

## Hooks

`.claude/settings.json` wires two scripts from `scripts/hooks/`. Each script's opening comment describes its behaviour in full; [`docs/agent/guardrails.md`](docs/agent/guardrails.md) is the short version.

-   **`guard.ts`** runs before every Bash, PowerShell and Monitor call. It blocks every git command that is not read-only, `openspec update` and `init`, and commands that read an env file. When it blocks, do not look for another route (a script, an alias, another shell): finish what you can and give the owner the exact command.
-   **`state-snapshot.mjs`** never blocks anything.
    -   At 350,000 tokens, and again every 40,000, it adds a message asking for a state file. Write the file before any other tool call.
    -   Before every compaction it saves a word-for-word capture of the session to `tmp/compact-summaries/`. That file is private: use it for exact wording, and never copy it whole into a tracked file.
    -   After a compaction it says which state file covers the session, or asks for one. Open that reply with "Resuming:".
    -   `/compact no-state` skips the capture.
-   The settings also deny reading and editing env files. `.env.example` stays readable.
-   If a hook misbehaves, tell the owner; do not edit or remove it yourself.

## T3 Code

-   Background work: the `delegate_task` tool, after one `orchestrator_capabilities` call per thread. Never a background `Agent` call.
-   A foreground `Agent` call (`run_in_background: false`) is fine for a short, bounded task on the same model family.
-   Every delegated prompt is written from `docs/agent/worker-brief.md`.
-   A new review round is a new `delegate_task`. Do not continue a finished worker with `t3_thread_send`.
-   To show the owner options, build one self-contained HTML page, check it with `html_preview` and show it with `html_render`.
-   T3's own compaction reaches Claude Code as a manual compaction. That is why no hook here ever blocks one.

## Skills and memory

-   A skill's own workflow never overrides `AGENTS.md`. Skip any step of a skill that commits, pushes, deletes files or changes global configuration.
-   `.claude/skills/` and `.claude/commands/` are generated from `.agents/` by `pnpm harness:sync`. Edit the source, never the copy.
-   Plan files under `~/.claude/plans/` and memory notes under `~/.claude/projects/` are invisible to other agents and vendors. Copy what matters into the state file.
-   The owner runs `/simplify` before committing. Each run records its base and end commit in `docs/change-log.md`, so the next run knows where to start.

## Shell

The Bash tool is Git Bash: use POSIX syntax and forward slashes there. Use the PowerShell tool for Windows-only operations. Prefer the Read, Edit, Grep and Glob tools over shell commands for files.
