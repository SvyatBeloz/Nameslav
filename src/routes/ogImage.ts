import { Router } from "express";
import type { Bank } from "../names/bankLoader.js";
import type { LocaleConfig } from "../i18n/schema.js";
import type { Env } from "../config/env.js";
import { pickDailyName } from "../names/selector.js";
import { getDailyOgImage } from "../og/dailyImageCache.js";
import { formatDate } from "../i18n/loader.js";
import type { OgTemplateProps } from "../og/templates/registry.js";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createOgImageRouter(bank: Bank, locale: LocaleConfig, env: Env): Router {
  const router = Router();

  router.get("/og-image.png", async (_req, res, next) => {
    try {
      const date = todayUtc();
      const { category, entry } = pickDailyName(bank, date);

      const props: OgTemplateProps = {
        id: entry.id,
        name: entry.name,
        hint: entry.hint,
        categoryTitle: category.title,
        categorySlug: category.slug,
        date: formatDate(Date.now(), locale),
        domain: env.siteDomain,
      };

      const image = await getDailyOgImage(date, category.template, props);
      res.set("Content-Type", "image/png");
      res.send(image);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
