# Tasks

## 1. Baseline

- [x] 1.1 Record `pnpm verify` at `b6d13cd`: one spawn test timed out under load (5.6 s against 5 s), 891 passed

## 2. Guard

- [x] 2.1 Tests first, then block `openspec feedback` and `openspec install` wherever they run, with the owner's override; check: `pnpm exec vitest run scripts/hooks/guard.test.ts`
- [x] 2.2 Regression test first, then read `--language` as a value-taking option of `openspec init`
- [x] 2.3 Tests first, then gate this repository's own commands (build output, `serve-static.ts`, `openspec-port.ts`) and drop the template's names from the test fixtures
- [x] 2.4 Regression test first (104 bytes), then shorten the real-holder scratch prefix so the socket fits 103 bytes on the GitHub runner

## 3. Checkout lock

- [x] 3.1 Wrap `build`, `test:e2e`, `verify:fix`, `lint:fix`, `format:fix`, `harness:sync` and `openspec:port`; treat `VERCEL` as CI; point the busy message at `docs/agent/guardrails.md`
- [x] 3.2 Port the lock's test file; check: `pnpm exec vitest run scripts/checkout-lock.test.ts`
- [x] 3.3 Run one wrapped script through pnpm on Windows; check: `pnpm harness:sync` exits 0 and changes nothing

## 4. Other tools

- [x] 4.1 Add `scripts/hooks/state-pointer.ts` with its tests
- [x] 4.2 Add `.codex/hooks.json`, `.agents/hooks.json` and `.grok/hooks/guards.json`; check: `pnpm exec vitest run scripts/hooks/hook-config.test.ts`
- [x] 4.3 Add `.codex/rules/guards.rules` and a test that the guard blocks each of its examples (24, under the read-only git policy); Codex's own load-time check of the examples waits for a trusted Codex session
- [x] 4.4 Add the Cursor and Copilot targets to `scripts/sync-harness.config.json`, the Codex `opsx-*` aliases and the retired folders; check: `pnpm harness:sync:check` reports all 72 generated files fresh, and `pnpm verify` passes with 0 warnings (1,059 tests passed, 1 skipped; 2026-11-14)
- [x] 4.5 The owner trusts the hooks in Codex and Antigravity; a live blocked `git push` in each (2026-11-20). Antigravity IDE 2.7.0 with Node 24.22.2: the SessionStart pointer arrived, `git push --dry-run` was denied with no review prompt ("resurse guard blocked: git push"), `git status` ran with no guard message. Codex (the desktop app's hook review, with `codex` 0.169.0-alpha.11.1 on the PATH): both project hooks trusted, the pointer arrived, `codex execpolicy check` returned forbidden for `git push --dry-run` and no match for `git status`, and the live `git push --dry-run` was blocked by the PreToolUse hook ("resurse guard blocked: git push (git push --dry-run)")
- [x] 4.6 Antigravity file and search tools (owner decision Q1 A, 2026-11-20, `tmp/decisions/walkthroughs-d-f.html`): its docs and samples use more file-tool names than the five the matcher listed (`read_file`, `write_file`, `create_file`, `edit_file`), and its search tool `grep_search` was not matched at all. Tests first, in `scripts/hooks/hook-config.test.ts` (the matcher sends 11 shell, file and search names to the guard and leaves 5 other tools alone, anchored or not; through the platform shell, `grep_search`, `create_file` and a `file:` URI in `view_file` on an env file are denied, and a search for the text `.env.local` runs) and `scripts/hooks/guard.test.ts` (a search's `Query` is text, its `SearchPath` and `Includes` are paths): 8 failed. Then the matcher `run_command|.*file.*|grep_search|search_directory` in `.agents/hooks.json` and `query` among the guard's text names: 543 passed in the two files. A review workflow (`wf_a7753f5a-7bc`, two lanes and a skeptic per finding) found that `query` also hid a path nested under it: regression test first (failed), then `query` counts as text only for a plain string; `find_file` joins the matcher test as a guarded name; 545 passed. Its findings on older gaps went to the owner (`tmp/decisions/guard-gaps.html`)
- [x] 4.7 The owner restarts Antigravity and probes the widened matcher live (2026-11-24). With a dummy `tmp/.env.probe`, a `read_file` of it was denied by the hook ("resurse guard blocked: env file (.env.probe)"). The search half had no tool to run: asked for its search tool, the agent listed 19 tools (`read_file`, `write_file`, `edit_file`, `run_command`, `manage_task`, and 14 for subagents, scheduling, MCP and the web) and none for search, and searched with `run_command` instead, which the guard judged as a shell command (a search for the words `.env.local` in `docs/agent` ran, exit 0). Check: of the 19 live names, the old matcher matched only `run_command`, anchored or not, so the three live file tools never reached the guard before 4.6; the new one matches those four
- [x] 4.8 A second review (workflow `wf_f2115eb0-738`: three lanes, a skeptic per finding, a completeness critic; 2026-11-24) found that 4.6 made the guard deny an Antigravity `edit_file` whose one-line old or new text names an env file, for example adding `.env.local` to `.gitignore`: agy 1.5.15, which IDE 2.7.0 runs, calls that text `Target` and `Replacement`. Tests first, in `scripts/hooks/guard.test.ts` (the two keys are text for `edit_file` only; a `Path` naming an env file, a path nested under `Target`, and a `Target` in another tool stay paths) and `scripts/hooks/hook-config.test.ts` (the same edit through the launcher runs): 2 failed; then `TOOL_TEXT_KEYS` in `guard.ts`: 547 passed in the two files. The guardrails page now names the tools each matcher leaves out (Antigravity `manage_task`, `run_workflow`, `call_mcp_tool`; Grok `grep`, `list_dir`, `monitor`) and the routes past the guard that need no shell; the review's other findings went to the owner (`tmp/decisions/guard-gaps.html`)

## 5. Documents

- [x] 5.1 `AGENTS.md`, `CLAUDE.md`, `docs/agent/guardrails.md` and `docs/state/README.md` name the new hooks, the lock and the four blocked OpenSpec commands

## 6. Final checks

- [x] 6.1 `pnpm verify` passes: 1,035 tests passed, 1 skipped, 0 warnings after `pnpm verify:fix` (2026-11-14)
- [x] 6.2 `pnpm build` passes through the wrapper (56 pages), and all 105 built files match the previous build once the build time in the two `article:*_time` tags is masked (that tag is a Phase 5 item)
- [x] 6.3 `pnpm test:e2e` passes through the wrapper: 89 passed
- [x] 6.4 The unit tests pass on Linux at the runner's path (local container): in `node:24-bookworm` as the non-root `node` user, with `CI` and `GITHUB_ACTIONS` set, the working tree at `/home/runner/work/digital-resources/digital-resources` (53 bytes), `pnpm install --frozen-lockfile --ignore-scripts` then `pnpm verify` exit 0: 1,050 passed, 10 skipped (the 3 case-insensitive file-system tests and the 7 cmd.exe cases; the POSIX stale-socket test ran), 0 warnings (2026-11-14)
