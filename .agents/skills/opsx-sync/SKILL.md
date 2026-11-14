---
name: opsx-sync
description: "Alias for the opsx-sync workflow. Sync delta specs from a change to main specs"
disable-model-invocation: true
metadata:
    invocation: human
---
<!-- GENERATED from .agents/ — do not edit directly. Run: pnpm harness:sync -->

Read `.agents/workflows/opsx-sync.md` from the repo root and follow it with the user's arguments unchanged. Resolve every path from the repo root. Where the workflow names another `/opsx-<verb>` command, use this host's form of it (in Codex, `$opsx-<verb>`). Do not invoke this alias again from inside it.
