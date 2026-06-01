#!/usr/bin/env node
// Codex-friendly CLI helpers for reports and configuration.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { detectMode } from "./lib/detect.mjs";
import { formatAnnotationsForDisplay } from "./lib/annotations.mjs";
import { CODEX_CLI_ENGINE, runCodexCliPreprocessor } from "./lib/codex-cli-engine.mjs";
import { getDataDir, readDay, readRange, resolveConfig } from "./lib/state.mjs";
import { renderDoctorMarkdown, runDoctor } from "./lib/doctor.mjs";
import { buildHostVerificationMatrix, renderHostVerificationMarkdown } from "./lib/host-verification.mjs";
import {
  allTimeStats,
  buildDrillPlan,
  periodStats,
  recordHistoryQuality,
  todayStats,
  trendVerdict,
  weeklyTrend,
} from "./lib/stats.mjs";

const PROJECT_CONFIG_NAME = ".codex-english-buddy.json";

function flagValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function numericFlag(args, name, fallback) {
  const raw = flagValue(args, name);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function wantsJson(args) {
  return args.includes("--json");
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

function oneLine(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function hasLimitedHistory(stats) {
  return stats.historyQuality === "limited" && stats.limitedRecords > 0;
}

function limitedNotice(stats) {
  if (stats?.patterns?.length > 0) {
    return "History quality: limited. Reports use captured full-history correction pairs where available; limited host_model records are excluded from exact corrections, recurring-mistake patterns, and drills.";
  }
  return "History quality: limited. host_model records prompt categories only; exact corrected text, annotations, recurring mistakes, and drills require a full-history engine.";
}

function dateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(raw, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ""))) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new Error(`${label} must be a valid date.`);
  }
  return raw;
}

function addUtcDays(dateText, delta) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dateOnly(date);
}

function normalizeExportFormat(raw) {
  const format = String(raw || "markdown").toLowerCase();
  if (format === "md") return "markdown";
  if (["markdown", "csv", "json"].includes(format)) return format;
  throw new Error("Unsupported export format. Use markdown, csv, or json.");
}

function exportExtension(format) {
  if (format === "markdown") return "md";
  return format;
}

function parseExportRange(args) {
  const dateFlagPresent = args.includes("--date");
  const dateRaw = flagValue(args, "--date");
  const sinceFlagPresent = args.includes("--since");
  const untilFlagPresent = args.includes("--until");
  const sinceRaw = flagValue(args, "--since");
  const untilRaw = flagValue(args, "--until");
  const daysFlagPresent = args.includes("--days");
  if (dateFlagPresent) {
    if (!dateRaw) throw new Error("--date must use YYYY-MM-DD.");
    if (daysFlagPresent || sinceFlagPresent || untilFlagPresent) {
      throw new Error("Use --date by itself, or use --days, or use --since and --until.");
    }
    const date = parseIsoDate(dateRaw, "--date");
    return { since: date, until: date, days: null };
  }
  if (sinceFlagPresent || untilFlagPresent) {
    if (!sinceRaw || !untilRaw) throw new Error("Use --since and --until together.");
    const since = parseIsoDate(sinceRaw, "--since");
    const until = parseIsoDate(untilRaw, "--until");
    if (since > until) throw new Error("--since must be earlier than or equal to --until.");
    return { since, until, days: null };
  }
  const days = numericFlag(args, "--days", 30);
  const until = dateOnly();
  const since = addUtcDays(until, -(days - 1));
  return { since, until, days };
}

function getExportDir() {
  return path.join(path.dirname(getDataDir()), "exports");
}

function annotationsText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object") {
        const original = item.original ?? "";
        const corrected = item.corrected ?? "";
        const category = item.category ? ` (${item.category})` : "";
        return `${original} -> ${corrected}${category}`;
      }
      return String(item ?? "");
    }).filter(Boolean).join("\n");
  }
  return value == null ? "" : String(value);
}

function exportableRecord(record) {
  const mode = record.mode || "clean";
  const transformed = mode === "clean" ? null : record.corrected ?? null;
  return {
    ts: record.ts || null,
    date: record.ts ? String(record.ts).slice(0, 10) : null,
    mode,
    engine: record.engine || null,
    original: record.original ?? null,
    transformed,
    annotations: annotationsText(record.annotations),
    session: record.session || null,
  };
}

function buildExportPayload(args) {
  const format = normalizeExportFormat(flagValue(args, "--format", "markdown"));
  const range = parseExportRange(args);
  const records = readRange(range.since, range.until);
  const exportedRecords = [];
  let skippedLimited = 0;
  for (const record of records) {
    if (recordHistoryQuality(record) !== "full") {
      skippedLimited += 1;
      continue;
    }
    const mode = record.mode || "clean";
    if (!["correct", "refine", "translate", "clean"].includes(mode)) continue;
    exportedRecords.push(exportableRecord(record));
  }
  const byMode = { correct: 0, refine: 0, translate: 0, clean: 0 };
  for (const record of exportedRecords) {
    byMode[record.mode] = (byMode[record.mode] || 0) + 1;
  }
  return {
    generated_at: new Date().toISOString(),
    range,
    summary: {
      total_records: records.length,
      exported_full_records: exportedRecords.length,
      skipped_limited_records: skippedLimited,
      by_mode: byMode,
      format,
    },
    records: exportedRecords,
  };
}

function markdownFence(value) {
  const text = value == null || value === "" ? "(empty)" : String(value);
  let fence = "```";
  while (text.includes(fence)) fence += "`";
  return `${fence}\n${text}\n${fence}`;
}

function renderExportMarkdown(payload) {
  const lines = [];
  lines.push("# Codex English Buddy Export");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Generated at: ${payload.generated_at}`);
  lines.push(`- Range: ${payload.range.since} to ${payload.range.until}`);
  if (payload.range.days) lines.push(`- Days: ${payload.range.days}`);
  lines.push(`- Total records scanned: ${payload.summary.total_records}`);
  lines.push(`- Exported full records: ${payload.summary.exported_full_records}`);
  lines.push(`- Skipped limited records: ${payload.summary.skipped_limited_records}`);
  lines.push("");
  lines.push("## Records");
  if (payload.records.length === 0) {
    lines.push("");
    lines.push("No full-history records were available in this range.");
    return lines.join("\n") + "\n";
  }
  payload.records.forEach((record, index) => {
    lines.push("");
    lines.push(`### Record ${index + 1}`);
    lines.push("");
    lines.push(`- Time: ${record.ts || ""}`);
    lines.push(`- Mode: ${record.mode}`);
    lines.push(`- Engine: ${record.engine || ""}`);
    lines.push(`- Session: ${record.session || ""}`);
    lines.push("");
    lines.push("Original:");
    lines.push("");
    lines.push(markdownFence(record.original));
    lines.push("");
    lines.push("Transformed:");
    lines.push("");
    lines.push(markdownFence(record.mode === "clean" ? "No change" : record.transformed));
    if (record.annotations) {
      lines.push("");
      lines.push("Annotations:");
      lines.push("");
      lines.push(markdownFence(record.annotations));
    }
  });
  return lines.join("\n") + "\n";
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function renderExportCsv(payload) {
  const rows = [["ts", "date", "mode", "engine", "original", "transformed", "annotations", "session"]];
  for (const record of payload.records) {
    rows.push([
      record.ts,
      record.date,
      record.mode,
      record.engine,
      record.original,
      record.mode === "clean" ? "No change" : record.transformed,
      record.annotations,
      record.session,
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function renderExportContent(payload, format) {
  if (format === "json") return JSON.stringify(payload, null, 2) + "\n";
  if (format === "csv") return renderExportCsv(payload);
  return renderExportMarkdown(payload);
}

function nextExportPath(range, format) {
  const dir = getExportDir();
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const base = `english-buddy-export-${range.since}_${range.until}-${timestamp}`;
  const ext = exportExtension(format);
  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `-${index}`;
    const candidate = path.join(dir, `${base}${suffix}.${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Could not allocate a unique export filename.");
}

function resolveExportPath(args, payload, format) {
  const output = flagValue(args, "--output");
  if (output) return path.resolve(process.cwd(), output);
  return nextExportPath(payload.range, format);
}

function renderExport(args) {
  const payload = buildExportPayload(args);
  const format = payload.summary.format;
  const content = renderExportContent(payload, format);
  if (args.includes("--stdout")) {
    process.stdout.write(content);
    return;
  }

  const outputPath = resolveExportPath(args, payload, format);
  const force = args.includes("--force");
  if (fs.existsSync(outputPath) && !force) {
    throw new Error(`Export output already exists: ${outputPath}. Use --force to overwrite.`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
  process.stdout.write([
    `Export written: ${outputPath}`,
    `Exported full records: ${payload.summary.exported_full_records}`,
    `Skipped limited records: ${payload.summary.skipped_limited_records}`,
  ].join("\n") + "\n");
}

function renderLimitedActivity(lines, records) {
  if (records.length === 0) return;
  lines.push("");
  lines.push("## Limited Activity");
  lines.push("");
  lines.push("| # | Mode | Original | Detected Language |");
  lines.push("|---:|---|---|---|");
  records.forEach((record, index) => {
    lines.push(`| ${index + 1} | ${record.mode || ""} | ${oneLine(record.original)} | ${record.detected_language || ""} |`);
  });
}

function renderWeeklyTrend(lines, trend) {
  lines.push("");
  lines.push("## Weekly Trend");
  lines.push("");
  lines.push("| Week | Prompts | Full Corrections | Error Rate |");
  lines.push("|---|---:|---:|---:|");
  for (const week of trend) {
    lines.push(`| ${week.weekStart} - ${week.weekEnd} | ${week.total} | ${week.corrections} | ${week.errorRate}% |`);
  }
  const verdict = trendVerdict(trend);
  lines.push("");
  lines.push(verdict.message);
}

function renderFocusAreas(lines, focusAreas) {
  lines.push("");
  lines.push("## Focus Areas");
  if (!focusAreas || focusAreas.length === 0) {
    lines.push("");
    lines.push("No focus areas available yet.");
    return;
  }
  lines.push("");
  lines.push("| Category | Count | Share | Top Pattern |");
  lines.push("|---|---:|---:|---|");
  for (const area of focusAreas.slice(0, 3)) {
    const pattern = area.topPattern ? `${area.topPattern.original} -> ${area.topPattern.corrected}` : "";
    lines.push(`| ${area.category} | ${area.count} | ${area.share}% | ${pattern} |`);
  }
}

function renderLessons(lines, lessons) {
  lines.push("");
  lines.push("## Lessons of the Day");
  if (!lessons || lessons.length === 0) {
    lines.push("");
    lines.push("No full correction pairs available for lessons yet.");
    return;
  }
  lines.push("");
  lessons.forEach((lesson, index) => {
    lines.push(`${index + 1}. **${lesson.pattern}** - ${lesson.rule}`);
    lines.push(`   Wrong: "${lesson.original}"`);
    lines.push(`   Right: "${lesson.corrected}"`);
  });
}

function renderToday(args) {
  const date = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  const yRecords = readDay(yesterdayDate);
  const yTotal = yRecords.length;
  const yFullRecords = yRecords.filter((record) => recordHistoryQuality(record) === "full");
  const yCorrections = yFullRecords.filter((record) => record.mode !== "clean").length;
  const payload = {
    today: todayStats(),
    yesterday: {
      total: yTotal,
      corrections: yCorrections,
      errorRate: yFullRecords.length > 0 ? Math.round((yCorrections / yFullRecords.length) * 100) : 0,
    },
    week: periodStats(7),
    trend: weeklyTrend(4),
  };
  payload.verdict = trendVerdict(payload.trend);

  if (wantsJson(args)) return printJson(payload);
  if (payload.today.total === 0) {
    process.stdout.write("No prompts processed today yet.\n");
    return;
  }

  const lines = [];
  lines.push(`# Today's Language Report - ${date}`);
  lines.push("");
  lines.push(`**History quality**: ${payload.today.historyQuality}`);
  if (hasLimitedHistory(payload.today)) {
    lines.push("");
    lines.push(limitedNotice(payload.today));
  }
  lines.push("");
  lines.push("| Metric | Today | Yesterday | 7-day avg |");
  lines.push("|---|---:|---:|---:|");
  lines.push(`| Prompts | ${payload.today.total} | ${payload.yesterday.total} | ${Math.round(payload.week.total / 7)} |`);
  lines.push(`| Full correction records | ${payload.today.corrections} (${payload.today.errorRate}%) | ${payload.yesterday.corrections} (${payload.yesterday.errorRate}%) | ${Math.round(payload.week.corrections / 7)} (${payload.week.errorRate}%) |`);
  lines.push(`| English check requests | ${payload.today.correctionRequests} | - | - |`);
  lines.push(`| Translations | ${payload.today.translations} | - | - |`);
  lines.push(`| Clean prompts | ${payload.today.clean} | - | - |`);
  lines.push(`| Refinements | ${payload.today.refinements} | - | - |`);
  lines.push("");
  lines.push("## Today's Corrections");
  if (payload.today.fullCorrectionRecords.length === 0) {
    lines.push("");
    lines.push(hasLimitedHistory(payload.today)
      ? "No full correction records are available today. Limited host_model records do not contain corrected text or annotations."
      : "No corrections recorded today.");
  } else {
    lines.push("");
    lines.push("| # | You Wrote | Corrected | Fixes |");
    lines.push("|---:|---|---|---|");
    payload.today.fullCorrectionRecords.forEach((record, index) => {
      const fixes = oneLine(record.annotations).replaceAll("\n", "<br>");
      lines.push(`| ${index + 1} | ${oneLine(record.original)} | ${oneLine(record.corrected)} | ${fixes} |`);
    });
  }
  renderLimitedActivity(lines, payload.today.limitedActivityRecords);
  lines.push("");
  lines.push("## Top Patterns");
  if (payload.today.patterns.length === 0) {
    lines.push("");
    lines.push(hasLimitedHistory(payload.today)
      ? "Recurring patterns are unavailable for limited history because no real correction pairs were captured."
      : "No recurring patterns yet.");
  } else {
    lines.push("");
    lines.push("| Pattern | Count | Category |");
    lines.push("|---|---:|---|");
    for (const pattern of payload.today.patterns.slice(0, 10)) {
      lines.push(`| ${pattern.original} -> ${pattern.corrected} | ${pattern.count} | ${pattern.category || ""} |`);
    }
  }
  renderLessons(lines, payload.today.lessons);
  renderWeeklyTrend(lines, payload.trend);
  process.stdout.write(lines.join("\n") + "\n");
}

function renderStats(args) {
  const days = numericFlag(args, "--days", 30);
  const payload = { days, stats: periodStats(days), trend: weeklyTrend(Math.ceil(days / 7)) };
  payload.verdict = trendVerdict(payload.trend);
  if (wantsJson(args)) return printJson(payload);

  const lines = [];
  lines.push(`# Language Stats - Last ${days} Days`);
  lines.push("");
  lines.push(`**History quality**: ${payload.stats.historyQuality}`);
  if (hasLimitedHistory(payload.stats)) {
    lines.push("");
    lines.push(limitedNotice(payload.stats));
  }
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  lines.push(`| Total prompts | ${payload.stats.total} |`);
  lines.push(`| Full correction records | ${payload.stats.corrections} (${payload.stats.errorRate}%) |`);
  lines.push(`| English check requests | ${payload.stats.correctionRequests} |`);
  lines.push(`| Translations | ${payload.stats.translations} |`);
  lines.push(`| Refinements | ${payload.stats.refinements} |`);
  lines.push(`| Clean prompts | ${payload.stats.clean} |`);
  lines.push("");
  lines.push("## Top Recurring Mistakes");
  lines.push("");
  if (payload.stats.recurringPatterns.length === 0) {
    lines.push(hasLimitedHistory(payload.stats)
      ? "Unavailable for limited history. Enable a full-history engine before using recurring-mistake statistics."
      : payload.stats.patterns.length > 0
        ? "No recurring mistakes found yet. Captured one-off correction pairs need to appear more than once before they are called recurring."
        : "No recurring mistakes found yet.");
  } else {
    lines.push("| # | You Write | Should Be | Times | Category |");
    lines.push("|---:|---|---|---:|---|");
    payload.stats.recurringPatterns.slice(0, 10).forEach((pattern, index) => {
      lines.push(`| ${index + 1} | ${pattern.original} | ${pattern.corrected} | ${pattern.count} | ${pattern.category || ""} |`);
    });
  }
  renderWeeklyTrend(lines, payload.trend);
  lines.push("");
  lines.push("## Analysis");
  lines.push("");
  lines.push(payload.verdict.message);
  renderFocusAreas(lines, payload.stats.focusAreas);
  process.stdout.write(lines.join("\n") + "\n");
}

function renderMistakes(args) {
  const topN = numericFlag(args, "--top", 20);
  const stats = allTimeStats();
  const payload = {
    ...stats,
    topN,
    patterns: stats.recurringPatterns.slice(0, topN),
    capturedPatterns: stats.patterns.filter((pattern) => pattern.count <= 1).slice(0, topN),
  };
  if (wantsJson(args)) return printJson(payload);

  const lines = [];
  lines.push("# Recurring Mistakes");
  lines.push("");
  lines.push(`**History quality**: ${payload.historyQuality}`);
  if (hasLimitedHistory(payload)) {
    lines.push("");
    lines.push(limitedNotice(payload));
  }
  lines.push("");
  lines.push(`Period: all time (${payload.total} prompts, ${payload.corrections} corrections)`);
  lines.push("");
  if (payload.patterns.length === 0) {
    lines.push(hasLimitedHistory(payload)
      ? "Recurring mistakes are unavailable because limited host_model history does not include actual correction pairs."
      : payload.capturedPatterns.length > 0
        ? "No recurring mistakes found yet. Captured one-off correction pairs need to appear more than once before they are called recurring."
        : "No recurring mistakes found yet.");
  } else {
    lines.push("| # | You Write | Should Be | Times | Category |");
    lines.push("|---:|---|---|---:|---|");
    payload.patterns.forEach((pattern, index) => {
      lines.push(`| ${index + 1} | ${pattern.original} | ${pattern.corrected} | ${pattern.count} | ${pattern.category || ""} |`);
    });
    renderFocusAreas(lines, payload.focusAreas);
  }
  if (payload.patterns.length === 0 && payload.capturedPatterns.length > 0) {
    lines.push("");
    lines.push("## Captured One-Off Mistakes");
    lines.push("");
    lines.push("| # | You Wrote | Should Be | Category |");
    lines.push("|---:|---|---|---|");
    payload.capturedPatterns.forEach((pattern, index) => {
      lines.push(`| ${index + 1} | ${pattern.original} | ${pattern.corrected} | ${pattern.category || ""} |`);
    });
  }
  process.stdout.write(lines.join("\n") + "\n");
}

function renderDrill(args) {
  const rounds = numericFlag(args, "--rounds", 3);
  const category = flagValue(args, "--category", null);
  const payload = buildDrillPlan({ rounds, category });
  if (wantsJson(args)) return printJson(payload);

  if (!payload.available) {
    process.stdout.write(`${payload.reason}\n`);
    return;
  }

  const lines = [];
  lines.push(`# Drill - ${payload.rounds.length} Round${payload.rounds.length === 1 ? "" : "s"}`);
  for (const round of payload.rounds) {
    lines.push("");
    lines.push(`## Round ${round.round} - Category: ${round.category}`);
    lines.push("");
    lines.push(`Your recurring pattern: **${round.pattern}** (seen ${round.count} times)`);
    lines.push("");
    lines.push("### The Sentence");
    lines.push("");
    lines.push(`> ${round.sentence}`);
    lines.push("");
    lines.push("Rewrite this sentence to fix the target error.");
    lines.push("");
    lines.push(`Expected target fix: \`${round.original}\` -> \`${round.corrected}\``);
    lines.push(`Rule: ${round.rule}`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}

function renderDoctor(args) {
  const payload = runDoctor({ cwd: process.cwd() });
  if (wantsJson(args)) return printJson(payload);
  process.stdout.write(renderDoctorMarkdown(payload));
}

function renderVerifyHosts(args) {
  const doctor = runDoctor({ cwd: process.cwd() });
  const payload = buildHostVerificationMatrix({ doctorReport: doctor });
  if (wantsJson(args)) return printJson(payload);
  process.stdout.write(renderHostVerificationMarkdown(payload));
}

function previewNotice(result) {
  if (result.mode === "translate") return `Translated (${result.sourceLanguage || "non-English"}): ${result.transformed}`;
  if (result.mode === "refine") return `Refined: ${result.transformed}`;
  if (result.status === "clean") return "English check: no correction needed.";
  return `Corrected: ${result.transformed}`;
}

function hostModelPreview(detection, config) {
  const mode = detection.mode;
  const source = detection.language || "non-English";
  const notice = mode === "translate"
    ? `Translated (${source}): <natural English translation>`
    : mode === "refine"
      ? "Refined: <refined English prompt>"
      : "Corrected: <corrected English prompt>";
  return {
    ok: true,
    engine: "host_model",
    history_quality_if_submitted: "limited",
    mode,
    input: detection.text,
    notice,
    transformed: null,
    annotations: [],
    dry_run: true,
    writes_history: false,
    note: config.auto_correct === false
      ? "auto_correct is disabled, but preview still shows what the hook would classify."
      : "host_model preview is instruction-only; the active Codex model would produce the exact transformed text during the real turn.",
  };
}

function codexCliPreview(detection, config) {
  const result = runCodexCliPreprocessor({
    mode: detection.mode,
    text: detection.text,
    sourceLanguage: detection.language || null,
    config,
    cwd: process.cwd(),
    env: process.env,
  });
  if (!result.ok) {
    return {
      ...hostModelPreview(detection, config),
      engine: "host_model",
      requested_engine: CODEX_CLI_ENGINE,
      fallback_reason: result.reason,
      note: `codex_cli preview failed (${result.reason}); showing host_model dry-run instructions instead.`,
    };
  }
  return {
    ok: true,
    engine: CODEX_CLI_ENGINE,
    history_quality_if_submitted: result.status === "clean" ? "full" : "full",
    mode: result.mode,
    status: result.status,
    input: detection.text,
    notice: previewNotice(result),
    transformed: result.transformed,
    annotations: result.annotations || [],
    sourceLanguage: result.sourceLanguage || null,
    dry_run: true,
    writes_history: false,
    note: "codex_cli preview ran the preprocessor but did not write JSONL history.",
  };
}

function buildPreview(args) {
  const text = args.filter((arg) => arg !== "--json").join(" ").trim();
  if (!text) throw new Error("Use preview <text>.");
  const config = resolveConfig(process.cwd());
  const detection = detectMode(text, { sensitive_patterns: config.sensitive_patterns });
  if (detection.mode === "skip") {
    return {
      ok: true,
      skipped: true,
      engine: config.engine,
      input: text,
      dry_run: true,
      writes_history: false,
      note: "Input is skipped by hook filtering, so a real submission would not add English Buddy context or history.",
    };
  }
  if (detection.mode === "refine" && !detection.text) throw new Error("Nothing to refine. Provide text after ::.");
  if (config.engine === CODEX_CLI_ENGINE) return codexCliPreview(detection, config);
  return hostModelPreview(detection, config);
}

function renderPreview(args) {
  const payload = buildPreview(args);
  if (wantsJson(args)) return printJson(payload);

  const lines = [];
  lines.push("# Preview - Dry Run");
  lines.push("");
  lines.push("This preview does not submit the prompt and does not write JSONL history.");
  lines.push("");
  lines.push(`Engine: ${payload.engine}${payload.requested_engine ? ` (fallback from ${payload.requested_engine})` : ""}`);
  lines.push(`History if submitted: ${payload.history_quality_if_submitted || "none"}`);
  if (payload.skipped) {
    lines.push("");
    lines.push(payload.note);
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }
  lines.push(`Mode: ${payload.mode}`);
  lines.push("");
  lines.push("Expected first line:");
  lines.push("");
  lines.push(`> ${payload.notice}`);
  if (payload.transformed) {
    lines.push("");
    lines.push("## Transformed Prompt");
    lines.push("");
    lines.push(payload.transformed);
  }
  if (payload.annotations?.length > 0) {
    lines.push("");
    lines.push("## Annotations");
    lines.push("");
    lines.push(formatAnnotationsForDisplay(payload.annotations, { indent: "" }));
  }
  lines.push("");
  lines.push(payload.note);
  process.stdout.write(lines.join("\n") + "\n");
}

function parseConfigValue(key, raw) {
  if (key === "engine") return raw;
  if (key === "codex_cli_model") return raw === "null" || raw === "none" ? null : raw;
  if (key === "codex_cli_binary") return raw === "null" || raw === "none" ? null : raw;
  if (key === "codex_cli_timeout_sec") {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("codex_cli_timeout_sec must be a positive integer.");
    return parsed;
  }
  if (key === "show_transformed_prompt") return raw;
  if (key === "clean_english_notice") return raw === "true";
  if (key === "auto_correct") return raw === "true";
  if (key === "summary_language") return raw === "null" || raw === "none" ? null : raw;
  if (key === "strictness") return raw;
  if (key === "domain_terms") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (key === "sensitive_patterns") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  throw new Error(`Unsupported config key: ${key}`);
}

function showConfig() {
  printJson(resolveConfig(process.cwd()));
}

function setConfig(args) {
  const raw = flagValue(args, "--set");
  if (!raw || !raw.includes("=")) {
    throw new Error("Use --set key=value.");
  }
  const [key, ...rest] = raw.split("=");
  const value = parseConfigValue(key, rest.join("="));
  const configPath = path.join(process.cwd(), PROJECT_CONFIG_NAME);
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf8"))
    : {};
  config[key] = value;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  process.stdout.write(`Set ${key} in ${PROJECT_CONFIG_NAME}\n`);
  showConfig();
}

function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "doctor") return renderDoctor(args);
  if (command === "verify-hosts") return renderVerifyHosts(args);
  if (command === "today") return renderToday(args);
  if (command === "stats") return renderStats(args);
  if (command === "mistakes") return renderMistakes(args);
  if (command === "drill") return renderDrill(args);
  if (command === "export") return renderExport(args);
  if (command === "preview") return renderPreview(args);
  if (command === "config" && args.includes("--set")) return setConfig(args);
  if (command === "config" || command === "show-config") return showConfig();

  process.stdout.write(`Usage:
  english-buddy doctor [--json]
  english-buddy verify-hosts [--json]
  english-buddy today [--json]
  english-buddy stats [--days N] [--json]
  english-buddy mistakes [--top N] [--json]
  english-buddy drill [--rounds N] [--category name] [--json]
  english-buddy export [--date YYYY-MM-DD | --days N | --since YYYY-MM-DD --until YYYY-MM-DD] [--format markdown|csv|json] [--output file] [--stdout] [--force]
  english-buddy preview <text> [--json]
  english-buddy config [--set key=value]

Supported config keys:
  engine=host_model|codex_cli
  codex_cli_model=model-name|null
  codex_cli_binary=/path/to/codex|null
  codex_cli_timeout_sec=45
  show_transformed_prompt=always
  clean_english_notice=true|false
  auto_correct=true|false
  summary_language=Chinese|null
  strictness=gentle|standard|strict
  domain_terms=TermA,TermB
  sensitive_patterns=secret,password,token
`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
