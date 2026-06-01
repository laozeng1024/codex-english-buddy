---
name: codex-english-buddy:preview
description: "Alias for /preview: dry-run prompt coaching without submitting a task or writing history."
argument-hint: "<text to preview>"
allowed-tools: Bash, Read
---

Run the same preview entrypoint as `/preview`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" preview $ARGUMENTS
```

State that this is a dry run and does not write JSONL history.
