---
name: today
description: "Show today's Codex English Buddy language report. Use when the user invokes /codex-english-buddy:today, $codex-english-buddy:today, asks for today's English Buddy report, or reports the CLI slash command is unrecognized."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:today"
  defaultPrompt: "Show today's Codex English Buddy language report."
---

# Codex English Buddy Today

This skill is the skill-backed daily report entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:today`
- invokes `$codex-english-buddy:today`
- asks for today's English Buddy report
- asks whether today's translations, corrections, or limited/full history were recorded

## Required Workflow

Run the bundled daily report command from the installed plugin root and summarize the report.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" today
```

For JSON output:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" today --json
```

## Output Guidance

Report history quality near the top. Do not infer corrected text, annotations, recurring mistakes, lessons, or drills from limited `host_model` records. If the user is in Codex CLI and reports that `/codex-english-buddy:today` is unrecognized, give the replacement first: use `$codex-english-buddy:today` in Codex CLI chat, or run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" today` from the resolved plugin root. Then explain that current CLI builds may not expose plugin command Markdown in the native slash menu.
