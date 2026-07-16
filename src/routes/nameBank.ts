import { Router } from "express";
import type { Bank } from "../names/bankLoader.js";

export function createNameBankRouter(bank: Bank): Router {
  const router = Router();

  // Only role: regular categories -- not_found stays server-side only, so the
  // client-side selector (public/assets/selectorMath.js) can never see or
  // accidentally pick fallback-only entries (see 03-share-link.md).
  const payload = {
    categories: bank.categories
      .filter((category) => category.role === "regular")
      .map((category) => ({
        slug: category.slug,
        title: category.title,
        weight: category.weight,
        names: category.names.map((entry) => ({ id: entry.id, name: entry.name, hint: entry.hint })),
      })),
  };

  router.get("/api/name-bank.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.json(payload);
  });

  return router;
}
