import { Router } from "express";
import type { Bank } from "../names/bankLoader.js";
import type { LocaleConfig } from "../i18n/schema.js";
import type { Env } from "../config/env.js";
import type { Category, NameEntry } from "../names/schema.js";
import { pickFallbackName } from "../names/selector.js";
import { renderOgImage } from "../og/renderer.js";
import { formatDate, interpolate } from "../i18n/loader.js";
import { escapeHtml } from "../utils/html.js";
import type { OgTemplateProps } from "../og/templates/registry.js";

interface ResolvedShare {
  category: Category;
  entry: NameEntry;
  timestamp: number;
  isFallback: boolean;
}

/**
 * Any decoding failure (bad base64, missing separator, unknown id, garbage
 * timestamp) collapses into the same not_found fallback — no explicit 404,
 * per 03-share-link.md ("this Svyatoslav is lost in time" beats a technical error).
 */
function resolveShareToken(bank: Bank, token: string): ResolvedShare {
  try {
    const payload = Buffer.from(token, "base64url").toString("utf-8");
    const separatorIndex = payload.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error("malformed share token payload");
    }

    const id = payload.slice(0, separatorIndex);
    const timestamp = Number(payload.slice(separatorIndex + 1));

    const found = bank.idIndex.get(id);
    if (!found || !Number.isFinite(timestamp)) {
      throw new Error("unknown id or malformed timestamp");
    }

    return { category: found.category, entry: found.entry, timestamp, isFallback: false };
  } catch {
    const fallback = pickFallbackName(bank);
    return { ...fallback, timestamp: Date.now(), isFallback: true };
  }
}

// Mirrors the hue-from-category-title hash used client-side in script.js,
// so a share link's accent color matches what the roulette showed at share time.
function hueFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function createShareRouter(bank: Bank, locale: LocaleConfig, env: Env): Router {
  const router = Router();

  router.get("/r/:token", (req, res) => {
    const resolved = resolveShareToken(bank, req.params.token);
    const date = formatDate(resolved.timestamp, locale);
    const heading = resolved.isFallback
      ? locale.share_page.fallback_heading
      : interpolate(locale.share_page.heading, { date, name: resolved.entry.name });
    const description = interpolate(locale.meta.og_description, { name: resolved.entry.name });

    const pageUrl = `https://${env.siteDomain}/r/${req.params.token}`;
    const ogImageUrl = `${pageUrl}/og-image.png`;

    const hue = hueFromString(resolved.category.title);
    const idText = `#${resolved.entry.id}`;
    const name = escapeHtml(resolved.entry.name);
    const hint = escapeHtml(resolved.entry.hint);
    const categoryTitle = escapeHtml(resolved.category.title);
    const homeLink = escapeHtml(locale.share_page.home_link);
    const viewCaption = "просмотр по ссылке";

    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="${escapeHtml(locale.locale_code)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
<meta property="og:title" content="${escapeHtml(heading)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(ogImageUrl)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<main class="card is-landed is-shared" id="card" style="--hue: ${hue}">
  <div class="bg-idle" aria-hidden="true"></div>
  <div class="bg-theme" aria-hidden="true"></div>
  <div class="scanline" aria-hidden="true"></div>
  <div class="panel">
    <div class="panel-main">
      <p class="status">nameslav.sh · stopped</p>
      <div class="reel-window">
        <div class="reel-track"><div class="reel-row">${name}</div></div>
      </div>
      <p class="hint">${hint}</p>
      <div class="meta-mobile">
        <div class="meta-mobile-col">
          <span class="meta-category">${categoryTitle}</span>
          <span class="meta-id">${escapeHtml(idText)}</span>
        </div>
        <div class="meta-mobile-col meta-mobile-col--right">
          <span class="meta-date">${escapeHtml(date)}</span>
          <span class="meta-caption">${viewCaption}</span>
        </div>
      </div>
      <a class="share-btn" href="/">${homeLink}</a>
      <div class="footer-row">
        <p class="footnote">Это уже готовый результат по ссылке — сыграть свой можно на главной</p>
        <a class="repo-link" href="https://github.com/SvyatBeloz/Nameslav" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
    <div class="rail">
      <div class="rail-content">
        <span class="meta-id">${escapeHtml(idText)}</span>
        <p class="meta-category-vertical">${categoryTitle}</p>
        <div class="rail-date-block">
          <span class="meta-date">${escapeHtml(date)}</span>
          <span class="meta-caption">${viewCaption}</span>
        </div>
      </div>
    </div>
  </div>
</main>
<script>
(function () {
  var panel = document.querySelector(".panel");
  panel.addEventListener("mousemove", function (ev) {
    var r = panel.getBoundingClientRect();
    var px = (ev.clientY - r.top) / r.height - 0.5;
    var py = (ev.clientX - r.left) / r.width - 0.5;
    panel.style.transform = "perspective(1000px) rotateX(" + (px * -1.5) + "deg) rotateY(" + (py * 1.5) + "deg)";
  });
  panel.addEventListener("mouseleave", function () { panel.style.transform = ""; });
})();
</script>
</body>
</html>
`);
  });

  // Never cached: every share link is a one-off, per-user/per-moment event
  // (see 03-share-link.md) — re-rendered from scratch on every request.
  router.get("/r/:token/og-image.png", async (req, res, next) => {
    try {
      const resolved = resolveShareToken(bank, req.params.token);
      const props: OgTemplateProps = {
        id: resolved.entry.id,
        name: resolved.entry.name,
        hint: resolved.entry.hint,
        categoryTitle: resolved.category.title,
        categorySlug: resolved.category.slug,
        date: formatDate(resolved.timestamp, locale),
        domain: env.siteDomain,
      };
      const image = await renderOgImage(resolved.category.template, props);
      res.set("Content-Type", "image/png");
      res.send(image);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
