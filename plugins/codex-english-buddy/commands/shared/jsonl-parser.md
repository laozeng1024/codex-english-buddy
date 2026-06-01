---
description: "Shared: correction-history JSONL format and parsing pattern"
user-invocable: false
---
<!-- Shared partial: JSONL parser -->
<!-- Referenced by: today, stats, mistakes, drill. Do not use standalone. -->

## Correction-History JSONL

Every UserPromptSubmit hook call appends one line to the day's JSONL file. The library functions in `scripts/lib/state.mjs` read and write this file. This partial documents the format so commands can fall back to raw parsing when the library is unavailable.

### File Layout

```text
$CODEX_PLUGIN_DATA/history/YYYY-MM-DD.jsonl
```

One file per calendar day. One JSON object per line. Files are append-only.

### Record Shape

Every record has these fields (some nullable):

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 string | Timestamp of the event |
| `engine` | string | Engine that produced the record, e.g. `host_model` |
| `history_quality` | `"limited"` / `"full"` | Whether the record contains actual transformed text and annotations |
| `mode` | `"correct"` / `"translate"` / `"refine"` / `"clean"` | Which hook branch fired |
| `original` | string or null | User's raw input (null for `clean`) |
| `corrected` | string or null | What a full-history preprocessor/capture path produced. Must be null for limited `host_model` records. |
| `annotations` | string or null | Diff string from a full-history path. Must be null for limited `host_model` records. Current format: one fix per line, `wrong → right (category)`, e.g. `its → it's (apostrophe)\nmodul → module (spelling)`. Legacy format still present in older files: `(its got>it has; modul>module)` |
| `pattern` | string or null | Dominant pattern label (optional) |
| `detected_language` | string or null | Lightweight detected language label for limited records |
| `session` | string or null | `CODEX_SESSION_ID` when the hook ran |

### Mode Semantics

| Mode | Meaning |
|------|---------|
| `correct` | English input should be checked. In limited `host_model` history, this is a check request, not proof that an error existed. |
| `translate` | Non-English input should be translated into English. In limited `host_model` history, exact translation is unavailable. |
| `refine` | `::` prefix — rough idea should be rewritten into a precise prompt. In limited `host_model` history, exact refinement is unavailable. |
| `clean` | English input with no errors. This is only valid when a full-history preprocessor/capture path actually verified the prompt. |

### Canonical Read Pattern

Prefer the library:

```bash
node -e "
  const root = process.env.CODEX_PLUGIN_ROOT || '.';
  const { readDay, readLastNDays, listHistoryDates } = await import(root + '/scripts/lib/state.mjs');
  console.log(JSON.stringify(readDay('2026-04-24')));
"
```

### Fallback Raw Read

When the library import fails (missing node_modules, wrong path), commands MUST be able to fall back to raw `Glob` + `Read`:

1. `Glob` the history dir: `$CODEX_PLUGIN_DATA/history/*.jsonl`
2. `Read` the target file(s).
3. Split by `\n`, filter empty lines, `JSON.parse` each line inside a `try/catch` (skip malformed lines).
4. Build the aggregate manually.

### Extracting Corrections

Within parsed records, full corrections are records with `history_quality === "full"` and `mode !== "clean"`. Limited `host_model` records are activity records only; do not count them as real corrections, and do not infer `corrected` or `annotations`.

Prefer the shared parser:

```js
const root = process.env.CODEX_PLUGIN_ROOT || ".";
const { parseAnnotations } = await import(`${root}/scripts/lib/annotations.mjs`);
const fixes = parseAnnotations(record.annotations); // [{ original, corrected, category }, ...]
```

The parser handles both the current `wrong → right (category)` multi-line format and the legacy `(a>b; c>d)` parenthetical format, suppresses no-op entries where `original === corrected`, and returns `[]` for translation records (whose annotation is a language tag, not a diff).

If the parser import fails, raw fallback rules:

- If the string contains ` → `, split on newlines, then match each line against `^(.+?) → (.+?)(?:\s*\((.+)\))?$`.
- Otherwise, if it starts with `(`, strip the surrounding parens, split on `;`, then split each pair on the FIRST `>`.

### Pattern Extraction for Reports

For stats and mistakes reports, aggregate by the `(original, corrected)` pair across records:

1. Iterate only `history_quality === "full"` records.
2. Call `parseAnnotations(record.annotations)` to get fix objects.
3. Count occurrences of each case-insensitive `original → corrected` pair.
4. Sort by count descending.
5. Use the embedded `category` when present; otherwise classify with heuristics (spelling, grammar, punctuation, word-choice, article, preposition).

### Extracting User Prompts

For drills, iterate only full `correct` records with non-empty `annotations`. The `original` field is the user's raw prompt; the `corrected` field is the fixed version. Combined with `annotations`, they form the full learning signal. If only limited `host_model` history exists, drills must report that recurring-mistake practice is unavailable instead of generating guessed exercises.
