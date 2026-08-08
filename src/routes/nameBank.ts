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
    // no-cache + ETag: the bank is read once at startup and served from memory,
    // so revalidation is cheap; it lets a bank edit + restart reach clients on
    // their next request instead of being hidden behind a day-long immutable cache.
    res.set("Cache-Control", "no-cache");
    res.json(payload);
  });

  return router;
}
