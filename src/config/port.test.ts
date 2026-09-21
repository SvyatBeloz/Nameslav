import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePort } from "./port.js";

test("unset or blank PORT falls back to the default", () => {
  assert.equal(parsePort(undefined, 3000), 3000);
  assert.equal(parsePort("", 3000), 3000);
  assert.equal(parsePort("   ", 3000), 3000);
});

test("a valid port is parsed", () => {
  assert.equal(parsePort("8080", 3000), 8080);
  assert.equal(parsePort("1", 3000), 1);
  assert.equal(parsePort("65535", 3000), 65535);
});

// Regression: these used to reach net.listen() and kill the process with a raw
// ERR_SOCKET_BAD_PORT stack instead of a message naming the variable.
test("garbage, out-of-range and non-integer values fail fast by name", () => {
  for (const bad of ["notanumber", "0", "-1", "65536", "99999", "3000.5", "0x10", "3e3"]) {
    assert.throws(() => parsePort(bad, 3000), /PORT/, `value ${bad}`);
  }
});
