import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createApp } from "./app.js";
import { loadBank } from "./names/bankLoader.js";
import { loadLocale } from "./i18n/loader.js";
import type { Env } from "./config/env.js";
import type { HealthState } from "./routes/health.js";

const srcDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(srcDir, "..");

const bank = loadBank(join(srcDir, "names", "bank"));
const locale = loadLocale(join(srcDir, "i18n", "locale.yaml"));

// Built by hand rather than imported from config/env.js: that module reads
// process.env at import time and throws without SITE_DOMAIN.
const env: Env = {
  siteDomain: "test.local",
  port: 0,
  nodeEnv: "test",
  fingerprintSalt: "test-salt",
  fingerprintFields: ["language", "timezone"],
};

const healthState: HealthState = { isShuttingDown: false };

let server: Server;
let base: string;

function token(payload: string): string {
  return Buffer.from(payload, "utf-8").toString("base64url");
}

before(async () => {
  const app = createApp(bank, locale, env, healthState, {
    publicDir: join(projectRoot, "public"),
    indexPath: join(projectRoot, "public", "index.html"),
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("the homepage renders with the injected absolute OG meta", async () => {
  const res = await fetch(`${base}/`);
  const body = await res.text();
  assert.equal(res.status, 200);
  assert.ok(body.includes(`https://${env.siteDomain}/og-image.png`));
  assert.ok(body.includes(locale.meta.site_title));
  // index.html's own leading comment mentions "{{...}}", so check the actual
  // placeholder names rather than a bare "{{".
  for (const placeholder of ["LOCALE_CODE", "SITE_TITLE", "SITE_DESCRIPTION", "OG_IMAGE_URL", "SITE_URL"]) {
    assert.ok(!body.includes(`{{${placeholder}}}`), `${placeholder} was substituted`);
  }
});

test("an unknown path gets the app's own 404, not Express' default", async () => {
  const res = await fetch(`${base}/no-such-page`);
  const body = await res.text();
  assert.equal(res.status, 404);
  assert.ok(body.includes(locale.errors.not_found_title));
  assert.ok(!body.includes("Cannot GET"));
});

test("a valid share token renders the name and caches its image forever", async () => {
  const entry = bank.categories.find((c) => c.role === "regular")!.names[0]!;
  const t = token(`${entry.id}:${Date.UTC(2026, 5, 21)}`);

  const page = await fetch(`${base}/r/${t}`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes(entry.name));

  const image = await fetch(`${base}/r/${t}/og-image.png`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  // Fully determined by the token (id + timestamp), so it is safe to pin.
  assert.match(image.headers.get("cache-control") ?? "", /immutable/);
});

// Regression: Number.isFinite() let timestamps outside the JS Date range
// through, and Intl.DateTimeFormat threw RangeError mid-request — both share
// routes answered 500 instead of the documented fallback.
test("a timestamp outside the Date range falls back instead of 500-ing", async () => {
  for (const payload of ["kuberslav:999999999999999999", "kuberslav:-8640000000000001"]) {
    const t = token(payload);

    const page = await fetch(`${base}/r/${t}`);
    assert.equal(page.status, 200, `page for ${payload}`);
    assert.ok((await page.text()).includes(locale.share_page.fallback_heading));

    const image = await fetch(`${base}/r/${t}/og-image.png`);
    assert.equal(image.status, 200, `image for ${payload}`);
    assert.equal(image.headers.get("content-type"), "image/png");
  }
});

// Regression: the page and the image resolve the token in two separate
// requests. While the fallback used crypto.randomBytes they could land on
// different names, so a broken link's preview card contradicted the page.
test("a broken token resolves to the same fallback on every request", async () => {
  const broken = "definitely-not-a-valid-token";

  const nameOf = async () => {
    const html = await (await fetch(`${base}/r/${broken}`)).text();
    return /reel-row">([^<]+)</.exec(html)?.[1];
  };

  const first = await nameOf();
  assert.ok(first, "the page shows a name");
  for (let i = 0; i < 5; i++) {
    assert.equal(await nameOf(), first, "same name on reload");
  }

  const bytesOf = async () =>
    Buffer.from(await (await fetch(`${base}/r/${broken}/og-image.png`)).arrayBuffer());
  const imageA = await bytesOf();
  const imageB = await bytesOf();
  assert.ok(imageA.equals(imageB), "the OG image is byte-identical across requests");
  assert.ok(imageA.length > 0);
});

test("health endpoints report ready, and 503 once shutdown starts", async () => {
  assert.equal((await fetch(`${base}/livez`)).status, 200);
  assert.equal((await fetch(`${base}/readyz`)).status, 200);

  healthState.isShuttingDown = true;
  try {
    const res = await fetch(`${base}/readyz`);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { reason?: string };
    assert.equal(body.reason, "shutting_down");
  } finally {
    healthState.isShuttingDown = false;
  }
});
