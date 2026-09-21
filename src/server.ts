import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { env } from "./config/env.js";
import { assertTemplatesImplemented, createApp } from "./app.js";
import { loadBank } from "./names/bankLoader.js";
import { loadLocale } from "./i18n/loader.js";
import { ogRendererReady } from "./og/renderer.js";
import type { HealthState } from "./routes/health.js";

// Mirrors the Docker layout from 08-deployment.md: bank/locale get copied
// INTO dist/ alongside the compiled server (dist/names/bank, dist/i18n/locale.yaml),
// while public/ and templates/ stay siblings of dist/ — so these resolve differently.
const moduleDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(moduleDir, "..");
const BANK_DIR = join(moduleDir, "names", "bank");
const LOCALE_PATH = join(moduleDir, "i18n", "locale.yaml");
const PUBLIC_DIR = join(projectRoot, "public");
const TEMPLATES_DIR = join(projectRoot, "templates");

async function main(): Promise<void> {
  const bank = loadBank(BANK_DIR);
  assertTemplatesImplemented(bank);
  const locale = loadLocale(LOCALE_PATH);
  await ogRendererReady;

  const healthState: HealthState = { isShuttingDown: false };
  const app = createApp(bank, locale, env, healthState, {
    publicDir: PUBLIC_DIR,
    homeTemplatePath: join(TEMPLATES_DIR, "index.html"),
    shareTemplatePath: join(TEMPLATES_DIR, "share.html"),
  });

  const server = app.listen(env.port, () => {
    console.log(`nameslav-roulette listening on port ${env.port}`);
  });

  const SHUTDOWN_GRACE_MS = 10_000;

  const shutdown = () => {
    healthState.isShuttingDown = true; // /readyz starts returning 503 — orchestrator stops sending new traffic
    server.close(() => process.exit(0));
    // server.close() alone waits for ALL open connections — including idle
    // keep-alive ones — so without help the process hangs until the
    // orchestrator's SIGKILL. Close idle connections immediately, and
    // force-exit after the grace period in case an in-flight request stalls.
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  };

  process.on("SIGTERM", shutdown); // Docker/Kubernetes stop
  process.on("SIGINT", shutdown); // Ctrl+C during local dev
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
