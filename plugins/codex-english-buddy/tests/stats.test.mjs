import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { logCorrection, logClean, logLimitedEvent } from "../scripts/lib/state.mjs";
import {
  allTimeStats,
  buildDrillPlan,
  focusAreas,
  todayStats,
  trendVerdict,
} from "../scripts/lib/stats.mjs";

function withTempData(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-stats-test-"));
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

function writeHistoryRecord(dataDir, date, record) {
  const historyDir = path.join(dataDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });
  fs.appendFileSync(path.join(historyDir, `${date}.jsonl`), JSON.stringify(record) + "\n", "utf8");
}

test("todayStats returns zeros when no data", () => {
  withTempData(() => {
    const stats = todayStats();
    assert.equal(stats.total, 0);
    assert.equal(stats.corrections, 0);
    assert.equal(stats.errorRate, 0);
  });
});

test("todayStats computes error rate", () => {
  withTempData(() => {
    logCorrection({ mode: "correct", original: "a", corrected: "b", annotations: "(a>b)" });
    logCorrection({ mode: "correct", original: "c", corrected: "d", annotations: "(c>d)" });
    logClean();
    logClean();
    const stats = todayStats();
    assert.equal(stats.total, 4);
    assert.equal(stats.corrections, 2);
    assert.equal(stats.errorRate, 50);
    assert.equal(stats.clean, 2);
  });
});

test("todayStats extracts patterns", () => {
  withTempData(() => {
    logCorrection({ mode: "correct", original: "its", corrected: "it's", annotations: "(its>it's)" });
    logCorrection({ mode: "correct", original: "its", corrected: "it's", annotations: "(its>it's)" });
    logCorrection({ mode: "correct", original: "modul", corrected: "module", annotations: "(modul>module)" });
    const stats = todayStats();
    assert.equal(stats.patterns.length, 2);
    assert.equal(stats.patterns[0].original, "its");
    assert.equal(stats.patterns[0].count, 2);
    assert.equal(stats.recurringPatterns.length, 1);
    assert.equal(stats.recurringPatterns[0].original, "its");
  });
});

test("todayStats counts translations and refinements", () => {
  withTempData(() => {
    logCorrection({ mode: "translate", original: "中文", corrected: "Chinese" });
    logCorrection({ mode: "refine", original: "fix auth", corrected: "Refactor the authentication module" });
    logClean();
    const stats = todayStats();
    assert.equal(stats.translations, 1);
    assert.equal(stats.refinements, 1);
    assert.equal(stats.clean, 1);
  });
});

test("todayStats extracts patterns from the new arrow format", () => {
  withTempData(() => {
    logCorrection({
      mode: "correct",
      original: "its got modul",
      corrected: "it's got module",
      annotations: "its → it's (apostrophe)\nmodul → module (spelling)",
    });
    logCorrection({
      mode: "correct",
      original: "its bug",
      corrected: "it's a bug",
      annotations: "its → it's (apostrophe)",
    });
    const stats = todayStats();
    assert.equal(stats.patterns.length, 2);
    assert.equal(stats.patterns[0].original, "its");
    assert.equal(stats.patterns[0].corrected, "it's");
    assert.equal(stats.patterns[0].count, 2);
    assert.equal(stats.patterns[0].category, "apostrophe");
  });
});

test("todayStats aggregates patterns across mixed old and new formats", () => {
  withTempData(() => {
    logCorrection({ mode: "correct", original: "x", corrected: "y", annotations: "(its>it's)" });
    logCorrection({ mode: "correct", original: "z", corrected: "w", annotations: "its → it's (apostrophe)" });
    const stats = todayStats();
    assert.equal(stats.patterns.length, 1);
    assert.equal(stats.patterns[0].count, 2);
  });
});

test("todayStats ignores translation-mode language tags", () => {
  withTempData(() => {
    logCorrection({ mode: "translate", original: "中文", corrected: "Chinese", annotations: "(Chinese)" });
    const stats = todayStats();
    assert.equal(stats.patterns.length, 0); // language tag is not a diff pair
  });
});

test("todayStats marks host_model records limited and does not infer corrections", () => {
  withTempData(() => {
    logLimitedEvent({ mode: "correct", original: "i has a bug", detected_language: "english" });
    logLimitedEvent({ mode: "translate", original: "修复这个 bug", detected_language: "Chinese" });
    const stats = todayStats();
    assert.equal(stats.historyQuality, "limited");
    assert.equal(stats.total, 2);
    assert.equal(stats.limitedRecords, 2);
    assert.equal(stats.fullRecords, 0);
    assert.equal(stats.corrections, 0);
    assert.equal(stats.correctionRequests, 1);
    assert.equal(stats.translations, 1);
    assert.equal(stats.patterns.length, 0);
    assert.equal(stats.fullCorrectionRecords.length, 0);
    assert.equal(stats.limitedActivityRecords.length, 2);
  });
});

test("allTimeStats reads history outside the rolling period window", () => {
  withTempData((dir) => {
    writeHistoryRecord(dir, "2020-01-01", {
      ts: "2020-01-01T00:00:00.000Z",
      engine: "preprocessor",
      history_quality: "full",
      mode: "correct",
      original: "its broken",
      corrected: "it's broken",
      annotations: "its → it's (apostrophe)",
    });
    const stats = allTimeStats();
    assert.equal(stats.total, 1);
    assert.equal(stats.corrections, 1);
    assert.equal(stats.patterns.length, 1);
    assert.equal(stats.recurringPatterns.length, 0);
    assert.equal(stats.patterns[0].category, "apostrophe");
    assert.equal(stats.focusAreas.length, 0);
  });
});

test("focusAreas groups patterns by canonical category", () => {
  const areas = focusAreas([
    { original: "its", corrected: "it's", count: 2, category: "apostrophe" },
    { original: "modul", corrected: "module", count: 1, category: "spelling" },
  ]);
  assert.equal(areas[0].category, "punctuation");
  assert.equal(areas[0].count, 2);
  assert.equal(areas[0].share, 67);
  assert.equal(areas[1].category, "spelling");
});

test("trendVerdict reports improving, regressing, flat, and insufficient states", () => {
  assert.equal(trendVerdict([
    { fullRecords: 10, errorRate: 60 },
    { fullRecords: 10, errorRate: 45 },
  ]).status, "improving");
  assert.equal(trendVerdict([
    { fullRecords: 10, errorRate: 30 },
    { fullRecords: 10, errorRate: 42 },
  ]).status, "regressing");
  assert.equal(trendVerdict([
    { fullRecords: 10, errorRate: 30 },
    { fullRecords: 10, errorRate: 33 },
  ]).status, "flat");
  assert.equal(trendVerdict([{ fullRecords: 0, errorRate: 0 }]).status, "insufficient");
});

test("buildDrillPlan refuses limited history", () => {
  withTempData(() => {
    logLimitedEvent({ mode: "correct", original: "i has a bug", detected_language: "english" });
    const drill = buildDrillPlan();
    assert.equal(drill.available, false);
    assert.match(drill.reason, /limited host_model history/);
  });
});

test("buildDrillPlan creates deterministic drill rounds from full history", () => {
  withTempData(() => {
    for (let i = 0; i < 5; i++) {
      logCorrection({
        mode: "correct",
        original: `its broken ${i}`,
        corrected: `it's broken ${i}`,
        annotations: "its → it's (apostrophe)",
      });
    }
    const drill = buildDrillPlan({ rounds: 2, category: "punctuation" });
    assert.equal(drill.available, true);
    assert.equal(drill.rounds.length, 2);
    assert.equal(drill.rounds[0].category, "punctuation");
    assert.match(drill.rounds[0].sentence, /its/);
    assert.match(drill.rounds[0].expected, /it's/);
  });
});

test("buildDrillPlan refuses one-off full-history correction pairs", () => {
  withTempData(() => {
    for (let i = 0; i < 5; i++) {
      logCorrection({
        mode: "correct",
        original: `issue ${i}`,
        corrected: `an issue ${i}`,
        annotations: `issue ${i} → an issue ${i} (article)`,
      });
    }
    const drill = buildDrillPlan();
    assert.equal(drill.available, false);
    assert.match(drill.reason, /recurring full-history correction patterns/);
    assert.equal(drill.stats.patterns.length, 5);
    assert.equal(drill.stats.recurringPatterns.length, 0);
  });
});

test("buildDrillPlan uses full correction pairs when limited records are mixed in", () => {
  withTempData(() => {
    logLimitedEvent({ mode: "correct", original: "i has a bug", detected_language: "english" });
    for (let i = 0; i < 5; i++) {
      logCorrection({
        mode: "correct",
        original: `its broken ${i}`,
        corrected: `it's broken ${i}`,
        annotations: "its → it's (apostrophe)",
      });
    }
    const drill = buildDrillPlan({ rounds: 1 });
    assert.equal(drill.stats.historyQuality, "limited");
    assert.equal(drill.available, true);
    assert.equal(drill.rounds.length, 1);
  });
});
