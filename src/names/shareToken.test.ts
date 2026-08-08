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
