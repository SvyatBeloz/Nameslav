import { getConfig } from "./config.js";
import { buildSeed } from "./fingerprint.js";
import { seedToFloats, pickWeighted, pickEqual } from "./selectorMath.js";

function base64url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function hueFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

const ITEM_H = 84;
const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Builds the flat pool the reel visually scrolls through (every name across every
// category), so the drum feels like it's drawing from the whole bank, not just
// today's category.
function buildFlatPool(nameBank) {
  const pool = [];
  for (const category of nameBank.categories) {
    for (const entry of category.names) pool.push({ entry, category });
  }
  return pool;
}

function runReel(track, pool, startIdx, targetIdx, onDone) {
  const loops = REDUCED_MOTION ? 0 : 2;
  let delta = ((targetIdx - startIdx) % pool.length + pool.length) % pool.length;
  if (delta === 0) delta = pool.length;
  const travelSteps = loops * pool.length + delta;

  track.innerHTML = "";
  for (let i = 0; i < travelSteps + 4; i++) {
    const item = pool[(startIdx + i) % pool.length];
    const row = document.createElement("div");
    row.className = "reel-row";
    row.textContent = item.entry.name;
    track.appendChild(row);
  }

  const toOffset = -(travelSteps * ITEM_H);
  const duration = REDUCED_MOTION ? 1 : 2800 + Math.random() * 500;
  const start = performance.now();

  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 4);
    track.style.transform = `translateY(${toOffset * eased}px)`;
    track.style.filter = REDUCED_MOTION ? "none" : `blur(${(1 - p) * 6}px)`;
    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      track.innerHTML = "";
      const row = document.createElement("div");
      row.className = "reel-row";
      row.textContent = pool[targetIdx].entry.name;
      track.appendChild(row);
      track.style.transform = "translateY(0px)";
      track.style.filter = "none";
      onDone();
    }
  }
  requestAnimationFrame(tick);
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

  const card = document.getElementById("card");
  const statusEl = document.getElementById("status");
  const startButton = document.getElementById("start-button");
  const reelTrack = document.getElementById("reel-track");
  const hintEl = document.getElementById("hint");
  const shareButton = document.getElementById("share-button");
  const footnoteEl = document.getElementById("footnote");

  const railId = document.getElementById("meta-id-d");
  const railCategory = document.getElementById("meta-category-d");
  const railDate = document.getElementById("meta-date-d");
  const railCaption = document.getElementById("meta-caption-d");
  const metaId = document.getElementById("meta-id-m");
  const metaCategory = document.getElementById("meta-category-m");
  const metaDate = document.getElementById("meta-date-m");
  const metaCaption = document.getElementById("meta-caption-m");

  hintEl.textContent = locale.home.start_hint;
  shareButton.textContent = locale.home.share_button;

  const pool = buildFlatPool(nameBank);
  const targetIdx = pool.findIndex((p) => p.entry.id === entry.id);
  const startIdx = Math.floor(Math.random() * pool.length);

  // Displayed in UTC to match the seed date (todayUtc): the personal name is
  // keyed on the UTC day, so the caption date must not drift into the browser's
  // local timezone near midnight.
  const dateText = new Intl.DateTimeFormat(locale.locale_code, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date());
  [railDate, metaDate].forEach((el) => {
    el.firstChild ? el.insertBefore(document.createTextNode(dateText), el.firstChild) : (el.textContent = dateText);
  });
  railCaption.textContent = "сегодня";
  metaCaption.textContent = "сегодня";

  startButton.addEventListener("click", () => {
    startButton.hidden = true;
    // Status text is deliberately left untranslated (terminal/CLI aesthetic).
    statusEl.textContent = "nameslav.sh · running";

    runReel(reelTrack, pool, startIdx, targetIdx === -1 ? startIdx : targetIdx, () => {
      const hue = hueFromString(category.title);
      card.style.setProperty("--hue", hue);
      card.classList.add("is-landed");

      statusEl.textContent = "nameslav.sh · waiting";
      hintEl.textContent = entry.hint;

      const idText = `#${entry.id}`;
      railId.textContent = idText;
      metaId.textContent = idText;
      railCategory.textContent = category.title;
      metaCategory.textContent = category.title;

      shareButton.disabled = false;
      footnoteEl.textContent = locale.home.reroll_hint;
    });
  });

  shareButton.addEventListener("click", async () => {
    const token = base64url(`${entry.id}:${Date.now()}`);
    const url = `https://${config.siteDomain}/r/${token}`;

    history.pushState({ shared: true, token }, "", `/r/${token}`);
    card.classList.add("is-shared");
    shareButton.disabled = true;
    statusEl.textContent = "nameslav.sh · stopped";
    railCaption.textContent = "просмотр по ссылке";
    metaCaption.textContent = "просмотр по ссылке";

    try {
      await navigator.clipboard.writeText(url);
      const original = locale.home.share_button;
      shareButton.textContent = "Скопировано!";
      setTimeout(() => {
        shareButton.textContent = original;
      }, 1500);
    } catch {
      window.prompt(interpolate(locale.home.eyebrow, {}), url);
    }
  });

  // Sharing rewrites the URL via history.pushState; the browser Back button
  // returns here but the DOM stays in the "shared" state. The personal name is
  // deterministic for the day, so a plain reload restores a clean homepage.
  window.addEventListener("popstate", () => {
    location.reload();
  });

  const panel = document.querySelector(".panel");
  panel.addEventListener("mousemove", (ev) => {
    const r = panel.getBoundingClientRect();
    const px = (ev.clientY - r.top) / r.height - 0.5;
    const py = (ev.clientX - r.left) / r.width - 0.5;
    panel.style.transform = `perspective(1000px) rotateX(${px * -1.5}deg) rotateY(${py * 1.5}deg)`;
  });
  panel.addEventListener("mouseleave", () => {
    panel.style.transform = "";
  });
}

main().catch((err) => {
  console.error("Nameslav Roulette: failed to initialize", err);
});
