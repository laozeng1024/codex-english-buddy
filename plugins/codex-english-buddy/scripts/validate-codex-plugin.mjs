#!/usr/bin/env node
// Lightweight local validation for the Codex plugin package.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  const file = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertPath(relativePath) {
  const file = path.join(root, relativePath);
  assert(fs.existsSync(file), `Missing ${relativePath}`);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walkFiles(relativePath) {
  const base = path.join(root, relativePath);
  const entries = fs.readdirSync(base, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return walkFiles(child);
    return [child];
  });
}

try {
  const plugin = readJson(".codex-plugin/plugin.json");
  assert(plugin.name === "codex-english-buddy", "plugin name must match folder name");
  assert(plugin.version && !plugin.version.includes("TODO"), "plugin version must be filled");
  assert(plugin.version === "0.5.0-codex.6", "plugin version must match the public release version");
  assert(!plugin.version.includes("+codex."), "plugin version must not include a local cachebuster suffix for public release");
  assert(plugin.homepage === "https://github.com/laozeng1024/codex-english-buddy", "plugin homepage must point to the public GitHub repository");
  assert(plugin.repository === "https://github.com/laozeng1024/codex-english-buddy", "plugin repository must point to the public GitHub repository");
  assert(plugin.author?.url === "https://github.com/laozeng1024", "plugin author URL must point to the public GitHub profile");
  assert(plugin.skills === "./skills/", "plugin skills path must be ./skills/");
  assert(plugin.hooks === "./hooks/hooks.json", "plugin hooks path must be ./hooks/hooks.json");
  assert(plugin.interface?.displayName, "interface.displayName is required");
  assert(plugin.interface?.developerName === "laozeng", "interface.developerName must be laozeng");
  assert(Array.isArray(plugin.interface?.defaultPrompt), "interface.defaultPrompt must be an array");

  assertPath("skills/codex-english-buddy/SKILL.md");
  assertPath("skills/codex-english-buddy/doctor/SKILL.md");
  for (const command of ["config", "preview", "today", "stats", "mistakes", "drill", "export", "review"]) {
    assertPath(`skills/codex-english-buddy/${command}/SKILL.md`);
  }
  assertPath("hooks/hooks.json");
  assertPath("scripts/run-hook.sh");
  assertPath("scripts/run-node.sh");
  assertPath("scripts/english-buddy.mjs");
  assertPath("scripts/prompt-coach-hook.mjs");
  assertPath("scripts/session-end-hook.mjs");
  assertPath("assets/english-buddy.svg");
  assertPath("commands/doctor.md");
  assertPath("commands/codex-english-buddy:doctor.md");
  assertPath("commands/config.md");
  assertPath("commands/codex-english-buddy:config.md");
  assertPath("commands/preview.md");
  assertPath("commands/codex-english-buddy:preview.md");
  assertPath("commands/today.md");
  assertPath("commands/codex-english-buddy:today.md");
  assertPath("commands/stats.md");
  assertPath("commands/codex-english-buddy:stats.md");
  assertPath("commands/mistakes.md");
  assertPath("commands/codex-english-buddy:mistakes.md");
  assertPath("commands/drill.md");
  assertPath("commands/codex-english-buddy:drill.md");
  assertPath("commands/export.md");
  assertPath("commands/codex-english-buddy:export.md");
  assertPath("commands/review.md");
  assertPath("commands/codex-english-buddy:review.md");
  assertPath("LICENSE");

  const hooks = readJson("hooks/hooks.json");
  const userPromptCommand = hooks.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command || "";
  const sessionEndCommand = hooks.hooks?.SessionEnd?.[0]?.hooks?.[0]?.command || "";
  for (const [name, command] of Object.entries({ UserPromptSubmit: userPromptCommand, SessionEnd: sessionEndCommand })) {
    assert(command.includes("scripts/run-hook.sh"), `${name} hook must invoke scripts/run-hook.sh`);
    assert(command.includes("CODEX_PLUGIN_ROOT"), `${name} hook must prefer CODEX_PLUGIN_ROOT when available`);
    assert(command.includes(".codex/plugins/cache"), `${name} hook must include a CLI fallback for plugin cache lookup`);
    assert(!command.includes("${CODEX_PLUGIN_ROOT:-.}"), `${name} hook must not fall back to current working directory`);
  }
  assert(userPromptCommand.includes("scripts/prompt-coach-hook.mjs"), "UserPromptSubmit must invoke prompt-coach-hook.mjs");
  assert(sessionEndCommand.includes("scripts/session-end-hook.mjs"), "SessionEnd must invoke session-end-hook.mjs");
  const readme = readText("README.md");
  const normalizedReadme = readme.toLowerCase();
  assert(readme.includes("Default engine"), "README must document the default engine");
  assert(readme.includes("Language: English is the default README"), "README must state that English is shown by default");
  assert(readme.includes("README.zh-CN.md"), "README must link to the Chinese README");
  assert(readme.includes("git clone https://github.com/laozeng1024/codex-english-buddy.git"), "README must document GitHub clone install");
  assert(readme.includes("codex plugin add codex-english-buddy@laozeng1024"), "README must document local marketplace install");
  assert(readme.includes("Official Codex Marketplace distribution is a future/to-be-confirmed path"), "README must not claim official marketplace availability");
  assert(readme.includes("Trust"), "README must document hook trust");
  assert(readme.includes("skill-backed"), "README must document Desktop skill-backed command behavior");
  assert(readme.includes("CLI Command Surface"), "README must document the CLI command surface");
  assert(readme.includes("## Commands"), "README must document the concrete command list");
  assert(readme.includes("| Purpose | Desktop / Skill Host | Codex CLI Chat |"), "README command list must include a surface comparison table");
  assert(!readme.includes("Shell Fallback"), "README command list must not include a shell fallback column");
  assert(readme.includes("$codex-english-buddy:today"), "README must document the CLI skill-backed report entry");
  assert(readme.includes("Native slash: /codex-english-buddy:today is not supported unless"), "README must document CLI native slash command limitations");
  assert(readme.includes("### Export Records"), "README must document export usage");
  assert(readme.includes("$codex-english-buddy:export --date 2026-05-28"), "README must document single-day export");
  assert(readme.includes("$codex-english-buddy:export --since 2026-05-01 --until 2026-05-28"), "README must document range export");
  assert(readme.includes("`--format markdown|csv|json`"), "README must document export formats");
  assert(readme.includes("`--output path`"), "README must document export output path");
  assert(readme.includes("`--stdout`"), "README must document export stdout");
  assert(readme.includes("No equivalent export command in the original plugin"), "README functional differences must document export as a Codex-only addition");
  assert(readme.includes("$codex-english-buddy:export"), "README must document the CLI skill-backed export entry");
  assert(readme.includes("Limited records are counted in the summary, but their prompt text is not exported"), "README must document export limited-history behavior");
  assert(readme.includes("/codex-english-buddy:preview"), "README must document the preview command");
  assert(readme.includes("codex_cli"), "README must document the optional codex_cli engine");
  assert(readme.includes("config --set engine=codex_cli"), "README must document how to enable codex_cli");
  assert(readme.includes("config --set codex_cli_binary=/path/to/codex"), "README must document codex_cli_binary");
  assert(readme.includes("Codex CLI is installed and `codex exec` works from your shell"), "README must document codex_cli prerequisites");
  assert(readme.includes("falls back to `host_model`"), "README must document codex_cli fallback behavior");
  assert(readme.includes("## License"), "README must document the license");
  assert(readme.trim().endsWith("## License\n\nISC"), "README License section must contain only ISC");
  assert(readme.trim().split("\n").filter((line) => line.startsWith("## ")).at(-1) === "## License", "README License section must be last");
  assert(readme.includes("https://github.com/xiaolai/claude-english-buddy-for-claude"), "README must document upstream reference");
  assert(readme.includes("## Acknowledgements"), "README must include acknowledgements");
  assert(readme.includes("### Main Functional Differences"), "README must summarize functional differences from upstream under acknowledgements");
  assert(readme.includes("| Area | `codex-english-buddy` | `claude-english-buddy-for-claude` |"), "README functional differences must include a comparison table");
  assert(readme.includes("| Hook integration |"), "README functional differences must cover Codex hook integration");
  assert(!readme.includes("| Paths |"), "README functional differences should not include a paths row");
  assert(readme.includes("/claude-english-buddy:today"), "README functional differences must include upstream today command example");
  assert(readme.includes("/claude-english-buddy:stats"), "README functional differences must include upstream stats command example");
  assert(readme.includes("/claude-english-buddy:mistakes"), "README functional differences must include upstream mistakes command example");
  assert(readme.includes("/claude-english-buddy:review"), "README functional differences must include upstream review command example");
  assert(readme.includes("/claude-english-buddy:config"), "README functional differences must include upstream config command example");
  assert(readme.includes("UserPromptSubmit"), "README must document UserPromptSubmit hook behavior");
  assert(readme.includes("SessionEnd"), "README must document SessionEnd hook behavior");
  assert(normalizedReadme.includes("history quality"), "README must document history quality");

  const license = readText("LICENSE");
  assert(license.includes("ISC License"), "LICENSE must use ISC");
  assert(license.includes("Copyright (c) 2026 Xiaolai Li"), "LICENSE must preserve upstream copyright");
  assert(license.includes("Copyright (c) 2026 laozeng"), "LICENSE must include the Codex adaptation copyright");

  for (const relativePath of ["README.md", ...walkFiles("skills").filter((file) => file.endsWith(".md"))]) {
    const text = readText(relativePath);
    assert(!/\/Users\/laozeng/.test(text), `${relativePath} must not hardcode local user paths`);
    assert(!/\/opt\/homebrew|\/opt\/anaconda3/.test(text), `${relativePath} must not hardcode local binary paths`);
    assert(!/\.codex\/plugins\/cache\/laozeng/.test(text), `${relativePath} must not hardcode local plugin cache paths`);
  }

  const privacy = readText("PRIVACY.md");
  assert(privacy.includes("host_model"), "Privacy policy must document host_model");
  assert(privacy.includes("codex_cli"), "Privacy policy must document codex_cli");
  assert(privacy.includes("$CODEX_PLUGIN_DATA/exports/english-buddy-export-*.md"), "Privacy policy must document local export files");
  assert(privacy.includes("Limited `host_model` records are counted in the export summary but their prompt text is not exported"), "Privacy policy must document limited-history export behavior");
  assert(!privacy.includes("trusted_hash"), "Privacy policy must not instruct trusted_hash editing");
  process.stdout.write("Codex plugin validation passed.\n");
} catch (error) {
  process.stderr.write(`Codex plugin validation failed: ${error.message}\n`);
  process.exitCode = 1;
}
