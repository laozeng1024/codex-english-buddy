---
name: config
description: |
  Configure codex-english-buddy — set language, strictness, toggle auto-correction.
  <example>
  Context: User wants to inspect the currently active merged configuration.
  user: "/codex-english-buddy:config --show"
  assistant: "Reading project and plugin-data config files and displaying the merged active settings with their source."
  </example>
  <example>
  Context: User wants to raise the strictness level for their next session.
  user: "/codex-english-buddy:config --set strictness=strict"
  assistant: "Updating .codex-english-buddy.json with strictness=strict and showing the updated merged config."
  </example>
argument-hint: "[--show | --set key=value]"
allowed-tools: Bash, Read
---

## User Input

```text
$ARGUMENTS
```

## Workflow

### Step 1: Parse arguments

| Input | Action |
|-------|--------|
| (empty) or `--show` | Show current config |
| `--set auto_correct=true` | Set a config value |
| `--set summary_language=Chinese` | Set summary language |
| `--set strictness=strict` | Set strictness level |
| `--set domain_terms=Tailscale,Headscale` | Set domain terms |
| `--set engine=codex_cli` | Enable optional full-history preprocessor |
| `--set sensitive_patterns=SECRET_[A-Z0-9]+,sk-[A-Za-z0-9]+` | Skip matching sensitive prompts |

### Step 2: Show current config

Read project config (`.codex-english-buddy.json` in cwd) and global config (`~/.codex/codex-english-buddy/config.json` if it exists). Display merged result:

```markdown
# English Coach Config

## Active Settings (merged)

| Setting | Value | Source |
|---------|-------|--------|
| auto_correct | {value} | {global / project / default} |
| engine | {host_model / codex_cli} | {source} |
| codex_cli_model | {value or "default"} | {source} |
| codex_cli_timeout_sec | {value} | {source} |
| summary_language | {value or "disabled"} | {source} |
| strictness | {value} | {source} |
| domain_terms | {list or "none"} | {source} |
| sensitive_patterns | {list or "none"} | {source} |

## Strictness Levels

| Level | Behavior |
|-------|----------|
| gentle | Only fix clear errors. Accept informal English. |
| standard | Fix errors + improve awkward phrasing. (default) |
| strict | Fix everything + suggest more natural alternatives. |

## Config Files

- Global Codex: `~/.codex/codex-english-buddy/config.json`
- Project: `.codex-english-buddy.json` in project root
- Priority: Codex project > global Codex > defaults
```

### Step 3: Set config value

If `--set` was used, update the project config file (`.codex-english-buddy.json` in cwd):

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" config --set {key}={value}
```

Then show the updated merged config.
