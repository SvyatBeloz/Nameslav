import { Router } from "express";
import type { LocaleConfig } from "../i18n/schema.js";

export function createLocaleRouter(locale: LocaleConfig): Router {
  const router = Router();

  router.get("/api/locale.json", (_req, res) => {
    // no-cache + ETag: same reasoning as the other /api endpoints — revalidation
    // is cheap (served from memory) and locale edits propagate immediately.
    res.set("Cache-Control", "no-cache");
    res.json(locale);
  });

  return router;
}
