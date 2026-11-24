# Harness, part two

## Why

Part one gave Claude Code a command guard and a state hook; every other agent tool that can work in this checkout ran on the written rules alone. The checkout lock existed but wrapped nothing, so two runs could rebuild the site or rewrite the skill trees under each other. The owner decided on 2026-11-11 (D19 A) that Codex, Grok and Antigravity get hooks and that Cursor and Copilot get the generated skill files, and on 2026-11-14 that the guard also blocks `openspec feedback` and `openspec install`.

## What Changes

- The command guard blocks `openspec feedback` (its text leaves the machine) and `openspec install` (a binary outside the lockfile) wherever they run, with the owner's existing override. `--language` is read as an option that takes a value, which closes a bypass of the `init` rule.
- Seven package scripts take the checkout lock: `build`, `test:e2e`, `verify:fix`, `lint:fix`, `format:fix`, `harness:sync` and `openspec:port`. A second run in the same checkout exits 75 and names the holder. The read-only scripts, among them `verify`, which the pre-push hook runs, do not take it. In CI and on Vercel the lock does nothing.
- The guard's lock gate judges this repository's own commands: a `serve` of the build output, `node scripts/serve-static.ts`, `sync-harness.ts` and `openspec-port.ts`.
- A state pointer (`scripts/hooks/state-pointer.ts`) tells a new Codex or Antigravity session where the state trail starts.
- Added 2026-11-20 with the owner's approval (decision Q1 A): Antigravity's guard covers every tool with `file` in its name, `grep_search` and `search_directory`, besides `run_command`, so a renamed file tool or a search inside an env file reaches the guard; the guard reads a search's `Query` as text, so a search for the words `.env.local` still runs.
- Codex: `.codex/hooks.json` (guard and pointer) and `.codex/rules/guards.rules` (a backstop that needs only project trust). Grok and Antigravity: their hook files. The owner's `.codex/config.toml`, `.gemini/settings.json` and `.cursor/mcp.json` are not touched.
- The sync engine also writes the skill copies Cursor and Copilot read.
- Tests: the lock's own test file (ported), the pointer's, and a test that ties every committed hook file to a script that exists.
- A fault that would have failed the first pipeline run: the guard test's lock socket path was 104 bytes on the GitHub runner, over the 103-byte limit.

Visitors see no change: no page, style or script of the site is touched.

## Capabilities

### New Capabilities

None. The change alters no behaviour of the site, so `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- No dependency is added, removed or upgraded.
- `pnpm build` and `pnpm test:e2e` now run through `node scripts/checkout-lock.ts`. On Vercel and GitHub the wrapper only runs the command.
- Out of scope: hooks for Cursor and Copilot beyond what reads the Claude settings already; a rule that blocks lockfile-changing pnpm commands outside the lock gate; Claude Code's own session-start pointer.
- Waits for the owner: every commit, and trusting the Codex hooks again after each edit of `.codex/hooks.json`. Done live: the trust steps in Codex and Antigravity (2026-11-20) and the probe of Antigravity's wider matcher (2026-11-24, task 4.7).
