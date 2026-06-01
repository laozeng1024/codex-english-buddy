// Doctor diagnostics for Codex English Buddy.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { CODEX_CLI_ENGINE, getConfigPaths, getDataDir, resolveConfig } from "./state.mjs";
import { buildHostVerificationMatrix } from "./host-verification.mjs";
import { periodStats } from "./stats.mjs";

const PLUGIN_ID = "codex-english-buddy";
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PLUGIN_ROOT = path.resolve(thisDir, "..", "..");
const PUBLIC_COMMANDS = ["doctor", "config", "preview", "today", "stats", "mistakes", "drill", "export", "review"];

function safeReadText(file) {
  try {
    return { ok: true, text: fs.readFileSync(file, "utf8") };
  } catch (error) {
    return { ok: false, text: "", error: error.message };
  }
}

function safeReadJson(file) {
  const read = safeReadText(file);
  if (!read.ok) return { ok: false, value: null, error: read.error };
  try {
    return { ok: true, value: JSON.parse(read.text) };
  } catch (error) {
    return { ok: false, value: null, error: error.message };
  }
}

function commandOutput(command, args, options = {}) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: options.timeout ?? 5_000,
      env: options.env,
      input: options.input,
      cwd: options.cwd,
    });
    return {
      ok: result.status === 0,
      status: result.status,
      signal: result.signal,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      error: result.error?.message || null,
    };
  } catch (error) {
    return { ok: false, status: null, signal: null, stdout: "", stderr: "", error: error.message };
  }
}

function findCodexBinary(env, config = {}) {
  if (config.codex_cli_binary) return { path: config.codex_cli_binary, source: "codex_cli_binary" };
  if (env.CODEX_ENGLISH_BUDDY_CODEX_BIN) return { path: env.CODEX_ENGLISH_BUDDY_CODEX_BIN, source: "CODEX_ENGLISH_BUDDY_CODEX_BIN" };
  if (env.CODEX_BINARY) return { path: env.CODEX_BINARY, source: "CODEX_BINARY" };
  const found = commandOutput("sh", ["-lc", "command -v codex"], { env });
  return found.ok && found.stdout
    ? { path: found.stdout.split("\n")[0], source: "PATH" }
    : { path: null, source: "not_found", error: found.stderr || found.error || null };
}

function readFeatureFlag(configText, name) {
  if (!configText) return { value: null, status: "unknown" };
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:features\\.)?${name}\\s*=\\s*(true|false)\\b`, "i");
  const match = configText.match(pattern);
  if (!match) return { value: null, status: "unknown" };
  const value = match[1].toLowerCase() === "true";
  return { value, status: value ? "enabled" : "disabled" };
}

function pluginEnabledState(configText) {
  if (!configText) return { status: "unknown", evidence: "No Codex config file was readable." };
  if (!configText.includes(PLUGIN_ID)) {
    return { status: "not_found", evidence: `No ${PLUGIN_ID} reference found in Codex config.` };
  }

  const escaped = PLUGIN_ID.replaceAll("-", "\\-");
  const blockPattern = new RegExp(`\\[(?:plugins\\.)?["']?${escaped}(?:@[^"']+)?["']?\\]([\\s\\S]*?)(?:\\n\\[|$)`, "i");
  const block = configText.match(blockPattern)?.[1] || "";
  const enabledMatch = block.match(/(?:^|\n)\s*enabled\s*=\s*(true|false)\b/i);
  if (enabledMatch) {
    const enabled = enabledMatch[1].toLowerCase() === "true";
    return { status: enabled ? "enabled" : "disabled", evidence: `Found ${PLUGIN_ID} plugin block with enabled=${enabled}.` };
  }
  return { status: "referenced", evidence: `Found ${PLUGIN_ID} in Codex config, but no enabled flag was detected.` };
}

function userHookFallbackState(configText) {
  if (!configText) return { present: false, occurrences: 0, evidence: "No Codex config file was readable." };
  const userPromptOccurrences = (configText.match(/UserPromptSubmit/g) || []).length;
  const scriptOccurrences = (configText.match(/prompt-coach-hook\.mjs|run-hook\.sh/g) || []).length;
  const pluginOccurrences = (configText.match(new RegExp(PLUGIN_ID, "g")) || []).length;
  return {
    present: userPromptOccurrences > 0 && (scriptOccurrences > 0 || pluginOccurrences > 0),
    occurrences: userPromptOccurrences,
    evidence: `${userPromptOccurrences} UserPromptSubmit reference(s), ${scriptOccurrences} hook script reference(s).`,
  };
}

function hookTrustState(configText) {
  if (!configText) return { status: "unknown", trustedHashConfigured: false, evidence: "No Codex config file was readable." };
  const hasTrustedHash = /(?:^|\n)\s*trusted_hash\s*=/.test(configText);
  const mentionsPlugin = configText.includes(PLUGIN_ID) || /prompt-coach-hook\.mjs|run-hook\.sh/.test(configText);
  if (hasTrustedHash && mentionsPlugin) {
    return {
      status: "configured",
      trustedHashConfigured: true,
      evidence: "A trusted_hash entry appears near Codex English Buddy hook configuration. The hash is not validated by doctor.",
    };
  }
  return {
    status: "unknown",
    trustedHashConfigured: false,
    evidence: "No trusted_hash for this hook was detected in config. Codex may store plugin hook trust outside this file.",
  };
}

function readPluginManifest(root) {
  const manifestPath = path.join(root, ".codex-plugin", "plugin.json");
  const manifest = safeReadJson(manifestPath);
  const hooksPath = manifest.ok && manifest.value?.hooks
    ? path.resolve(root, manifest.value.hooks)
    : path.join(root, "hooks", "hooks.json");
  const hooks = safeReadJson(hooksPath);
  const hookCommand = hooks.value?.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command || "";
  const sessionEndCommand = hooks.value?.hooks?.SessionEnd?.[0]?.hooks?.[0]?.command || "";
  const hookCommands = [hookCommand, sessionEndCommand].filter(Boolean).join("\n");
  const runnerPath = path.join(root, "scripts", "run-hook.sh");
  const commandSurface = PUBLIC_COMMANDS.map((name) => {
    const skillPath = path.join(root, "skills", PLUGIN_ID, name, "SKILL.md");
    const commandPath = path.join(root, "commands", `${name}.md`);
    const namespacedCommandPath = path.join(root, "commands", `${PLUGIN_ID}:${name}.md`);
    return {
      name,
      skillPath,
      skillBacked: fs.existsSync(skillPath),
      commandPath,
      commandFile: fs.existsSync(commandPath),
      namespacedCommandPath,
      namespacedCommandFile: fs.existsSync(namespacedCommandPath),
    };
  });
  return {
    manifestPath,
    manifestOk: manifest.ok,
    manifestError: manifest.error || null,
    hooksPath,
    hooksOk: hooks.ok,
    hooksError: hooks.error || null,
    runnerPath,
    runnerExists: fs.existsSync(runnerPath),
    bundledHookRegistration: {
      userPromptSubmit: Boolean(hooks.value?.hooks?.UserPromptSubmit),
      sessionEnd: Boolean(hooks.value?.hooks?.SessionEnd),
      commandReferencesPromptHook: hookCommand.includes("prompt-coach-hook.mjs"),
      commandUsesPluginRoot: hookCommand.includes("CODEX_PLUGIN_ROOT"),
      commandCanLocatePluginCache: hookCommands.includes(".codex/plugins/cache"),
      commandHasUnsafeCwdFallback: hookCommands.includes("${CODEX_PLUGIN_ROOT:-.}"),
    },
    commandSurface: {
      entries: commandSurface,
      skillBackedEntries: commandSurface.filter((entry) => entry.skillBacked).length,
      commandFiles: commandSurface.filter((entry) => entry.commandFile && entry.namespacedCommandFile).length,
      nativeCliSlashCommands: {
        status: "unsupported_or_host_dependent",
        label: "unsupported/host-dependent",
        nativeCommand: "/codex-english-buddy:today",
        recommendedChatEntry: "$codex-english-buddy:today",
        shellFallback: "sh scripts/run-node.sh scripts/english-buddy.mjs today",
        evidence: "Codex CLI can reject unregistered slash commands before plugin code can handle them. Native /codex-english-buddy:today is supported only if the host / menu lists it.",
      },
    },
  };
}

function debugLogInfo(env) {
  const home = env.HOME || os.homedir();
  const preferredDir = env.CODEX_ENGLISH_BUDDY_DEBUG_DIR || path.join(home, ".codex", PLUGIN_ID);
  const preferredFile = path.join(preferredDir, "hook-debug.log");
  const tempFile = path.join(env.TMPDIR || os.tmpdir(), PLUGIN_ID, "hook-debug.log");
  for (const file of [preferredFile, tempFile]) {
    try {
      const stat = fs.statSync(file);
      return { path: file, exists: true, mtime: stat.mtime.toISOString(), size: stat.size };
    } catch {}
  }
  return { path: preferredFile, exists: false, mtime: null, size: 0 };
}

function runManualHookCheck(root, env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceb-doctor-"));
  try {
    const hookInput = JSON.stringify({
      cwd: root,
      hook_event_name: "UserPromptSubmit",
      prompt: "修复这个 bug",
      session_id: "doctor-session",
      turn_id: "doctor-turn",
    });
    const result = commandOutput("sh", [
      path.join(root, "scripts", "run-hook.sh"),
      path.join(root, "scripts", "prompt-coach-hook.mjs"),
    ], {
      cwd: root,
      input: hookInput,
      timeout: 10_000,
      env: {
        ...env,
        CODEX_PLUGIN_DATA: dataDir,
        CODEX_SESSION_ID: "doctor-session",
        CODEX_ENGLISH_BUDDY_DISABLE_GLOBAL_CONFIG: "1",
      },
    });
    if (!result.ok) {
      return { ok: false, status: result.status, error: result.stderr || result.error || "Hook command failed." };
    }
    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      return { ok: false, status: result.status, error: `Hook output was not JSON: ${error.message}` };
    }

    const context = parsed.hookSpecificOutput?.additionalContext || "";
    const leakedMock = result.stdout.includes("DOCTOR_MOCK_MUST_NOT_APPEAR");
    const historyDir = path.join(dataDir, "history");
    const historyFiles = fs.existsSync(historyDir)
      ? fs.readdirSync(historyDir).filter((name) => name.endsWith(".jsonl"))
      : [];
    const records = historyFiles.flatMap((name) => {
      const text = fs.readFileSync(path.join(historyDir, name), "utf8");
      return text.split("\n").filter(Boolean).map((line) => {
        try { return JSON.parse(line); }
        catch { return null; }
      }).filter(Boolean);
    });
    const firstRecord = records[0] || null;
    return {
      ok: context.includes("Translated (Chinese): <natural English translation>") && !leakedMock && firstRecord?.history_quality === "limited",
      status: result.status,
      emitsAdditionalContext: Boolean(context),
      translatedInstructionPresent: context.includes("Translated (Chinese): <natural English translation>"),
      mockOutputLeaked: leakedMock,
      historyRecordQuality: firstRecord?.history_quality || null,
      historyCorrectedIsNull: firstRecord ? firstRecord.corrected === null : null,
      historyAnnotationsAreNull: firstRecord ? firstRecord.annotations === null : null,
    };
  } catch (error) {
    return { ok: false, status: null, error: error.message };
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

function desktopConfigComparison(env, cliConfigPath) {
  const desktopHome = env.CODEX_DESKTOP_HOME || env.CODEX_DESKTOP_CODEX_HOME || null;
  if (!desktopHome) {
    return {
      status: "unknown",
      sameConfig: null,
      evidence: "No CODEX_DESKTOP_HOME or CODEX_DESKTOP_CODEX_HOME environment variable is available for comparison.",
    };
  }
  const desktopConfigPath = path.join(desktopHome, "config.toml");
  return {
    status: desktopConfigPath === cliConfigPath ? "same" : "different",
    sameConfig: desktopConfigPath === cliConfigPath,
    desktopConfigPath,
    evidence: `CLI config: ${cliConfigPath}; Desktop config: ${desktopConfigPath}`,
  };
}

function buildIssues(report) {
  const issues = [];
  if (!report.plugin.manifestOk) {
    issues.push({ severity: "error", message: "Plugin manifest could not be read.", hint: report.plugin.manifestError });
  }
  if (!report.plugin.hooksOk) {
    issues.push({ severity: "error", message: "Plugin hooks.json could not be read.", hint: report.plugin.hooksError });
  }
  if (!report.plugin.runnerExists) {
    issues.push({ severity: "error", message: "Hook runner script is missing.", hint: report.plugin.runnerPath });
  }
  if (!report.plugin.bundledHookRegistration.userPromptSubmit) {
    issues.push({ severity: "error", message: "Plugin-bundled UserPromptSubmit hook is not registered.", hint: "Check hooks/hooks.json." });
  }
  if (report.plugin.bundledHookRegistration.commandHasUnsafeCwdFallback) {
    issues.push({ severity: "error", message: "Hook command falls back to the current working directory.", hint: "Use a plugin-root/cache resolver so Codex CLI can run hooks from arbitrary projects." });
  }
  if (!report.plugin.bundledHookRegistration.commandCanLocatePluginCache) {
    issues.push({ severity: "warning", message: "Hook command has no Codex plugin-cache fallback.", hint: "Codex CLI may not set CODEX_PLUGIN_ROOT before invoking plugin hooks." });
  }
  const missingSkillEntries = report.plugin.commandSurface.entries.filter((entry) => !entry.skillBacked);
  if (missingSkillEntries.length > 0) {
    issues.push({ severity: "warning", message: "Some public commands are not exposed as skill-backed entries.", hint: missingSkillEntries.map((entry) => entry.name).join(", ") });
  }
  const nativeCliSlash = report.plugin.commandSurface.nativeCliSlashCommands;
  issues.push({
    severity: "info",
    message: "Codex CLI native slash command support is unsupported/host-dependent.",
    hint: `${nativeCliSlash.evidence} This Codex binary reports ${report.codex.version || "unknown version"}. Use ${nativeCliSlash.recommendedChatEntry} or ${nativeCliSlash.shellFallback}.`,
  });
  if (!report.manualHookCheck.ok) {
    issues.push({ severity: "error", message: "Manual hook smoke test failed.", hint: report.manualHookCheck.error || "Check scripts/run-hook.sh and prompt-coach-hook.mjs." });
  }
  for (const [name, flag] of Object.entries(report.features)) {
    if (flag.status === "disabled") {
      issues.push({ severity: "warning", message: `Codex feature flag ${name} is disabled.`, hint: "Enable hooks/plugins/plugin_hooks in Codex config if your host requires explicit flags." });
    }
  }
  if (report.pluginEnabled.status === "not_found") {
    issues.push({ severity: "warning", message: "Plugin is not referenced in Codex config.", hint: "This may be fine for marketplace-managed installs; otherwise enable the plugin through Codex." });
  }
  if (report.duplicateHookRisk.status === "possible") {
    issues.push({ severity: "warning", message: "Duplicate hook execution is possible.", hint: report.duplicateHookRisk.evidence });
  }
  if (report.hookTrust.status === "unknown") {
    issues.push({ severity: "info", message: "Hook trust state is unknown.", hint: report.hookTrust.evidence });
  }
  if (report.history.recurringMistakeReportsAvailable === false) {
    issues.push({ severity: "info", message: "Recurring-mistake reports are not available with current history.", hint: report.history.recurringMistakeReportsReason });
  }
  if (report.config.activeEngine === CODEX_CLI_ENGINE && !report.codex.version) {
    issues.push({ severity: "error", message: "codex_cli engine is active, but the Codex CLI could not be executed.", hint: report.codex.versionError || "Set codex_cli_binary or CODEX_BINARY to a working codex executable." });
  }
  return issues;
}

export function runDoctor(options = {}) {
  const root = options.root || DEFAULT_PLUGIN_ROOT;
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const codexHome = env.CODEX_HOME || path.join(env.HOME || os.homedir(), ".codex");
  const codexConfigPath = path.join(codexHome, "config.toml");
  const configRead = safeReadText(codexConfigPath);
  const configPaths = getConfigPaths(cwd);
  const resolvedConfig = resolveConfig(cwd);
  const codexBinary = findCodexBinary(env, resolvedConfig);
  const codexVersion = codexBinary.path
    ? commandOutput(codexBinary.path, ["--version"], { env, timeout: 5_000 })
    : { ok: false, stdout: "", stderr: "", error: codexBinary.error || "codex binary not found" };
  const period = periodStats(365);
  const activeHistoryQuality = resolvedConfig.engine === CODEX_CLI_ENGINE ? "full" : "limited";

  const userFallback = userHookFallbackState(configRead.text);
  const pluginEnabled = pluginEnabledState(configRead.text);
  const duplicateHookRisk = {
    status: userFallback.present && pluginEnabled.status !== "not_found" ? "possible" : "none",
    evidence: userFallback.present
      ? "A user-level UserPromptSubmit hook appears in config while the plugin may also be enabled."
      : "No user-level English Buddy UserPromptSubmit hook was detected in config.",
  };

  const report = {
    generatedAt: new Date().toISOString(),
    plugin: {
      id: PLUGIN_ID,
      root,
      ...readPluginManifest(root),
    },
    codex: {
      home: codexHome,
      configPath: codexConfigPath,
      configExists: configRead.ok,
      configError: configRead.ok ? null : configRead.error,
      binaryPath: codexBinary.path,
      binarySource: codexBinary.source,
      version: codexVersion.ok ? codexVersion.stdout : null,
      versionError: codexVersion.ok ? null : codexVersion.stderr || codexVersion.error || null,
      desktopConfigComparison: desktopConfigComparison(env, codexConfigPath),
    },
    features: {
      hooks: readFeatureFlag(configRead.text, "hooks"),
      plugins: readFeatureFlag(configRead.text, "plugins"),
      plugin_hooks: readFeatureFlag(configRead.text, "plugin_hooks"),
    },
    pluginEnabled,
    hookTrust: hookTrustState(configRead.text),
    userLevelHookFallback: userFallback,
    duplicateHookRisk,
    config: {
      activeEngine: resolvedConfig.engine,
      resolved: resolvedConfig,
      projectPaths: configPaths.project.map((file) => ({ path: file, exists: fs.existsSync(file) })),
      globalPaths: configPaths.global.map((file) => ({ path: file, exists: fs.existsSync(file) })),
    },
    data: {
      codePluginData: env.CODEX_PLUGIN_DATA || null,
      historyDir: getDataDir(),
    },
    history: {
      activeHistoryQuality,
      storedHistoryQuality: period.historyQuality,
      fullRecords: period.fullRecords,
      limitedRecords: period.limitedRecords,
      totalRecords: period.total,
      recurringMistakeReportsAvailable: period.patterns.length > 0,
      recurringMistakeReportsReason: period.patterns.length > 0
        ? activeHistoryQuality === "limited"
          ? "Full correction patterns are available from stored history, but current host_model records remain limited."
          : "Full correction patterns are available."
        : activeHistoryQuality === "limited"
          ? "host_model history is limited and does not contain actual correction pairs."
          : "No recurring correction patterns have been captured yet.",
    },
    debugLog: debugLogInfo(env),
    manualHookCheck: options.runManualHookCheck === false
      ? { ok: null, skipped: true }
      : runManualHookCheck(root, env),
  };
  report.hostVerification = buildHostVerificationMatrix({ doctorReport: report });
  report.issues = buildIssues(report);
  report.ok = report.issues.every((issue) => issue.severity !== "error");
  return report;
}

export function renderDoctorMarkdown(report) {
  const lines = [];
  lines.push("# Codex English Buddy Doctor");
  lines.push("");
  lines.push(`Status: ${report.ok ? "OK" : "Needs attention"}`);
  lines.push("");
  lines.push("| Check | Result | Detail |");
  lines.push("|---|---|---|");
  lines.push(`| Plugin manifest | ${report.plugin.manifestOk ? "ok" : "error"} | ${report.plugin.manifestPath} |`);
  lines.push(`| Hook runner | ${report.plugin.runnerExists ? "ok" : "missing"} | ${report.plugin.runnerPath} |`);
  lines.push(`| Hook registration | ${report.plugin.bundledHookRegistration.userPromptSubmit ? "ok" : "missing"} | UserPromptSubmit=${report.plugin.bundledHookRegistration.userPromptSubmit}, SessionEnd=${report.plugin.bundledHookRegistration.sessionEnd} |`);
  lines.push(`| Command surface | skill-backed | skills=${report.plugin.commandSurface.skillBackedEntries}/${PUBLIC_COMMANDS.length}, commandFiles=${report.plugin.commandSurface.commandFiles}/${PUBLIC_COMMANDS.length} |`);
  lines.push(`| Native CLI slash | ${report.plugin.commandSurface.nativeCliSlashCommands.label} | use ${report.plugin.commandSurface.nativeCliSlashCommands.recommendedChatEntry} or ${report.plugin.commandSurface.nativeCliSlashCommands.shellFallback}; ${report.plugin.commandSurface.nativeCliSlashCommands.nativeCommand} only works if the host / menu lists it |`);
  lines.push(`| Codex binary | ${report.codex.binaryPath ? "found" : "missing"} | ${report.codex.binaryPath || report.codex.versionError || ""} |`);
  lines.push(`| Codex config | ${report.codex.configExists ? "found" : "missing"} | ${report.codex.configPath} |`);
  lines.push(`| Feature hooks | ${report.features.hooks.status} | ${report.features.hooks.value ?? ""} |`);
  lines.push(`| Feature plugins | ${report.features.plugins.status} | ${report.features.plugins.value ?? ""} |`);
  lines.push(`| Feature plugin_hooks | ${report.features.plugin_hooks.status} | ${report.features.plugin_hooks.value ?? ""} |`);
  lines.push(`| Plugin enabled | ${report.pluginEnabled.status} | ${report.pluginEnabled.evidence} |`);
  lines.push(`| Hook trust | ${report.hookTrust.status} | ${report.hookTrust.evidence} |`);
  lines.push(`| User-level fallback | ${report.userLevelHookFallback.present ? "present" : "not detected"} | ${report.userLevelHookFallback.evidence} |`);
  lines.push(`| Duplicate hook risk | ${report.duplicateHookRisk.status} | ${report.duplicateHookRisk.evidence} |`);
  lines.push(`| Desktop/CLI config | ${report.codex.desktopConfigComparison.status} | ${report.codex.desktopConfigComparison.evidence} |`);
  lines.push(`| Active engine | ${report.config.activeEngine} | history=${report.history.activeHistoryQuality} |`);
  lines.push(`| Data path | ok | ${report.data.historyDir} |`);
  lines.push(`| Stored history | ${report.history.storedHistoryQuality} | full=${report.history.fullRecords}, limited=${report.history.limitedRecords}, total=${report.history.totalRecords} |`);
  lines.push(`| Recurring reports | ${report.history.recurringMistakeReportsAvailable ? "available" : "limited/unavailable"} | ${report.history.recurringMistakeReportsReason} |`);
  lines.push(`| Debug log | ${report.debugLog.exists ? "found" : "missing"} | ${report.debugLog.exists ? `${report.debugLog.path} (${report.debugLog.mtime})` : report.debugLog.path} |`);
  lines.push(`| Manual hook smoke test | ${report.manualHookCheck.ok ? "ok" : "failed"} | additionalContext=${report.manualHookCheck.emitsAdditionalContext ?? ""}, history=${report.manualHookCheck.historyRecordQuality ?? ""} |`);
  lines.push(`| Host verification | ${report.hostVerification.status} | ${report.hostVerification.scenarios.length} scenarios require manual verification |`);
  lines.push("");
  lines.push("## Issues");
  if (report.issues.length === 0) {
    lines.push("");
    lines.push("No issues detected.");
  } else {
    lines.push("");
    for (const issue of report.issues) {
      lines.push(`- ${issue.severity.toUpperCase()}: ${issue.message}${issue.hint ? ` ${issue.hint}` : ""}`);
    }
  }
  return lines.join("\n") + "\n";
}
