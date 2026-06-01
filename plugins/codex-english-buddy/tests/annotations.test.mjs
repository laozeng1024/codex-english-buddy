import test from "node:test";
import assert from "node:assert/strict";

import {
  parseAnnotations,
  formatAnnotationsForStorage,
  formatAnnotationsForDisplay,
} from "../scripts/lib/annotations.mjs";

test("parseAnnotations handles new arrow format with categories", () => {
  const input = "its → it's (apostrophe)\nmodul → module (spelling)";
  const result = parseAnnotations(input);
  assert.deepEqual(result, [
    { original: "its", corrected: "it's", category: "apostrophe" },
    { original: "modul", corrected: "module", category: "spelling" },
  ]);
});

test("parseAnnotations handles new format without categories", () => {
  const input = "html → HTML\nfoo → bar";
  const result = parseAnnotations(input);
  assert.deepEqual(result, [
    { original: "html", corrected: "HTML", category: null },
    { original: "foo", corrected: "bar", category: null },
  ]);
});

test("parseAnnotations strips stray bullet markers if the model adds them", () => {
  const input = "  • its → it's (apostrophe)\n- modul → module (spelling)\n  * x → y";
  const result = parseAnnotations(input);
  assert.deepEqual(result.map((r) => `${r.original}|${r.corrected}`), [
    "its|it's",
    "modul|module",
    "x|y",
  ]);
});

test("parseAnnotations suppresses no-op entries where before equals after", () => {
  const input = "a VitePress → a VitePress (none)\nhtml → HTML (acronym)";
  const result = parseAnnotations(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].original, "html");
});

test("parseAnnotations handles legacy parenthetical format", () => {
  const input = "(autentication>authentication; modul>module)";
  const result = parseAnnotations(input);
  assert.deepEqual(result, [
    { original: "autentication", corrected: "authentication", category: null },
    { original: "modul", corrected: "module", category: null },
  ]);
});

test("parseAnnotations suppresses no-op entries in legacy format too", () => {
  const input = "(a VitePress>a VitePress; html>HTML)";
  const result = parseAnnotations(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].original, "html");
});

test("parseAnnotations returns [] for null, empty, and translation tags", () => {
  assert.deepEqual(parseAnnotations(null), []);
  assert.deepEqual(parseAnnotations(""), []);
  assert.deepEqual(parseAnnotations("   "), []);
  assert.deepEqual(parseAnnotations("(Chinese)"), []); // translation language tag, no `>`
  assert.deepEqual(parseAnnotations("(Japanese)"), []);
});

test("parseAnnotations is robust to legacy entries whose 'right' side contains '>'", () => {
  const input = "(a>b>c)";
  const result = parseAnnotations(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].original, "a");
  assert.equal(result[0].corrected, "b>c");
});

test("formatAnnotationsForStorage renders one fix per line, no bullets", () => {
  const items = [
    { original: "its", corrected: "it's", category: "apostrophe" },
    { original: "html", corrected: "HTML", category: null },
  ];
  assert.equal(
    formatAnnotationsForStorage(items),
    "its → it's (apostrophe)\nhtml → HTML",
  );
});

test("formatAnnotationsForDisplay adds bullets and aligns category", () => {
  const items = [
    { original: "its", corrected: "it's", category: "apostrophe" },
    { original: "html", corrected: "HTML", category: null },
  ];
  const display = formatAnnotationsForDisplay(items);
  assert.equal(
    display,
    "  • its → it's   (apostrophe)\n  • html → HTML",
  );
});
