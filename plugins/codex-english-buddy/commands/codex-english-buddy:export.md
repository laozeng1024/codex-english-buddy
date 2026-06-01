---
name: codex-english-buddy:export
description: "Alias for /export: export full-history Codex English Buddy records."
argument-hint: "[--date YYYY-MM-DD] [--days N] [--since YYYY-MM-DD --until YYYY-MM-DD] [--format markdown|csv|json] [--output file] [--stdout] [--force]"
allowed-tools: Bash, Read
---

Run the same export entrypoint as `/export`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" export $ARGUMENTS
```

Report the output path and counts. Export uses only full-history records; limited records are counted as skipped and their prompt text must not be exported or used to infer corrections.
