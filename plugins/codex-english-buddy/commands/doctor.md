---
name: doctor
description: |
  Diagnose Codex English Buddy installation, hook registration, trust hints, active engine, data paths, and history quality.
  <example>
  Context: User installed the plugin but the transformed prompt is not showing.
  user: "/codex-english-buddy:doctor"
  assistant: "Running doctor to inspect plugin hooks, feature flags, config paths, and a manual hook smoke test."
  </example>
argument-hint: "[--json]"
allowed-tools: Bash, Read
---

## Workflow

### Step 1: Run doctor

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" doctor $ARGUMENTS
```

If the command fails, read these files directly and report the failure:

- `.codex-plugin/plugin.json`
- `hooks/hooks.json`
- `${CODEX_HOME:-$HOME/.codex}/config.toml`

### Step 2: Interpret results

Doctor reports:

- Codex version and binary path when available.
- `CODEX_HOME` and active Codex config path.
- Feature flags: `hooks`, `plugins`, `plugin_hooks`.
- Plugin enabled/reference state.
- Plugin-bundled hook registration.
- Hook trust hints from config. Do not claim trust if doctor says `unknown`.
- User-level hook fallback and duplicate-hook risk.
- Desktop/CLI config comparison when environment data is available.
- Active engine and effective config/data paths.
- History quality and recurring-mistake report availability.
- Latest hook debug log timestamp.
- Manual hook smoke test result.

### Step 3: Respond

If doctor emits JSON, summarize the high-value fields instead of pasting the whole object unless the user explicitly asks for raw output.

For `host_model`, limited history is expected. Say that recurring-mistake reports require a full-history engine or response-capture path.
