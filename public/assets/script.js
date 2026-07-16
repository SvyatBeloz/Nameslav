import { getConfig } from "./config.js";
import { buildSeed } from "./fingerprint.js";
import { seedToFloats, pickWeighted, pickEqual } from "./selectorMath.js";

function base64url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return res.json();
}

async function main() {
  const [config, nameBank, locale] = await Promise.all([
    getConfig(),
    fetchJson("/api/name-bank.json"),
    fetchJson("/api/locale.json"),
  ]);

  document.title = locale.meta.site_title;

  const date = todayUtc();
  const seed = buildSeed(date, config.fingerprintFields, config.fingerprintSalt);
  const [categoryFloat, nameFloat] = await seedToFloats(seed, 2);

  const categories = nameBank.categories;
  const category = pickWeighted(
    categories,
    categories.map((c) => c.weight),
    categoryFloat,
  );
  const entry = pickEqual(category.names, nameFloat);

  const eyebrowEl = document.getElementById("eyebrow");
  const nameEl = document.getElementById("name");
  const hintEl = document.getElementById("hint");
  const shareButton = document.getElementById("share-button");
  const rerollHintEl = document.getElementById("reroll-hint");

  eyebrowEl.textContent = locale.home.eyebrow;
  nameEl.textContent = entry.name;
  hintEl.textContent = entry.hint;
  rerollHintEl.textContent = locale.home.reroll_hint;
  shareButton.textContent = locale.home.share_button;
  shareButton.disabled = false;

  shareButton.addEventListener("click", async () => {
    // Built entirely client-side — no network round-trip needed to share.
    const token = base64url(`${entry.id}:${Date.now()}`);
    const url = `https://${config.siteDomain}/r/${token}`;

    try {
      await navigator.clipboard.writeText(url);
      const original = locale.home.share_button;
      shareButton.textContent = "✓";
      setTimeout(() => {
        shareButton.textContent = original;
      }, 1500);
    } catch {
      window.prompt(interpolate(locale.home.eyebrow, {}), url);
    }
  });
}

main().catch((err) => {
  console.error("Nameslav Roulette: failed to initialize", err);
});
