import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { createErrorHandler, createNotFoundHandler } from "./errors.js";
import { loadLocale } from "../i18n/loader.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const locale = loadLocale(
  join(dirname(fileURLToPath(import.meta.url)), "..", "i18n", "locale.yaml"),
);

const BOOM = "secret-stack-marker-do-not-leak";

/** Minimal app whose only route throws, so the error handler is what answers. */
async function withApp(run: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.get("/throws", () => {
    throw new Error(BOOM);
  });
  app.get("/api/throws", () => {
    throw new Error(BOOM);
  });
  app.use(createNotFoundHandler(locale));
  app.use(createErrorHandler(locale));

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  // The handler logs every error it catches; silence that for the test run so a
  // green suite does not print stack traces that look like failures.
  const originalError = console.error;
  console.error = () => {};
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    console.error = originalError;
    await new Promise((resolve) => server.close(resolve));
  }
}

test("an unmatched path renders the localized 404 page, not Express' English default", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/no-such-page`);
    const body = await res.text();

    assert.equal(res.status, 404);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.ok(body.includes(locale.errors.not_found_title), "shows the localized title");
    assert.ok(body.includes(`lang="${locale.locale_code}"`), "declares the site language");
    assert.ok(!body.includes("Cannot GET"), "no Express default body");
  });
});

test("an unmatched /api/* path answers with JSON, not an HTML page", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/no-such-endpoint`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), { error: "not_found" });
  });
});

test("a thrown error answers 500 without leaking the stack trace", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/throws`);
    const body = await res.text();

    assert.equal(res.status, 500);
    assert.ok(body.includes(locale.errors.server_error_title), "shows the localized title");
    // Express' own handler inlines err.stack whenever NODE_ENV !== "production".
    // This must hold regardless of how the process was started.
    assert.ok(!body.includes(BOOM), "error message stays server-side");
    assert.ok(!body.includes("at "), "no stack frames");
    assert.ok(!body.includes(process.cwd()), "no absolute server paths");
  });
});

test("a thrown error under /api/* answers 500 as JSON", async () => {
  await withApp(async (base) => {
    const res = await fetch(`${base}/api/throws`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "internal_server_error" });
  });
});
