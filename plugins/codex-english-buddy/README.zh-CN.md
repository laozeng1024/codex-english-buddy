# Codex English Buddy

面向 Codex 用户的英语提示词助手。

`codex-english-buddy` 支持两个主要提示词工作流：

- 将中文或其他非英语输入翻译成自然英文，再让 Codex 按翻译后的意思执行。
- 检查英文输入的语法、拼写、用词和自然度。

助手会先展示转换后的提示词：

```text
Translated (Chinese): ...
Corrected: ...
Refined: ...
```

默认英文 README 见 [README.md](README.md)。

## 安装

克隆公开仓库，并注册为本地 Codex marketplace：

```bash
git clone https://github.com/laozeng1024/codex-english-buddy.git
cd codex-english-buddy
codex plugin marketplace add "$PWD"
codex plugin add codex-english-buddy@laozeng1024
```

然后在 marketplace entry 中启用 `codex-english-buddy`。正常安装不需要编辑 `~/.codex/config.toml`，不需要复制本地绝对路径，也不需要手写 `trusted_hash`。

官方 Codex Marketplace 发布路径目前仍是未来/待确认事项。本仓库当前提供 GitHub + 本地 marketplace 安装方式。

## 默认引擎

默认引擎：`host_model`

默认引擎不需要 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 或其他 provider 凭据。hook 只做轻量检测，并通过 `hookSpecificOutput.additionalContext` 注入规则；实际翻译/纠错由当前 Codex 主模型在同一轮对话里完成。

限制：`host_model` 可以展示转换后的提示词，但不能写入精确 correction pairs，因为 hook 不会收到助手后续生成的转换文本。

## 完整历史引擎

可选引擎：`codex_cli`

在当前插件目录下启用：

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs config --set engine=codex_cli
```

也可以在使用 Codex 的项目根目录创建 `.codex-english-buddy.json`：

```json
{
  "engine": "codex_cli",
  "codex_cli_model": null,
  "codex_cli_timeout_sec": 45
}
```

如果 hook 环境找不到 `codex`，配置显式路径：

```bash
sh scripts/run-node.sh scripts/english-buddy.mjs config --set codex_cli_binary=/path/to/codex
```

`codex_cli` 会在子进程中运行 `codex exec`，带递归保护、禁用子 hooks/plugins、使用 ephemeral 和只读 sandbox。它只在 preprocessor 返回真实 transformed text 时写入 full history。如果子进程失败，hook 会回退到 `host_model` 并写入 limited history。

前置条件：

- 已安装 Codex CLI，并且 `codex exec` 可以在 shell 中正常运行。
- 用户已登录，并且有可用的 Codex 模型。
- English Buddy hook 已启用并被信任。
- Node.js 版本为 `>=18.18.0`。
- hook 能找到 `codex`，或者已配置 `codex_cli_binary`。
- 子进程 `codex exec` 能在 `codex_cli_timeout_sec` 内完成。

`codex_cli` 仍是实验性模式，因为它依赖用户本机的 Codex CLI 和模型可用性。如果它失败、超时或返回无效结构化输出，English Buddy 会在该轮回退到 `host_model`，并写入一条 `limited` 记录。

## 历史质量

报告区分两种历史质量：

- `limited`：知道提示词类型和原始输入，但没有 corrected text 和 annotations。
- `full`：由 `codex_cli` 或其他已验证捕获路径生成了 corrected text 和 annotations。

Recurring mistakes、recurring drills、focus areas 和 correction-pair lessons 只使用 full-history records。插件不会从 limited `host_model` records 推断纠错内容。同一个 correction pair 必须出现超过一次，才会被称为 recurring。

## 命令列表

Codex 通过 Skills 暴露插件动作。Desktop 和部分宿主可能会用 slash-like 名称显示这些 skill-backed entries。在 Codex CLI 中，优先使用 `$...` skill-backed 形式。

| 用途 | Desktop / Skill 宿主 | Codex CLI Chat |
|---|---|---|
| 诊断安装、hook trust、引擎和历史质量 | `/codex-english-buddy:doctor` | `$codex-english-buddy:doctor` |
| 查看或更新配置 | `/codex-english-buddy:config` | `$codex-english-buddy:config` |
| 预览提示词检测，不提交任务 | `/codex-english-buddy:preview` | `$codex-english-buddy:preview` |
| 查看今日语言报告 | `/codex-english-buddy:today` | `$codex-english-buddy:today` |
| 查看多日统计 | `/codex-english-buddy:stats` | `$codex-english-buddy:stats` |
| 查看 recurring mistakes | `/codex-english-buddy:mistakes` | `$codex-english-buddy:mistakes` |
| 生成练习题 | `/codex-english-buddy:drill` | `$codex-english-buddy:drill` |
| 导出 full-history records | `/codex-english-buddy:export` | `$codex-english-buddy:export` |
| 深度审阅英文文本 | `/codex-english-buddy:review` | `$codex-english-buddy:review` |

插件仍然保留 `commands/*.md`，供 Desktop 或未来支持插件命令发现的宿主使用。原生 CLI slash command 支持取决于宿主能力。

## CLI 命令面

Codex CLI 中优先使用：

```text
Codex CLI chat: $codex-english-buddy:today
Native slash: /codex-english-buddy:today is not supported unless your host's / menu lists it
```

如果 CLI 输出 `Unrecognized command '/codex-english-buddy:today'`，请使用 `$codex-english-buddy:today`。

## 使用示例

### 翻译中文提示词

在 Codex 中输入：

```text
帮我检查这个 PR 里的测试失败原因
```

English Buddy 会要求 Codex 先展示转换后的提示词：

```text
Translated (Chinese): Help me investigate why the tests are failing in this PR.
```

然后 Codex 会继续按这个英文请求执行。

### 修正英文提示词

输入：

```text
please help me check why this tests is failed
```

预期第一行：

```text
Corrected: Please help me check why these tests failed.
```

### 优化粗略提示词

当你想把零散想法改成更清晰的 Codex 请求时，可以使用 `::`：

```text
:: fix auth bug, add tests, keep change small
```

预期第一行：

```text
Refined: Fix the authentication bug, add focused tests, and keep the change narrowly scoped.
```

### 查看统计和练习

在 Codex CLI 中使用 skill-backed 报告入口：

```text
$codex-english-buddy:today
$codex-english-buddy:mistakes
$codex-english-buddy:drill
$codex-english-buddy:export
```

`today` 摘要示例：

```text
# Today's Language Report - 2026-05-27
**History quality**: limited
Prompts: 12
Translations: 7
English check requests: 3
Refinements: 2
```

当存在 recurring full-history correction pairs 时，`mistakes` 可能输出：

```text
| # | You Write | Should Be | Times | Category |
|---:|---|---|---:|---|
| 1 | this tests | these tests | 3 | grammar |
| 2 | in shell | in the shell | 2 | article |
```

`drill` 练习题示例：

```text
Your recurring pattern: this tests -> these tests
Sentence: Please update the PR description because this tests still appears in the release notes.
Rewrite this sentence to fix the target error.
```

`today` 可以基于 limited `host_model` history 工作。`mistakes` 和 `drill` 需要来自 `codex_cli` 或其他已验证捕获路径的 recurring full-history correction pairs。

`export` 输出示例：

```text
Export written: .../exports/english-buddy-export-2026-04-28_2026-05-27-2026-05-27T09-30-00Z.md
Exported full records: 8
Skipped limited records: 4
```

### 导出记录

`$codex-english-buddy:export` 会从 full-history records 中导出原始提示词和转换后的文本。limited records 只在摘要里计数，不导出提示词正文。

常用形式：

```text
$codex-english-buddy:export
$codex-english-buddy:export --date 2026-05-28
$codex-english-buddy:export --days 30
$codex-english-buddy:export --since 2026-05-01 --until 2026-05-28
$codex-english-buddy:export --format markdown
$codex-english-buddy:export --format csv
$codex-english-buddy:export --format json
```

参数说明：

- `--date YYYY-MM-DD`：只导出指定单日。
- `--days N`：导出最近 N 天，默认 30 天。
- `--since YYYY-MM-DD --until YYYY-MM-DD`：导出包含起止日期的范围。
- `--format markdown|csv|json`：选择输出格式，默认是 `markdown`。
- `--output path`：写入指定文件；如果文件已存在，必须同时加 `--force` 才会覆盖。
- `--stdout`：只打印导出内容，不写文件。
- `--force`：允许 `--output` 覆盖已有文件。

日期范围参数三选一：`--date`、`--days`、`--since/--until` 不能混用。

## 本地开发

```bash
npm test
npm run validate:codex
```

## 致谢

感谢 [xiaolai/claude-english-buddy-for-claude](https://github.com/xiaolai/claude-english-buddy-for-claude) 提供原始 English Buddy 工作流和学习报告设计灵感。

### 主要差异

| 对比项 | `codex-english-buddy` | `claude-english-buddy-for-claude` |
|---|---|---|
| 宿主 | Codex Desktop 和可支持的 Codex CLI | Claude Code |
| 打包方式 | Codex 插件，包含 `.codex-plugin/plugin.json`、插件自带 hooks、skills 和本地 marketplace metadata | 从 xiaolai marketplace 安装的 Claude Code 插件 |
| Hook 集成 | 插件自带 Codex `UserPromptSubmit` 和 `SessionEnd` hooks；提示词辅导通过 Codex hook output 注入，Desktop 和 CLI 宿主表现可能不同 | Claude Code hook 工作流，在 Claude 回复前纠错、翻译或润色提示词 |
| 默认行为 | 默认 providerless `host_model` 只做轻量检测，由当前 Codex 主模型在同一轮对话里生成可见的翻译、纠错或润色结果 | 纠正英文提示词、翻译非英文提示词、润色 `::` 提示词；干净提示词保持安静 |
| 历史质量 | 默认 `host_model` 只写 limited history，不伪造 corrected text 或 annotations | 保存 correction history，用于原版 today、stats、mistakes 和 drill 报告 |
| Full-history 模式 | 可选 `codex_cli` 引擎，预处理成功时写入已验证 correction pairs | Full correction history 是 recurring mistakes、drills 和趋势报告的默认数据基础 |
| Export | 新增 `$codex-english-buddy:export`，可将 full-history 原句和转换结果导出为 Markdown、CSV 或 JSON，并支持单日、日期范围、格式、输出路径和 stdout 参数 | 原版没有对应的 export 命令 |
| 命令入口 | `$codex-english-buddy:today` 等 skill-backed 入口；原生 CLI slash 是否可用取决于 host | 原生 slash commands，例如 `/claude-english-buddy:today`、`/claude-english-buddy:stats`、`/claude-english-buddy:mistakes`、`/claude-english-buddy:review`、`/claude-english-buddy:config` |

## License

ISC
