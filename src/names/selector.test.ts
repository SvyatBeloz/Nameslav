import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWeighted, pickEqual, pickFallbackName } from "./selector.js";
import { loadBank } from "./bankLoader.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const bankDir = join(dirname(fileURLToPath(import.meta.url)), "bank");

test("pickWeighted picks the only item when there is one", () => {
  assert.equal(pickWeighted(["a"], [10], 0.5), "a");
});

test("pickWeighted respects weight boundaries", () => {
  // weights [1, 3] -> total 4; item 0 covers [0, 0.25), item 1 covers [0.25, 1)
  assert.equal(pickWeighted(["a", "b"], [1, 3], 0), "a");
  assert.equal(pickWeighted(["a", "b"], [1, 3], 0.24), "a");
  assert.equal(pickWeighted(["a", "b"], [1, 3], 0.26), "b");
  assert.equal(pickWeighted(["a", "b"], [1, 3], 0.999999), "b");
});

test("pickWeighted rejects empty items or mismatched lengths", () => {
  assert.throws(() => pickWeighted([], [], 0.5));
  assert.throws(() => pickWeighted(["a"], [1, 2], 0.5));
});

test("pickEqual splits range evenly and never goes out of bounds", () => {
  const items = ["a", "b", "c", "d"];
  assert.equal(pickEqual(items, 0), "a");
  assert.equal(pickEqual(items, 0.24), "a");
  assert.equal(pickEqual(items, 0.26), "b");
  assert.equal(pickEqual(items, 0.999999999), "d");
});

test("pickFallbackName only ever picks from the not_found category, no NaN/out-of-range over many seeds", () => {
  const bank = loadBank(bankDir);
  const notFoundIds = new Set(
    bank.categories.find((c) => c.role === "not_found")!.names.map((n) => n.id),
  );
  for (let i = 0; i < 1000; i++) {
    const { category, entry } = pickFallbackName(bank, `seed-${i}`);
    assert.equal(category.role, "not_found");
    assert.ok(notFoundIds.has(entry.id));
  }
});

test("pickFallbackName is deterministic: the same seed always gives the same entry", () => {
  const bank = loadBank(bankDir);
  for (const seed of ["", "a", "broken-token", "кириллица", "x".repeat(500)]) {
    const first = pickFallbackName(bank, seed);
    for (let i = 0; i < 10; i++) {
      assert.equal(pickFallbackName(bank, seed).entry.id, first.entry.id, `seed ${seed}`);
    }
  }
});

test("pickFallbackName still spreads across the not_found category", () => {
  // Determinism must not collapse every seed onto one entry — that would turn
  // the fallback into a constant rather than a pick.
  const bank = loadBank(bankDir);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    seen.add(pickFallbackName(bank, `token-${i}`).entry.id);
  }
  const available = bank.categories.find((c) => c.role === "not_found")!.names.length;
  assert.equal(seen.size, available, "every not_found entry is reachable");
});
