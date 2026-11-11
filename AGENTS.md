# AGENTS.md

The single source of instructions for every agent and every vendor working in this repository. Tool-specific files (such as `CLAUDE.md`) only add what their tool needs and never restate or override this file.

When two sources disagree, the higher one wins:

1. The owner's instruction in the current conversation.
2. The active OpenSpec change in `openspec/changes/`.
3. This file.
4. Everything else, including a skill's or a tool's default behaviour.

## The project in five lines

1. resurse.dev is a Romanian catalogue of free learning resources for digital skills (front end, back end, design, marketing, security).
2. It is an Astro site on Vercel, built from Markdown and data files in this repository. It has no accounts and stores nothing about visitors.
3. The repository is public, and so is everything written into it.
4. The site is being upgraded from an old stack in phases; each phase must leave the pages looking exactly as before unless its change says otherwise.
5. One owner. Agents build; the owner decides, and owns git.

## Always

1. Start by reading this file, the top row of the index in `docs/state/README.md`, and the OpenSpec change for the phase you work on.
2. Use `pnpm`. Never `npm`, `yarn`, `npx`, `pnpx` or `pnpm dlx`: they run code the lockfile does not pin.
3. Run the check for what you touched and show its output before you call anything done ([Definition of done](#definition-of-done)).
4. Label every claim in a report: verified (you checked it in this run), historical (from a document, with its date) or unverified.
5. Write a state file at each trigger in [State files and compaction](#state-files-and-compaction), before any other tool call when the hook warns.
6. Add a regression test with every bug fix, and write the test before the fix.
7. Stop after three failed attempts at the same thing and report ([Three attempts](#three-attempts)).
8. Keep scratch files in `tmp/` at the repository root (gitignored). Never in the root itself, a drive root or the system temp folder. Run commands from the repository root or with absolute paths.
9. Take dates and times from the system clock, not from memory.
10. End every piece of work with a report: what changed, the evidence, what was not verified, a commit message suggestion and the `/simplify` reminder ([Git](#git)).
11. When you offer options, put the recommended one first as A, label it "(recommended)", and show the options side by side.

## Ask first

Stop and ask the owner before any of these.

1. Adding, removing or upgrading a dependency outside the phase you were given, or changing a hook or this file.
2. Deleting or moving a file. List it in your report instead.
3. Any new network request, storage key, analytics call or third-party host on the site.
4. Anything that leaves the machine: an external service, a pull request, an issue, a public post, a deploy.
5. More than four parallel workers, a workflow the owner did not ask for, or another vendor's model.
6. Work outside the scope you were given, including a "while I am here" fix.

## Never

1. **Never run a git command that changes anything:** add, commit, push, pull, fetch, merge, rebase, reset, restore, checkout, switch, stash, clean, rm, mv, or a branch, tag or config change. Never list git as a step in a plan, and never wait on a commit.
2. **Never delete or move a file** without the owner's consent.
3. **Never read, print or copy an env file** (`.env` and its variants; `.env.example` is fine). Never write a secret, a token, or a personal detail about the owner or anyone else into any file.
4. **Never change a test to make it pass.** Never compute an expected value the way the code does. Never skip, delete or weaken a failing test.
5. **Never silence a check:** no `eslint-disable`, no `@ts-ignore` or `@ts-expect-error`, no `--no-verify`, no `HUSKY=0`.
6. **Never say "done", "fixed" or "passes" without the command output** that shows it. "Should pass" is not evidence.
7. **Never start a background native agent.** Background work goes through the T3 `delegate_task` tool. A worker never starts workers.
8. **Never copy a name or a path from another repository** into a tracked file.
9. **Never run `openspec update` or `openspec init`.** They rewrite the tool folders; they are the owner's commands ([OpenSpec](#openspec)).
10. **Never edit `pnpm-lock.yaml` or a generated file by hand.** Generated files carry a header that names their source.
11. **Never use emojis** in any file or reply.

## Where things live

| Path                      | What it holds                                                           |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/`                    | The site: pages, components, layouts, styles, content collections       |
| `public/`                 | Static files served as they are                                         |
| `data/`                   | The resource catalogue as data files                                    |
| `test/`                   | Unit tests of the site code                                             |
| `scripts/hooks/`          | The agent hooks (command guard, state hook) and their tests             |
| `scripts/sync-harness.ts` | Generates each tool's copy of the skills and workflows from `.agents/`  |
| `.agents/`                | Canonical skills and workflows. Edit here, then run `pnpm harness:sync` |
| `.claude/`                | Claude Code settings; `skills/` and `commands/` in it are generated     |
| `openspec/`               | One change per phase: proposal, requirements, tasks                     |
| `docs/state/`             | State snapshots and their index                                         |
| `docs/agent/`             | Worker brief, guardrails, harness sync, analytics access notes          |
| `docs/lessons.md`         | Mistakes already made, each with the check that now prevents it         |
| `docs/change-log.md`      | Milestones, retrospectives and `/simplify` ranges                       |
| `tmp/`                    | Scratch space. Gitignored, and excluded from every linter and test run  |

## Commands

Run the check for the file you touched while you work. Run `pnpm verify` before you report.

| Need            | Whole project             | One file                                        |
| --------------- | ------------------------- | ----------------------------------------------- |
| Format check    | `pnpm format`             | `pnpm exec prettier --check <file>`             |
| Lint            | `pnpm lint`               | `pnpm exec eslint <file>`                       |
| Types           | `pnpm typecheck`          | none: the check is project-wide                 |
| Unit tests      | `pnpm test:unit`          | `pnpm exec vitest run <test file>`              |
| Build           | `pnpm build`              |                                                 |
| Harness mirrors | `pnpm harness:sync:check` | `pnpm harness:sync` rewrites them               |
| All fast checks | `pnpm verify`             |                                                 |
| Commit message  |                           | `pnpm exec commitlint --edit <file>`            |
| OpenSpec        |                           | `pnpm exec openspec validate <change> --strict` |

-   Install with `pnpm install --frozen-lockfile --ignore-scripts`. The build must work without any package's install script.
-   The shell in Claude Code is Git Bash; PowerShell is also available. Quote every glob.
-   Add `--reporter=dot` to vitest and `--quiet` to eslint, so a failure is not lost in passing lines.

## Definition of done

Work is done when all of these hold, and the report shows them.

1. It does what the brief or the OpenSpec task says. Each task is ticked when it is verified, not in a batch at the end.
2. Every check that applies was run, and its output is in the report as a receipt: the command, the result, the commit and the tree state. Example: `pnpm verify: pass, at f7f92d8 + 12 changed files`.
3. A check that was not run is named as "not run", with the reason.
4. A change that should not alter the pages is compared against the previous build: same HTML apart from what the change names, and the same screenshots.
5. Code next to the change was scanned for regressions.
6. Anything unverified is listed under GAPS.
7. A state file exists if the work was long, and `docs/change-log.md` has the entry if a milestone was reached.

## Model routing

| Work                                                 | Tier     |
| ---------------------------------------------------- | -------- |
| Coordination, design, security, review               | Top      |
| A bounded module with its tests                      | Strong   |
| Mechanical formatting, bulk edits with an exact rule | Economic |

-   A worker stays on the parent thread's provider. Take the exact model ID from the T3 `orchestrator_capabilities` tool; never from a file and never from memory.
-   Security, dependency and review work never goes to the economic tier.
-   Move a task up a tier only after a concrete failed attempt. After two failures on one task, change the tier or the approach.
-   Another vendor is used only for the optional review seat, read-only, and only when the owner says so each time.

## Delegation

1. Call `orchestrator_capabilities` once per thread, before the first `delegate_task`.
2. Background workers start with `delegate_task`. A native agent is used only in the foreground. Each review round is a new `delegate_task`, never a message to an old worker.
3. Every worker gets a brief written from `docs/agent/worker-brief.md`.
4. One controller owns the plan, the integration, the checks and the state files. Two live workers never own the same path, and every thread works in the main checkout: a thread that will edit files names them in its first message.
5. A worker's report is not proof. The controller re-runs the checks it relies on.

## State files and compaction

T3 Code compacts a session at about 450,000 tokens. What is not in a file by then is lost.

-   **The hook warns at 350,000 tokens and again every 40,000.** When it warns, write the state file before any other tool call.
-   **Write a state file** before a manual compaction, in the first turn after an automatic one that no file covered, on a handoff request, on the hook's warning, and after major work before handing back.
-   **Follow `docs/state/README.md`:** the name, the 12 sections, the index row, the resume prompt, and the content rules for a public repository.
-   **Copy in what other agents cannot see:** plan files and memory notes outside the repository, decisions made only in chat, workers' reports.
-   **After a compaction,** open your reply with "Resuming:": the original request, the state file's path and the next step.

The hooks run only in Claude Code for now. In any other tool the same rules hold without the safety net.

## Git

The owner makes every commit and every push. Agents run read-only git: `status`, `log`, `diff`, `show`, `blame`, `grep`, `ls-files`, `rev-parse` and the listing forms of `branch`, `tag`, `stash` and `remote`. In Claude Code a hook blocks the rest ([`docs/agent/guardrails.md`](docs/agent/guardrails.md)). When it blocks, do not work around it: give the owner the exact command.

Every report ends with a commit message suggestion and a reminder to run `/simplify` before committing.

-   Conventional Commits with the default types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.
-   Header at most 100 characters, lower-case subject, no full stop.
-   No double quotes and no backticks: the owner pastes the message into PowerShell.
-   No AI attribution line of any kind.
-   Check it before you suggest it: write it to a file in `tmp/` and run `pnpm exec commitlint --edit <file>`. Only a message that passes goes to the owner.
-   The message covers everything changed since the last commit, not only your part.

## Tests

-   A failing test means the code is wrong until proven otherwise. Fix the code. If the test itself is wrong, say why in the report and change it in a separate step.
-   Expected values are written by hand from the requirement, never produced by calling the code under test.
-   Never keep a test file in `tmp/` on purpose; the test runner ignores that folder.

## Three attempts

Any loop has a budget. After three failed attempts at the same thing (a test that stays red, a command that keeps failing, a fix that does not hold), stop. Report what you tried, what each attempt showed, and what you would try next. The same budget applies to review rounds: three, then the owner decides.

## Lessons

`docs/lessons.md` records mistakes this project has already made. Read it before work in the same area. When a mistake happens a second time, a note is not enough: it becomes a test, a lint rule or a hook, and the entry names that check.

## OpenSpec

Every code change that is more than a small fix goes through an OpenSpec change in `openspec/changes/<name>/`. A fix of a few lines, a typo, a formatting change or a dependency patch needs none.

-   Run the CLI as `pnpm exec openspec <command>`. `update` and `init` are the owner's commands; the guard blocks them.
-   Before work on a phase, read its proposal and requirements. Tick a task when it is verified.
-   A change in scope is written into the proposal first, with the owner's approval.
