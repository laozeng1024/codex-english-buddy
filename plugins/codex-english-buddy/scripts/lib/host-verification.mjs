// Host-surface verification matrix for Phase 5.

export const REQUIRED_HOST_SCENARIOS = [
  {
    id: "desktop_new_conversation",
    surface: "Codex Desktop",
    mode: "new conversation",
    status: "manual_required",
    supportClaim: "not_claimed_supported",
    prompt: "输入中文测试",
    expectedNotice: "Translated (Chinese): ...",
    requiredChecks: [
      "Install and enable the plugin through Codex plugin flows.",
      "Trust the plugin-bundled UserPromptSubmit hook when prompted.",
      "Start a fresh Desktop conversation.",
      "Submit the Chinese prompt and confirm the assistant visibly shows the translated notice before answering.",
      "Run doctor and confirm the hook/debug state matches the Desktop run.",
    ],
    passCriteria: [
      "The translated notice appears as the first visible assistant line.",
      "No duplicate English Buddy notices appear.",
      "History quality is disclosed as limited for host_model records.",
    ],
    failureSignals: [
      "No notice appears.",
      "Doctor reports hook untrusted, disabled, or duplicate hook risk.",
      "Desktop and CLI use different config without a documented reason.",
    ],
  },
  {
    id: "cli_interactive_tui",
    surface: "Codex CLI",
    mode: "interactive TUI",
    status: "manual_required",
    supportClaim: "not_claimed_supported",
    command: "codex",
    prompt: "输入中文测试",
    expectedNotice: "Translated (Chinese): ...",
    requiredChecks: [
      "Run `codex` interactively.",
      "Submit the Chinese prompt.",
      "Confirm whether UserPromptSubmit fires and whether additionalContext is rendered by the CLI.",
      "Run doctor before and after the manual test to compare CODEX_HOME and debug log state.",
      "Use `$codex-english-buddy:today` for report checks unless the native `/` menu lists `/codex-english-buddy:today`.",
    ],
    passCriteria: [
      "The translated notice appears before the main answer.",
      "The hook/debug timestamp updates or doctor can otherwise confirm the hook ran.",
      "Report commands are available through `$codex-english-buddy:...` skill mentions or bundled scripts.",
      "CLI behavior is recorded with Codex version and CODEX_HOME.",
    ],
    failureSignals: [
      "CLI launched with hooks/plugins disabled.",
      "CLI uses a different CODEX_HOME than Desktop.",
      "The hook runs but the CLI does not render the injected instruction.",
    ],
  },
  {
    id: "cli_initial_prompt",
    surface: "Codex CLI",
    mode: "initial prompt argument",
    status: "manual_required",
    supportClaim: "experimental_not_verified",
    command: "codex \"输入中文测试\"",
    expectedNotice: "Translated (Chinese): ...",
    requiredChecks: [
      "Run `codex \"输入中文测试\"` from a shell.",
      "Confirm whether the initial prompt path triggers UserPromptSubmit.",
      "Check whether the visible notice appears before the main answer.",
      "Record if behavior differs from interactive TUI.",
    ],
    passCriteria: [
      "The hook fires for the initial prompt.",
      "The translated notice is visible and not duplicated.",
      "Any difference from interactive CLI is documented.",
    ],
    failureSignals: [
      "Initial prompt bypasses hooks.",
      "Only subsequent interactive prompts trigger the hook.",
      "Output formatting hides or reorders the notice.",
    ],
  },
  {
    id: "codex_exec_prompt",
    surface: "Codex CLI",
    mode: "exec prompt",
    status: "manual_required",
    supportClaim: "experimental_not_verified",
    command: "codex exec \"输入中文测试\"",
    expectedNotice: "Translated (Chinese): ...",
    requiredChecks: [
      "Run `codex exec \"输入中文测试\"` from a shell.",
      "Confirm whether exec mode triggers UserPromptSubmit.",
      "Record whether the translated notice pollutes machine-readable output.",
      "Do not use this result to enable the Phase 6 codex_cli engine.",
    ],
    passCriteria: [
      "Either the notice appears predictably, or exec mode is documented as unsupported/experimental.",
      "The behavior is recorded with Codex version and CODEX_HOME.",
      "No full-history claim is made from this mode.",
    ],
    failureSignals: [
      "Exec bypasses hooks.",
      "Exec output mixes notices with data expected by scripts.",
      "A child Codex run would recurse if later used by Phase 6 without safeguards.",
    ],
  },
];

export function buildHostVerificationMatrix({ doctorReport = null } = {}) {
  const preflight = {
    doctorOk: doctorReport?.ok ?? null,
    codexBinaryPath: doctorReport?.codex?.binaryPath ?? null,
    codexVersion: doctorReport?.codex?.version ?? null,
    codexHome: doctorReport?.codex?.home ?? null,
    pluginEnabled: doctorReport?.pluginEnabled?.status ?? "unknown",
    hookTrust: doctorReport?.hookTrust?.status ?? "unknown",
    manualHookSmokeTest: doctorReport?.manualHookCheck?.ok ?? null,
    desktopCliConfigComparison: doctorReport?.codex?.desktopConfigComparison?.status ?? "unknown",
    activeEngine: doctorReport?.config?.activeEngine ?? "unknown",
    activeHistoryQuality: doctorReport?.history?.activeHistoryQuality ?? "unknown",
  };

  return {
    status: "manual_verification_required",
    supportClaim: "not_supported_until_recorded",
    generatedAt: new Date().toISOString(),
    preflight,
    scenarios: REQUIRED_HOST_SCENARIOS.map((scenario) => ({ ...scenario })),
    notes: [
      "Phase 5 records verification coverage and checklists only.",
      "CLI support must not be claimed until at least interactive CLI behavior is manually verified.",
      "Native CLI slash commands are unsupported/host-dependent unless the host `/` menu lists plugin commands.",
      "codex exec remains experimental because notices can pollute scripted output.",
      "host_model history remains limited unless a future response-capture or preprocessor path writes full records.",
    ],
  };
}

export function renderHostVerificationMarkdown(matrix) {
  const lines = [];
  lines.push("# CLI/Desktop Host Verification");
  lines.push("");
  lines.push(`Status: ${matrix.status}`);
  lines.push(`Support claim: ${matrix.supportClaim}`);
  lines.push("");
  lines.push("## Preflight");
  lines.push("");
  lines.push("| Check | Value |");
  lines.push("|---|---|");
  lines.push(`| Doctor OK | ${matrix.preflight.doctorOk ?? "unknown"} |`);
  lines.push(`| Codex binary | ${matrix.preflight.codexBinaryPath || "unknown"} |`);
  lines.push(`| Codex version | ${matrix.preflight.codexVersion || "unknown"} |`);
  lines.push(`| CODEX_HOME | ${matrix.preflight.codexHome || "unknown"} |`);
  lines.push(`| Plugin enabled | ${matrix.preflight.pluginEnabled} |`);
  lines.push(`| Hook trust | ${matrix.preflight.hookTrust} |`);
  lines.push(`| Manual hook smoke test | ${matrix.preflight.manualHookSmokeTest ?? "unknown"} |`);
  lines.push(`| Desktop/CLI config | ${matrix.preflight.desktopCliConfigComparison} |`);
  lines.push(`| Active engine | ${matrix.preflight.activeEngine} |`);
  lines.push(`| History quality | ${matrix.preflight.activeHistoryQuality} |`);
  lines.push("");
  lines.push("## Scenario Matrix");
  lines.push("");
  lines.push("| Scenario | Surface | Mode | Status | Support Claim | Expected |");
  lines.push("|---|---|---|---|---|---|");
  for (const scenario of matrix.scenarios) {
    lines.push(`| ${scenario.id} | ${scenario.surface} | ${scenario.mode} | ${scenario.status} | ${scenario.supportClaim} | ${scenario.expectedNotice} |`);
  }
  lines.push("");
  lines.push("## Manual Checklists");
  for (const scenario of matrix.scenarios) {
    lines.push("");
    lines.push(`### ${scenario.id}`);
    lines.push("");
    if (scenario.command) lines.push(`Command: \`${scenario.command}\``);
    if (scenario.prompt) lines.push(`Prompt: \`${scenario.prompt}\``);
    lines.push(`Expected notice: \`${scenario.expectedNotice}\``);
    lines.push("");
    lines.push("Required checks:");
    scenario.requiredChecks.forEach((item) => lines.push(`- [ ] ${item}`));
    lines.push("");
    lines.push("Pass criteria:");
    scenario.passCriteria.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    lines.push("Failure signals:");
    scenario.failureSignals.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");
  lines.push("## Notes");
  matrix.notes.forEach((note) => lines.push(`- ${note}`));
  return lines.join("\n") + "\n";
}
