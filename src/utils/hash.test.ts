import { test } from "node:test";
import assert from "node:assert/strict";
import { bytesToUnitFloat, seedToFloats } from "./hash.js";

test("seedToFloats is deterministic for the same seed", () => {
  const a = seedToFloats("2026-07-16", 2);
  const b = seedToFloats("2026-07-16", 2);
  assert.deepEqual(a, b);
});

test("seedToFloats returns floats in [0, 1)", () => {
  const floats = seedToFloats("2026-07-16|some-fingerprint|salt", 4);
  assert.equal(floats.length, 4);
  for (const f of floats) {
    assert.ok(f >= 0 && f < 1, `expected ${f} to be in [0, 1)`);
  }
});

test("seedToFloats gives different floats for different seeds", () => {
  const a = seedToFloats("2026-07-16", 1);
  const b = seedToFloats("2026-07-17", 1);
  assert.notDeepEqual(a, b);
});

test("seedToFloats rejects count outside available digest chunks", () => {
  assert.throws(() => seedToFloats("seed", 0));
  assert.throws(() => seedToFloats("seed", 5));
});

test("bytesToUnitFloat rejects buffers that are not exactly 8 bytes", () => {
  assert.throws(() => bytesToUnitFloat(new Uint8Array(4)));
  assert.throws(() => bytesToUnitFloat(new Uint8Array(9)));
});

test("bytesToUnitFloat maps all-zero bytes to 0 and all-ones bytes near 1", () => {
  assert.equal(bytesToUnitFloat(new Uint8Array(8)), 0);
  const allOnes = new Uint8Array(8).fill(0xff);
  assert.ok(bytesToUnitFloat(allOnes) < 1 && bytesToUnitFloat(allOnes) > 0.99);
});
