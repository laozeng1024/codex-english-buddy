import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "english-buddy.mjs");

function withTempProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-cli-test-"));
  const dataDir = path.join(dir, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    return fn(dir, dataDir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function records(dataDir) {
  const historyDir = path.join(dataDir, "history");
  if (!fs.existsSync(historyDir)) return [];
  return fs
    .readdirSync(historyDir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) => fs.readFileSync(path.join(historyDir, name), "utf8").trim().split("\n").filter(Boolean))
    .map((line) => JSON.parse(line));
}

function writeExecutable(file, text) {
  fs.writeFileSync(file, text, "utf8");
  fs.chmodSync(file, 0o755);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateText, delta) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function writeHistory(dataDir, date, entries) {
  const historyDir = path.join(dataDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(
    path.join(historyDir, `${date}.jsonl`),
    entries.map((entry, index) => JSON.stringify({
      ts: `${date}T00:00:0${index}.000Z`,
      engine: entry.engine || "codex_cli",
      session: entry.session || "test-session",
      pattern: null,
      ...entry,
    })).join("\n") + "\n",
    "utf8",
  );
}

function runCli(args, dir, dataDir) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_PLUGIN_DATA: dataDir,
      CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
    },
  });
}

test("preview host_model is a dry run and writes no history", () => {
  withTempProject((dir, dataDir) => {
    const result = runCli(["preview", "修复这个 bug", "--json"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.engine, "host_model");
    assert.equal(payload.mode, "translate");
    assert.equal(payload.writes_history, false);
    assert.match(payload.notice, /Translated \(Chinese\): <natural English translation>/);
    assert.equal(records(dataDir).length, 0);
  });
});

test("help lists export command", () => {
  withTempProject((dir, dataDir) => {
    const result = runCli(["help"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /english-buddy export \[--date YYYY-MM-DD \| --days N \| --since YYYY-MM-DD --until YYYY-MM-DD\]/);
  });
});

test("export json includes only full-history records and counts limited records", () => {
  withTempProject((dir, dataDir) => {
    const date = today();
    writeHistory(dataDir, date, [
      {
        history_quality: "full",
        mode: "correct",
        original: "this tests failed",
        corrected: "these tests failed",
        annotations: [{ original: "this tests", corrected: "these tests", category: "grammar" }],
      },
      {
        history_quality: "full",
        mode: "refine",
        original: "fix auth, add test",
        corrected: "Fix the authentication bug and add a focused test.",
        annotations: "rough prompt refined",
      },
      {
        history_quality: "full",
        mode: "translate",
        original: "修复这个 bug",
        corrected: "Fix this bug.",
        annotations: "source language: Chinese",
      },
      {
        history_quality: "full",
        mode: "clean",
        original: "Please list the files.",
        corrected: null,
        annotations: null,
      },
      {
        history_quality: "limited",
        mode: "translate",
        engine: "host_model",
        original: "SECRET LIMITED PROMPT",
        corrected: null,
        annotations: null,
      },
    ]);

    const result = runCli(["export", "--since", date, "--until", date, "--format", "json", "--stdout"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /SECRET LIMITED PROMPT/);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.range.since, date);
    assert.equal(payload.range.until, date);
    assert.equal(payload.summary.total_records, 5);
    assert.equal(payload.summary.exported_full_records, 4);
    assert.equal(payload.summary.skipped_limited_records, 1);
    assert.deepEqual(payload.summary.by_mode, {
      correct: 1,
      refine: 1,
      translate: 1,
      clean: 1,
    });
    assert.deepEqual(payload.records.map((record) => record.mode), ["correct", "refine", "translate", "clean"]);
    assert.equal(payload.records[0].transformed, "these tests failed");
    assert.match(payload.records[0].annotations, /this tests -> these tests \(grammar\)/);
    assert.equal(payload.records[3].transformed, null);
  });
});

test("export --date selects exactly one day", () => {
  withTempProject((dir, dataDir) => {
    const date = today();
    const previousDate = addDays(date, -1);
    writeHistory(dataDir, previousDate, [
      {
        history_quality: "full",
        mode: "correct",
        original: "previous day prompt",
        corrected: "Previous-day prompt.",
        annotations: null,
      },
    ]);
    writeHistory(dataDir, date, [
      {
        history_quality: "full",
        mode: "translate",
        original: "导出今天的数据",
        corrected: "Export today's data.",
        annotations: "source language: Chinese",
      },
    ]);

    const result = runCli(["export", "--date", date, "--format", "json", "--stdout"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /previous day prompt/);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.range.since, date);
    assert.equal(payload.range.until, date);
    assert.equal(payload.range.days, null);
    assert.equal(payload.summary.total_records, 1);
    assert.equal(payload.summary.exported_full_records, 1);
    assert.equal(payload.records[0].original, "导出今天的数据");
    assert.equal(payload.records[0].transformed, "Export today's data.");
  });
});

test("export writes markdown to the plugin data exports directory by default", () => {
  withTempProject((dir, dataDir) => {
    const date = today();
    writeHistory(dataDir, date, [
      {
        history_quality: "full",
        mode: "correct",
        original: "this tests failed",
        corrected: "these tests failed",
        annotations: "this tests -> these tests (grammar)",
      },
    ]);

    const result = runCli(["export", "--since", date, "--until", date, "--format", "markdown"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/Export written: (.+\.md)/);
    assert.ok(match, result.stdout);
    const outputPath = match[1];
    assert.equal(path.dirname(outputPath), path.join(dataDir, "exports"));
    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /# Codex English Buddy Export/);
    assert.match(content, /Skipped limited records: 0/);
    assert.match(content, /these tests failed/);
  });
});

test("export refuses to overwrite explicit output unless forced", () => {
  withTempProject((dir, dataDir) => {
    const date = today();
    const output = path.join(dir, "export.md");
    fs.writeFileSync(output, "old\n", "utf8");
    writeHistory(dataDir, date, [
      {
        history_quality: "full",
        mode: "correct",
        original: "this tests failed",
        corrected: "these tests failed",
        annotations: null,
      },
    ]);

    const refused = runCli(["export", "--since", date, "--until", date, "--output", output], dir, dataDir);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /already exists/);
    assert.equal(fs.readFileSync(output, "utf8"), "old\n");

    const forced = runCli(["export", "--since", date, "--until", date, "--output", output, "--force"], dir, dataDir);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(fs.readFileSync(output, "utf8"), /# Codex English Buddy Export/);
  });
});

test("export csv escapes quotes, commas, and newlines and stdout writes no file", () => {
  withTempProject((dir, dataDir) => {
    const date = today();
    writeHistory(dataDir, date, [
      {
        history_quality: "full",
        mode: "correct",
        original: "He said, \"bad\"\nline",
        corrected: "He said, \"good\"\nline",
        annotations: "bad -> good (word-choice)",
      },
    ]);

    const result = runCli(["export", "--since", date, "--until", date, "--format", "csv", "--stdout"], dir, dataDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^ts,date,mode,engine,original,transformed,annotations,session\n/);
    assert.match(result.stdout, /"He said, ""bad""\nline"/);
    assert.match(result.stdout, /"He said, ""good""\nline"/);
    assert.equal(fs.existsSync(path.join(dataDir, "exports")), false);
  });
});

test("export validates date arguments", () => {
  withTempProject((dir, dataDir) => {
    const missingRangeEnd = runCli(["export", "--since", "2026-05-01", "--stdout"], dir, dataDir);

    assert.notEqual(missingRangeEnd.status, 0);
    assert.match(missingRangeEnd.stderr, /Use --since and --until together/);

    const invalidSingleDate = runCli(["export", "--date", "2026-02-30", "--stdout"], dir, dataDir);

    assert.notEqual(invalidSingleDate.status, 0);
    assert.match(invalidSingleDate.stderr, /--date must be a valid date/);

    const mixedWithDays = runCli(["export", "--date", "2026-05-28", "--days", "7", "--stdout"], dir, dataDir);

    assert.notEqual(mixedWithDays.status, 0);
    assert.match(mixedWithDays.stderr, /Use --date by itself/);

    const mixedWithRange = runCli(["export", "--date", "2026-05-28", "--since", "2026-05-01", "--until", "2026-05-28", "--stdout"], dir, dataDir);

    assert.notEqual(mixedWithRange.status, 0);
    assert.match(mixedWithRange.stderr, /Use --date by itself/);
  });
});

test("preview codex_cli returns preprocessor output without writing history", () => {
  withTempProject((dir, dataDir) => {
    const fakeCodex = path.join(dir, "codex");
    writeExecutable(fakeCodex, `#!/bin/sh
last_message=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then
    shift
    last_message="$1"
  fi
  shift
done
printf '%s\\n' '{"status":"ok","mode":"correct","transformed":"I saw the file.","annotations":[{"original":"seen","corrected":"saw","category":"grammar"}]}' > "$last_message"
`);
    fs.writeFileSync(
      path.join(dir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const result = spawnSync(process.execPath, [cli, "preview", "i seen the file", "--json"], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        CODEX_PLUGIN_DATA: dataDir,
        CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.engine, "codex_cli");
    assert.equal(payload.mode, "correct");
    assert.equal(payload.transformed, "I saw the file.");
    assert.equal(payload.writes_history, false);
    assert.deepEqual(payload.annotations, [
      { original: "seen", corrected: "saw", category: "grammar" },
    ]);
    assert.equal(records(dataDir).length, 0);
  });
});
