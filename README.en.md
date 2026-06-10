# Codex English Buddy

Codex English Buddy is a Codex plugin that helps non-native English users write better prompts. It translates Chinese or other non-English prompts into natural English, checks English prompts for clarity and correctness, and keeps local language-learning reports.

Repository: <https://github.com/laozeng1024/codex-english-buddy>

The installable plugin lives in `plugins/codex-english-buddy`.

Language: Chinese is the default README. 中文默认文档见 [README.md](README.md)。

## Install From GitHub

Clone this repository and register it as a local Codex marketplace:

```bash
git clone https://github.com/laozeng1024/codex-english-buddy.git
cd codex-english-buddy
codex plugin marketplace add "$PWD"
codex plugin add codex-english-buddy@laozeng1024
```

Then enable `codex-english-buddy` through Codex's normal plugin flow and trust the bundled hook when prompted. Normal users should not edit `~/.codex/config.toml`, copy local absolute paths, or hardcode a `trusted_hash`.

Official Codex Marketplace distribution is a future/to-be-confirmed path. This repository currently documents the reproducible GitHub + local marketplace installation flow.

## Usage

Default engine: `host_model`

The default hook does not require provider credentials. It injects prompt-coaching instructions into Codex so the active model shows the transformed prompt first:

```text
Translated (Chinese): ...
Corrected: ...
Refined: ...
```

Codex Desktop surfaces plugin actions through skills. After install or update, start a new thread or refresh skills before trying:

```text
/codex-english-buddy:doctor
```

In Codex CLI, use the skill-backed form:

```text
$codex-english-buddy:today
```

Do not treat `/codex-english-buddy:today` as the primary CLI path unless the current CLI `/` menu lists it.

## Commands

Codex Desktop and future hosts may expose slash-style skill entries. In Codex CLI, prefer the `$...` skill-backed form.

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

Native CLI slash commands such as `/codex-english-buddy:today` are supported only when your current host lists them in its `/` menu.

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

## Reports

`host_model` history is limited: it records prompt category and original input, but not exact corrected text or annotations. Full recurring-mistake reports and drills require full-history records from the optional `codex_cli` engine.

## Enable Full-History Mode

Use `codex_cli` only when you want verified full-history records for recurring mistakes, drills, and exports.

From `plugins/codex-english-buddy`, enable it for the current project:

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

Prerequisites:

- Codex CLI is installed and `codex exec` works from your shell.
- The user is signed in and has a usable Codex model.
- The English Buddy hook is enabled and trusted.
- Node.js is `>=18.18.0`.
- The hook can find `codex`, or `codex_cli_binary` is configured.
- The child `codex exec` run finishes before `codex_cli_timeout_sec`.

If `codex_cli` fails, times out, or returns invalid structured output, English Buddy falls back to `host_model` for that turn and writes a `limited` record.

## Project Files

- User-facing plugin docs: `plugins/codex-english-buddy/README.md`
- Privacy policy: `plugins/codex-english-buddy/PRIVACY.md`
- License: `LICENSE`
- Safe project config template: `.codex-english-buddy.example.json`

## Local Validation

```bash
cd plugins/codex-english-buddy
npm test
npm run validate:codex
```

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
