import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "english-buddy.mjs");

function withDoctorEnv(fn) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-doctor-test-"));
  const codexHome = path.join(temp, "codex-home");
  const pluginData = path.join(temp, "plugin-data");
  const home = path.join(temp, "home");
  fs.mkdirSync(codexHome, { recursive: true });
  fs.mkdirSync(pluginData, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(
    path.join(codexHome, "config.toml"),
    `
[features]
hooks = true
plugins = true
plugin_hooks = true

[plugins."codex-english-buddy@laozeng1024"]
enabled = true

[[hooks.UserPromptSubmit]]
command = "sh ./scripts/run-hook.sh ./scripts/prompt-coach-hook.mjs"
trusted_hash = "test-hash"
`,
    "utf8",
  );

  try {
    return fn({
      ...process.env,
      CODEX_HOME: codexHome,
      CODEX_PLUGIN_DATA: pluginData,
      CODEX_BINARY: process.execPath,
      CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
      HOME: home,
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test("doctor JSON reports Phase 2 host_model and Phase 3 diagnostics", () => {
  withDoctorEnv((env) => {
    const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
      cwd: root,
      encoding: "utf8",
      env,
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.config.activeEngine, "host_model");
    assert.equal(payload.history.activeHistoryQuality, "limited");
    assert.equal(payload.history.recurringMistakeReportsAvailable, false);
    assert.equal(payload.features.hooks.status, "enabled");
    assert.equal(payload.features.plugins.status, "enabled");
    assert.equal(payload.features.plugin_hooks.status, "enabled");
    assert.equal(payload.pluginEnabled.status, "enabled");
    assert.equal(payload.hookTrust.status, "configured");
    assert.equal(payload.userLevelHookFallback.present, true);
    assert.equal(payload.duplicateHookRisk.status, "possible");
    assert.equal(payload.plugin.runnerExists, true);
    assert.equal(payload.plugin.bundledHookRegistration.userPromptSubmit, true);
    assert.equal(payload.plugin.bundledHookRegistration.sessionEnd, true);
    assert.equal(payload.plugin.bundledHookRegistration.commandCanLocatePluginCache, true);
    assert.equal(payload.plugin.bundledHookRegistration.commandHasUnsafeCwdFallback, false);
    assert.equal(payload.plugin.commandSurface.skillBackedEntries, 9);
    assert.equal(payload.plugin.commandSurface.commandFiles, 9);
    assert.equal(payload.plugin.commandSurface.nativeCliSlashCommands.status, "unsupported_or_host_dependent");
    assert.equal(payload.plugin.commandSurface.nativeCliSlashCommands.label, "unsupported/host-dependent");
    assert.equal(payload.plugin.commandSurface.nativeCliSlashCommands.recommendedChatEntry, "$codex-english-buddy:today");
    assert.equal(payload.plugin.commandSurface.nativeCliSlashCommands.shellFallback, "sh scripts/run-node.sh scripts/english-buddy.mjs today");
    assert.match(payload.plugin.commandSurface.nativeCliSlashCommands.evidence, /Native \/codex-english-buddy:today is supported only if the host \/ menu lists it/);
    assert.equal(payload.manualHookCheck.ok, true);
    assert.equal(payload.manualHookCheck.translatedInstructionPresent, true);
    assert.equal(payload.manualHookCheck.historyRecordQuality, "limited");
    assert.equal(payload.manualHookCheck.historyCorrectedIsNull, true);
    assert.equal(payload.manualHookCheck.historyAnnotationsAreNull, true);
    assert.equal(payload.hostVerification.status, "manual_verification_required");
    assert.equal(payload.hostVerification.scenarios.length, 4);
    assert.deepEqual(payload.hostVerification.scenarios.map((scenario) => scenario.id), [
      "desktop_new_conversation",
      "cli_interactive_tui",
      "cli_initial_prompt",
      "codex_exec_prompt",
    ]);
    assert.doesNotMatch(result.stdout, /DOCTOR_MOCK_MUST_NOT_APPEAR/);
  });
});

test("doctor markdown renders a concise report", () => {
  withDoctorEnv((env) => {
    const result = spawnSync(process.execPath, [cli, "doctor"], {
      cwd: root,
      encoding: "utf8",
      env,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# Codex English Buddy Doctor/);
    assert.match(result.stdout, /Active engine/);
    assert.match(result.stdout, /host_model/);
    assert.match(result.stdout, /Manual hook smoke test/);
    assert.match(result.stdout, /Command surface/);
    assert.match(result.stdout, /Native CLI slash/);
    assert.match(result.stdout, /unsupported\/host-dependent/);
    assert.match(result.stdout, /\$codex-english-buddy:today/);
    assert.match(result.stdout, /scripts\/run-node\.sh scripts\/english-buddy\.mjs today/);
    assert.match(result.stdout, /Host verification/);
  });
});

test("doctor reports codex_cli as full-history active engine", () => {
  withDoctorEnv((env) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-doctor-project-"));
    try {
      fs.writeFileSync(
        path.join(projectDir, ".codex-english-buddy.json"),
        JSON.stringify({
          engine: "codex_cli",
          codex_cli_model: "test-model",
          codex_cli_timeout_sec: 9,
        }),
        "utf8",
      );
      const result = spawnSync(process.execPath, [cli, "doctor", "--json"], {
        cwd: projectDir,
        encoding: "utf8",
        env,
      });

      assert.equal(result.status, 0, result.stderr);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.config.activeEngine, "codex_cli");
      assert.equal(payload.config.resolved.codex_cli_model, "test-model");
      assert.equal(payload.config.resolved.codex_cli_timeout_sec, 9);
      assert.equal(payload.history.activeHistoryQuality, "full");
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
