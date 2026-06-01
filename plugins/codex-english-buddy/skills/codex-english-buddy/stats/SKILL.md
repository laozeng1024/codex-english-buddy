---
name: stats
description: "Show multi-day Codex English Buddy language stats and trends. Use when the user invokes /codex-english-buddy:stats, $codex-english-buddy:stats, or asks for English Buddy statistics."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:stats"
  defaultPrompt: "Show Codex English Buddy stats."
---

# Codex English Buddy Stats

This skill is the skill-backed stats report entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:stats`
- invokes `$codex-english-buddy:stats`
- asks for language stats across days or weeks
- asks for longer-term English Buddy trends

## Required Workflow

Run the bundled stats command from the installed plugin root. Preserve user flags such as `--days 7`.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" stats
```

For JSON output:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" stats --days 30 --json
```

## Output Guidance

Report the selected period and history quality. Recurring mistakes and focus areas must use only full correction records. If the user is in Codex CLI and reports that `/codex-english-buddy:stats` is unrecognized, give the replacement first: use `$codex-english-buddy:stats` in Codex CLI chat, or run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" stats` from the resolved plugin root. Then explain that current CLI builds may not expose plugin command Markdown in the native slash menu.
