---
name: codex-english-buddy:drill
description: "Alias for /drill: practice from recurring full-history English mistakes."
argument-hint: "[--rounds N] [--category name] [--json]"
allowed-tools: Bash, Read
---

Run the same drill entrypoint as `/drill`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" drill $ARGUMENTS
```

If full-history patterns are unavailable, explain why instead of guessing exercises.
