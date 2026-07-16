import { Router } from "express";
import type { LocaleConfig } from "../i18n/schema.js";

export function createLocaleRouter(locale: LocaleConfig): Router {
  const router = Router();

  router.get("/api/locale.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.json(locale);
  });

  return router;
}
