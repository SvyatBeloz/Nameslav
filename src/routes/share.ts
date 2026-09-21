import { Router } from "express";
import { readFileSync } from "node:fs";
import type { Bank } from "../names/bankLoader.js";
import type { LocaleConfig } from "../i18n/schema.js";
import type { Env } from "../config/env.js";
import { resolveShareToken } from "../names/shareToken.js";
import { renderOgImage } from "../og/renderer.js";
import { formatDate, interpolate } from "../i18n/loader.js";
import { renderTemplate } from "../utils/template.js";
import type { OgTemplateProps } from "../og/templates/registry.js";

// Mirrors the hue-from-category-title hash used client-side in script.js,
// so a share link's accent color matches what the roulette showed at share time.
function hueFromString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function createShareRouter(
  bank: Bank,
  locale: LocaleConfig,
  env: Env,
  templatePath: string,
): Router {
  const router = Router();

  // Read once at startup, like the homepage: only the values differ per request.
  const template = readFileSync(templatePath, "utf-8");

  router.get("/r/:token", (req, res) => {
    const resolved = resolveShareToken(bank, req.params.token);
    const date = formatDate(resolved.timestamp, locale);
    const heading = resolved.isFallback
      ? locale.share_page.fallback_heading
      : interpolate(locale.share_page.heading, { date, name: resolved.entry.name });
    // A fallback page is not "today you are — X": nobody is that name, the link
    // is simply broken. Reusing meta.og_description there put a cheerful
    // "Сегодня ты — Потеряслав" next to the "lost in time" title.
    const description = resolved.isFallback
      ? locale.share_page.fallback_og_description
      : interpolate(locale.meta.og_description, { name: resolved.entry.name });

    const pageUrl = `https://${env.siteDomain}/r/${req.params.token}`;

    res.set("Content-Type", "text/html; charset=utf-8");
    // Explicit rather than implied: with no Cache-Control at all, intermediaries
    // are free to cache heuristically. no-cache + Express' ETag lets them
    // revalidate cheaply instead.
    res.set("Cache-Control", "no-cache");
    res.send(
      renderTemplate(template, {
        LOCALE_CODE: locale.locale_code,
        HEADING: heading,
        OG_DESCRIPTION: description,
        OG_IMAGE_URL: `${pageUrl}/og-image.png`,
        PAGE_URL: pageUrl,
        HUE: String(hueFromString(resolved.category.title)),
        NAME: resolved.entry.name,
        HINT: resolved.entry.hint,
        CATEGORY_TITLE: resolved.category.title,
        ID_TEXT: `#${resolved.entry.id}`,
        DATE: date,
        VIEW_CAPTION: locale.share_page.view_caption,
        FOOTNOTE: locale.share_page.footnote,
        HOME_LINK: locale.share_page.home_link,
      }),
    );
  });

  // Cacheable because the response is a pure function of the token: a valid one
  // carries both the id and the timestamp, and a broken one now resolves to a
  // fallback seeded by the token itself (see resolveShareToken). Without this,
  // every crawler re-render hit the renderer again — an unauthenticated ~60-byte
  // GET turning into a 22 KB PNG plus CPU, with nothing in front of it.
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
      // A valid token pins the date too, so its image never changes. The
      // fallback's date is "today", so it only holds until the UTC day rolls.
      res.set(
        "Cache-Control",
        resolved.isFallback ? "public, max-age=3600" : "public, max-age=31536000, immutable",
      );
      res.send(image);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
