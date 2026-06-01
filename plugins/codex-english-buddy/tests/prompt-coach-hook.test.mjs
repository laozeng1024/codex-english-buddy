import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = path.join(root, "scripts", "prompt-coach-hook.mjs");
const runner = path.join(root, "scripts", "run-node.sh");

function readRecords(dataDir) {
  const historyDir = path.join(dataDir, "history");
  if (!fs.existsSync(historyDir)) return [];
  return fs
    .readdirSync(historyDir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) => fs.readFileSync(path.join(historyDir, name), "utf8").trim().split("\n").filter(Boolean))
    .map((line) => JSON.parse(line));
}

function writeExecutable(file, text) {
  fs.writeFileSync(file, text, "utf8");
  fs.chmodSync(file, 0o755);
}

function withProjectConfig(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-hook-project-"));
  try {
    fs.writeFileSync(path.join(dir, ".codex-english-buddy.json"), JSON.stringify(config, null, 2), "utf8");
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runHook({ prompt, env = {}, cwd = root }) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ec-hook-test-"));
  try {
    const childEnv = {
      ...process.env,
      CODEX_PLUGIN_DATA: dataDir,
      CODEX_SESSION_ID: "test-session",
      CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
      ...env,
    };
    delete childEnv.OPENAI_API_KEY;
    delete childEnv.ANTHROPIC_API_KEY;

    const result = spawnSync("sh", [runner, hook], {
      cwd: root,
      input: JSON.stringify({
        cwd,
        hook_event_name: "UserPromptSubmit",
        model: "test",
        permission_mode: "default",
        prompt,
        session_id: "test-session",
        transcript_path: null,
        turn_id: "test-turn",
      }),
      encoding: "utf8",
      env: childEnv,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    return { output: result.stdout.trim() ? JSON.parse(result.stdout) : {}, records: readRecords(dataDir), stdout: result.stdout };
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test("UserPromptSubmit host_model correction emits instructions without model output", () => {
  const { output, records, stdout } = runHook({
    prompt: "i seen the file but its missing comma",
    env: {
      CODEX_ENGLISH_BUDDY_MOCK_RESPONSE: "SHOULD_NOT_APPEAR",
      OPENAI_API_KEY: "should-not-be-used",
      ANTHROPIC_API_KEY: "should-not-be-used",
    },
  });

  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /English Buddy: first show notice/);
  assert.match(output.hookSpecificOutput.additionalContext, /Corrected: <corrected English prompt>/);
  assert.ok(output.hookSpecificOutput.additionalContext.length < 240);
  assert.doesNotMatch(stdout, /SHOULD_NOT_APPEAR/);
  assert.equal(output.systemMessage, undefined);

  assert.equal(records.length, 1);
  assert.equal(records[0].engine, "host_model");
  assert.equal(records[0].history_quality, "limited");
  assert.equal(records[0].mode, "correct");
  assert.equal(records[0].original, "i seen the file but its missing comma");
  assert.equal(records[0].corrected, null);
  assert.equal(records[0].annotations, null);
});

test("UserPromptSubmit host_model translation emits additionalContext without API keys", () => {
  const { output, records } = runHook({
    prompt: "修复这个 bug",
  });

  assert.equal(output.additionalContext, undefined);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /Translated \(Chinese\): <natural English translation>/);
  assert.ok(output.hookSpecificOutput.additionalContext.length < 220);
  assert.equal(output.systemMessage, undefined);

  assert.equal(records.length, 1);
  assert.equal(records[0].engine, "host_model");
  assert.equal(records[0].history_quality, "limited");
  assert.equal(records[0].mode, "translate");
  assert.equal(records[0].corrected, null);
  assert.equal(records[0].annotations, null);
  assert.equal(records[0].detected_language, "Chinese");
});

test("UserPromptSubmit host_model refine emits limited history without fake corrections", () => {
  const { output, records } = runHook({
    prompt: ":: make this better",
  });

  assert.match(output.hookSpecificOutput.additionalContext, /Refined: <refined English prompt>/);
  assert.equal(records.length, 1);
  assert.equal(records[0].history_quality, "limited");
  assert.equal(records[0].mode, "refine");
  assert.equal(records[0].original, "make this better");
  assert.equal(records[0].corrected, null);
  assert.equal(records[0].annotations, null);
});

test("UserPromptSubmit skips fenced code and sensitive patterns without history", () => {
  const fenced = runHook({
    prompt: "```js\nconst token = 'abc';\n```",
  });
  assert.deepEqual(fenced.output, {});
  assert.equal(fenced.records.length, 0);

  withProjectConfig({ sensitive_patterns: ["SECRET_[A-Z0-9]+"] }, (projectDir) => {
    const sensitive = runHook({
      cwd: projectDir,
      prompt: "please review SECRET_ABC123 before release",
    });
    assert.deepEqual(sensitive.output, {});
    assert.equal(sensitive.records.length, 0);
  });
});

test("UserPromptSubmit codex_cli translation records full history from real preprocessor output", () => {
  withProjectConfig({}, (projectDir) => {
    const fakeCodex = path.join(projectDir, "codex");
    const envFile = path.join(projectDir, "child-env.txt");
    writeExecutable(fakeCodex, `#!/bin/sh
printf '%s\\n' "$CODEX_ENGLISH_BUDDY_CHILD" > "$FAKE_CODEX_ENV_FILE"
printf '%s\\n' '{"status":"ok","mode":"translate","transformed":"Fix this bug.","source_language":"Chinese","annotations":[]}'
`);
    fs.writeFileSync(
      path.join(projectDir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const { output, records } = runHook({
      cwd: projectDir,
      prompt: "修复这个 bug",
      env: { FAKE_CODEX_ENV_FILE: envFile },
    });

    const context = output.hookSpecificOutput.additionalContext;
    assert.match(context, /Translated \(Chinese\): Fix this bug\./);
    assert.match(context, /transformed English request: Fix this bug\./);
    assert.doesNotMatch(context, /codex_cli/);
    assert.doesNotMatch(context, /host_model fallback/);
    assert.equal(fs.readFileSync(envFile, "utf8").trim(), "1");

    assert.equal(records.length, 1);
    assert.equal(records[0].engine, "codex_cli");
    assert.equal(records[0].history_quality, "full");
    assert.equal(records[0].mode, "translate");
    assert.equal(records[0].original, "修复这个 bug");
    assert.equal(records[0].corrected, "Fix this bug.");
    assert.equal(records[0].annotations, "(Chinese)");
  });
});

test("UserPromptSubmit codex_cli correction stores actual annotations only", () => {
  withProjectConfig({}, (projectDir) => {
    const fakeCodex = path.join(projectDir, "codex");
    writeExecutable(fakeCodex, `#!/bin/sh
printf '%s\\n' '{"status":"ok","mode":"correct","transformed":"I saw the file, but it is missing a comma.","annotations":[{"original":"seen","corrected":"saw","category":"grammar"},{"original":"file","corrected":"file","category":"noop"}]}'
`);
    fs.writeFileSync(
      path.join(projectDir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const { output, records } = runHook({
      cwd: projectDir,
      prompt: "i seen the file but it is missing a comma",
    });

    assert.match(output.hookSpecificOutput.additionalContext, /Corrected: I saw the file, but it is missing a comma\./);
    assert.equal(records.length, 1);
    assert.equal(records[0].engine, "codex_cli");
    assert.equal(records[0].history_quality, "full");
    assert.equal(records[0].mode, "correct");
    assert.equal(records[0].corrected, "I saw the file, but it is missing a comma.");
    assert.match(records[0].annotations, /seen/);
    assert.match(records[0].annotations, /saw/);
    assert.doesNotMatch(records[0].annotations, /noop/);
  });
});

test("UserPromptSubmit codex_cli clean prompt is quiet by default but still records full clean history", () => {
  withProjectConfig({}, (projectDir) => {
    const fakeCodex = path.join(projectDir, "codex");
    writeExecutable(fakeCodex, `#!/bin/sh
printf '%s\\n' '{"status":"clean","mode":"correct","transformed":"Refactor the authentication module.","annotations":[]}'
`);
    fs.writeFileSync(
      path.join(projectDir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const { output, records } = runHook({
      cwd: projectDir,
      prompt: "Refactor the authentication module.",
    });

    assert.deepEqual(output, {});
    assert.equal(records.length, 1);
    assert.equal(records[0].engine, "codex_cli");
    assert.equal(records[0].history_quality, "full");
    assert.equal(records[0].mode, "clean");
    assert.equal(records[0].original, "Refactor the authentication module.");
    assert.equal(records[0].corrected, null);
    assert.equal(records[0].annotations, null);
  });
});

test("UserPromptSubmit codex_cli clean prompt can show configured clean notice", () => {
  withProjectConfig({}, (projectDir) => {
    const fakeCodex = path.join(projectDir, "codex");
    writeExecutable(fakeCodex, `#!/bin/sh
printf '%s\\n' '{"status":"clean","mode":"correct","transformed":"Refactor the authentication module.","annotations":[]}'
`);
    fs.writeFileSync(
      path.join(projectDir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        clean_english_notice: true,
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const { output, records } = runHook({
      cwd: projectDir,
      prompt: "Refactor the authentication module.",
    });

    assert.match(output.hookSpecificOutput.additionalContext, /English check: no correction needed\./);
    assert.equal(records.length, 1);
    assert.equal(records[0].mode, "clean");
  });
});

test("UserPromptSubmit codex_cli failure falls back to host_model limited history", () => {
  withProjectConfig({}, (projectDir) => {
    const fakeCodex = path.join(projectDir, "codex");
    writeExecutable(fakeCodex, `#!/bin/sh
printf '%s\\n' 'intentional failure' >&2
exit 2
`);
    fs.writeFileSync(
      path.join(projectDir, ".codex-english-buddy.json"),
      JSON.stringify({
        engine: "codex_cli",
        codex_cli_binary: fakeCodex,
        codex_cli_timeout_sec: 5,
      }),
      "utf8",
    );

    const { output, records } = runHook({
      cwd: projectDir,
      prompt: "i seen the file but its missing comma",
    });

    const context = output.hookSpecificOutput.additionalContext;
    assert.match(context, /codex_cli preprocessing failed \(nonzero_exit\)/);
    assert.match(context, /limited host_model fallback/);
    assert.match(context, /Corrected: <corrected English prompt>/);
    assert.equal(records.length, 1);
    assert.equal(records[0].engine, "host_model");
    assert.equal(records[0].history_quality, "limited");
    assert.equal(records[0].corrected, null);
    assert.equal(records[0].annotations, null);
  });
});
