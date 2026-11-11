# State snapshots

A state snapshot is a file that lets any agent, model, session or vendor continue a task without the conversation that produced it. T3 Code compacts a session somewhere above 400,000 tokens, sessions end, and workers finish: what is not written here by then is gone.

This folder is the trail of how the project got where it is. Files in it are added, never rewritten.

## When to write one

Write a new snapshot, in this folder, every time one of these happens:

1. **Manual compaction.** Before it. Not needed if nothing happened since this session's newest snapshot.
2. **Automatic compaction.** In the first turn after it, if no snapshot covered the session. Use `trigger: auto-compact` and say in section 10 that detail may have been lost.
3. **Handoff.** The owner asks for a handoff, a handover or a resume note.
4. **Context-pressure warning.** The hook warns 90,000 tokens before the compaction point (at 350,000 until it has measured a compaction here) and again every 40,000. Write the snapshot before any other tool call, with `trigger: pause-point`, then carry on.
5. **Major work finished.** Before handing back a turn that changed many files or used workers.
6. **A usage limit is close.** Finish the smallest safe step, start nothing new, and write a `pause-point` snapshot that marks each changed path "implemented, unverified" or "verified" and gives the exact next command.

A snapshot at each natural pause of a long session is recommended. Frequent snapshots are the only real protection against what a compaction drops.

## Names

`docs/state/YYYY-MM-DD-HHMM-<task-slug>.md`, in the owner's local time, taken from the system clock.

-   Reuse one slug for every snapshot of the same task; an OpenSpec change name is a good slug.
-   Several files a day are normal.
-   **Worker progress files** are the one exception. A delegated worker keeps a single file, `YYYY-MM-DD-<worker-slug>.md` with no time, writes it at the start, updates it in place while it runs, and leaves it as it is once it has reported.

## Rules

-   **Append-only.** Never edit or delete an older snapshot. A correction is a new file that names the old one in `supersedes:`. Fixing a broken link is the only permitted edit.
-   **Self-contained.** A snapshot never says "see the previous file" for something the next agent needs. Copy in what lives outside the repository or only in the chat: plan files, memory notes, decisions, workers' reports, research results. Link to files in the repository instead of copying them.
-   **All twelve sections, in order.** A section with nothing to say holds "None", so the reader knows nothing was left out.
-   **Decisions carry their origin:** the date, who decided (the owner, or an agent with the owner's approval), the options, and why.
-   **Every fact is labelled** verified (and how), historical (date and source) or unverified.
-   **Check receipts name what they ran against:** the command, the result, the commit and the tree state. Example: `pnpm verify: pass, at f7f92d8 + 12 changed files`.
-   **This repository is public.** No secrets, tokens or `.env` values. No personal details about the owner or anyone else, even if they came up in the chat. No access links, local network addresses or pairing codes. No names or paths from other repositories. When in doubt, leave it out and say that something was left out.
-   **Update the index** below in the same turn, newest first.
-   Format with `pnpm exec prettier --write <file>`.

## Reading state at the start of a session

Open the top row of the index, or the newest row with your task's slug. Read the frontmatter and section 1 first; read the rest only when the task needs it.

## The resume prompt

Section 1 ends with a fenced `text` block that can be pasted as the first message of a new session or thread, for any vendor. It must work with no other context, so it names:

-   the snapshot to read (and any file that must be read with it),
-   the role the new agent takes and the exact next action,
-   the limits that must survive the handoff (no git writes, the scope, what waits for the owner).

## Template

```markdown
---
state_id: YYYY-MM-DD-HHMM-<task-slug>
created: YYYY-MM-DDTHH:MM+TZ
trigger: manual-compact | auto-compact | handoff | pause-point
task: <one line>
agent: <tool, model, harness>
branch: <branch>
head: <short sha>
working_tree: <clean, or the changed files>
supersedes: <previous state_id for this task, or none>
---

# State: <task> (<date and time>)

## 1. Resume here

Status, the exact next action, and the resume prompt in a fenced `text` block.

## 2. Original request

The owner's request, close to word for word, with its constraints.

## 3. Decisions made

Dated, with who decided, the options and the reason.

## 4. Open decisions

What the owner still has to decide, each with the agent's recommendation as option A.

## 5. Plan

The current plan, copied in full if it lives outside the repository.

## 6. Facts established

Repository, environment and external facts, each labelled verified, historical or unverified.

## 7. Subagent and external research results

What each worker, other agent or research session produced: the path, a summary, and how far it was verified.

## 8. Owner context and preferences

Preferences and constraints stated in the conversation that change how the work should be done. Nothing personal.

## 9. Pending owner actions

What only the owner can do: commits, approvals, deletions, accounts.

## 10. Caveats and unverified claims

What could be wrong, what was not checked, and what was left out on purpose.

## 11. Suggested skills for the next session

## 12. Files written or changed in this session
```

## What the hook does

`scripts/hooks/state-snapshot.mjs` (Claude Code only) warns when the context is within 90,000 tokens of the compaction point, saves a private word-for-word capture to `tmp/compact-summaries/` before every compaction, and after a compaction says which snapshot covers the session or asks for one. It never blocks anything and never writes into this folder: a snapshot is always written by an agent, which applies the rules above. The script's opening comment is the full description.

## Index (newest first)

| File | Trigger | What it holds |
| --- | --- | --- |
| [2026-11-11-1527-harness-h1a.md](2026-11-11-1527-harness-h1a.md) | pause-point | Harness part one checked and handed back: hooks, contract, documents, sync engine, OpenSpec CLI; OpenSpec content and changes open |
| [2026-11-11-1521-harness-h1a.md](2026-11-11-1521-harness-h1a.md) | pause-point | Harness part H1a half built: guard, state hook and settings done; documents, OpenSpec and final checks open |
