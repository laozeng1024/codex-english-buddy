# Privacy Policy

This plugin follows the canonical repository privacy policy:

<https://github.com/laozeng1024/codex-english-buddy/blob/main/PRIVACY.md>

This file is kept inside the plugin package so hosts and users that inspect only `plugins/codex-english-buddy` can still find the privacy policy location.

## Plugin-Local Summary

`codex-english-buddy` runs locally as a Codex plugin. It does not operate a hosted service, does not run centralized analytics, and does not send telemetry to the plugin author.

The default `host_model` engine does not call a separate model provider from the hook. It performs lightweight detection and asks the active Codex model to show a translated, corrected, or refined prompt in the main conversation turn. No `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or other provider credential is required for default behavior.

The optional `codex_cli` engine calls the user's local `codex exec` command in a child process. In that mode, prompt text is processed through the user's own Codex CLI session. If the child process fails, times out, or returns invalid structured output, the plugin falls back to `host_model` and writes a limited record.

The plugin may store local configuration, history, and exports:

```text
.codex-english-buddy.json
~/.codex/codex-english-buddy/config.json
$CODEX_PLUGIN_DATA/history/YYYY-MM-DD.jsonl
$CODEX_PLUGIN_DATA/exports/english-buddy-export-*.md
$CODEX_PLUGIN_DATA/exports/english-buddy-export-*.csv
$CODEX_PLUGIN_DATA/exports/english-buddy-export-*.json
```

History and exports are stored on the user's local filesystem. History powers reports such as `today`, `stats`, `mistakes`, `drill`, and `export`.

The `export` command writes only full-history records by default. Limited `host_model` records are counted in the export summary but their prompt text is not exported.

The `preview` command is a dry run and does not write normal prompt history.

`sensitive_patterns` can be configured to skip prompts that match project-specific secrets or private text. Skipped prompts do not receive English Buddy context and do not create history records.

To remove local plugin data, delete:

```text
~/.codex/codex-english-buddy/
$CODEX_PLUGIN_DATA/
.codex-english-buddy.json
```
