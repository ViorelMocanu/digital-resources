---
name: opsx-onboard
description: "Alias for the opsx-onboard workflow. Guided onboarding - walk through a complete OpenSpec workflow cycle with narration"
disable-model-invocation: true
metadata:
    invocation: human
---
<!-- GENERATED from .agents/ — do not edit directly. Run: pnpm harness:sync -->

Read `.agents/workflows/opsx-onboard.md` from the repo root and follow it with the user's arguments unchanged. Resolve every path from the repo root. Where the workflow names another `/opsx-<verb>` command, use this host's form of it (in Codex, `$opsx-<verb>`). Do not invoke this alias again from inside it.
