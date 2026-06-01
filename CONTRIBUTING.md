# Contributing

Thanks for helping improve Codex English Buddy.

## Development Setup

```bash
git clone https://github.com/laozeng1024/codex-english-buddy.git
cd codex-english-buddy/plugins/codex-english-buddy
npm test
npm run validate:codex
```

Use Node.js `>=18.18.0`. Do not commit local `.codex-english-buddy.json`, `.env` files, plugin cache output, debug logs, or prompt history.

## Pull Requests

- Keep changes scoped to the plugin behavior or docs being improved.
- Add or update tests for behavior changes.
- Preserve the providerless `host_model` default.
- Do not write guessed corrections or annotations to history.
- Do not add local absolute paths to public docs.
- Do not claim Desktop or CLI support unless it has been verified and recorded.

## Release Checks

Before opening a release PR, run:

```bash
cd plugins/codex-english-buddy
npm test
npm run validate:codex
```
