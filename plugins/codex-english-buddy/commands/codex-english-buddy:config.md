---
name: codex-english-buddy:config
description: "Alias for /config: show or update Codex English Buddy project configuration."
argument-hint: "[--show | --set key=value]"
allowed-tools: Bash, Read
---

Run the same config entrypoint as `/config`:

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" config $ARGUMENTS
```

Only write project config through `.codex-english-buddy.json`; do not edit global config from this command.
