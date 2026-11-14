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
- [ ] 4.3 Add `.codex/rules/guards.rules` and a test that the guard blocks each of its examples
- [ ] 4.4 Add the Cursor and Copilot targets to `scripts/sync-harness.config.json`; check: `pnpm harness:sync:check`
- [ ] 4.5 The owner trusts the hooks in Codex and Antigravity; a live blocked `git push` in each

## 5. Documents

- [x] 5.1 `AGENTS.md`, `CLAUDE.md`, `docs/agent/guardrails.md` and `docs/state/README.md` name the new hooks, the lock and the four blocked OpenSpec commands

## 6. Final checks

- [ ] 6.1 `pnpm verify` passes
- [ ] 6.2 `pnpm build` passes through the wrapper, and the built pages are unchanged
- [ ] 6.3 `pnpm test:e2e` passes through the wrapper
- [ ] 6.4 The unit tests pass on Linux at the runner's path (local container)
