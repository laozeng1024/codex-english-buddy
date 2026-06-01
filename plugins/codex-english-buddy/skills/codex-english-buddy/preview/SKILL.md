---
name: preview
description: "Dry-run Codex English Buddy prompt detection and preprocessing without submitting the task or writing normal history. Use when the user invokes /codex-english-buddy:preview or $codex-english-buddy:preview."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:preview"
  defaultPrompt: "Preview how English Buddy would handle a prompt."
---

# Codex English Buddy Preview

This skill is the skill-backed preview entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:preview`
- invokes `$codex-english-buddy:preview`
- wants to dry-run translation, correction, or refinement
- wants to verify what the hook would do without submitting the real task

## Required Workflow

Run the bundled preview command from the installed plugin root. Preserve the user's input text exactly when passing it to the command.

Resolve the plugin root from this loaded `SKILL.md` file path. The plugin root is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`. Do not rely on the user's project cwd and do not use machine-specific cache paths in public instructions.

Use this shape:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" preview "<text>"
```

For JSON output:

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" preview "<text>" --json
```

## Output Guidance

State that preview is a dry run and does not submit the prompt or write normal JSONL history. If `engine=host_model`, explain that exact transformed text is instruction-only until the real turn because the host model produces it. If the user is in Codex CLI and reports that `/codex-english-buddy:preview` is unrecognized, explain that current CLI builds do not expose plugin command Markdown in the native slash menu; use `$codex-english-buddy:preview` or the bundled CLI script instead.
