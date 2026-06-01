---
description: "Shared: unified config load across codex-english-buddy commands"
user-invocable: false
---
<!-- Shared partial: config loader -->
<!-- Referenced by: config, today, stats, mistakes, preview, drill. Do not use standalone. -->

## Config Resolution

All codex-english-buddy commands share the same config resolution.

### Priority (highest to lowest)

1. **Codex project config** — `.codex-english-buddy.json` in the current working directory
2. **Codex global config** — `~/.codex/codex-english-buddy/config.json`
3. **Defaults** — hard-coded inside `scripts/lib/state.mjs`

### Keys and Defaults

| Key | Default | Meaning |
|-----|---------|---------|
| `engine` | `"host_model"` | `host_model` default or optional `codex_cli` preprocessor |
| `codex_cli_model` | `null` | Optional model passed to child `codex exec` |
| `codex_cli_binary` | `null` | Optional path to the `codex` binary |
| `codex_cli_timeout_sec` | `45` | Child preprocessor timeout |
| `auto_correct` | `true` | Whether UserPromptSubmit hook fixes English prompts |
| `show_transformed_prompt` | `"always"` | Display policy for transformed prompt notices |
| `clean_english_notice` | `false` | Whether clean English should create a visible confirmation where supported |
| `summary_language` | `null` | If set, Codex appends a summary in this language at end of every reply |
| `strictness` | `"standard"` | `gentle` / `standard` / `strict` — depth of correction |
| `domain_terms` | `[]` | Proper nouns and tool names to preserve verbatim |
| `sensitive_patterns` | `[]` | Regex strings that make the hook skip matching prompts |

### Canonical Load Snippet

Commands that need the resolved config should load it via the library, not re-implement the merge:

```bash
node -e "
  const root = process.env.CODEX_PLUGIN_ROOT || '.';
  const { resolveConfig } = await import(root + '/scripts/lib/state.mjs');
  console.log(JSON.stringify(resolveConfig(process.cwd())));
"
```

The output is a plain JSON object with the keys above plus any project-specific extras.

### Strictness Reference

| Level | Behavior |
|-------|----------|
| `gentle` | Only fix clear errors. Accept informal English. |
| `standard` | Fix errors + improve awkward phrasing. (default) |
| `strict` | Fix everything + suggest more natural alternatives. |

### Writing Config

Commands that update config should only ever write to the Codex project file (`.codex-english-buddy.json` in cwd). Do not write to the global file from a command — that is the user's responsibility. The `/config --set key=value` command implements this.
