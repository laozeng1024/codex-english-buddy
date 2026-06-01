---
name: codex-english-buddy:today
description: "Alias for /today: show today's Codex English Buddy language report."
argument-hint: "[--json]"
allowed-tools: Bash, Read
---

Run the same report entrypoint as `/today`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" today $ARGUMENTS
```

Report history quality clearly. Do not infer recurring mistakes from limited history.
