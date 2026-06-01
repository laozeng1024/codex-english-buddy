---
name: codex-english-buddy:doctor
description: "Alias for /doctor: diagnose Codex English Buddy installation, hooks, trust, engine, and history quality."
argument-hint: "[--json]"
allowed-tools: Bash, Read
---

Run the same diagnostic entrypoint as `/doctor`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" doctor $ARGUMENTS
```

Report the output directly. If it fails, read `.codex-plugin/plugin.json`, `hooks/hooks.json`, and `${CODEX_HOME:-$HOME/.codex}/config.toml`, then explain the failing layer.
