import test from "node:test";
import assert from "node:assert/strict";

import { detectLanguage, shouldSkip, detectMode } from "../scripts/lib/detect.mjs";

test("detectLanguage returns english for ASCII text", () => {
  const r = detectLanguage("refactor the authentication module");
  assert.equal(r.mode, "correct");
  assert.equal(r.language, "english");
  assert.ok(r.ratio >= 80);
});

test("detectLanguage returns non-english for Chinese", () => {
  const r = detectLanguage("重构认证模块，职责太多了");
  assert.equal(r.mode, "translate");
  assert.equal(r.language, "Chinese");
  assert.ok(r.ratio < 80);
});

test("detectLanguage returns non-english for mixed CJK+English", () => {
  const r = detectLanguage("把 auth module 里的 session handler 重构一下");
  assert.equal(r.mode, "translate");
});

test("detectLanguage handles empty string", () => {
  const r = detectLanguage("");
  assert.equal(r.mode, "skip");
});

test("shouldSkip returns true for slash commands", () => {
  assert.equal(shouldSkip("/commit"), true);
  assert.equal(shouldSkip("/codex-toolkit:audit"), true);
});

test("shouldSkip returns true for very short prompts", () => {
  assert.equal(shouldSkip("ok"), true);
  assert.equal(shouldSkip("yes"), true);
});

test("shouldSkip returns false for normal prompts", () => {
  assert.equal(shouldSkip("refactor the authentication module"), false);
});

test("shouldSkip returns true for URLs", () => {
  assert.equal(shouldSkip("https://github.com/foo/bar"), true);
});

test("shouldSkip returns true for code patterns", () => {
  assert.equal(shouldSkip("npm install express"), true);
  assert.equal(shouldSkip("docker run -it ubuntu"), true);
});

test("shouldSkip returns true for fenced code blocks", () => {
  assert.equal(shouldSkip("```js\nconst x = 1;\n```"), true);
});

test("shouldSkip returns true for raw code-like prompts", () => {
  assert.equal(shouldSkip("const result = items.map((item) => item.id);"), true);
  assert.equal(shouldSkip("function run() {\n  return true;\n}"), true);
});

test("shouldSkip returns true for configured sensitive patterns", () => {
  assert.equal(shouldSkip("please review token sk-live-123", { sensitive_patterns: ["sk-live-[0-9]+"] }), true);
  assert.equal(shouldSkip("please review PASSWORD=abc", { sensitive_patterns: ["PASSWORD="] }), true);
});

test("shouldSkip returns false for Chinese (long enough)", () => {
  assert.equal(shouldSkip("重构认证模块，职责太多了"), false);
});

test("shouldSkip returns false for short Chinese prompts", () => {
  assert.equal(shouldSkip("修复这个 bug"), false);
});

test("detectMode returns refine for :: prefix", () => {
  const r = detectMode(":: investigate why auth is slow");
  assert.equal(r.mode, "refine");
  assert.equal(r.text, "investigate why auth is slow");
});

test("detectMode applies sensitive pattern skip to refine input", () => {
  const r = detectMode(":: explain SECRET_ABC123", { sensitive_patterns: ["SECRET_[A-Z0-9]+"] });
  assert.equal(r.mode, "skip");
});

test("detectMode returns correct for English", () => {
  const r = detectMode("refactor the autentication modul");
  assert.equal(r.mode, "correct");
});

test("detectMode returns translate for Chinese", () => {
  const r = detectMode("重构认证模块，职责太多了");
  assert.equal(r.mode, "translate");
});

test("detectMode returns translate for short Chinese", () => {
  const r = detectMode("修复这个 bug");
  assert.equal(r.mode, "translate");
});

test("detectMode returns skip for slash commands", () => {
  const r = detectMode("/commit");
  assert.equal(r.mode, "skip");
});
