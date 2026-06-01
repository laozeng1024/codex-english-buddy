---
name: export
description: "Export Codex English Buddy full-history records to Markdown, CSV, or JSON. Use when the user invokes /codex-english-buddy:export, $codex-english-buddy:export, or asks to export original and transformed sentences."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:export"
  defaultPrompt: "Export Codex English Buddy full-history records."
---

# Codex English Buddy Export

This skill is the skill-backed export entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:export`
- invokes `$codex-english-buddy:export`
- asks to export original prompts and transformed English text
- wants Markdown, CSV, or JSON output from English Buddy history

## Required Workflow

Run the bundled export command from the installed plugin root and summarize the written file path and counts.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Default export:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export
```

Common options:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --days 30
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --date 2026-05-28
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --since 2026-05-01 --until 2026-05-27
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --format markdown
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --format csv
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --format json
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --stdout
```

## Output Guidance

Explain that export uses only full-history records. Limited `host_model` records are counted in `skipped_limited_records`, but their prompt text is not exported. Do not infer corrected text, annotations, recurring mistakes, or drills from limited records.

If the user is in Codex CLI and reports that `/codex-english-buddy:export` is unrecognized, give the replacement first: use `$codex-english-buddy:export` in Codex CLI chat, or run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export` from the resolved plugin root. Then explain that current CLI builds may not expose plugin command Markdown in the native slash menu.
