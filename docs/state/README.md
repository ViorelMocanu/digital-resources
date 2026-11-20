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

- Reuse one slug for every snapshot of the same task; an OpenSpec change name is a good slug.
- Several files a day are normal.
- **Worker progress files** are the one exception. A delegated worker keeps a single file, `YYYY-MM-DD-<worker-slug>.md` with no time, writes it at the start, updates it in place while it runs, and leaves it as it is once it has reported.

## Rules

- **Append-only.** Never edit or delete an older snapshot. A correction is a new file that names the old one in `supersedes:`. Fixing a broken link is the only permitted edit.
- **Self-contained.** A snapshot never says "see the previous file" for something the next agent needs. Copy in what lives outside the repository or only in the chat: plan files, memory notes, decisions, workers' reports, research results. Link to files in the repository instead of copying them.
- **All twelve sections, in order.** A section with nothing to say holds "None", so the reader knows nothing was left out.
- **Decisions carry their origin:** the date, who decided (the owner, or an agent with the owner's approval), the options, and why.
- **Every fact is labelled** verified (and how), historical (date and source) or unverified.
- **Check receipts name what they ran against:** the command, the result, the commit and the tree state. Example: `pnpm verify: pass, at f7f92d8 + 12 changed files`.
- **This repository is public.** No secrets, tokens or `.env` values. No personal details about the owner or anyone else, even if they came up in the chat. No access links, local network addresses or pairing codes. No names or paths from other repositories. When in doubt, leave it out and say that something was left out.
- **Update the index** below in the same turn, newest first.
- Format with `pnpm exec prettier --write <file>`.

## Reading state at the start of a session

Open the top row of the index, or the newest row with your task's slug. Read the frontmatter and section 1 first; read the rest only when the task needs it.

## The resume prompt

Section 1 ends with a fenced `text` block that can be pasted as the first message of a new session or thread, for any vendor. It must work with no other context, so it names:

- the snapshot to read (and any file that must be read with it),
- the role the new agent takes and the exact next action,
- the limits that must survive the handoff (no git writes, the scope, what waits for the owner).

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

`scripts/hooks/state-snapshot.mjs` (Claude Code only; Codex and Antigravity get only a pointer to the index, from `scripts/hooks/state-pointer.ts`) warns when the context is within 90,000 tokens of the compaction point, saves a private word-for-word capture to `tmp/compact-summaries/` before every compaction, and after a compaction says which snapshot covers the session or asks for one. It never blocks anything and never writes into this folder: a snapshot is always written by an agent, which applies the rules above. The script's opening comment is the full description.

## Index (newest first)

| File | Trigger | What it holds |
| --- | --- | --- |
| [2026-11-19-2017-phase-5b-owner-answers.md](2026-11-19-2017-phase-5b-owner-answers.md) | pause-point | The owner's all A built: fflate under satori overridden to 0.7.5 (audit clean, build unchanged, 110 browser tests), the engine warning left; walkthroughs a to h and decisions N1 to N4, D6 remain |
| [2026-11-19-1930-phase-5b-owner-answers.md](2026-11-19-1930-phase-5b-owner-answers.md) | pause-point | The engine warning is local and cosmetic; CI fails at the audit (fflate under satori); an override tried in a copy clears it with a byte-identical site; the before-push page waits for the owner |
| [2026-11-19-1910-phase-5b-owner-answers.md](2026-11-19-1910-phase-5b-owner-answers.md) | manual-compact | The sixth simplify run committed as `e52747e`, the Node pin pushed; the owner asks whether the local Unsupported engine warning needs a fix before the next push |
| [2026-11-16-1935-phase-5b-owner-answers.md](2026-11-16-1935-phase-5b-owner-answers.md) | pause-point | Node pinned to `^24.16.0` (owner's A, committed `f1871bf`); the sixth simplify run (base `515b802`) running as a workflow; next re-run its checks and record its row |
| [2026-11-16-1901-phase-5b-owner-answers.md](2026-11-16-1901-phase-5b-owner-answers.md) | manual-compact | The decision page redesigned for a plain browser and checked; the owner working through the walkthroughs one by one, on walkthrough a (the Vercel variable) |
| [2026-11-15-1900-phase-5b-owner-answers.md](2026-11-15-1900-phase-5b-owner-answers.md) | pause-point | The owner's answers built and checked, the OpenSpec change valid, the decision page shown; blocked on the owner's walkthroughs, decisions and commit (time estimated) |
| [2026-11-15-1845-phase-5b-owner-answers.md](2026-11-15-1845-phase-5b-owner-answers.md) | pause-point | The answers built and checked (verify, build with 56 share cards, 110 browser tests, comparison with the build at 6545861); the decision page being written; the OpenSpec change and the change log remain (newer than the 1855 file, whose name is wrong) |
| [2026-11-15-1855-phase-5b-owner-answers.md](2026-11-15-1855-phase-5b-owner-answers.md) | pause-point | The owner's answers to the Phase 5 page half built: /login, archive, lint warnings fail, Bucharest dates, screenshot references per kind, Phase 5 findings, share-card renderer; the layout tag and the build step for the cards still to do (written at 18:30; the name's time is wrong) |
| [2026-11-14-2053-phase-5-due-fixes.md](2026-11-14-2053-phase-5-due-fixes.md) | pause-point | Phase 5 built and checked (verify, build, 105 browser tests, tag-by-tag comparison); the formatter's whitespace fixed by one setting; blocked on the owner's decisions and commit |
| [2026-11-14-2034-phase-5-due-fixes.md](2026-11-14-2034-phase-5-due-fixes.md) | pause-point | Newest (the 2035 file below was misnamed, written at 20:30). Phase 5 up to 5.6 done; 5.7 applied but the reformat adds whitespace to every page; next a screenshot comparison of the two builds, then documents, final checks, the decision page |
| [2026-11-14-2035-phase-5-due-fixes.md](2026-11-14-2035-phase-5-due-fixes.md) | pause-point | Phase 5 task 5.3 done (accessibility by rule and element, 21 passed); next 5.5, 5.7, documents, final checks, the decision page |
| [2026-11-14-2027-phase-5-due-fixes.md](2026-11-14-2027-phase-5-due-fixes.md) | pause-point | Phase 5 groups 1 to 4 done, group 5 half done; task 5.3 in progress (accessibility lists by element, received lists in a scratch file); next 5.3, 5.5, 5.7, documents, final checks, the decision page |
| [2026-11-14-2019-phase-5-due-fixes.md](2026-11-14-2019-phase-5-due-fixes.md) | pause-point | Harness part two done apart from the owner's trust step; Phase 5 change written, groups 1 to 3 built and tested, group 4 half built; next the build check of group 4, then 4.5, 4.6, group 5 and the decision page |
| [2026-11-14-1947-harness-h1b.md](2026-11-14-1947-harness-h1b.md) | pause-point | The owner's new way of working: unassisted until blocked, then one HTML decision page; harness part two committed as `74f143e`; its lint warnings fixed; next the rest of part two and Phase 5 |
| [2026-11-14-1916-harness-h1b.md](2026-11-14-1916-harness-h1b.md) | pause-point | Harness part two mostly built, `pnpm verify` green: three tasks and the build, browser and Linux checks left; then Phase 5 from its read-only map |
| [2026-11-14-1911-harness-h1b.md](2026-11-14-1911-harness-h1b.md) | pause-point | The spreadsheet stays (owner's B); harness part two half built and checked file by file: guard blocks two more OpenSpec commands, a CI-only lock test fault fixed, scripts wrapped by the lock, Codex hooks, a state pointer |
| [2026-11-14-1721-content-decisions.md](2026-11-14-1721-content-decisions.md) | pause-point | The owner's answers to the five content decisions (images are downloaded); the roadmap part by part; six commits wait for the push; the spreadsheet is in an unpushed commit |
| [2026-11-14-1650-phase-4-pipeline.md](2026-11-14-1650-phase-4-pipeline.md) | pause-point | Phase 4 committed as `f934586`, not pushed; the fifth simplify run about to start, with its base and scope |
| [2026-11-14-1616-phase-4-pipeline.md](2026-11-14-1616-phase-4-pipeline.md) | pause-point | The pipeline, Dependabot and the screenshot test written; the review round done and its fixes checked, uncommitted; the push is fine on two conditions; the Phase 5 list and the content phase |
| [2026-11-14-1536-phase-4-rest.md](2026-11-14-1536-phase-4-rest.md) | manual-compact | The owner's answers to twenty pending decisions, nothing of them built yet; the order of the work; a content phase to append to the roadmap |
| [2026-11-13-1728-phase-4-e2e-followups.md](2026-11-13-1728-phase-4-e2e-followups.md) | pause-point | The approved findings of the fourth simplify run built and checked, uncommitted: a faster suite, collections fetched once, overrides that expire; the rest of Phase 4 next |
| [2026-11-13-0418-phase-4-e2e-suite.md](2026-11-13-0418-phase-4-e2e-suite.md) | pause-point | The night's work finished and checked, uncommitted: Phases 2 and 3 and the end-to-end suite; receipts, seventeen open decisions, stopped for the owner |
| [2026-11-13-0314-phase-3-tooling.md](2026-11-13-0314-phase-3-tooling.md) | pause-point | Phases 2 and 3 finished and checked, uncommitted; the audit is empty and the pages are unchanged; thirteen open decisions. Written after the row below: the three earlier names of this night ran ahead of the clock |
| [2026-11-13-0345-phase-2-core-upgrade.md](2026-11-13-0345-phase-2-core-upgrade.md) | pause-point | Phase 2 finished and checked on Astro 7, uncommitted; receipts, the agent's decisions, nine open decisions, Phase 3 next |
| [2026-11-13-0320-phase-2-core-upgrade.md](2026-11-13-0320-phase-2-core-upgrade.md) | pause-point | Phase 2 built; the navigation regression understood, its fix being reworked as a pnpm patch of the head sorter; exact next steps |
| [2026-11-13-0255-phase-2-core-upgrade.md](2026-11-13-0255-phase-2-core-upgrade.md) | pause-point | Phase 2 mostly built on Astro 7 and checked; one regression open (the client router script is missing); decisions the agent made alone |
| [2026-11-12-2227-phase-1-prune-static.md](2026-11-12-2227-phase-1-prune-static.md) | pause-point | Harness part one and Phase 1 finished and checked, uncommitted; receipts, three small open decisions, Phase 2 next |
| [2026-11-12-1933-harness-h1a.md](2026-11-12-1933-harness-h1a.md) | manual-compact | Static output live, two simplify runs done; OpenSpec content and the rest of Phase 1 open; the list of open decisions |
| [2026-11-11-1527-harness-h1a.md](2026-11-11-1527-harness-h1a.md) | pause-point | Harness part one checked and handed back: hooks, contract, documents, sync engine, OpenSpec CLI; OpenSpec content and changes open |
| [2026-11-11-1521-harness-h1a.md](2026-11-11-1521-harness-h1a.md) | pause-point | Harness part H1a half built: guard, state hook and settings done; documents, OpenSpec and final checks open |
