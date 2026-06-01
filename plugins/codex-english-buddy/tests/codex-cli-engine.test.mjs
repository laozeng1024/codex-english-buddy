import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  CODEX_CLI_CHILD_ENV,
  buildCodexExecArgs,
  parseCodexCliOutput,
  runCodexCliPreprocessor,
} from "../scripts/lib/codex-cli-engine.mjs";

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-codex-cli-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeExecutable(file, text) {
  fs.writeFileSync(file, text, "utf8");
  fs.chmodSync(file, 0o755);
}

test("buildCodexExecArgs disables hooks and uses safe codex exec options", () => {
  const args = buildCodexExecArgs({ prompt: "prompt text", model: "test-model", outputLastMessagePath: "/tmp/last-message.txt" });
  assert.deepEqual(args.slice(0, 10), [
    "exec",
    "--disable", "hooks",
    "--disable", "plugin_hooks",
    "--disable", "plugins",
    "--ephemeral",
    "--sandbox", "read-only",
  ]);
  assert.ok(args.includes("--output-last-message"));
  assert.ok(args.includes("/tmp/last-message.txt"));
  assert.ok(args.includes("--model"));
  assert.ok(args.includes("test-model"));
  assert.equal(args.at(-1), "prompt text");
});

test("parseCodexCliOutput extracts structured correction data", () => {
  const result = parseCodexCliOutput(
    'note\n{"status":"ok","mode":"correct","transformed":"I saw the file.","annotations":[{"original":"seen","corrected":"saw","category":"grammar"},{"original":"file","corrected":"file","category":"noop"}]}',
    "correct",
    null,
  );

  assert.equal(result.status, "ok");
  assert.equal(result.mode, "correct");
  assert.equal(result.transformed, "I saw the file.");
  assert.deepEqual(result.annotations, [
    { original: "seen", corrected: "saw", category: "grammar" },
  ]);
});

test("runCodexCliPreprocessor calls fake codex with recursion guard env", () => {
  withTempDir((dir) => {
    const fakeCodex = path.join(dir, "codex");
    const envFile = path.join(dir, "env.txt");
    writeExecutable(fakeCodex, `#!/bin/sh
last_message=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then
    shift
    last_message="$1"
  fi
  shift
done
printf '%s\\n' "$${CODEX_CLI_CHILD_ENV}" > "$FAKE_CODEX_ENV_FILE"
printf '%s\\n' '{"status":"ok","mode":"translate","transformed":"Fix this bug.","source_language":"Chinese","annotations":[]}' > "$last_message"
printf '%s\\n' 'non-json stdout should be ignored when last-message file exists'
`);

    const result = runCodexCliPreprocessor({
      mode: "translate",
      text: "修复这个 bug",
      sourceLanguage: "Chinese",
      cwd: dir,
      config: {
        codex_cli_binary: fakeCodex,
        codex_cli_model: "test-model",
        codex_cli_timeout_sec: 5,
      },
      env: {
        ...process.env,
        FAKE_CODEX_ENV_FILE: envFile,
      },
    });

    assert.equal(result.ok, true, result.message);
    assert.equal(result.transformed, "Fix this bug.");
    assert.equal(result.sourceLanguage, "Chinese");
    assert.equal(fs.readFileSync(envFile, "utf8").trim(), "1");
    assert.deepEqual(result.command.args.slice(0, 10), [
      "exec",
      "--disable", "hooks",
      "--disable", "plugin_hooks",
      "--disable", "plugins",
      "--ephemeral",
      "--sandbox", "read-only",
    ]);
    assert.ok(result.command.args.includes("--output-last-message"));
  });
});

test("runCodexCliPreprocessor skips child recursion", () => {
  const result = runCodexCliPreprocessor({
    mode: "correct",
    text: "i seen it",
    env: { [CODEX_CLI_CHILD_ENV]: "1" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "recursion_guard");
});
