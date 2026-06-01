# Security Policy

## Supported Versions

Security fixes are targeted at the latest public release of `codex-english-buddy`.

## Reporting A Vulnerability

Please report security issues privately through GitHub's security advisory flow for:

<https://github.com/laozeng1024/codex-english-buddy>

If GitHub advisories are unavailable, open an issue with a minimal description and ask for a private follow-up path. Do not include secrets, tokens, or private prompt text in public issues.

## Data Handling

The default `host_model` engine does not call a separate model provider from the hook. The optional `codex_cli` engine runs the user's local Codex CLI in an ephemeral child process. Local history and configuration stay on the user's filesystem.
