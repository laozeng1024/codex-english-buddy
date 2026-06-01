#!/usr/bin/env node
// SessionEnd hook — show a brief session summary of corrections made.

import process from "node:process";
import { readToday } from "./lib/state.mjs";
import { parseAnnotations } from "./lib/annotations.mjs";
import { recordHistoryQuality } from "./lib/stats.mjs";

function main() {
  const records = readToday();
  if (records.length === 0) return;

  const corrections = records.filter((r) => r.mode === "correct");
  const fullCorrections = corrections.filter((r) => recordHistoryQuality(r) === "full");
  const translations = records.filter((r) => r.mode === "translate");
  const refinements = records.filter((r) => r.mode === "refine");
  const clean = records.filter((r) => r.mode === "clean");
  const limited = records.filter((r) => recordHistoryQuality(r) === "limited");
  const total = records.length;

  if (corrections.length === 0 && translations.length === 0 && refinements.length === 0) return;

  const parts = [];
  parts.push(`Session language stats: ${total} prompts`);
  if (fullCorrections.length > 0) parts.push(`${fullCorrections.length} full corrections`);
  if (corrections.length > fullCorrections.length) parts.push(`${corrections.length - fullCorrections.length} English check requests`);
  if (translations.length > 0) parts.push(`${translations.length} translations`);
  if (refinements.length > 0) parts.push(`${refinements.length} refinements`);
  if (clean.length > 0) parts.push(`${clean.length} clean`);
  if (limited.length > 0) parts.push(`${limited.length} limited-history`);

  process.stderr.write(parts.join(", ") + "\n");

  if (limited.length > 0 && fullCorrections.length === 0) {
    process.stderr.write("Recurring mistakes unavailable for limited host_model history.\n");
    return;
  } else if (limited.length > 0) {
    process.stderr.write("Limited host_model records excluded from recurring-mistake analysis.\n");
  }

  // Find recurring mistakes in this session — bucket by case-insensitive
  // (original, corrected) pair so "Its" and "its" count together.
  const fixes = {};
  for (const r of fullCorrections) {
    for (const fix of parseAnnotations(r.annotations)) {
      const key = `${fix.original.toLowerCase()}|${fix.corrected.toLowerCase()}`;
      const entry = fixes[key] || { label: `${fix.original} → ${fix.corrected}`, count: 0 };
      entry.count += 1;
      fixes[key] = entry;
    }
  }

  const recurring = Object.values(fixes)
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count);

  if (recurring.length > 0) {
    process.stderr.write(
      "Recurring this session: " +
        recurring.map((entry) => `${entry.label} (${entry.count}x)`).join(", ") +
        "\n",
    );
  }
}

main();
