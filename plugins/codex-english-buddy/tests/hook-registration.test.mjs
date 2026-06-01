import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooks = JSON.parse(fs.readFileSync(path.join(root, "hooks", "hooks.json"), "utf8"));

function hookCommand(eventName) {
  return hooks.hooks?.[eventName]?.[0]?.hooks?.[0]?.command || "";
}

test("bundled hook commands do not rely on the caller working directory", () => {
  for (const eventName of ["UserPromptSubmit", "SessionEnd"]) {
    const command = hookCommand(eventName);
    assert.match(command, /CODEX_PLUGIN_ROOT/);
    assert.match(command, /\.codex\/plugins\/cache/);
    assert.match(command, /scripts\/run-hook\.sh/);
    assert.doesNotMatch(command, /\$\{CODEX_PLUGIN_ROOT:-\.\}/);
  }
});

test("UserPromptSubmit hook command resolves plugin cache when CODEX_PLUGIN_ROOT is absent", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-hook-registration-"));
  const home = path.join(temp, "home");
  const workspace = path.join(temp, "workspace");
  const pluginCache = path.join(home, ".codex", "plugins", "cache", "laozeng1024", "codex-english-buddy");
  const oldVersion = path.join(pluginCache, "0.5.0-codex.3");
  const currentVersion = path.join(pluginCache, "0.5.0-codex.6");
  const dataDir = path.join(temp, "data");
  fs.mkdirSync(path.join(oldVersion, "scripts"), { recursive: true });
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(oldVersion, "scripts", "run-hook.sh"), "#!/bin/sh\nexit 66\n", "utf8");
  fs.chmodSync(path.join(oldVersion, "scripts", "run-hook.sh"), 0o755);
  fs.symlinkSync(root, currentVersion, "dir");

  try {
    const env = {
      ...process.env,
      HOME: home,
      CODEX_NODE: process.execPath,
      CODEX_PLUGIN_DATA: dataDir,
      CODEX_SESSION_ID: "hook-registration-test",
      CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
    };
    delete env.CODEX_PLUGIN_ROOT;
    delete env.OPENAI_API_KEY;
    delete env.ANTHROPIC_API_KEY;

    const result = spawnSync("sh", ["-c", hookCommand("UserPromptSubmit")], {
      cwd: workspace,
      input: JSON.stringify({
        cwd: workspace,
        hook_event_name: "UserPromptSubmit",
        prompt: "测试插件，先 ls 读取下本地有哪些目录和文件",
        session_id: "hook-registration-test",
        turn_id: "turn-1",
      }),
      encoding: "utf8",
      env,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const payload = JSON.parse(result.stdout);
    assert.match(payload.hookSpecificOutput?.additionalContext || "", /Translated \(Chinese\): <natural English translation>/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
