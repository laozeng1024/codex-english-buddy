---
name: config
description: "Show or update Codex English Buddy configuration. Use when the user invokes /codex-english-buddy:config, $codex-english-buddy:config, asks to configure English Buddy, or wants to enable host_model/codex_cli."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:config"
  defaultPrompt: "Show Codex English Buddy configuration."
---

# Codex English Buddy Config

This skill is the skill-backed entry point for English Buddy configuration.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:config`
- invokes `$codex-english-buddy:config`
- asks to show or update English Buddy settings
- asks how to switch `engine` between `host_model` and `codex_cli`

## Required Workflow

Run the bundled config command from the installed plugin root and summarize the result.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" config
```

For updates, pass the user's `--set key=value` argument through to the same script. The script writes only the project config file in the user's current project:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" config --set engine=codex_cli
```

## Output Guidance

Report the active `engine`, `history_quality` implication, and config file priority. If the user is in Codex CLI and reports that `/codex-english-buddy:config` is unrecognized, explain that current CLI builds do not expose plugin command Markdown in the native slash menu; use `$codex-english-buddy:config` or the bundled CLI script instead.
