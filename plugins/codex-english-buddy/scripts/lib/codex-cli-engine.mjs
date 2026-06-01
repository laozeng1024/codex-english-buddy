// codex_cli preprocessor engine: calls public `codex exec` and captures
// structured prompt transformations for full-history records.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CODEX_CLI_ENGINE = "codex_cli";
export const CODEX_CLI_CHILD_ENV = "CODEX_ENGLISH_BUDDY_CHILD";
export const DEFAULT_CODEX_CLI_TIMEOUT_SEC = 45;

const VALID_MODES = new Set(["translate", "correct", "refine"]);
const VALID_STATUSES = new Set(["ok", "clean"]);

export function buildCodexCliPrompt({ mode, text, sourceLanguage, config = {} }) {
  const strictness = config.strictness || "standard";
  const terms = Array.isArray(config.domain_terms) && config.domain_terms.length > 0
    ? `\nPreserve these domain terms exactly: ${config.domain_terms.join(", ")}`
    : "";
  const modeInstruction = {
    translate: `Translate the input from ${sourceLanguage || "the detected source language"} into natural, idiomatic English.`,
    correct: "Correct spelling, grammar, punctuation, word choice, and awkward phrasing in the English input. If it is already natural English, return status clean and keep transformed identical to the input.",
    refine: "Rewrite the input into a clearer, precise, actionable English prompt for Codex.",
  }[mode];

  return [
    "You are the Codex English Buddy preprocessor.",
    "Return only one JSON object. Do not use Markdown or prose outside JSON.",
    "The JSON schema is:",
    '{"status":"ok|clean","mode":"translate|correct|refine","transformed":"string","source_language":"string|null","annotations":[{"original":"string","corrected":"string","category":"string|null"}]}',
    "",
    `Mode: ${mode}`,
    `Strictness: ${strictness}`,
    modeInstruction,
    "Preserve code identifiers, file paths, command names, product names, and the user's intent.",
    "Annotations must contain only real changed spans. Do not include no-op annotations.",
    "For translate and refine, use an empty annotations array.",
    "For correct, include concise categories such as spelling, grammar, punctuation, word choice, clarity, or tone.",
    terms,
    "",
    "Input:",
    text,
  ].filter(Boolean).join("\n");
}

export function buildCodexExecArgs({ prompt, model, outputLastMessagePath }) {
  const args = [
    "exec",
    "--disable", "hooks",
    "--disable", "plugin_hooks",
    "--disable", "plugins",
    "--ephemeral",
    "--sandbox", "read-only",
  ];
  if (outputLastMessagePath) args.push("--output-last-message", outputLastMessagePath);
  if (model) args.push("--model", model);
  args.push(prompt);
  return args;
}

export function parseCodexCliOutput(text, expectedMode, fallbackSourceLanguage) {
  const parsed = parseJsonObject(text);
  return normalizeCodexCliPayload(parsed, expectedMode, fallbackSourceLanguage);
}

export function runCodexCliPreprocessor({ mode, text, sourceLanguage, config = {}, cwd, env = process.env }) {
  if (!VALID_MODES.has(mode)) {
    return failure("unsupported_mode", `Unsupported codex_cli mode: ${mode}`);
  }
  if (env[CODEX_CLI_CHILD_ENV] === "1") {
    return failure("recursion_guard", "codex_cli skipped because recursion guard is active.");
  }

  const prompt = buildCodexCliPrompt({ mode, text, sourceLanguage, config });
  const binary = config.codex_cli_binary || env.CODEX_ENGLISH_BUDDY_CODEX_BIN || env.CODEX_BINARY || "codex";
  const timeoutSec = positiveInteger(config.codex_cli_timeout_sec, DEFAULT_CODEX_CLI_TIMEOUT_SEC);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-codex-cli-"));
  const outputLastMessagePath = path.join(tempDir, "last-message.txt");
  const args = buildCodexExecArgs({ prompt, model: config.codex_cli_model, outputLastMessagePath });
  const childEnv = {
    ...env,
    [CODEX_CLI_CHILD_ENV]: "1",
    CODEX_ENGLISH_BUDDY_RECURSION_GUARD: "1",
  };

  try {
    let result;
    try {
      result = spawnSync(binary, args, {
        cwd,
        env: childEnv,
        encoding: "utf8",
        timeout: timeoutSec * 1000,
        maxBuffer: 1024 * 1024,
      });
    } catch (error) {
      return failure("spawn_error", error.message, { binary, args });
    }

    if (result.error) {
      const reason = result.error.code === "ETIMEDOUT" ? "timeout" : "spawn_error";
      return failure(reason, result.error.message, { binary, args });
    }
    if (result.status !== 0) {
      return failure("nonzero_exit", trimMessage(result.stderr || result.stdout || `codex exited with status ${result.status}`), {
        binary,
        args,
        status: result.status,
        signal: result.signal,
      });
    }

    try {
      const output = safeReadText(outputLastMessagePath).trim() || result.stdout;
      return {
        ok: true,
        engine: CODEX_CLI_ENGINE,
        ...parseCodexCliOutput(output, mode, sourceLanguage),
        command: { binary, args },
      };
    } catch (error) {
      return failure("invalid_output", error.message, { binary, args });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function normalizeCodexCliPayload(value, expectedMode, fallbackSourceLanguage) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("codex_cli output was not a JSON object.");
  }

  const status = String(value.status || "ok").trim();
  if (!VALID_STATUSES.has(status)) throw new Error(`Invalid codex_cli status: ${status}`);
  const mode = String(value.mode || expectedMode).trim();
  if (mode !== expectedMode) throw new Error(`codex_cli mode mismatch: expected ${expectedMode}, got ${mode}`);
  if (status === "clean" && mode !== "correct") throw new Error("Only correct mode may return clean status.");

  const transformed = typeof value.transformed === "string" ? value.transformed.trim() : "";
  if (!transformed) throw new Error("codex_cli output did not include transformed text.");

  const rawAnnotations = Array.isArray(value.annotations) ? value.annotations : [];
  const annotations = rawAnnotations
    .map(normalizeAnnotation)
    .filter(Boolean);

  return {
    status,
    mode,
    transformed,
    sourceLanguage: typeof value.source_language === "string" && value.source_language.trim()
      ? value.source_language.trim()
      : fallbackSourceLanguage || null,
    annotations: mode === "correct" && status !== "clean" ? annotations : [],
  };
}

function normalizeAnnotation(item) {
  if (!item || typeof item !== "object") return null;
  const original = typeof item.original === "string" ? item.original.trim() : "";
  const corrected = typeof item.corrected === "string" ? item.corrected.trim() : "";
  if (!original || !corrected || original === corrected) return null;
  const category = typeof item.category === "string" && item.category.trim()
    ? item.category.trim()
    : null;
  return { original, corrected, category };
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("codex_cli produced empty output.");
  try {
    return JSON.parse(trimmed);
  } catch {}

  for (let start = trimmed.indexOf("{"); start !== -1; start = trimmed.indexOf("{", start + 1)) {
    const candidate = extractBalancedObject(trimmed, start);
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error("codex_cli output did not contain a parseable JSON object.");
}

function extractBalancedObject(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const ch = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeReadText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function failure(reason, message, extra = {}) {
  return {
    ok: false,
    engine: CODEX_CLI_ENGINE,
    reason,
    message: trimMessage(message),
    ...extra,
  };
}

function trimMessage(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
}
