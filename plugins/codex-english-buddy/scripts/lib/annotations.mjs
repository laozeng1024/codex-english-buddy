// Annotation parsing — handles both the legacy `(a>b; c>d)` format and the
// newer multi-line `a → b (reason)` format. The hook writes the new format;
// the legacy format remains in older JSONL files that must keep being
// readable by stats/today/mistakes/session-end consumers.

const ARROW = " → ";

// Parse an annotation string into a list of { original, corrected, category }.
// Returns [] for nullish/empty input or for translation-mode annotations
// (which carry a source-language tag like "(Chinese)", not diff pairs).
export function parseAnnotations(annotations) {
  if (!annotations || typeof annotations !== "string") return [];
  const trimmed = annotations.trim();
  if (!trimmed) return [];

  if (trimmed.includes(ARROW)) return parseArrowFormat(trimmed);
  if (trimmed.startsWith("(") && trimmed.includes(">")) return parseLegacyFormat(trimmed);
  return [];
}

function parseArrowFormat(text) {
  const out = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^\s*[-•*]\s*/, "").trim();
    if (!line) continue;
    const match = line.match(/^(.+?)\s*→\s*(.+?)(?:\s*\(([^)]+)\))?\s*$/);
    if (!match) continue;
    const original = match[1].trim();
    const corrected = match[2].trim();
    if (!original || !corrected) continue;
    if (original === corrected) continue; // suppress no-op entries
    out.push({ original, corrected, category: match[3]?.trim() || null });
  }
  return out;
}

function parseLegacyFormat(text) {
  const inner = text.replace(/^\(/, "").replace(/\)$/, "");
  const out = [];
  for (const rawFix of inner.split(";")) {
    const fix = rawFix.trim();
    if (!fix) continue;
    const idx = fix.indexOf(">");
    if (idx === -1) continue;
    const original = fix.slice(0, idx).trim();
    const corrected = fix.slice(idx + 1).trim();
    if (!original || !corrected) continue;
    if (original === corrected) continue;
    out.push({ original, corrected, category: null });
  }
  return out;
}

// Render a parsed annotation list back to the storage format (one line per
// fix). Used when the hook normalizes Haiku output before persisting.
export function formatAnnotationsForStorage(items) {
  return items
    .map(({ original, corrected, category }) => {
      const tail = category ? ` (${category})` : "";
      return `${original}${ARROW}${corrected}${tail}`;
    })
    .join("\n");
}

// Render a parsed annotation list for display under the corrected sentence.
// Bullets are added here, not stored in JSONL.
export function formatAnnotationsForDisplay(items, { indent = "  " } = {}) {
  return items
    .map(({ original, corrected, category }) => {
      const tail = category ? `   (${category})` : "";
      return `${indent}• ${original}${ARROW}${corrected}${tail}`;
    })
    .join("\n");
}
