import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readPlugin(relativePath) {
  return fs.readFileSync(path.join(pluginRoot, relativePath), "utf8");
}

test(".gitignore covers local config, env, cache, build, and logs", () => {
  const gitignore = readRepo(".gitignore");
  for (const pattern of [
    ".DS_Store",
    "AGENTS.md",
    ".codex-english-buddy.json",
    "docs/",
    ".env",
    ".env.*",
    "!.env.example",
    "node_modules/",
    "coverage/",
    "dist/",
    "build/",
    "*.log",
    ".cache/",
    ".tmp/",
    "tmp/",
  ]) {
    assert.match(gitignore, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
});

test("release metadata uses the public GitHub repository and stable version", () => {
  const plugin = JSON.parse(readPlugin(".codex-plugin/plugin.json"));
  const pkg = JSON.parse(readPlugin("package.json"));
  const rootLicense = readRepo("LICENSE");
  const pluginLicense = readPlugin("LICENSE");
  assert.equal(plugin.version, "0.5.0-codex.6");
  assert.equal(pkg.version, "0.5.0-codex.6");
  assert.equal(plugin.license, "ISC");
  assert.equal(pkg.license, "ISC");
  for (const license of [rootLicense, pluginLicense]) {
    assert.match(license, /ISC License/);
    assert.match(license, /Copyright \(c\) 2026 Xiaolai Li/);
    assert.match(license, /Copyright \(c\) 2026 laozeng/);
  }
  assert.doesNotMatch(plugin.version, /\+codex\./);
  assert.equal(plugin.homepage, "https://github.com/laozeng1024/codex-english-buddy");
  assert.equal(plugin.repository, "https://github.com/laozeng1024/codex-english-buddy");
  assert.equal(plugin.author.url, "https://github.com/laozeng1024");
  assert.equal(plugin.interface.websiteURL, "https://github.com/laozeng1024/codex-english-buddy");
  assert.equal(plugin.interface.privacyPolicyURL, "https://github.com/laozeng1024/codex-english-buddy/blob/main/PRIVACY.md");
  assert.equal(plugin.interface.termsOfServiceURL, "https://github.com/laozeng1024/codex-english-buddy/blob/main/LICENSE");
});

test("public docs describe GitHub/local marketplace install and CLI skill entry", () => {
  const rootChineseReadme = readRepo("README.md");
  const rootEnglishReadme = readRepo("README.en.md");
  const pluginReadme = readPlugin("README.md");
  const pluginChineseReadme = readPlugin("README.zh-CN.md");
  for (const readme of [rootEnglishReadme, pluginReadme]) {
    assert.match(readme, /git clone https:\/\/github\.com\/laozeng1024\/codex-english-buddy\.git/);
    assert.match(readme, /codex plugin marketplace add "\$PWD"/);
    assert.match(readme, /codex plugin add codex-english-buddy@laozeng1024/);
    assert.match(readme, /\$codex-english-buddy:today/);
    assert.match(readme, /Official Codex Marketplace distribution is a future\/to-be-confirmed path/);
  }
  assert.match(rootEnglishReadme, /Language: Chinese is the default README/);
  assert.match(rootEnglishReadme, /README\.md/);
  assert.match(rootChineseReadme, /英文 README 见/);
  assert.match(rootChineseReadme, /README\.en\.md/);
  assert.match(pluginReadme, /Language: English is the default README/);
  assert.match(pluginReadme, /README\.zh-CN\.md/);
  assert.match(pluginChineseReadme, /默认英文 README/);
});

test("README documents concrete command list and license", () => {
  const rootChineseReadme = readRepo("README.md");
  const rootEnglishReadme = readRepo("README.en.md");
  const pluginReadme = readPlugin("README.md");
  const pluginChineseReadme = readPlugin("README.zh-CN.md");
  for (const readme of [rootEnglishReadme, pluginReadme]) {
    assert.match(readme, /## Commands/);
    assert.match(readme, /\| Purpose \| Desktop \/ Skill Host \| Codex CLI Chat \|/);
    assert.doesNotMatch(readme, /Shell Fallback/);
    assert.match(readme, /\/codex-english-buddy:doctor/);
    assert.match(readme, /\$codex-english-buddy:config/);
    assert.match(readme, /### Export Records/);
    assert.match(readme, /\$codex-english-buddy:export --date 2026-05-28/);
    assert.match(readme, /\$codex-english-buddy:export --days 30/);
    assert.match(readme, /\$codex-english-buddy:export --since 2026-05-01 --until 2026-05-28/);
    assert.match(readme, /\$codex-english-buddy:export --format csv/);
    assert.match(readme, /`--output path`/);
    assert.match(readme, /`--stdout`/);
    assert.match(readme, /Use only one range selector at a time/);
    assert.match(readme, /\$codex-english-buddy:export/);
    assert.match(readme, /Limited records are counted in the summary, but their prompt text is not exported/);
    assert.match(readme, /## License/);
    assert.match(readme.trim(), /## License\n\nISC$/);
    assert.equal(readme.trim().split("\n").filter((line) => line.startsWith("## ")).at(-1), "## License");
  }
  for (const readme of [rootChineseReadme, pluginChineseReadme]) {
    assert.match(readme, /## 命令列表/);
    assert.match(readme, /\| 用途 \| Desktop \/ Skill 宿主 \| Codex CLI Chat \|/);
    assert.doesNotMatch(readme, /Shell 备用入口/);
    assert.match(readme, /\/codex-english-buddy:doctor/);
    assert.match(readme, /\$codex-english-buddy:config/);
    assert.match(readme, /### 导出记录/);
    assert.match(readme, /\$codex-english-buddy:export --date 2026-05-28/);
    assert.match(readme, /\$codex-english-buddy:export --days 30/);
    assert.match(readme, /\$codex-english-buddy:export --since 2026-05-01 --until 2026-05-28/);
    assert.match(readme, /\$codex-english-buddy:export --format csv/);
    assert.match(readme, /`--output path`/);
    assert.match(readme, /`--stdout`/);
    assert.match(readme, /日期范围参数三选一/);
    assert.match(readme, /\$codex-english-buddy:export/);
    assert.match(readme, /limited records 只在摘要里计数，不导出提示词正文/);
    assert.match(readme, /## License/);
    assert.match(readme.trim(), /## License\n\nISC$/);
    assert.equal(readme.trim().split("\n").filter((line) => line.startsWith("## ")).at(-1), "## License");
  }
});

test("README documents how to enable codex_cli full-history mode", () => {
  const rootChineseReadme = readRepo("README.md");
  const rootEnglishReadme = readRepo("README.en.md");
  const pluginReadme = readPlugin("README.md");
  const pluginChineseReadme = readPlugin("README.zh-CN.md");
  for (const readme of [rootEnglishReadme, pluginReadme]) {
    assert.match(readme, /Enable Full-History Mode|Full-History Engine/);
    assert.match(readme, /config --set engine=codex_cli/);
    assert.match(readme, /"engine": "codex_cli"/);
    assert.match(readme, /"codex_cli_timeout_sec": 45/);
    assert.match(readme, /config --set codex_cli_binary=\/path\/to\/codex/);
    assert.match(readme, /Codex CLI is installed and `codex exec` works from your shell/);
    assert.match(readme, /The user is signed in and has a usable Codex model/);
    assert.match(readme, /The English Buddy hook is enabled and trusted/);
    assert.match(readme, /Node\.js is `>=18\.18\.0`/);
    assert.match(readme, /falls back to `host_model`/);
    assert.match(readme, /writes a `limited` record/);
  }
  for (const readme of [rootChineseReadme, pluginChineseReadme]) {
    assert.match(readme, /启用完整历史模式|完整历史引擎/);
    assert.match(readme, /config --set engine=codex_cli/);
    assert.match(readme, /"engine": "codex_cli"/);
    assert.match(readme, /"codex_cli_timeout_sec": 45/);
    assert.match(readme, /config --set codex_cli_binary=\/path\/to\/codex/);
    assert.match(readme, /已安装 Codex CLI/);
    assert.match(readme, /`codex exec` 可以在 shell 中正常运行/);
    assert.match(readme, /用户已登录/);
    assert.match(readme, /English Buddy hook 已启用并被信任/);
    assert.match(readme, /Node\.js 版本为 `>=18\.18\.0`/);
    assert.match(readme, /回退到 `host_model`/);
    assert.match(readme, /`limited` 记录/);
  }
});

test("README documents upstream reference and Codex functional differences", () => {
  const rootChineseReadme = readRepo("README.md");
  const rootEnglishReadme = readRepo("README.en.md");
  const pluginReadme = readPlugin("README.md");
  const pluginChineseReadme = readPlugin("README.zh-CN.md");
  for (const readme of [rootEnglishReadme, rootChineseReadme, pluginReadme, pluginChineseReadme]) {
    assert.match(readme, /https:\/\/github\.com\/xiaolai\/claude-english-buddy-for-claude/);
    assert.match(readme, /English Buddy/);
    assert.match(readme, /\|.*codex-english-buddy.*\|.*claude-english-buddy-for-claude.*\|/);
    assert.match(readme, /host_model/);
    assert.match(readme, /UserPromptSubmit/);
    assert.match(readme, /SessionEnd/);
    assert.match(readme, /codex_cli/);
    assert.match(readme, /\$codex-english-buddy:today/);
  }
  assert.match(rootEnglishReadme, /## Acknowledgements/);
  assert.match(rootEnglishReadme, /### Main Functional Differences/);
  assert.match(pluginReadme, /## Acknowledgements/);
  assert.match(pluginReadme, /### Main Functional Differences/);
  assert.match(rootChineseReadme, /## 致谢/);
  assert.match(rootChineseReadme, /### 主要差异/);
  assert.match(pluginChineseReadme, /## 致谢/);
  assert.match(pluginChineseReadme, /### 主要差异/);
  assert.match(rootEnglishReadme, /\| Area \| `codex-english-buddy` \| `claude-english-buddy-for-claude` \|/);
  assert.match(pluginReadme, /\| Area \| `codex-english-buddy` \| `claude-english-buddy-for-claude` \|/);
  assert.match(rootChineseReadme, /\| 对比项 \| `codex-english-buddy` \| `claude-english-buddy-for-claude` \|/);
  assert.match(pluginChineseReadme, /\| 对比项 \| `codex-english-buddy` \| `claude-english-buddy-for-claude` \|/);
  assert.match(rootEnglishReadme, /\| Hook integration \|/);
  assert.match(pluginReadme, /\| Hook integration \|/);
  assert.match(rootChineseReadme, /\| Hook 集成 \|/);
  assert.match(pluginChineseReadme, /\| Hook 集成 \|/);
  assert.match(rootEnglishReadme, /\| Export \| Adds `\$codex-english-buddy:export`/);
  assert.match(pluginReadme, /\| Export \| Adds `\$codex-english-buddy:export`/);
  assert.match(rootChineseReadme, /\| Export \| 新增 `\$codex-english-buddy:export`/);
  assert.match(pluginChineseReadme, /\| Export \| 新增 `\$codex-english-buddy:export`/);
  assert.match(rootEnglishReadme, /No equivalent export command in the original plugin/);
  assert.match(pluginReadme, /No equivalent export command in the original plugin/);
  assert.match(rootChineseReadme, /原版没有对应的 export 命令/);
  assert.match(pluginChineseReadme, /原版没有对应的 export 命令/);
  assert.doesNotMatch(rootEnglishReadme, /\| Paths \|/);
  assert.doesNotMatch(pluginReadme, /\| Paths \|/);
  assert.doesNotMatch(rootChineseReadme, /\| 路径 \|/);
  assert.doesNotMatch(pluginChineseReadme, /\| 路径 \|/);
  assert.match(rootEnglishReadme, /\/claude-english-buddy:today/);
  assert.match(rootEnglishReadme, /\/claude-english-buddy:stats/);
  assert.match(rootEnglishReadme, /\/claude-english-buddy:mistakes/);
  assert.match(rootEnglishReadme, /\/claude-english-buddy:review/);
  assert.match(rootEnglishReadme, /\/claude-english-buddy:config/);
  assert.match(rootChineseReadme, /\/claude-english-buddy:today/);
  assert.match(rootChineseReadme, /\/claude-english-buddy:stats/);
  assert.match(rootChineseReadme, /\/claude-english-buddy:mistakes/);
  assert.match(rootChineseReadme, /\/claude-english-buddy:review/);
  assert.match(rootChineseReadme, /\/claude-english-buddy:config/);
});

test("README documents usage examples in English and Chinese", () => {
  const rootChineseReadme = readRepo("README.md");
  const rootEnglishReadme = readRepo("README.en.md");
  const pluginReadme = readPlugin("README.md");
  const pluginChineseReadme = readPlugin("README.zh-CN.md");

  for (const readme of [rootEnglishReadme, pluginReadme]) {
    assert.match(readme, /## Usage Examples/);
    assert.match(readme, /Translate A Chinese Prompt/);
    assert.match(readme, /Correct An English Prompt/);
    assert.match(readme, /Refine A Rough Prompt/);
    assert.match(readme, /Check Reports And Practice/);
    assert.match(readme, /Translated \(Chinese\): Help me investigate why the tests are failing in this PR\./);
    assert.match(readme, /Corrected: Please help me check why these tests failed\./);
    assert.match(readme, /Refined: Fix the authentication bug, add focused tests, and keep the change narrowly scoped\./);
    assert.match(readme, /\$codex-english-buddy:drill/);
    assert.match(readme, /\$codex-english-buddy:export/);
    assert.match(readme, /# Today's Language Report - 2026-05-27/);
    assert.match(readme, /Prompts: 12/);
    assert.match(readme, /\| 1 \| this tests \| these tests \| 3 \| grammar \|/);
    assert.match(readme, /Your recurring pattern: this tests -> these tests/);
    assert.match(readme, /Rewrite this sentence to fix the target error\./);
    assert.match(readme, /Exported full records: 8/);
    assert.match(readme, /Skipped limited records: 4/);
  }

  for (const readme of [rootChineseReadme, pluginChineseReadme]) {
    assert.match(readme, /## 使用示例/);
    assert.match(readme, /翻译中文提示词/);
    assert.match(readme, /修正英文提示词/);
    assert.match(readme, /优化粗略提示词/);
    assert.match(readme, /查看统计和练习/);
    assert.match(readme, /Translated \(Chinese\): Help me investigate why the tests are failing in this PR\./);
    assert.match(readme, /Corrected: Please help me check why these tests failed\./);
    assert.match(readme, /Refined: Fix the authentication bug, add focused tests, and keep the change narrowly scoped\./);
    assert.match(readme, /\$codex-english-buddy:drill/);
    assert.match(readme, /\$codex-english-buddy:export/);
    assert.match(readme, /# Today's Language Report - 2026-05-27/);
    assert.match(readme, /Prompts: 12/);
    assert.match(readme, /\| 1 \| this tests \| these tests \| 3 \| grammar \|/);
    assert.match(readme, /Your recurring pattern: this tests -> these tests/);
    assert.match(readme, /Rewrite this sentence to fix the target error\./);
    assert.match(readme, /Exported full records: 8/);
    assert.match(readme, /Skipped limited records: 4/);
  }
});

test("privacy policy documents export storage and limited-history behavior", () => {
  const rootPrivacy = readRepo("PRIVACY.md");
  const privacy = readPlugin("PRIVACY.md");
  for (const text of [rootPrivacy, privacy]) {
    assert.match(text, /\$CODEX_PLUGIN_DATA\/history\/YYYY-MM-DD\.jsonl/);
    assert.match(text, /\$CODEX_PLUGIN_DATA\/exports\/english-buddy-export-\*\.md/);
    assert.match(text, /Limited `host_model` records are counted in the export summary but their prompt text is not exported/);
  }
  assert.match(rootPrivacy, /Effective date: 2026-05-28/);
  assert.match(rootPrivacy, /does not operate a hosted service, does not run centralized analytics, and does not send telemetry to the plugin author/);
  assert.match(rootPrivacy, /The plugin author does not receive prompt text, configuration, history, exports, telemetry, or analytics from the plugin/);
  assert.match(rootPrivacy, /Exported files may contain original prompt text and transformed text from full-history records/);
  assert.match(privacy, /canonical repository privacy policy/);
  assert.match(privacy, /https:\/\/github\.com\/laozeng1024\/codex-english-buddy\/blob\/main\/PRIVACY\.md/);
  assert.match(privacy, /\$CODEX_PLUGIN_DATA\/history\/YYYY-MM-DD\.jsonl/);
  assert.match(privacy, /\$CODEX_PLUGIN_DATA\/exports\/english-buddy-export-\*\.md/);
  assert.match(privacy, /History and exports are stored on the user's local filesystem/);
  assert.match(privacy, /Limited `host_model` records are counted in the export summary but their prompt text is not exported/);
});

test("run-node reports a clear error when Node.js is too old", () => {
  const result = spawnSync("sh", [path.join(pluginRoot, "scripts", "run-node.sh"), "-e", "console.log('ok')"], {
    cwd: pluginRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_NODE: process.execPath,
      CODEX_ENGLISH_BUDDY_MIN_NODE_VERSION: "99.0.0",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /codex-english-buddy requires Node\.js >=99\.0\.0/);
  assert.match(result.stderr, /Set CODEX_NODE to a compatible Node\.js binary/);
});
