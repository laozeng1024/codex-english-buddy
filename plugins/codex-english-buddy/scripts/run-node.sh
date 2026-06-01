#!/bin/sh
set -eu

NODE_BIN="${CODEX_NODE:-}"
if [ -z "$NODE_BIN" ] && [ -x /Applications/Codex.app/Contents/Resources/node ]; then
  NODE_BIN=/Applications/Codex.app/Contents/Resources/node
fi

NODE_BIN="${NODE_BIN:-node}"
MIN_NODE_VERSION="${CODEX_ENGLISH_BUDDY_MIN_NODE_VERSION:-18.18.0}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "codex-english-buddy requires Node.js >=${MIN_NODE_VERSION}; no usable node binary was found. Set CODEX_NODE to a compatible Node.js binary." >&2
  exit 127
fi

if ! "$NODE_BIN" -e '
var min = (process.env.CODEX_ENGLISH_BUDDY_MIN_NODE_VERSION || "18.18.0").split(".").map(Number);
var got = process.versions.node.split(".").map(Number);
var ok = got[0] > min[0] || got[0] === min[0] && (got[1] > min[1] || got[1] === min[1] && got[2] >= min[2]);
if (!ok) {
  console.error("codex-english-buddy requires Node.js >=" + min.join(".") + "; found " + process.versions.node + ". Set CODEX_NODE to a compatible Node.js binary.");
  process.exit(1);
}
' >&2; then
  exit 1
fi

exec "$NODE_BIN" "$@"
