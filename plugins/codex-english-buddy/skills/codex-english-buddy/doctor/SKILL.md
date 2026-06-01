---
name: doctor
description: "Diagnose Codex English Buddy installation, hook trust, active engine, data path, history quality, and Desktop/CLI support. Use when the user invokes /codex-english-buddy:doctor, asks for English Buddy doctor diagnostics, or reports that the command, hook, or transformed prompt is not working."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:doctor"
  defaultPrompt: "Run Codex English Buddy doctor diagnostics."
---

# Codex English Buddy Doctor

This skill is the Desktop-compatible doctor entry point for Codex English Buddy.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:doctor`
- invokes `$codex-english-buddy:doctor`
- asks to run English Buddy doctor diagnostics
- reports that the plugin command is missing
- reports that translated, corrected, or refined prompt output is not appearing
- asks whether the hook, engine, trust state, or history quality is working

## Required Workflow

Run the bundled doctor script from the installed plugin root and summarize the result.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" doctor
```

For JSON diagnostics:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" doctor --json
```

## Output Guidance

Report the practical status first:

- plugin enabled or not
- hook registered and trusted or not
- active engine
- history quality
- duplicate hook risk
- data path
- Desktop/CLI verification status

If Desktop says `/codex-english-buddy:doctor` is not a command, explain that current Codex Desktop surfaces plugin actions through Skills. Ask the user to refresh skills or start a new thread after installing or updating the plugin, then retry `/codex-english-buddy:doctor`.
