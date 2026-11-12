# Change log

The project's milestones, newest first. It answers "what happened, and what did we learn"; `docs/state/` holds the detail and `docs/lessons.md` holds the mistakes.

## Rules

1. **Each major milestone gets an entry with a short retrospective:** what was delivered, what went well, what to do differently, what comes next. A milestone is a finished phase, a review round, a launch, or a decision that changes the plan.
2. **Each `/simplify` run records its range** in the table below: the base commit, the end commit, the date, and what it covered. A run covers everything changed since the previous run's end, committed or not. If the table is empty, the agent asks the owner for the base before it starts.
3. Entries are added, never rewritten. A correction is a new entry that names the old one.
4. An entry states facts with their evidence: a commit, a file, a command and its result. No secrets and no personal details: the repository is public.

## Simplify runs

| Date | Base commit | End commit | Covered |
| --- | --- | --- | --- |
| 2026-11-11 | `cce652e` | `07e2491` plus the uncommitted fixes of this run | The build fix (`f7f92d8`) and the first harness part (`07e2491`). The next run starts at the commit that holds these fixes. |
| 2026-11-12 | `b6bb524` (holds the fixes of the run above) | `9637f04` plus the uncommitted fix of this run | The static output switch and the disabled deep scan (`9637f04`). The next run starts at the commit that holds this fix. |

## Milestones

### 2026-11-11: plan approved, build fixed, first harness part started

**Delivered**

-   A scan of the repository and its 226 dependency alerts, and a phased upgrade plan with the owner's decisions on it.
-   The build works again after an install with scripts off (commit `f7f92d8`): the manifest plugin was replaced by a static manifest, and the lint scripts call the local stylelint.
-   The first harness part, in progress: the command guard with a read-only git policy, the state hook, the Claude Code settings, the agent contract and these documents. State: `docs/state/2026-11-11-1521-harness-h1a.md`.

**What went well**

-   A baseline of every built page and 116 screenshots was recorded before the first change, so "nothing changed" is a comparison, not an opinion.
-   The hook scripts came with their tests; running those on this repository's older test runner settled in minutes whether they could be adopted now.

**What to do differently**

-   Write the first state file at the start of long work, not when the hook asks (`docs/lessons.md`, L-006).
-   Write scripts with the file tool, never through a here-document (L-007).

**Next**

Finish the first harness part (the OpenSpec skills and workflows, and one change per phase), then Phase 1: remove unused dependencies and switch to static output.
