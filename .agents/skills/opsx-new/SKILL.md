---
name: opsx-new
description: "Alias for the opsx-new workflow. Start a new change using the experimental artifact workflow (OPSX)"
disable-model-invocation: true
metadata:
    invocation: human
---
<!-- GENERATED from .agents/ — do not edit directly. Run: pnpm harness:sync -->

Read `.agents/workflows/opsx-new.md` from the repo root and follow it with the user's arguments unchanged. Resolve every path from the repo root. Where the workflow names another `/opsx-<verb>` command, use this host's form of it (in Codex, `$opsx-<verb>`). Do not invoke this alias again from inside it.
