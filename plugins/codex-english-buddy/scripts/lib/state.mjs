// Correction history — persists every correction for trend analysis and reports.
// Storage:
// - Codex:  $CODEX_PLUGIN_DATA/history/YYYY-MM-DD.jsonl

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PLUGIN_DATA_ENVS = ["CODEX_PLUGIN_DATA"];
const FALLBACK_DIR = path.join(os.tmpdir(), "codex-english-buddy");
const PROJECT_CONFIG_NAMES = [".codex-english-buddy.json"];
const GLOBAL_CONFIG_PATHS = [
  path.join(os.homedir(), ".codex", "codex-english-buddy", "config.json"),
];
export const HISTORY_QUALITY_FULL = "full";
export const HISTORY_QUALITY_LIMITED = "limited";
export const DEFAULT_ENGINE = "host_model";
export const CODEX_CLI_ENGINE = "codex_cli";
export const DEFAULT_CODEX_CLI_TIMEOUT_SEC = 45;

export function getDataDir() {
  const pluginData = PLUGIN_DATA_ENVS.map((name) => process.env[name]).find(Boolean);
  return pluginData
    ? path.join(pluginData, "history")
    : path.join(FALLBACK_DIR, "history");
}

export function getConfigPaths(cwd) {
  const root = cwd || process.cwd();
  return {
    project: PROJECT_CONFIG_NAMES.map((name) => path.join(root, name)),
    global: [...GLOBAL_CONFIG_PATHS],
  };
}

function ensureDataDir() {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function todayFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(ensureDataDir(), `${date}.jsonl`);
}

function dateFile(date) {
  return path.join(getDataDir(), `${date}.jsonl`);
}

export function logCorrection(entry) {
  const record = {
    ts: new Date().toISOString(),
    engine: entry.engine || "preprocessor",
    history_quality: entry.history_quality || HISTORY_QUALITY_FULL,
    mode: entry.mode,
    original: entry.original,
    corrected: entry.corrected,
    annotations: entry.annotations || null,
    pattern: entry.pattern || null,
    session: process.env.CODEX_SESSION_ID || null,
  };
  fs.appendFileSync(todayFile(), JSON.stringify(record) + "\n", "utf8");
  return record;
}

export function logLimitedEvent(entry) {
  const record = {
    ts: new Date().toISOString(),
    engine: entry.engine || DEFAULT_ENGINE,
    history_quality: HISTORY_QUALITY_LIMITED,
    mode: entry.mode,
    original: entry.original ?? null,
    corrected: null,
    annotations: null,
    pattern: null,
    detected_language: entry.detected_language || null,
    session: process.env.CODEX_SESSION_ID || null,
  };
  fs.appendFileSync(todayFile(), JSON.stringify(record) + "\n", "utf8");
  return record;
}

export function logClean(entry = {}) {
  const record = {
    ts: new Date().toISOString(),
    engine: entry.engine || "preprocessor",
    history_quality: entry.history_quality || HISTORY_QUALITY_FULL,
    mode: "clean",
    original: entry.original ?? null,
    corrected: null,
    annotations: null,
    pattern: null,
    session: process.env.CODEX_SESSION_ID || null,
  };
  fs.appendFileSync(todayFile(), JSON.stringify(record) + "\n", "utf8");
  return record;
}

export function readDay(date) {
  const file = dateFile(date);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

export function readToday() {
  const date = new Date().toISOString().slice(0, 10);
  return readDay(date);
}

export function readRange(startDate, endDate) {
  const records = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    records.push(...readDay(date));
  }
  return records;
}

export function readLastNDays(n) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (n - 1));
  return readRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
}

export function listHistoryDates() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => f.replace(".jsonl", ""))
    .sort();
}

// --- Project config ---

export function loadProjectConfig(cwd) {
  const root = cwd || process.cwd();
  const merged = {};
  for (const name of PROJECT_CONFIG_NAMES) {
    const configPath = path.join(root, name);
    if (!fs.existsSync(configPath)) continue;
    try {
      Object.assign(merged, JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch {}
  }
  return merged;
}

export function loadGlobalConfig() {
  if (process.env.CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG === "1") return {};
  const merged = {};
  for (const configPath of GLOBAL_CONFIG_PATHS) {
    if (!fs.existsSync(configPath)) continue;
    try {
      Object.assign(merged, JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch {}
  }
  return merged;
}

export function resolveConfig(cwd) {
  const global = loadGlobalConfig();
  const project = loadProjectConfig(cwd);
  const codexCliTimeout = positiveInteger(
    project.codex_cli_timeout_sec ?? global.codex_cli_timeout_sec,
    DEFAULT_CODEX_CLI_TIMEOUT_SEC,
  );
  return {
    engine: project.engine ?? global.engine ?? DEFAULT_ENGINE,
    auto_correct: project.auto_correct ?? global.auto_correct ?? true,
    show_transformed_prompt: project.show_transformed_prompt ?? global.show_transformed_prompt ?? "always",
    clean_english_notice: project.clean_english_notice ?? global.clean_english_notice ?? false,
    summary_language: project.summary_language ?? global.summary_language ?? null,
    strictness: project.strictness ?? global.strictness ?? "standard",
    codex_cli_model: project.codex_cli_model ?? global.codex_cli_model ?? null,
    codex_cli_timeout_sec: codexCliTimeout,
    codex_cli_binary: project.codex_cli_binary ?? global.codex_cli_binary ?? null,
    domain_terms: [
      ...(global.domain_terms || []),
      ...(project.domain_terms || []),
    ],
    sensitive_patterns: [
      ...(global.sensitive_patterns || []),
      ...(project.sensitive_patterns || []),
    ],
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
