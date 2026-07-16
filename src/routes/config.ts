import { Router } from "express";
import type { Env } from "../config/env.js";

const CONFIG_VERSION = 1;

export function createConfigRouter(env: Env): Router {
  const router = Router();

  const payload = {
    fingerprintSalt: env.fingerprintSalt,
    fingerprintFields: env.fingerprintFields,
    siteDomain: env.siteDomain,
    configVersion: CONFIG_VERSION,
  };

  router.get("/api/config.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.json(payload);
  });

  return router;
}
