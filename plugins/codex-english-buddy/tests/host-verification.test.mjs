import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_HOST_SCENARIOS,
  buildHostVerificationMatrix,
  renderHostVerificationMarkdown,
} from "../scripts/lib/host-verification.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..", "..");
const cli = path.join(root, "scripts", "english-buddy.mjs");

const REQUIRED_IDS = [
  "desktop_new_conversation",
  "cli_interactive_tui",
  "cli_initial_prompt",
  "codex_exec_prompt",
];

test("host verification matrix covers all Phase 5 required scenarios", () => {
  assert.deepEqual(REQUIRED_HOST_SCENARIOS.map((scenario) => scenario.id), REQUIRED_IDS);

  const matrix = buildHostVerificationMatrix({
    doctorReport: {
      ok: true,
      codex: {
        binaryPath: "/tmp/codex",
        version: "codex test",
        home: "/tmp/codex-home",
        desktopConfigComparison: { status: "unknown" },
      },
      pluginEnabled: { status: "enabled" },
      hookTrust: { status: "configured" },
      manualHookCheck: { ok: true },
      config: { activeEngine: "host_model" },
      history: { activeHistoryQuality: "limited" },
    },
  });

  assert.equal(matrix.status, "manual_verification_required");
  assert.equal(matrix.supportClaim, "not_supported_until_recorded");
  assert.equal(matrix.scenarios.length, 4);
  for (const scenario of matrix.scenarios) {
    assert.equal(scenario.status, "manual_required");
    assert.notEqual(scenario.supportClaim, "supported");
    assert.match(scenario.expectedNotice, /Translated \(Chinese\)/);
    assert.ok(scenario.requiredChecks.length > 0);
    assert.ok(scenario.passCriteria.length > 0);
  }
});

test("verify-hosts CLI emits JSON and markdown checklists", () => {
  const env = {
    ...process.env,
    CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
    CODEX_BINARY: process.execPath,
  };
  const json = spawnSync(process.execPath, [cli, "verify-hosts", "--json"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.equal(json.status, 0, json.stderr);
  const payload = JSON.parse(json.stdout);
  assert.equal(payload.scenarios.length, 4);
  assert.deepEqual(payload.scenarios.map((scenario) => scenario.id), REQUIRED_IDS);

  const markdown = spawnSync(process.execPath, [cli, "verify-hosts"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /# CLI\/Desktop Host Verification/);
  assert.match(markdown.stdout, /desktop_new_conversation/);
  assert.match(markdown.stdout, /cli_interactive_tui/);
  assert.match(markdown.stdout, /cli_initial_prompt/);
  assert.match(markdown.stdout, /codex_exec_prompt/);
  assert.match(markdown.stdout, /\$codex-english-buddy:today/);
  assert.match(markdown.stdout, /Native CLI slash commands are unsupported\/host-dependent/);
});

test("support matrix document names all required manual checks", () => {
  const doc = fs.readFileSync(path.join(repoRoot, "docs", "CLI_DESKTOP_SUPPORT_MATRIX.md"), "utf8");
  assert.match(doc, /Codex Desktop New Conversation/);
  assert.match(doc, /Codex CLI Interactive TUI/);
  assert.match(doc, /Codex CLI Initial Prompt Argument/);
  assert.match(doc, /Codex Exec Prompt/);
  assert.match(doc, /Do not mark CLI supported until this checklist passes/);
  assert.match(doc, /Codex CLI chat: \$codex-english-buddy:today/);
  assert.match(doc, /Native slash: \/codex-english-buddy:today is not supported unless/);
});

test("host verification markdown renderer includes preflight and checklists", () => {
  const matrix = buildHostVerificationMatrix();
  const markdown = renderHostVerificationMarkdown(matrix);
  assert.match(markdown, /## Preflight/);
  assert.match(markdown, /## Scenario Matrix/);
  assert.match(markdown, /## Manual Checklists/);
  assert.match(markdown, /manual_verification_required/);
  assert.match(markdown, /\$codex-english-buddy:today/);
});
