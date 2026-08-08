import { Router } from "express";
import type { Bank } from "../names/bankLoader.js";
import type { LocaleConfig } from "../i18n/schema.js";

export interface HealthState {
  isShuttingDown: boolean;
}

export function createHealthRouter(bank: Bank, locale: LocaleConfig, state: HealthState): Router {
  const router = Router();

  // Liveness: as cheap as possible, no dependency checks — only "is the
  // process fundamentally stuck/dead", not transient dependency issues.
  router.get("/livez", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: bank/locale are loaded synchronously before listen() starts,
  // so both checks are effectively always true post-startup. They stay here so
  // the endpoint still documents what "ready" means for this service.
  router.get("/readyz", (_req, res) => {
    if (state.isShuttingDown) {
      res.status(503).json({ status: "not_ready", reason: "shutting_down" });
      return;
    }

    const checks = {
      bankLoaded: bank.categories.some((category) => category.role === "regular"),
      localeLoaded: Boolean(locale.locale_code),
    };

    const allOk = Object.values(checks).every(Boolean);
    res.status(allOk ? 200 : 503).json({ status: allOk ? "ok" : "not_ready", checks });
  });

  return router;
}
