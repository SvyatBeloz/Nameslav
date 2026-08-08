import { Router } from "express";
import type { LocaleConfig } from "../i18n/schema.js";
import type { Env } from "../config/env.js";
import { getStaticOgImage } from "../og/renderer.js";

export function createOgImageRouter(locale: LocaleConfig, env: Env): Router {
  const router = Router();

  // Static branding card, NOT a per-day name: social crawlers cache OG images
  // aggressively, so a rotating daily image would go stale in previews anyway
  // (see docs/06-og-rendering.md). Rendered once per process, memoized in memory.
  router.get("/og-image.png", async (_req, res, next) => {
    try {
      const image = await getStaticOgImage({
        title: locale.meta.site_title,
        description: locale.meta.site_description,
        domain: env.siteDomain,
      });
      res.set("Content-Type", "image/png");
      // The card only changes on redeploy; still keep the TTL modest.
      res.set("Cache-Control", "public, max-age=3600");
      res.send(image);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
