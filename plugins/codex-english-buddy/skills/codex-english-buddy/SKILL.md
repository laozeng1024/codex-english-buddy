---
name: codex-english-buddy
description: "English coach for Codex users. Use when the user asks for English prompt correction, Chinese-to-English prompt translation, refinement with ::, writing review, preview, language stats, recurring mistakes, drills, or English Buddy configuration."
version: 0.5.0-codex.6
---

# Codex English Buddy

This is the Codex-facing router for `codex-english-buddy`.

## When To Use

Use this skill when the user asks to:

- review, preview, correct, translate, or refine English text
- run an English Buddy report such as today, stats, mistakes, drill, export, or config
- inspect or update `.codex-english-buddy.json`
- preserve the user's voice while fixing grammar, punctuation, clarity, or tone

## Core Rules

- Preserve the user's intent and voice.
- Fix real errors, not stylistic preferences.
- Surface at most three high-value lessons unless the user asks for exhaustive detail.
- Keep technical terms, code identifiers, file paths, commands, and product names unchanged.
- If the prompt starts with `::`, treat the rest as a rough idea and refine it into a precise Codex prompt before acting on it.
- If the text is non-English and the user is asking for English help, translate it into natural English while preserving technical terms.

The sibling skills contain the reference material:

- `writing-guide` routes to the focused writing references.
- `doctor` diagnoses plugin enablement, hook trust, Desktop command discovery, engine state, data path, and history quality.
- `config`, `preview`, `today`, `stats`, `mistakes`, `drill`, `export`, and `review` provide skill-backed entries for the public English Buddy command surface.
- `grammar-fundamentals` covers articles, agreement, tense, prepositions, and countability.
- `punctuation-rules` covers commas, semicolons, colons, hyphens, apostrophes, and quotation marks.
- `tone-calibration` covers commit messages, PR descriptions, docs, email, comments, and chat tone.
- `technical-writing` covers developer documentation, README structure, API docs, and error messages.
- `common-non-native-mistakes` covers recurring L2-English patterns.

## Reports And Config

For history-backed reports, run the bundled CLI from the installed plugin root. Resolve the plugin root from this loaded `SKILL.md` file path; it is the nearest parent directory containing `.codex-plugin/plugin.json` and `scripts/english-buddy.mjs`.

```bash
PLUGIN_ROOT="<resolved plugin root>"
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" today
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" stats --days 30
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" mistakes --top 20
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" export --date 2026-05-28 --format markdown
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" config
sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" config --set strictness=strict
```

The script reads Codex history from `$CODEX_PLUGIN_DATA`.

Current Codex CLI builds may not expose plugin `commands/*.md` files in the native slash-command menu. If `/codex-english-buddy:today` or another slash command is reported as unrecognized in CLI, use the skill-backed `$codex-english-buddy:today` form or run the bundled CLI script directly. Do not claim native CLI slash support unless the user's CLI slash menu actually lists the plugin command.

Project configuration priority:

1. `.codex-english-buddy.json`
2. global Codex config at `~/.codex/codex-english-buddy/config.json`
3. defaults

## Review Output

For review or preview requests, produce:

```markdown
## English Review

**Text length**: {words} words
**Context**: {commit / pr / doc / comment / email / chat}
**Overall quality**: {Excellent / Good / Needs Work / Poor}
**Errors found**: {N}
**Tone score**: {1-5} / 5

### Corrected Version

{corrected text}

### Changes

| # | Original | Corrected | Category | Why |
|---|----------|-----------|----------|-----|

### Style Suggestions

{optional, only for non-error improvements}

### Summary

{2-3 sentences with one practical tip}
```

## Drill Workflow

If the user asks for a drill:

1. Resolve the installed plugin root from this `SKILL.md`, then run `sh "$PLUGIN_ROOT/scripts/run-node.sh" "$PLUGIN_ROOT/scripts/english-buddy.mjs" mistakes --top 20 --json`.
2. Pick one high-count pattern or category.
3. Generate one developer-context sentence with exactly one intentional error matching that pattern.
4. Ask the user to correct it.
5. Grade only the target pattern, not stylistic rewrites.

## Hook Notes

The plugin includes Codex-compatible hook scripts. The scripts support:

- `$CODEX_PLUGIN_DATA`
- `$CODEX_SESSION_ID`
- `$CODEX_PLUGIN_ROOT` in `hooks/hooks.json`

The automatic prompt hook is being moved toward the providerless `host_model` engine. Until that phase is complete, model-backed preprocessor behavior is available only when explicitly configured for tests or advanced use.
