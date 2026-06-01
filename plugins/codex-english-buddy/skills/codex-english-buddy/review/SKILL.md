---
name: review
description: "Deep English review for text, commit messages, PR descriptions, docs, emails, and comments. Use when the user invokes /codex-english-buddy:review or $codex-english-buddy:review."
version: 0.5.0-codex.6
interface:
  displayName: "codex-english-buddy:review"
  defaultPrompt: "Review English text with Codex English Buddy."
---

# Codex English Buddy Review

This skill is the skill-backed deep writing review entry point.

## When To Use

Use this skill when the user:

- invokes `/codex-english-buddy:review`
- invokes `$codex-english-buddy:review`
- asks for deep English review of text or a file
- asks to review commit messages, PR descriptions, docs, emails, or comments

## Required Workflow

Resolve the text to review. If the user supplied a file path, read that file. If the user supplied inline text, review that text. If no text is available, ask for the text.

Use the sibling `writing-guide` skill to decide which focused references apply. Preserve technical terms, code identifiers, paths, command names, product names, and the user's intent.

## Output Guidance

Return a concise English review with:

- overall quality
- corrected version
- table of real changes
- style suggestions only when they are useful
- one practical lesson

If the user is in Codex CLI and reports that `/codex-english-buddy:review` is unrecognized, explain that current CLI builds do not expose plugin command Markdown in the native slash menu; use `$codex-english-buddy:review` instead.
