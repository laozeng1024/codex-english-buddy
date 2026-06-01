// Trend analysis — compute stats from correction history.

import { listHistoryDates, readDay, readToday, readLastNDays } from "./state.mjs";
import { parseAnnotations } from "./annotations.mjs";
import { HISTORY_QUALITY_FULL, HISTORY_QUALITY_LIMITED } from "./state.mjs";

function countByMode(records) {
  const counts = { correct: 0, translate: 0, refine: 0, clean: 0 };
  for (const r of records) {
    const mode = r.mode || "clean";
    counts[mode] = (counts[mode] || 0) + 1;
  }
  return counts;
}

export function recordHistoryQuality(record) {
  if (record.history_quality === HISTORY_QUALITY_LIMITED) return HISTORY_QUALITY_LIMITED;
  if (record.history_quality === HISTORY_QUALITY_FULL) return HISTORY_QUALITY_FULL;

  // Legacy records predate history_quality. Treat records with actual
  // preprocessor output as full, and records without output as limited.
  if (record.mode === "clean" || record.corrected || record.annotations) {
    return HISTORY_QUALITY_FULL;
  }
  return HISTORY_QUALITY_LIMITED;
}

function isFullRecord(record) {
  return recordHistoryQuality(record) === HISTORY_QUALITY_FULL;
}

function summarizeHistoryQuality(records) {
  if (records.length === 0) return "none";
  return records.some((record) => recordHistoryQuality(record) === HISTORY_QUALITY_LIMITED)
    ? HISTORY_QUALITY_LIMITED
    : HISTORY_QUALITY_FULL;
}

function qualityBreakdown(records) {
  let full = 0;
  let limited = 0;
  for (const record of records) {
    if (isFullRecord(record)) full += 1;
    else limited += 1;
  }
  return { full, limited };
}

function canonicalCategory(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("article")) return "article";
  if (value.includes("preposition")) return "preposition";
  if (value.includes("word") || value.includes("phrasing")) return "word-choice";
  if (value.includes("spell") || value.includes("typo")) return "spelling";
  if (value.includes("punct") || value.includes("comma") || value.includes("apostrophe")) return "punctuation";
  return "grammar";
}

function extractPatterns(records) {
  const patterns = {};
  for (const r of records) {
    if (!isFullRecord(r)) continue;
    if (r.mode === "translate") continue; // translate annotations carry a language tag, not diff pairs
    const fixes = parseAnnotations(r.annotations);
    for (const fix of fixes) {
      const key = `${fix.original.toLowerCase()}\u0000${fix.corrected.toLowerCase()}`;
      const entry = patterns[key] || {
        original: fix.original,
        corrected: fix.corrected,
        count: 0,
        category: fix.category || "grammar",
        rawCategory: fix.category || null,
        examples: [],
      };
      entry.count += 1;
      // Prefer the most-recent category label when present.
      if (fix.category) {
        entry.rawCategory = fix.category;
        entry.category = fix.category;
      }
      if (r.original && entry.examples.length < 3) {
        entry.examples.push({
          original: r.original,
          corrected: r.corrected || null,
          ts: r.ts || null,
        });
      }
      patterns[key] = entry;
    }
  }
  return Object.values(patterns).sort((a, b) => b.count - a.count);
}

function recurringOnly(patterns) {
  return patterns.filter((pattern) => pattern.count > 1);
}

function recordsStats(records, extra = {}) {
  const fullRecords = records.filter(isFullRecord);
  const breakdown = qualityBreakdown(records);
  const total = records.length;
  const counts = countByMode(records);
  const corrections = fullRecords.filter((record) => record.mode !== "clean").length;
  const errorRate = fullRecords.length > 0 ? Math.round((corrections / fullRecords.length) * 100) : 0;
  const patterns = extractPatterns(records);
  const recurringPatterns = recurringOnly(patterns);

  return {
    ...extra,
    historyQuality: summarizeHistoryQuality(records),
    fullRecords: breakdown.full,
    limitedRecords: breakdown.limited,
    total,
    corrections,
    correctionRequests: counts.correct,
    clean: counts.clean,
    translations: counts.translate,
    refinements: counts.refine,
    errorRate,
    patterns,
    recurringPatterns,
  };
}

export function focusAreas(patterns) {
  const grouped = {};
  for (const pattern of patterns) {
    const category = canonicalCategory(pattern.category);
    const entry = grouped[category] || { category, count: 0, topPattern: null };
    entry.count += pattern.count;
    if (!entry.topPattern || pattern.count > entry.topPattern.count) {
      entry.topPattern = pattern;
    }
    grouped[category] = entry;
  }
  const total = Object.values(grouped).reduce((sum, item) => sum + item.count, 0);
  return Object.values(grouped)
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      ...item,
      share: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
}

function lessonRule(category) {
  switch (canonicalCategory(category)) {
    case "article":
      return "Use articles like `a`, `an`, and `the` when a singular countable noun needs one.";
    case "preposition":
      return "Use the preposition that matches the relationship, not a literal translation from another language.";
    case "word-choice":
      return "Choose the idiomatic word or phrase a developer would naturally use in this context.";
    case "punctuation":
      return "Small punctuation changes can alter clarity, especially around contractions and clauses.";
    case "spelling":
      return "Fix spelling and capitalization early because these are easy, repeated quality wins.";
    default:
      return "Keep tense, agreement, and sentence structure consistent with the intended meaning.";
  }
}

export function lessonsFromPatterns(patterns, limit = 3) {
  return patterns
    .filter((pattern) => pattern.count > 0)
    .slice()
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const priority = { grammar: 0, article: 1, preposition: 2, "word-choice": 3, punctuation: 4, spelling: 5 };
      return (priority[canonicalCategory(a.category)] ?? 99) - (priority[canonicalCategory(b.category)] ?? 99);
    })
    .slice(0, limit)
    .map((pattern) => ({
      pattern: `${pattern.original} → ${pattern.corrected}`,
      original: pattern.original,
      corrected: pattern.corrected,
      category: canonicalCategory(pattern.category),
      count: pattern.count,
      rule: lessonRule(pattern.category),
    }));
}

export function trendVerdict(trend) {
  const active = trend.filter((week) => week.fullRecords > 0);
  if (active.length < 2) {
    return { status: "insufficient", delta: 0, message: "Not enough full-history weekly data for a trend verdict." };
  }
  const first = active[0].errorRate;
  const last = active[active.length - 1].errorRate;
  const delta = last - first;
  if (delta <= -5) {
    return { status: "improving", delta, message: `Improving - error rate down ${Math.abs(delta)}% over ${active.length} active weeks.` };
  }
  if (delta >= 5) {
    return { status: "regressing", delta, message: `Regressing - error rate up ${delta}% over ${active.length} active weeks.` };
  }
  return { status: "flat", delta, message: "Flat - focus on recurring patterns to break through." };
}

export function readAllRecords() {
  return listHistoryDates().flatMap((date) => readDay(date));
}

export function todayStats() {
  const records = readToday();
  const base = recordsStats(records);
  const fullRecords = records.filter(isFullRecord);

  return {
    ...base,
    date: new Date().toISOString().slice(0, 10),
    recurringPatterns: base.recurringPatterns,
    lessons: lessonsFromPatterns(base.patterns),
    focusAreas: focusAreas(base.patterns),
    records: records.filter((r) => r.mode !== "clean"),
    fullCorrectionRecords: fullRecords.filter((r) => r.mode !== "clean"),
    limitedActivityRecords: records.filter((r) => !isFullRecord(r)),
  };
}

export function periodStats(days) {
  const records = readLastNDays(days);
  const stats = recordsStats(records, { days });
  return {
    ...stats,
    focusAreas: focusAreas(stats.recurringPatterns),
  };
}

export function allTimeStats() {
  const records = readAllRecords();
  const stats = recordsStats(records, { days: "all" });
  return {
    ...stats,
    focusAreas: focusAreas(stats.recurringPatterns),
  };
}

export function weeklyTrend(weeks = 4) {
  const trend = [];
  const now = new Date();
  for (let w = 0; w < weeks; w++) {
    const end = new Date(now);
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const records = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      records.push(...readDay(date));
    }

    const total = records.length;
    const fullRecords = records.filter(isFullRecord);
    const breakdown = qualityBreakdown(records);
    const counts = countByMode(records);
    const corrections = fullRecords.filter((record) => record.mode !== "clean").length;
    const errorRate = fullRecords.length > 0 ? Math.round((corrections / fullRecords.length) * 100) : 0;
    const avgPerDay = total > 0 ? Math.round((corrections / 7) * 10) / 10 : 0;

    trend.push({
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
      historyQuality: summarizeHistoryQuality(records),
      fullRecords: breakdown.full,
      limitedRecords: breakdown.limited,
      total,
      corrections,
      errorRate,
      avgPerDay,
    });
  }
  return trend.reverse();
}

export function buildDrillPlan({ topN = 50, rounds = 3, category = null } = {}) {
  const stats = allTimeStats();
  const normalizedCategory = category ? canonicalCategory(category) : null;
  const patterns = stats.recurringPatterns
    .filter((pattern) => !normalizedCategory || canonicalCategory(pattern.category) === normalizedCategory)
    .slice(0, topN);

  if (patterns.length === 0 && stats.limitedRecords > 0) {
    return {
      available: false,
      reason: "Drill is unavailable for limited host_model history because no actual correction pairs were captured.",
      stats,
      rounds: [],
    };
  }

  if (stats.corrections < 5 || patterns.length === 0) {
    return {
      available: false,
      reason: "Not enough recurring full-history correction patterns yet to drill.",
      stats,
      rounds: [],
    };
  }

  const safeRounds = Math.max(1, Math.min(rounds, 10));
  const selected = [];
  const focus = focusAreas(patterns).slice(0, 3);
  const categoryOrder = normalizedCategory ? [normalizedCategory] : focus.map((area) => area.category);
  for (let i = 0; i < safeRounds; i++) {
    const targetCategory = categoryOrder[i % Math.max(categoryOrder.length, 1)] || patterns[0].category;
    const pattern = patterns.find((item) => canonicalCategory(item.category) === targetCategory) || patterns[i % patterns.length];
    const sentence = `Please update the PR description because ${pattern.original} still appears in the release notes.`;
    selected.push({
      round: i + 1,
      category: canonicalCategory(pattern.category),
      pattern: `${pattern.original} → ${pattern.corrected}`,
      original: pattern.original,
      corrected: pattern.corrected,
      count: pattern.count,
      sentence,
      expected: sentence.replace(pattern.original, pattern.corrected),
      rule: lessonRule(pattern.category),
    });
  }

  return {
    available: true,
    reason: null,
    stats,
    focusAreas: focus,
    rounds: selected,
  };
}
