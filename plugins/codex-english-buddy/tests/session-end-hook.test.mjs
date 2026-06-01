import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import { logCorrection, logLimitedEvent } from "../scripts/lib/state.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = path.join(root, "scripts", "session-end-hook.mjs");

function withTempData(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-session-test-"));
  const prevCodex = process.env.CODEX_PLUGIN_DATA;
  process.env.CODEX_PLUGIN_DATA = dir;
  try {
    fn(dir);
  } finally {
    if (prevCodex == null) delete process.env.CODEX_PLUGIN_DATA;
    else process.env.CODEX_PLUGIN_DATA = prevCodex;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runSessionEnd(dataDir) {
  return spawnSync(process.execPath, [hook], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_PLUGIN_DATA: dataDir,
      CODEX_SESSION_ID: "session-test",
    },
  });
}

test("SessionEnd summarizes limited host_model history without recurring mistakes", () => {
  withTempData((dir) => {
    logLimitedEvent({ mode: "correct", original: "i has a bug", detected_language: "english" });
    const result = runSessionEnd(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Session language stats: 1 prompts/);
    assert.match(result.stderr, /1 English check requests/);
    assert.match(result.stderr, /Recurring mistakes unavailable for limited host_model history/);
  });
});

test("SessionEnd reports recurring mistakes from full history only", () => {
  withTempData((dir) => {
    logCorrection({
      mode: "correct",
      original: "its broken",
      corrected: "it's broken",
      annotations: "its → it's (apostrophe)",
    });
    logCorrection({
      mode: "correct",
      original: "its failing",
      corrected: "it's failing",
      annotations: "its → it's (apostrophe)",
    });
    const result = runSessionEnd(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /2 full corrections/);
    assert.match(result.stderr, /Recurring this session: its → it's \(2x\)/);
  });
});
