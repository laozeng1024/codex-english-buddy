import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("doctor is exposed as a Desktop skill-backed slash entry", () => {
  const skill = read("skills/codex-english-buddy/doctor/SKILL.md");
  assert.match(skill, /^name: doctor$/m);
  assert.match(skill, /displayName: "codex-english-buddy:doctor"/);
  assert.match(skill, /\/codex-english-buddy:doctor/);
  assert.match(skill, /scripts\/english-buddy\.mjs" doctor/);
});

test("public commands are exposed as skill-backed entries", () => {
  const commands = ["doctor", "config", "preview", "today", "stats", "mistakes", "drill", "export", "review"];
  for (const command of commands) {
    const skill = read(`skills/codex-english-buddy/${command}/SKILL.md`);
    assert.match(skill, new RegExp(`^name: ${command}$`, "m"));
    assert.match(skill, new RegExp(`displayName: "codex-english-buddy:${command}"`));
    assert.match(skill, new RegExp(`\\$codex-english-buddy:${command}`));
  }
});

test("skill-backed command entries are marketplace-safe", () => {
  const commands = ["doctor", "config", "preview", "today", "stats", "mistakes", "drill", "export"];
  for (const command of commands) {
    const skill = read(`skills/codex-english-buddy/${command}/SKILL.md`);
    assert.doesNotMatch(skill, /\/Users\/laozeng/);
    assert.doesNotMatch(skill, /\/opt\/homebrew|\/opt\/anaconda3/);
    assert.doesNotMatch(skill, /\.codex\/plugins\/cache\/laozeng/);
    assert.doesNotMatch(skill, /source repository|current workspace is the source/i);
    assert.match(skill, /resolved plugin root/);
    assert.match(skill, /Do not rely on the user's project cwd/);
  }
});

test("CLI native slash limitation is documented for report entries", () => {
  const readme = read("README.md");
  assert.match(readme, /CLI Command Surface/);
  assert.match(readme, /Codex CLI chat: \$codex-english-buddy:today/);
  assert.doesNotMatch(readme, /Shell from plugin root/);
  assert.match(readme, /Native slash: \/codex-english-buddy:today is not supported unless/);
  assert.match(readme, /Some Codex CLI builds/);
  assert.match(readme, /native `\/` menu/);
  assert.match(readme, /plugin `commands\/\*\.md` files/);
  assert.match(readme, /\$codex-english-buddy:today/);
});

test("support matrix recommends CLI-safe report entrypoints", () => {
  const matrix = fs.readFileSync(path.resolve(root, "..", "..", "docs", "CLI_DESKTOP_SUPPORT_MATRIX.md"), "utf8");
  assert.match(matrix, /CLI Command Surface/);
  assert.match(matrix, /Codex CLI chat: \$codex-english-buddy:today/);
  assert.match(matrix, /Shell from plugin root: sh scripts\/run-node\.sh scripts\/english-buddy\.mjs today/);
  assert.match(matrix, /Native slash: \/codex-english-buddy:today is not supported unless/);
  assert.match(matrix, /Do not present `\/codex-english-buddy:today` as the primary CLI path/);
});

test("README documents Desktop skill-backed command behavior", () => {
  const readme = read("README.md");
  assert.match(readme, /skill-backed/);
  assert.match(readme, /\/codex-english-buddy:doctor/);
  assert.match(readme, /commands\/\*\.md/);
});
