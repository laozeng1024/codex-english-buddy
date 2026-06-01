---
name: codex-english-buddy:mistakes
description: "Alias for /mistakes: show recurring full-history English correction patterns."
argument-hint: "[--top N] [--json]"
allowed-tools: Bash, Read
---

Run the same mistakes entrypoint as `/mistakes`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" mistakes $ARGUMENTS
```

If only limited history exists, explain that recurring mistakes require full correction pairs.
