---
name: mistakes
description: |
  Your top recurring English mistakes — all-time patterns that need attention.
  <example>
  Context: User wants the default top-20 all-time recurring mistakes.
  user: "/codex-english-buddy:mistakes"
  assistant: "Loading all-time correction history and ranking your top 20 recurring patterns by frequency."
  </example>
  <example>
  Context: User wants only the top 5 patterns to focus on.
  user: "/codex-english-buddy:mistakes --top 5"
  assistant: "Showing your top 5 recurring mistakes grouped by category with focus areas."
  </example>
argument-hint: "[--top N]"
allowed-tools: Bash, Glob, Read
---

## User Input

```text
$ARGUMENTS
```

## Workflow

### Step 1: Load all-time patterns

Parse `$ARGUMENTS` for `--top N` (default: 20).

```bash
sh "${CODEX_PLUGIN_ROOT:-.}/scripts/run-node.sh" "${CODEX_PLUGIN_ROOT:-.}/scripts/english-buddy.mjs" mistakes --json $ARGUMENTS
```

If the script fails, read JSONL files directly via Glob + Read and extract patterns manually.

If the JSON says `historyQuality` is `limited` or `patterns` is empty while `limitedRecords > 0`, respond that recurring mistakes are unavailable for limited host_model history. Do not infer mistakes from raw prompts.

### Step 2: Generate report

```markdown
# Recurring Mistakes

**Period**: All time ({total} prompts, {corrections} corrections)
**History quality**: {historyQuality}

## Top {topN} Patterns

| # | You Write | Should Be | Times | Category |
|---|-----------|-----------|------:|----------|
{for each pattern: | N | original | corrected | count | category |}

Categories: spelling, grammar (tense/agreement/structure), punctuation, word-choice, article, preposition

## Focus Areas

{Group the top patterns by category. For the top 3 categories:}

### {Category 1}: {count} total occurrences

{Explain the underlying rule with 2-3 examples from the user's actual mistakes.}

### {Category 2}: {count} total occurrences

{Same format.}

### {Category 3}: {count} total occurrences

{Same format.}
```
