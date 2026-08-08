import { test } from "node:test";
import assert from "node:assert/strict";
import { seedToFloats } from "../utils/hash.js";
import { pickWeighted, pickEqual } from "./selector.js";
// public/assets/selectorMath.js is the hand-maintained browser mirror of the
// server selection math. It is deliberately untyped ESM (no frontend build
// step), so it has no declarations; tsx/Node loads it at runtime. These tests
// pin the client copy to the reviewed server copy so the two cannot silently
// drift apart.
// @ts-ignore browser ESM mirror has no type declarations
import * as clientMath from "../../public/assets/selectorMath.js";

const SEEDS = [
  "2026-08-09",
  "2026-08-09|ru-RU|Europe/Belgrade|1920x1080|8|Mozilla/5.0|default-salt",
  "2026-08-09|en-US|America/New_York|390x844|4|Safari/605.1.15|other-salt",
  "a",
  "",
];

test("mirror: client seedToFloats is bit-identical to the server's", async () => {
  for (const seed of SEEDS) {
    const expected = seedToFloats(seed, 2);
    const actual = await clientMath.seedToFloats(seed, 2);
    assert.deepEqual(actual, expected, `seed ${JSON.stringify(seed)}`);
  }
});

test("mirror: client pickWeighted/pickEqual agree with the server across the whole range", () => {
  const items = ["a", "b", "c"];
  const weights = [1, 2, 3];
  for (let i = 0; i < 1000; i++) {
    const f = i / 1000;
    assert.equal(
      clientMath.pickWeighted(items, weights, f),
      pickWeighted(items, weights, f),
      `pickWeighted @ ${f}`,
    );
    assert.equal(clientMath.pickEqual(items, f), pickEqual(items, f), `pickEqual @ ${f}`);
  }
});

test("mirror: end-to-end selection for a personal seed agrees between client and server", async () => {
  // Same seed -> same floats -> same weighted/equal picks on both sides.
  const seed = "2026-08-09|ru-RU|Europe/Belgrade|2560x1440|16|Firefox/120.0|salt";
  const serverFloats = seedToFloats(seed, 2);
  const serverCategoryFloat = serverFloats[0]!;
  const serverNameFloat = serverFloats[1]!;
  const [clientCategoryFloat, clientNameFloat] = await clientMath.seedToFloats(seed, 2);
  assert.equal(clientCategoryFloat, serverCategoryFloat);
  assert.equal(clientNameFloat, serverNameFloat);

  const items = ["x", "y", "z"];
  const weights = [5, 1, 4];
  assert.equal(
    clientMath.pickWeighted(items, weights, clientCategoryFloat),
    pickWeighted(items, weights, serverCategoryFloat),
  );
  assert.equal(
    clientMath.pickEqual(items, clientNameFloat),
    pickEqual(items, serverNameFloat),
  );
});
