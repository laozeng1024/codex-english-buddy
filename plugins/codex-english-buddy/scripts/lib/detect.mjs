// Language detection — determines whether text is English, non-English, or mixed.
// Uses ASCII ratio heuristic: CJK/Cyrillic/Arabic characters are multi-byte
// but fall outside ASCII printable range (0x20-0x7E).

export function detectLanguage(text) {
  if (!text || text.trim().length === 0) {
    return { language: "unknown", mode: "skip", ratio: 0 };
  }

  const chars = [...text];
  const totalChars = chars.length;
  if (totalChars === 0) {
    return { language: "unknown", mode: "skip", ratio: 0 };
  }

  let asciiCount = 0;
  for (const ch of chars) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) asciiCount++;
  }

  const ratio = Math.round((asciiCount / totalChars) * 100);

  if (ratio >= 85) {
    return { language: "english", mode: "correct", ratio };
  }
  return { language: detectSourceLanguage(text), mode: "translate", ratio };
}

export function detectSourceLanguage(text) {
  if (/[\u4e00-\u9fff]/u.test(text)) return "Chinese";
  if (/[\u3040-\u30ff]/u.test(text)) return "Japanese";
  if (/[\uac00-\ud7af]/u.test(text)) return "Korean";
  if (/[\u0400-\u04ff]/u.test(text)) return "Cyrillic";
  if (/[\u0600-\u06ff]/u.test(text)) return "Arabic";
  return "non-English";
}

export function shouldSkip(prompt, options = {}) {
  if (!prompt || prompt.trim().length === 0) return true;
  const trimmed = prompt.trim();
  if (trimmed.startsWith("/")) return true;
  if (isFencedCodeOnly(trimmed)) return true;
  if (matchesSensitivePattern(trimmed, options.sensitive_patterns || [])) return true;

  // Too short — use both char and word count (CJK has no spaces)
  const charCount = [...trimmed].length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const hasNonAscii = [...trimmed].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code > 0x7e;
  });
  if (!hasNonAscii && charCount < 10 && wordCount < 3) return true;
  if (hasNonAscii && charCount < 2) return true;

  // Code/URL patterns
  if (/^(https?:|git@|ssh:\/\/|\{|\[|\(|npm |pip |cargo |brew |sudo |cd |ls |cat |grep |find |docker |kubectl )/i.test(trimmed)) {
    return true;
  }
  if (looksLikeRawCode(trimmed)) return true;

  return false;
}

export function detectMode(prompt, options = {}) {
  if (prompt.startsWith("::")) {
    const text = prompt.slice(2).trimStart();
    if (isFencedCodeOnly(text) || matchesSensitivePattern(text, options.sensitive_patterns || [])) {
      return { mode: "skip", text: prompt };
    }
    return { mode: "refine", text };
  }

  if (shouldSkip(prompt, options)) {
    return { mode: "skip", text: prompt };
  }

  const detection = detectLanguage(prompt);
  return { mode: detection.mode, text: prompt, ...detection };
}

function isFencedCodeOnly(text) {
  if (!text.startsWith("```")) return false;
  const lines = text.split(/\r?\n/);
  if (lines.length < 3) return false;
  return lines[0].startsWith("```") && lines.at(-1).trim().startsWith("```");
}

function looksLikeRawCode(text) {
  if (/^(const|let|var|function|class|import|export|def|async function)\b/.test(text)) return true;
  if (/[{};]/.test(text) && /\b(return|if|for|while|const|let|var|function|class)\b/.test(text)) return true;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const codeLike = lines.filter((line) =>
      /[{};]$/.test(line) ||
      /^(const|let|var|return|if|for|while|import|export|def|class)\b/.test(line) ||
      /^[}\])]+$/.test(line)
    ).length;
    if (codeLike / lines.length >= 0.6) return true;
  }
  return false;
}

function matchesSensitivePattern(text, patterns) {
  for (const rawPattern of patterns) {
    if (typeof rawPattern !== "string" || !rawPattern.trim()) continue;
    const pattern = rawPattern.trim();
    try {
      if (new RegExp(pattern, "i").test(text)) return true;
    } catch {
      if (text.toLowerCase().includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}
