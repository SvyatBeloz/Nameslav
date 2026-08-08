import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFingerprintFields, KNOWN_FINGERPRINT_FIELDS } from "./fingerprintFields.js";

test("unset or empty input yields every known field, in registry order", () => {
  assert.deepEqual(parseFingerprintFields(undefined), [...KNOWN_FINGERPRINT_FIELDS]);
  assert.deepEqual(parseFingerprintFields(""), [...KNOWN_FINGERPRINT_FIELDS]);
});

test("a comma-separated subset is accepted and keeps the given order", () => {
  assert.deepEqual(parseFingerprintFields("timezone,language"), ["timezone", "language"]);
});

test("a single field works", () => {
  assert.deepEqual(parseFingerprintFields("userAgent"), ["userAgent"]);
});

test("whitespace is trimmed and empty segments are dropped", () => {
  assert.deepEqual(parseFingerprintFields(" language , , timezone ,"), ["language", "timezone"]);
});

test("an unknown field fails fast and names the offending value", () => {
  assert.throws(() => parseFingerprintFields("language,bogus"), /bogus/);
});

test("reordering does not deduplicate or reorder beyond the input", () => {
  // Order matters for the seed, so the parser must preserve it verbatim.
  assert.deepEqual(
    parseFingerprintFields("screenResolution,language,timezone"),
    ["screenResolution", "language", "timezone"],
  );
});
