---
name: mistakes
description: "Show recurring Codex English Buddy mistake patterns from full-history correction records. Use when the user invokes /codex-english-buddy:mistakes or $codex-english-buddy:mistakes."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:mistakes"
  defaultPrompt: "Show recurring English Buddy mistakes."
---

# Codex English Buddy Mistakes

This skill is the skill-backed recurring mistakes entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:mistakes`
- invokes `$codex-english-buddy:mistakes`
- asks for recurring English mistakes
- asks which English patterns need practice

## Required Workflow

Run the bundled mistakes command from the installed plugin root. Preserve user flags such as `--top 5`.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" mistakes
```

For JSON output:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" mistakes --top 20 --json
```

## Output Guidance

Do not infer mistakes from raw prompt text. Mistake patterns require full correction pairs from `codex_cli` or another verified capture path. Call a pattern recurring only when the same correction pair appears more than once; one-off correction pairs may be reported as captured one-off mistakes, not recurring mistakes. If the user is in Codex CLI and reports that `/codex-english-buddy:mistakes` is unrecognized, give the replacement first: use `$codex-english-buddy:mistakes` in Codex CLI chat, or run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" mistakes` from the resolved plugin root. Then explain that current CLI builds may not expose plugin command Markdown in the native slash menu.
