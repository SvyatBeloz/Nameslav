import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShareToken } from "./shareToken.js";
import { loadBank } from "./bankLoader.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const bank = loadBank(join(dirname(fileURLToPath(import.meta.url)), "bank"));

// Grab a real regular entry so the test tracks the actual bank contents.
const regularCategory = bank.categories.find((category) => category.role === "regular")!;
const sampleEntry = regularCategory.names[0]!;

function token(payload: string): string {
  return Buffer.from(payload, "utf-8").toString("base64url");
}

test("a valid token resolves to the exact entry, keeping its timestamp", () => {
  const timestamp = 1754600000000;
  const resolved = resolveShareToken(bank, token(`${sampleEntry.id}:${timestamp}`));
  assert.equal(resolved.isFallback, false);
  assert.equal(resolved.entry.id, sampleEntry.id);
  assert.equal(resolved.category.slug, regularCategory.slug);
  assert.equal(resolved.timestamp, timestamp);
});

test("an unknown id falls back to the not_found category", () => {
  const resolved = resolveShareToken(bank, token("no-such-id:1754600000000"));
  assert.equal(resolved.isFallback, true);
  assert.equal(resolved.category.role, "not_found");
});

test("a payload without the ':' separator falls back", () => {
  const resolved = resolveShareToken(bank, token("justanidno_separator"));
  assert.equal(resolved.isFallback, true);
  assert.equal(resolved.category.role, "not_found");
});

test("a non-numeric timestamp falls back even for a known id", () => {
  const resolved = resolveShareToken(bank, token(`${sampleEntry.id}:not-a-number`));
  assert.equal(resolved.isFallback, true);
  assert.equal(resolved.category.role, "not_found");
});

test("an empty token falls back", () => {
  const resolved = resolveShareToken(bank, "");
  assert.equal(resolved.isFallback, true);
  assert.equal(resolved.category.role, "not_found");
});

test("garbage / non-base64url input falls back without throwing", () => {
  for (const bad of ["!!!", "%%%", "a", "::::"]) {
    const resolved = resolveShareToken(bank, bad);
    assert.equal(resolved.isFallback, true, `token ${JSON.stringify(bad)}`);
    assert.equal(resolved.category.role, "not_found");
  }
});

// Regression: Number.isFinite() accepts values outside the JS Date range
// (±8.64e15 ms), and Intl.DateTimeFormat later threw RangeError on them — so a
// hand-crafted token produced a 500 on both share routes instead of a fallback.
test("a timestamp outside the representable Date range falls back", () => {
  for (const ts of ["999999999999999999", "8640000000000001", "-8640000000000001", "1e300"]) {
    const resolved = resolveShareToken(bank, token(`${sampleEntry.id}:${ts}`));
    assert.equal(resolved.isFallback, true, `timestamp ${ts}`);
    assert.equal(resolved.category.role, "not_found");
  }
});

test("the outermost representable timestamps are still accepted", () => {
  for (const ts of [8640000000000000, -8640000000000000, 0]) {
    const resolved = resolveShareToken(bank, token(`${sampleEntry.id}:${ts}`));
    assert.equal(resolved.isFallback, false, `timestamp ${ts}`);
    assert.equal(resolved.timestamp, ts);
    // The contract that matters: whatever passes must be formattable.
    assert.doesNotThrow(() => new Date(resolved.timestamp).toISOString());
  }
});

test("an empty or fractional timestamp falls back", () => {
  // Number("") is 0, which would otherwise render as 1 January 1970.
  for (const ts of ["", "1.5", " ", "0x10"]) {
    const resolved = resolveShareToken(bank, token(`${sampleEntry.id}:${ts}`));
    assert.equal(resolved.isFallback, true, `timestamp ${JSON.stringify(ts)}`);
  }
});

// Regression: /r/:token and /r/:token/og-image.png resolve the token in two
// separate requests. A randomly picked fallback let the page and its own OG
// preview disagree, and changed the name on every reload.
test("the fallback is stable for a given token across repeated resolutions", () => {
  for (const bad of ["", "!!!", "broken-token", token("no-such-id:123")]) {
    const first = resolveShareToken(bank, bad);
    assert.equal(first.isFallback, true);
    for (let i = 0; i < 10; i++) {
      assert.equal(resolveShareToken(bank, bad).entry.id, first.entry.id, `token ${bad}`);
    }
  }
});

test("the fallback entry always belongs to the not_found category", () => {
  const notFoundIds = new Set(
    bank.categories.find((category) => category.role === "not_found")!.names.map((n) => n.id),
  );
  for (let i = 0; i < 200; i++) {
    const resolved = resolveShareToken(bank, `garbage-${i}`);
    assert.equal(resolved.isFallback, true);
    assert.ok(notFoundIds.has(resolved.entry.id));
  }
});
