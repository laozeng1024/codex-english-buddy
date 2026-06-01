---
name: codex-english-buddy:stats
description: "Alias for /stats: show longer-term Codex English Buddy stats."
argument-hint: "[--days N] [--json]"
allowed-tools: Bash, Read
---

Run the same stats entrypoint as `/stats`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" stats $ARGUMENTS
```

Report history quality clearly. Do not infer recurring mistakes from limited history.
