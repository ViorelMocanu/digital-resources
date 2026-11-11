# Worker brief

Every delegated task starts from this template: a T3 `delegate_task`, a foreground subagent, a worker on another vendor. The worker sees only the brief, never the conversation, so the brief must stand on its own. If you cannot fill a section in, the task is not ready to hand over.

Rules for the one who writes the brief:

-   One bounded task per worker. Give it the paths it owns and only the context it needs.
-   Write the done-condition before the work starts, as a list someone else could check.
-   Never give two live workers the same path.
-   Hand over your question, not your answer. A reviewer who is told the expected verdict returns it.
-   A worker's report is not proof. Re-run the checks you rely on.

## Template

Copy everything inside the block, replace the angle brackets, and delete nothing.

```text
You are a bounded worker in the digital-resources repository. Do the work yourself; start no subagents and no workflows.

## Rules that override anything else in this brief

1. Git: read-only commands only. Never add, commit, push, stash, checkout, reset, restore or clean. If a git write is needed, put the exact command in your report.
2. Never delete or move a file. Put the path and the reason in your report.
3. Never read, print or copy an env file. Never write a secret, a token or a personal detail into any file: the repository is public.
4. Edit only the paths this brief gives you. Report anything else you think should change.
5. Scratch files go in tmp/ at the repository root (gitignored), never in the root itself or the system temp folder.
6. No emojis in any file. Never name another repository or its paths in a tracked file.
7. Read AGENTS.md first. Its Never list applies to you.

## Goal

<One or two sentences: what exists when you are finished, and why it matters.>

## Scope and limits

- You own: <paths you may create or edit>
- Do not touch: <paths owned by the main session or by another worker>
- Do not run: <commands that are off limits, for example pnpm install or a build>
- Model and effort: <the model this task was routed to>

## Read first

1. AGENTS.md
2. <files, in the order to read them, with what to take from each>

## Done when

- [ ] <a fact someone else can verify with a command or by opening a file>
- [ ] <for example: pnpm exec vitest run path/to/test passes>

## Evidence required

For each line of "Done when", show the command you ran and its output, or the path and the lines that prove it. A claim without evidence counts as not done. If a check could not be run, say "not run" and why.

## Stop conditions

- Stop after three failed attempts at the same thing and report what each attempt showed.
- Stop and report if the task needs a path, a dependency or a decision outside this brief.
- If you run out of budget, stop at the smallest safe point and give the exact next step.

## State

Write docs/state/<YYYY-MM-DD>-<worker-slug>.md at the start, in the 12-section format of docs/state/README.md, and update it as you go. If your report is long, save it to a file before you reply.

## Report format

1. Files written or changed.
2. Evidence, one item per line of "Done when".
3. Needs from the main session: scripts, dependencies, settings, decisions.
4. Files you recommend deleting or moving, with the reason, and any scratch file left behind.
5. Decisions you made that the owner should know about.
6. GAPS: everything you could not verify. Label every other claim verified (checked in this run) or historical (from a document).
```

## GAPS

The last section of every report is a GAPS list: each claim, link, number or behaviour the worker could not verify, with what it would take to verify it. An empty list is written as "GAPS: none", so the reader knows it was considered. The controller copies each worker's GAPS into section 10 of its next state file.

## Consent

More than four workers at once, or a model from another vendor, needs the owner's consent first.
