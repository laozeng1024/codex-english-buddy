---
name: drill
description: "Create English practice drills from recurring full-history Codex English Buddy mistakes. Use when the user invokes /codex-english-buddy:drill or $codex-english-buddy:drill."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:drill"
  defaultPrompt: "Create an English Buddy drill."
---

# Codex English Buddy Drill

This skill is the skill-backed drill entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:drill`
- invokes `$codex-english-buddy:drill`
- asks for practice based on recurring mistakes
- asks to drill a specific category such as articles, grammar, punctuation, or prepositions

## Required Workflow

Run the bundled drill command from the installed plugin root. Preserve user flags such as `--rounds 3` and `--category article`.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" drill
```

For JSON output:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" drill --rounds 3 --json
```

## Output Guidance

Only create drills from actual full-history recurring mistake patterns, where the same correction pair appears more than once. Exclude one-off captured mistakes from recurring drills. If full history or recurring patterns are unavailable, say why and stop. If the user is in Codex CLI and reports that `/codex-english-buddy:drill` is unrecognized, give the replacement first: use `$codex-english-buddy:drill` in Codex CLI chat, or run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" drill` from the resolved plugin root. Then explain that current CLI builds may not expose plugin command Markdown in the native slash menu.
