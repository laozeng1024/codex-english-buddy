# Codex English Buddy

English prompt coach for Codex users.

`codex-english-buddy` helps with two prompt workflows:

- Chinese or other non-English input is translated into natural English before Codex acts on it.
- English input is checked for grammar, spelling, word choice, and naturalness.

The assistant is instructed to show the transformed prompt first:

```text
Translated (Chinese): ...
Corrected: ...
Refined: ...
```

Language: English is the default README. 中文文档见 [README.zh-CN.md](README.zh-CN.md)。

## Install

Clone the public repository and register it as a local Codex marketplace:

```bash
git clone https://github.com/laozeng1024/codex-english-buddy.git
cd codex-english-buddy
codex plugin marketplace add "$PWD"
codex plugin add codex-english-buddy@laozeng1024
```

Then enable `codex-english-buddy` from the marketplace entry. Normal installation must not require editing `~/.codex/config.toml`, copying local absolute paths, or writing a `trusted_hash` by hand.

Official Codex Marketplace distribution is a future/to-be-confirmed path. This repository currently documents the GitHub + local marketplace installation flow.

## Trust The Hook

This plugin uses a bundled `UserPromptSubmit` hook and a `SessionEnd` hook. Codex may require hook review before running them.

After installing, review and trust the English Buddy hook when Codex prompts you. If the plugin appears enabled but no `Translated` or `Corrected` line appears, run the Desktop skill-backed doctor entry:

```text
/codex-english-buddy:doctor
```

Current Codex Desktop builds surface plugin actions through Skills. They do not load plugin `commands/*.md` files as standalone slash commands in every host/version. If Desktop says this command is missing after install or update, refresh skills or start a new thread, then retry the same entry.

For local development from this plugin directory:

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs doctor
```

`doctor` reports the active engine, hook registration, hook trust evidence, feature flags, data path, duplicate hook risk, and history quality.

## Default Engine

Default engine: `host_model`

The default engine does not require `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or any provider credential. The hook does lightweight detection and injects rules through `hookSpecificOutput.additionalContext`; the active Codex model performs the translation/correction inside the main turn.

Tradeoff: `host_model` can show transformed prompts, but it cannot write exact correction pairs because the hook does not receive the assistant's later transformed text.

## Full-History Engine

Optional engine: `codex_cli`

Enable it from this plugin directory:

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs config --set engine=codex_cli
```

Or create `.codex-english-buddy.json` in the project where you use Codex:

```json
{
  "engine": "codex_cli",
  "codex_cli_model": null,
  "codex_cli_timeout_sec": 45
}
```

If the hook cannot find `codex` in its environment, set an explicit binary path:

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs config --set codex_cli_binary=/path/to/codex
```

`codex_cli` runs `codex exec` in a child process with recursion protection, hooks/plugins disabled, `--ephemeral`, read-only sandboxing, and no approval prompts. It parses structured output and writes full history only when the preprocessor returns actual transformed text. If the child run fails, the hook falls back to `host_model` and writes limited history for that turn.

Prerequisites:

- Codex CLI is installed and `codex exec` works from your shell.
- The user is signed in and has a usable Codex model.
- The English Buddy hook is enabled and trusted.
- Node.js is `>=18.18.0`.
- The hook can find `codex`, or `codex_cli_binary` is configured.
- The child `codex exec` run finishes before `codex_cli_timeout_sec`.

`codex_cli` is experimental because it depends on the user's local Codex CLI and model availability. If it fails, times out, or returns invalid structured output, English Buddy falls back to `host_model` for that turn and writes a `limited` record.

## History Quality

Reports distinguish two history qualities:

- `limited`: prompt category and original input are known, but corrected text and annotations are unavailable.
- `full`: corrected text and annotations were produced by `codex_cli` or another verified capture path.

Recurring mistakes, recurring drills, focus areas, and correction-pair lessons use only full-history records. They do not infer corrections from limited `host_model` records. A correction pair must appear more than once before it is called recurring.

## Commands

Codex surfaces plugin actions through Skills. Desktop and some hosts may expose these skill-backed entries with slash-like names. In Codex CLI, prefer the `$...` skill-backed form.

| Purpose | Desktop / Skill Host | Codex CLI Chat |
|---|---|---|
| Diagnose install, hook trust, engine, and history quality | `/codex-english-buddy:doctor` | `$codex-english-buddy:doctor` |
| Show or update configuration | `/codex-english-buddy:config` | `$codex-english-buddy:config` |
| Preview prompt detection without submitting | `/codex-english-buddy:preview` | `$codex-english-buddy:preview` |
| Show today's language report | `/codex-english-buddy:today` | `$codex-english-buddy:today` |
| Show multi-day statistics | `/codex-english-buddy:stats` | `$codex-english-buddy:stats` |
| Show recurring mistakes | `/codex-english-buddy:mistakes` | `$codex-english-buddy:mistakes` |
| Generate practice drills | `/codex-english-buddy:drill` | `$codex-english-buddy:drill` |
| Export full-history records | `/codex-english-buddy:export` | `$codex-english-buddy:export` |
| Review a piece of English writing | `/codex-english-buddy:review` | `$codex-english-buddy:review` |

The plugin still ships `commands/*.md` files for Desktop or future hosts that support plugin command discovery. Treat native CLI slash command support as host-dependent.

## CLI Command Surface

In Codex CLI, prefer these entry points:

```text
Codex CLI chat: $codex-english-buddy:today
Native slash: /codex-english-buddy:today is not supported unless your host's / menu lists it
```

Some Codex CLI builds do not load plugin `commands/*.md` files into the native `/` menu. If CLI prints `Unrecognized command '/codex-english-buddy:today'`, use `$codex-english-buddy:today` in Codex chat.

## Usage Examples

### Translate A Chinese Prompt

Type this in Codex:

```text
帮我检查这个 PR 里的测试失败原因
```

English Buddy asks Codex to show the transformed prompt first:

```text
Translated (Chinese): Help me investigate why the tests are failing in this PR.
```

Codex then continues using that English request.

### Correct An English Prompt

Type:

```text
please help me check why this tests is failed
```

Expected first line:

```text
Corrected: Please help me check why these tests failed.
```

### Refine A Rough Prompt

Use `::` when you want English Buddy to turn rough notes into a clearer Codex request:

```text
:: fix auth bug, add tests, keep change small
```

Expected first line:

```text
Refined: Fix the authentication bug, add focused tests, and keep the change narrowly scoped.
```

### Check Reports And Practice

In Codex CLI, use skill-backed report entries:

```text
$codex-english-buddy:today
$codex-english-buddy:mistakes
$codex-english-buddy:drill
$codex-english-buddy:export
```

Example `today` summary:

```text
# Today's Language Report - 2026-05-27
**History quality**: limited
Prompts: 12
Translations: 7
English check requests: 3
Refinements: 2
```

Example `mistakes` output when recurring full-history pairs exist:

```text
| # | You Write | Should Be | Times | Category |
|---:|---|---|---:|---|
| 1 | this tests | these tests | 3 | grammar |
| 2 | in shell | in the shell | 2 | article |
```

Example `drill` prompt:

```text
Your recurring pattern: this tests -> these tests
Sentence: Please update the PR description because this tests still appears in the release notes.
Rewrite this sentence to fix the target error.
```

`today` works with limited `host_model` history. `mistakes` and `drill` need recurring full-history correction pairs from `codex_cli` or another verified capture path.

Example `export` output:

```text
Export written: .../exports/english-buddy-export-2026-04-28_2026-05-27-2026-05-27T09-30-00Z.md
Exported full records: 8
Skipped limited records: 4
```

### Export Records

`$codex-english-buddy:export` exports original prompts and transformed text from full-history records. Limited records are counted in the summary, but their prompt text is not exported.

Common forms:

```text
$codex-english-buddy:export
$codex-english-buddy:export --date 2026-05-28
$codex-english-buddy:export --days 30
$codex-english-buddy:export --since 2026-05-01 --until 2026-05-28
$codex-english-buddy:export --format markdown
$codex-english-buddy:export --format csv
$codex-english-buddy:export --format json
```

Options:

- `--date YYYY-MM-DD`: export exactly one day.
- `--days N`: export the latest N-day window. The default is 30 days.
- `--since YYYY-MM-DD --until YYYY-MM-DD`: export an inclusive date range.
- `--format markdown|csv|json`: choose the output format. The default is `markdown`.
- `--output path`: write to a specific file path. Existing files are not overwritten unless `--force` is also supplied.
- `--stdout`: print the export instead of writing a file.
- `--force`: allow `--output` to overwrite an existing file.

Use only one range selector at a time: `--date`, `--days`, or `--since/--until`.

Action behavior:

- `doctor`: diagnose plugin enablement, hook trust, feature flags, config, data path, and history quality.
- `config`: show merged config or write project config to `.codex-english-buddy.json`.
- `preview`: dry-run prompt detection/preprocessing without submitting a task and without writing history.
- `today`: daily prompt report, corrections, translations, lessons, and weekly trend.
- `stats --days N`: longer-period metrics and recurring mistake summary.
- `mistakes --top N`: all-time recurring correction pairs and focus areas.
- `drill`: practice based on recurring full-history mistakes.
- `export`: write full-history original/transformed records to Markdown, CSV, or JSON.
- `review`: optional deep writing review workflow retained from the upstream behavior.

Local CLI equivalents from this plugin directory:

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs doctor
sh scripts/run-node.sh scripts/english-buddy.mjs preview "修复这个 bug"
sh scripts/run-node.sh scripts/english-buddy.mjs today
sh scripts/run-node.sh scripts/english-buddy.mjs stats --days 30
sh scripts/run-node.sh scripts/english-buddy.mjs export --date 2026-05-28 --format markdown
```

## Configuration

Project config:

```text
.codex-english-buddy.json
```

Global config:

```text
~/.codex/codex-english-buddy/config.json
```

Project config overrides global config. Example:

```json
{
  "engine": "host_model",
  "show_transformed_prompt": "always",
  "clean_english_notice": false,
  "auto_correct": true,
  "summary_language": null,
  "strictness": "standard",
  "domain_terms": ["Codex"],
  "sensitive_patterns": ["SECRET_[A-Z0-9]+", "sk-[A-Za-z0-9]+"]
}
```

Supported config keys:

- `engine`: `host_model` or `codex_cli`
- `codex_cli_model`: model name or `null`
- `codex_cli_binary`: path to `codex` or `null`
- `codex_cli_timeout_sec`: positive integer
- `auto_correct`: `true` or `false`
- `summary_language`: language name or `null`
- `strictness`: `gentle`, `standard`, or `strict`
- `domain_terms`: strings to preserve
- `sensitive_patterns`: regex strings that make the hook skip matching prompts

## Skip Rules

The hook skips:

- slash commands
- prompts entirely inside triple-backtick fenced code blocks
- very short prompts
- URL/command-like inputs
- raw code-like prompts
- prompts matching `sensitive_patterns`

Skipped prompts produce no English Buddy context and no history record.

## Verify Desktop And CLI

Desktop and CLI behavior must be verified separately. Use `doctor` and `verify-hosts` to check the current host surface before claiming support for a specific scenario.

## Troubleshooting

| Symptom | Likely Cause | Next Step |
|---|---|---|
| No `Translated` or `Corrected` line | hook disabled, untrusted, or not registered | Run `doctor`; trust the bundled hook |
| Duplicate notices | user-level hook and plugin hook both active | Run `doctor`; disable one hook path |
| Reports work but mistakes/drill are empty | only limited `host_model` history exists | Enable `codex_cli` or collect full-history records |
| `codex_cli` falls back | child `codex exec` failed, timed out, or returned invalid JSON | Run `doctor`; check `codex_cli_binary`, model, and timeout |
| Desktop works but CLI does not | different host behavior or config path | Run `verify-hosts`; compare the reported host and config values |

## Local Development

From this plugin directory:

```bash
npm test
npm run validate:codex
```

Direct validation:

```bash
sh scripts/run-node.sh scripts/validate-codex-plugin.mjs
sh scripts/run-node.sh --test tests/*.test.mjs
```

## Privacy

See `PRIVACY.md`.

## Acknowledgements

Thanks to [xiaolai/claude-english-buddy-for-claude](https://github.com/xiaolai/claude-english-buddy-for-claude) for the original English Buddy workflow and learning-report inspiration.

### Main Functional Differences

| Area | `codex-english-buddy` | `claude-english-buddy-for-claude` |
|---|---|---|
| Host | Codex Desktop and Codex CLI where supported | Claude Code |
| Packaging | Codex plugin with `.codex-plugin/plugin.json`, bundled hooks, skills, and local marketplace metadata | Claude Code plugin installed from the xiaolai marketplace |
| Hook integration | Bundled Codex `UserPromptSubmit` and `SessionEnd` hooks; prompt coaching is injected through Codex hook output and can differ between Desktop and CLI hosts | Claude Code hook workflow that corrects, translates, or refines prompts before Claude responds |
| Default behavior | Providerless `host_model` uses lightweight detection and lets the active Codex model produce the visible translation, correction, or refinement in the same turn | Corrects English prompts, translates non-English prompts, refines `::` prompts, and stays quiet for clean prompts |
| History quality | Default `host_model` records limited history and never invents corrected text or annotations | Keeps correction history that powers the original today, stats, mistakes, and drill reports |
| Full-history mode | Optional `codex_cli` engine writes verified correction pairs when preprocessing succeeds | Full correction history is the normal basis for recurring mistakes, drills, and trend reports |
| Export | Adds `$codex-english-buddy:export` to export full-history original/transformed records as Markdown, CSV, or JSON with date, range, format, output, and stdout options | No equivalent export command in the original plugin |
| Command surface | Skill-backed entries such as `$codex-english-buddy:today`; native CLI slash support is host-dependent | Native slash commands such as `/claude-english-buddy:today`, `/claude-english-buddy:stats`, `/claude-english-buddy:mistakes`, `/claude-english-buddy:review`, and `/claude-english-buddy:config` |

## License

ISC
