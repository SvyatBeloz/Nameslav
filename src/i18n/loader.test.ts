import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocale, interpolate, formatDate } from "./loader.js";

const VALID_LOCALE = `
locale_code: ru-RU
date_style: long
meta:
  site_title: "Title"
  og_description: "Desc {{name}}"
home:
  eyebrow: "eyebrow"
  share_button: "share"
  reroll_hint: "hint"
share_page:
  heading: "{{date}}: {{name}}"
  fallback_heading: "fallback"
`;

function writeTempLocale(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "locale-test-"));
  const path = join(dir, "locale.yaml");
  writeFileSync(path, content, "utf-8");
  return path;
}

test("loadLocale accepts a fully populated file", () => {
  const path = writeTempLocale(VALID_LOCALE);
  const locale = loadLocale(path);
  assert.equal(locale.locale_code, "ru-RU");
  rmSync(path, { force: true });
});

test("loadLocale fails fast with the exact missing key path", () => {
  const withoutShareButton = VALID_LOCALE.replace('  share_button: "share"\n', "");
  const path = writeTempLocale(withoutShareButton);
  assert.throws(() => loadLocale(path), /home\.share_button/);
  rmSync(path, { force: true });
});

test("loadLocale rejects an invalid BCP 47 locale_code", () => {
  const invalid = VALID_LOCALE.replace("locale_code: ru-RU", "locale_code: not a real tag!!");
  const path = writeTempLocale(invalid);
  assert.throws(() => loadLocale(path), /locale_code/);
  rmSync(path, { force: true });
});

test("loadLocale rejects an invalid date_style", () => {
  const invalid = VALID_LOCALE.replace("date_style: long", "date_style: super-long");
  const path = writeTempLocale(invalid);
  assert.throws(() => loadLocale(path));
  rmSync(path, { force: true });
});

test("interpolate substitutes known placeholders and drops unknown ones", () => {
  assert.equal(interpolate("Сегодня ты — {{name}}", { name: "Куберслав" }), "Сегодня ты — Куберслав");
  assert.equal(interpolate("{{missing}}", {}), "");
});

test("formatDate uses Intl.DateTimeFormat per locale_code/date_style", () => {
  const path = writeTempLocale(VALID_LOCALE);
  const locale = loadLocale(path);
  const formatted = formatDate(Date.UTC(2026, 5, 21), locale);
  assert.ok(formatted.includes("2026"));
  rmSync(path, { force: true });
});
