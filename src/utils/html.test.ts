import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "./html.js";

test("escapeHtml escapes the five HTML-significant characters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("escapeHtml leaves safe text (incl. Cyrillic) untouched", () => {
  const safe = "Куберслав — сегодня ты чинишь всё";
  assert.equal(escapeHtml(safe), safe);
});

test("escapeHtml neutralizes an attribute-injection payload", () => {
  assert.equal(
    escapeHtml(`" onmouseover="alert('x')`),
    "&quot; onmouseover=&quot;alert(&#39;x&#39;)",
  );
});

test("escapeHtml escapes ampersand before introducing new ones", () => {
  // If & were escaped after < / >, the freshly produced &lt; would be
  // double-escaped to &amp;lt;. Escaping & first keeps entities intact.
  assert.equal(escapeHtml("a & b < c"), "a &amp; b &lt; c");
});

test("escapeHtml handles the empty string", () => {
  assert.equal(escapeHtml(""), "");
});
