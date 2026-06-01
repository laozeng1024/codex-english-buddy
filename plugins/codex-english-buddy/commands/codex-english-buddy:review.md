---
name: codex-english-buddy:review
description: "Alias for /review: deep English review of text, docs, commit messages, or PR descriptions."
argument-hint: "<text or file path>"
allowed-tools: Bash, Read, AskUserQuestion
---

Resolve the input like `/review`: use inline text directly, read a file path when provided, or ask for text when empty.

Then produce a deep English review with:

- corrected version
- issues table
- tone and clarity notes
- concise recommendation
