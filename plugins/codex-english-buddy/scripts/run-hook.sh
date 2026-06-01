#!/usr/bin/env sh
set -eu

if [ -n "${CODEX_PLUGIN_ROOT:-}" ]; then
  ROOT="$CODEX_PLUGIN_ROOT"
else
  SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
fi
DEBUG_DIR="${CODEX_ENGLISH_BUDDY_DEBUG_DIR:-$HOME/.codex/codex-english-buddy}"
if ! mkdir -p "$DEBUG_DIR" 2>/dev/null; then
  DEBUG_DIR="${TMPDIR:-/tmp}/codex-english-buddy"
  mkdir -p "$DEBUG_DIR" 2>/dev/null || true
fi
DEBUG_FILE="$DEBUG_DIR/hook-debug.log"
if ! { : >> "$DEBUG_FILE"; } 2>/dev/null; then
  DEBUG_DIR="${TMPDIR:-/tmp}/codex-english-buddy"
  mkdir -p "$DEBUG_DIR" 2>/dev/null || true
  DEBUG_FILE="$DEBUG_DIR/hook-debug.log"
fi
if { : >> "$DEBUG_FILE"; } 2>/dev/null; then
  printf '%s phase=run-hook-start root=%s script=%s argc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ROOT" "${1:-}" "$#" >> "$DEBUG_FILE" 2>/dev/null || true
fi

if [ "$#" -lt 1 ]; then
  echo "usage: run-hook.sh <hook-script> [args...]" >&2
  exit 2
fi

HOOK_SCRIPT="$1"
shift

exec /bin/sh "$ROOT/scripts/run-node.sh" "$HOOK_SCRIPT" "$@"
