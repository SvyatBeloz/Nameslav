import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { env } from "./config/env.js";
import { loadBank } from "./names/bankLoader.js";
import { loadLocale } from "./i18n/loader.js";
import { ogRendererReady } from "./og/renderer.js";
import { CACHE_DIR } from "./og/dailyImageCache.js";
import { createHealthRouter, type HealthState } from "./routes/health.js";
import { createOgImageRouter } from "./routes/ogImage.js";
import { createShareRouter } from "./routes/share.js";
import { createNameBankRouter } from "./routes/nameBank.js";
import { createLocaleRouter } from "./routes/locale.js";
import { createConfigRouter } from "./routes/config.js";

// Mirrors the Docker layout from 08-deployment.md: bank/locale get copied
// INTO dist/ alongside the compiled server (dist/names/bank, dist/i18n/locale.yaml),
// while public/ stays a sibling of dist/ — so these two resolve differently.
const moduleDir = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = join(moduleDir, "names", "bank");
const LOCALE_PATH = join(moduleDir, "i18n", "locale.yaml");
const PUBLIC_DIR = join(moduleDir, "..", "public");

async function main(): Promise<void> {
  const bank = loadBank(BANK_DIR);
  const locale = loadLocale(LOCALE_PATH);
  mkdirSync(CACHE_DIR, { recursive: true });
  await ogRendererReady;

  const app = express();
  const healthState: HealthState = { isShuttingDown: false };

  app.use(express.static(PUBLIC_DIR));
  app.use(createHealthRouter(bank, locale, CACHE_DIR, healthState));
  app.use(createOgImageRouter(bank, locale, env));
  app.use(createShareRouter(bank, locale, env));
  app.use(createNameBankRouter(bank));
  app.use(createLocaleRouter(locale));
  app.use(createConfigRouter(env));

  const server = app.listen(env.port, () => {
    console.log(`nameslav-roulette listening on port ${env.port}`);
  });

  process.on("SIGTERM", () => {
    healthState.isShuttingDown = true; // /readyz starts returning 503 — orchestrator stops sending new traffic
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
