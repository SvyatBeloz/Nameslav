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
    homeTemplatePath: join(projectRoot, "templates", "index.html"),
    shareTemplatePath: join(projectRoot, "templates", "share.html"),
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

test("every response carries the security headers", async () => {
  // Mounted before the routers, so it must hold for a page, an API payload and
  // a static asset alike — not just the handlers that remembered to set them.
  for (const path of ["/", "/api/config.json", "/assets/style.css", "/no-such-page"]) {
    const res = await fetch(`${base}${path}`);
    const csp = res.headers.get("content-security-policy") ?? "";

    assert.ok(csp.includes("default-src 'none'"), `${path}: CSP baseline`);
    assert.ok(csp.includes("script-src 'self'"), `${path}: script-src`);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), `${path}: no inline scripts allowed`);
    assert.ok(csp.includes("frame-ancestors 'none'"), `${path}: frame-ancestors`);

    assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer", path);
    assert.equal(res.headers.get("x-frame-options"), "DENY", path);
    assert.equal(res.headers.get("x-powered-by"), null, `${path}: framework not advertised`);
  }
});

// The CSP forbids inline scripts, so a page carrying one would silently lose
// that behaviour in a browser while still passing every status-code assertion.
test("no rendered page relies on an inline script", async () => {
  const broken = await (await fetch(`${base}/r/not-a-real-token`)).text();
  const valid = await (await fetch(`${base}/`)).text();

  for (const [name, html] of [["share page", broken], ["homepage", valid]] as const) {
    assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), `${name}: no inline <script>`);
    assert.ok(!/\son[a-z]+=/.test(html), `${name}: no inline event handler attributes`);
  }
  assert.ok(broken.includes('src="/assets/tilt.js"'), "share page loads the shared tilt module");
});

test("a fallback page does not claim the visitor is the lost name", async () => {
  const html = await (await fetch(`${base}/r/not-a-real-token`)).text();
  const description = /og:description" content="([^"]*)"/.exec(html)?.[1];

  assert.equal(description, locale.share_page.fallback_og_description);
  // The old bug: meta.og_description is "Сегодня ты — {{name}}", which read as
  // a cheerful announcement right next to the "lost in time" title.
  assert.ok(!description?.includes("Сегодня ты"), "not the personal phrasing");
  assert.ok(html.includes('name="robots" content="noindex"'), "share pages stay unindexed");
});

test("robots.txt is served and keeps share links crawlable", async () => {
  const res = await fetch(`${base}/robots.txt`);
  const body = await res.text();
  assert.equal(res.status, 200);
  // Disallowing /r/ would block the social crawlers the share links exist for.
  assert.ok(!/^\s*Disallow:\s*\/r\//m.test(body), "share links are not disallowed");
});

// The templates carry {{PLACEHOLDER}} markup and must never be reachable as
// files; this is why they moved out of public/ rather than relying on
// express.static's `index: false`.
test("the HTML templates are not served as static files", async () => {
  for (const path of ["/share.html", "/templates/index.html", "/templates/share.html"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 404, path);
    assert.ok(!(await res.text()).includes("{{"), `${path}: no raw placeholders`);
  }
  // /index.html stays a 301 to the canonical URL rather than a 404.
  const legacy = await fetch(`${base}/index.html`, { redirect: "manual" });
  assert.equal(legacy.status, 301);
});

// The OG fonts are read in-process by the renderer and were never used by the
// browser; under public/ they were a 1.2 MB public download for nothing.
test("the OG fonts are no longer part of the web root", async () => {
  for (const path of ["/assets/fonts/NotoSans-Regular.ttf", "/assets/fonts/NotoSans-Bold.ttf"]) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
  // …while the renderer still finds them.
  assert.equal((await fetch(`${base}/og-image.png`)).status, 200);
});

test("both pages take every visible string from the locale", async () => {
  const home = await (await fetch(`${base}/`)).text();
  for (const text of [locale.home.start_button, locale.home.start_hint, locale.home.share_button]) {
    assert.ok(home.includes(text), `homepage renders ${JSON.stringify(text)}`);
  }
  // Rendered into the document so the message survives a failed locale fetch.
  assert.ok(home.includes(locale.home.load_error), "load error text is in the page");

  const share = await (await fetch(`${base}/r/not-a-real-token`)).text();
  for (const text of [
    locale.share_page.view_caption,
    locale.share_page.footnote,
    locale.share_page.home_link,
  ]) {
    assert.ok(share.includes(text), `share page renders ${JSON.stringify(text)}`);
  }
});

test("the spinning reel is hidden from assistive tech, with a live region instead", async () => {
  const home = await (await fetch(`${base}/`)).text();
  assert.match(home, /class="reel-window"[^>]*aria-hidden="true"/, "reel is not announced");
  assert.match(home, /id="result-announcement"[^>]*aria-live="polite"/, "outcome is");
  assert.ok(home.includes('rel="icon"'), "favicon is linked rather than only probed");

  // The share page has no animation, so its name is plain readable content.
  const share = await (await fetch(`${base}/r/not-a-real-token`)).text();
  assert.ok(!/class="reel-window"[^>]*aria-hidden/.test(share), "share reel stays readable");
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
