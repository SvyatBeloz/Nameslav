import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { env } from "./config/env.js";
import { loadBank, type Bank } from "./names/bankLoader.js";
import { loadLocale } from "./i18n/loader.js";
import { ogRendererReady } from "./og/renderer.js";
import { TEMPLATE_COMPONENTS } from "./og/templates/registry.js";
import { createHealthRouter, type HealthState } from "./routes/health.js";
import { createHomeRouter } from "./routes/home.js";
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
const INDEX_PATH = join(PUBLIC_DIR, "index.html");

/**
 * Zod validates `template` against the known TEMPLATE_IDS, but a template id can
 * be declared before it has an implementation (e.g. "random" is reserved).
 * Rendering such a category would throw per-request (500 on OG images), so fail
 * at startup instead — same fail-fast contract as the bank validator.
 */
function assertTemplatesImplemented(bank: Bank): void {
  for (const category of bank.categories) {
    if (!TEMPLATE_COMPONENTS[category.template]) {
      throw new Error(
        `Категория "${category.slug}" (${category.sourceFile}) использует нереализованный OG-шаблон "${category.template}"`,
      );
    }
  }
}

async function main(): Promise<void> {
  const bank = loadBank(BANK_DIR);
  assertTemplatesImplemented(bank);
  const locale = loadLocale(LOCALE_PATH);
  await ogRendererReady;

  const app = express();
  const healthState: HealthState = { isShuttingDown: false };

  // Home router first: it serves GET / (injected OG meta) and redirects
  // /index.html, so it must run before express.static. index:false stops the
  // static middleware from also serving the raw, uninjected index.html at /.
  app.use(createHomeRouter(locale, env, INDEX_PATH));
  app.use(express.static(PUBLIC_DIR, { index: false }));
  app.use(createHealthRouter(bank, locale, healthState));
  app.use(createOgImageRouter(locale, env));
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
