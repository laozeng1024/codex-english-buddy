---
name: export
description: |
  Export full-history Codex English Buddy records to Markdown, CSV, or JSON.
  <example>
  Context: User wants a file containing original prompts and transformed English text.
  user: "/codex-english-buddy:export"
  assistant: "Exporting full-history records and counting limited records that cannot be exported safely."
  </example>
argument-hint: "[--date YYYY-MM-DD] [--days N] [--since YYYY-MM-DD --until YYYY-MM-DD] [--format markdown|csv|json] [--output file] [--stdout] [--force]"
allowed-tools: Bash, Read
---

## Workflow

Run the bundled export command:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" export $ARGUMENTS
```

Report the output path and counts. Export uses only full-history records; limited records are counted as skipped and their prompt text must not be exported or used to infer corrections.
