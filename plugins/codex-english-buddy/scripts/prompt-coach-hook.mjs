#!/usr/bin/env node
// UserPromptSubmit hook — providerless host-model prompt coaching by default,
// with optional codex_cli preprocessor mode for full-history records.

import fs from "node:fs";
import process from "node:process";

import { detectMode } from "./lib/detect.mjs";
import { formatAnnotationsForStorage } from "./lib/annotations.mjs";
import { CODEX_CLI_ENGINE, CODEX_CLI_CHILD_ENV, runCodexCliPreprocessor } from "./lib/codex-cli-engine.mjs";
import {
  DEFAULT_ENGINE,
  HISTORY_QUALITY_FULL,
  logClean,
  logCorrection,
  logLimitedEvent,
  resolveConfig,
} from "./lib/state.mjs";

function readStdin() {
  return JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
}

let hookEventName = "UserPromptSubmit";

function emit(obj) {
  const { additionalContext, ...rest } = obj;
  obj = rest;
  if (additionalContext) {
    obj.hookSpecificOutput = {
      hookEventName,
      additionalContext,
    };
  }
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function appendSummaryContext(ctx, summaryCtx) {
  return summaryCtx ? `${ctx}\n\n${summaryCtx}` : ctx;
}

function buildSummaryContext(config) {
  if (!config.summary_language) return "";
  return `After your response, add a brief summary in ${config.summary_language} under a --- separator. Summarize the key points, actions taken, and decisions made. Keep it concise (2-5 sentences). Label it: **${config.summary_language} Summary**`;
}

function baseHostModelInstruction() {
  return "English Buddy: first show notice, then answer using transformed English; preserve terms/code/paths/commands/intent.";
}

function fallbackPrefix(failure) {
  if (!failure) return "";
  const reason = failure.reason || "unknown";
  return `English Buddy codex_cli preprocessing failed (${reason}); using limited host_model fallback. `;
}

function translationContext(detection) {
  const source = detection.language || "non-English";
  return `${baseHostModelInstruction()} Notice exactly: Translated (${source}): <natural English translation>`;
}

function correctionContext(config) {
  const terms = config.domain_terms.length > 0
    ? ` Preserve terms unchanged: ${config.domain_terms.join(", ")}.`
    : "";
  return `${baseHostModelInstruction()} Notice exactly: Corrected: <corrected English prompt>. If already natural, repeat it unchanged after Corrected:.${terms}`;
}

function refineContext() {
  return `${baseHostModelInstruction()} The :: prefix means refine the text into a precise Codex prompt. Notice exactly: Refined: <refined English prompt>`;
}

function codexCliContext(result) {
  const notice = noticeForResult(result);
  return `English Buddy: first show exactly "${notice}", then answer using this transformed English request: ${result.transformed}`;
}

function noticeForResult(result) {
  if (result.status === "clean") return "English check: no correction needed.";
  if (result.mode === "translate") {
    return `Translated (${result.sourceLanguage || "non-English"}): ${result.transformed}`;
  }
  if (result.mode === "refine") return `Refined: ${result.transformed}`;
  return `Corrected: ${result.transformed}`;
}

function recordCodexCliResult(result, original) {
  if (result.status === "clean") {
    logClean({
      engine: CODEX_CLI_ENGINE,
      history_quality: HISTORY_QUALITY_FULL,
      original,
    });
    return;
  }

  const annotations = result.mode === "translate"
    ? result.sourceLanguage ? `(${result.sourceLanguage})` : null
    : formatAnnotationsForStorage(result.annotations || []) || null;

  logCorrection({
    engine: CODEX_CLI_ENGINE,
    history_quality: HISTORY_QUALITY_FULL,
    mode: result.mode,
    original,
    corrected: result.transformed,
    annotations,
  });
}

function tryCodexCli({ detection, config, cwd }) {
  if (config.engine !== CODEX_CLI_ENGINE) return null;
  if (process.env[CODEX_CLI_CHILD_ENV] === "1") {
    return {
      ok: false,
      engine: CODEX_CLI_ENGINE,
      reason: "recursion_guard",
      message: "codex_cli skipped because recursion guard is active.",
    };
  }
  return runCodexCliPreprocessor({
    mode: detection.mode,
    text: detection.text,
    sourceLanguage: detection.language || null,
    config,
    cwd,
    env: process.env,
  });
}

function main() {
  const input = readStdin();
  hookEventName = input.hook_event_name || input.hookEventName || "UserPromptSubmit";
  const prompt = input.prompt || "";
  const cwd = input.cwd || process.cwd();
  const config = resolveConfig(cwd);
  const summaryCtx = buildSummaryContext(config);

  const detection = detectMode(prompt, { sensitive_patterns: config.sensitive_patterns });

  if (detection.mode === "skip") {
    if (summaryCtx) emit({ additionalContext: summaryCtx });
    return;
  }

  if (!config.auto_correct) {
    if (summaryCtx) emit({ additionalContext: summaryCtx });
    return;
  }

  if (detection.mode === "refine" && !detection.text) {
    emit({ decision: "block", reason: "Nothing to refine. Provide text after ::." });
    return;
  }

  const codexCliResult = tryCodexCli({ detection, config, cwd });
  if (codexCliResult?.ok) {
    recordCodexCliResult(codexCliResult, detection.text);
    if (codexCliResult.status === "clean" && !config.clean_english_notice) {
      if (summaryCtx) emit({ additionalContext: summaryCtx });
      return;
    }
    emit({ additionalContext: appendSummaryContext(codexCliContext(codexCliResult), summaryCtx) });
    return;
  }

  const engine = DEFAULT_ENGINE;
  const fallback = fallbackPrefix(codexCliResult);

  if (detection.mode === "refine") {
    logLimitedEvent({
      engine,
      mode: "refine",
      original: detection.text,
      detected_language: detection.language || null,
    });
    emit({ additionalContext: appendSummaryContext(fallback + refineContext(), summaryCtx) });
    return;
  }

  if (detection.mode === "translate") {
    logLimitedEvent({
      engine,
      mode: "translate",
      original: detection.text,
      detected_language: detection.language,
    });
    emit({ additionalContext: appendSummaryContext(fallback + translationContext(detection), summaryCtx) });
    return;
  }

  logLimitedEvent({
    engine,
    mode: "correct",
    original: detection.text,
    detected_language: detection.language,
  });
  emit({ additionalContext: appendSummaryContext(fallback + correctionContext(config), summaryCtx) });
}

main();
