import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ENGINE,
  loadProjectConfig,
  logCorrection,
  logClean,
  logLimitedEvent,
  readToday,
  readDay,
  resolveConfig,
} from "../scripts/lib/state.mjs";

function withTempData(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-test-"));
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

test("logCorrection creates a JSONL entry", () => {
  withTempData(() => {
    logCorrection({
      mode: "correct",
      original: "autentication",
      corrected: "authentication",
      annotations: "(autentication>authentication)",
    });
    const records = readToday();
    assert.equal(records.length, 1);
    assert.equal(records[0].mode, "correct");
    assert.equal(records[0].original, "autentication");
    assert.equal(records[0].corrected, "authentication");
  });
});

test("logClean creates a clean entry", () => {
  withTempData(() => {
    logClean({ engine: "codex_cli", original: "Already natural." });
    const records = readToday();
    assert.equal(records.length, 1);
    assert.equal(records[0].mode, "clean");
    assert.equal(records[0].engine, "codex_cli");
    assert.equal(records[0].history_quality, "full");
    assert.equal(records[0].original, "Already natural.");
  });
});

test("logLimitedEvent records limited host_model history without fake corrections", () => {
  withTempData(() => {
    logLimitedEvent({
      mode: "correct",
      original: "i has a bug",
      detected_language: "english",
    });
    const records = readToday();
    assert.equal(records.length, 1);
    assert.equal(records[0].engine, DEFAULT_ENGINE);
    assert.equal(records[0].history_quality, "limited");
    assert.equal(records[0].mode, "correct");
    assert.equal(records[0].original, "i has a bug");
    assert.equal(records[0].corrected, null);
    assert.equal(records[0].annotations, null);
  });
});

test("multiple entries append to same file", () => {
  withTempData(() => {
    logCorrection({ mode: "correct", original: "a", corrected: "b" });
    logCorrection({ mode: "translate", original: "c", corrected: "d" });
    logClean();
    const records = readToday();
    assert.equal(records.length, 3);
    assert.equal(records[0].mode, "correct");
    assert.equal(records[1].mode, "translate");
    assert.equal(records[2].mode, "clean");
  });
});

test("readDay returns empty for non-existent date", () => {
  withTempData(() => {
    const records = readDay("2020-01-01");
    assert.deepEqual(records, []);
  });
});

test("CODEX_PLUGIN_DATA controls the history directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-test-codex-data-"));
  const prevCodex = process.env.CODEX_PLUGIN_DATA;
  process.env.CODEX_PLUGIN_DATA = dir;
  try {
    logClean();
    assert.equal(readToday().length, 1);
  } finally {
    if (prevCodex == null) delete process.env.CODEX_PLUGIN_DATA;
    else process.env.CODEX_PLUGIN_DATA = prevCodex;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadProjectConfig reads Codex project config", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-config-"));
  try {
    fs.writeFileSync(
      path.join(dir, ".codex-english-buddy.json"),
      JSON.stringify({
        auto_correct: false,
        strictness: "strict",
        domain_terms: ["Codex"],
        summary_language: "Chinese",
      }),
    );

    assert.deepEqual(loadProjectConfig(dir), {
      auto_correct: false,
      strictness: "strict",
      domain_terms: ["Codex"],
      summary_language: "Chinese",
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveConfig defaults to host_model engine", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-config-default-"));
  const prevDisableGlobal = process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG;
  process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG = "1";
  try {
    const config = resolveConfig(dir);
    assert.equal(config.engine, "host_model");
    assert.equal(config.auto_correct, true);
    assert.equal(config.clean_english_notice, false);
    assert.equal(config.codex_cli_model, null);
    assert.equal(config.codex_cli_timeout_sec, 45);
    assert.equal(config.codex_cli_binary, null);
  } finally {
    if (prevDisableGlobal == null) delete process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG;
    else process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG = prevDisableGlobal;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveConfig reads codex_cli settings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-config-codex-cli-"));
  const prevDisableGlobal = process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG;
  process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG = "1";
  try {
    fs.writeFileSync(
      path.join(dir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_model: "test-model",
        codex_cli_timeout_sec: 7,
        codex_cli_binary: "/tmp/fake-codex",
        sensitive_patterns: ["secret", "token-[0-9]+"],
      }),
      "utf8",
    );
    const config = resolveConfig(dir);
    assert.equal(config.engine, "codex_cli");
    assert.equal(config.codex_cli_model, "test-model");
    assert.equal(config.codex_cli_timeout_sec, 7);
    assert.equal(config.codex_cli_binary, "/tmp/fake-codex");
    assert.deepEqual(config.sensitive_patterns, ["secret", "token-[0-9]+"]);
  } finally {
    if (prevDisableGlobal == null) delete process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG;
    else process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG = prevDisableGlobal;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
