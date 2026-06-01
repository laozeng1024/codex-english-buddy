---
name: today
description: |
  Today's language report — corrections made, recurring mistakes, lessons, and improvement trend.
  <example>
  Context: User wants a quick summary of the corrections made during today's session.
  user: "/codex-english-buddy:today"
  assistant: "Loading today's correction history and comparing against yesterday and the 7-day average."
  </example>
  <example>
  Context: User wants to widen the window beyond just today.
  user: "/codex-english-buddy:today --days 3"
  assistant: "Generating a report covering the last 3 days of prompts, corrections, and recurring patterns."
  </example>
argument-hint: "[--days N]"
allowed-tools: Bash, Glob, Read
---

## Workflow

### Step 1: Load today's stats and comparison data

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" today --json
```

Parse the JSON output. If `today.total` is 0: respond "No prompts processed today yet." and STOP.

If `today.historyQuality` is `limited`, state this near the top of the report:

```text
History quality is limited. host_model records prompt categories only, so exact corrected text, annotations, recurring mistakes, and drills are unavailable until a full-history engine is enabled.
```

If the script fails (module not found, node error, etc.), read the JSONL files directly:
1. Use Glob to find `$CODEX_PLUGIN_DATA/history/*.jsonl`
2. Read today's file with Read tool
3. Count records manually and build the report from raw data

### Step 2: Generate report

```markdown
# Today's Language Report — {today.date}

## Overview

| Metric | Today | Yesterday | 7-day avg |
|--------|------:|----------:|----------:|
| Prompts | {today.total} | {yesterday.total} | {week.total / 7 rounded} |
| Full correction records | {today.corrections} ({today.errorRate}%) | {yesterday.corrections} ({yesterday.errorRate}%) | {week.corrections / 7 rounded} ({week.errorRate}%) |
| English check requests | {today.correctionRequests} | — | — |
| Translations | {today.translations} | — | — |
| Clean prompts | {today.clean} | — | — |
| Refinements (::) | {today.refinements} | — | — |

## Today's Corrections

| # | You Wrote | Corrected | Fixes |
|---|-----------|-----------|-------|
{for each record in today.records: | N | original | corrected | fixes |}
{where `fixes` is the record's annotations joined into one cell — if annotations is multi-line `wrong → right (category)`, replace newlines with `<br>` so the table renders; if it is the legacy `(a>b; c>d)` form, render it verbatim}

If only limited records are available, do not render a fake corrections table. Instead list limited activity by mode/original/detected language and say corrected text was not captured.

## Recurring Patterns

| Pattern | Count Today | Status |
|---------|:-----------:|--------|
{for each pattern with count > 1: | `original → corrected` | count | comment |}

If `today.patterns` is empty because history is limited, say recurring patterns are unavailable for limited history. Do not infer patterns from `original`.

## Lessons of the Day

{Pick 2-3 corrections using this ranking, in order: (1) highest pattern frequency today (count desc); tie-break by (2) pattern also appears in 2+ prior sessions (broad applicability); tie-break by (3) category priority: grammar > article > preposition > word-choice > punctuation > spelling. For each:}

1. **{pattern name}** — {explanation of the rule}
   Wrong: "{original}"
   Right: "{corrected}"

## Trend

| Week | Error Rate | Corrections/Day |
|------|:----------:|:---------------:|
{for each week in trend: | weekStart — weekEnd | errorRate% | avgPerDay |}

{If error rate is decreasing: "You're improving. Error rate down {delta}% in {weeks} weeks."}
{If error rate is flat: "Holding steady. Focus on your recurring patterns to break through."}
{If error rate is increasing: "Error rate is up — try to slow down and re-read before submitting."}
```
