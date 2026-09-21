import express, { type Express } from "express";
import type { Env } from "./config/env.js";
import type { Bank } from "./names/bankLoader.js";
import type { LocaleConfig } from "./i18n/schema.js";
import { TEMPLATE_COMPONENTS } from "./og/templates/registry.js";
import { createHealthRouter, type HealthState } from "./routes/health.js";
import { createHomeRouter } from "./routes/home.js";
import { createOgImageRouter } from "./routes/ogImage.js";
import { createShareRouter } from "./routes/share.js";
import { createNameBankRouter } from "./routes/nameBank.js";
import { createLocaleRouter } from "./routes/locale.js";
import { createConfigRouter } from "./routes/config.js";
import { createErrorHandler, createNotFoundHandler } from "./routes/errors.js";
import { createSecurityHeaders } from "./routes/security.js";

/**
 * Zod validates `template` against the known TEMPLATE_IDS, but a template id can
 * be declared before it has an implementation (e.g. "random" is reserved).
 * Rendering such a category would throw per-request (500 on OG images), so fail
 * at startup instead — same fail-fast contract as the bank validator.
 */
export function assertTemplatesImplemented(bank: Bank): void {
  for (const category of bank.categories) {
    if (!TEMPLATE_COMPONENTS[category.template]) {
      throw new Error(
        `Категория "${category.slug}" (${category.sourceFile}) использует нереализованный OG-шаблон "${category.template}"`,
      );
    }
  }
}

export interface AppPaths {
  publicDir: string;
  indexPath: string;
}

/**
 * Builds the fully wired Express app. Kept out of server.ts (which starts
 * listening on import) so tests can drive the real route stack — including the
 * 404/500 handlers, which only exist once every router is mounted.
 */
export function createApp(
  bank: Bank,
  locale: LocaleConfig,
  env: Env,
  healthState: HealthState,
  paths: AppPaths,
): Express {
  const app = express();

  // Advertising the framework and its version only helps someone matching the
  // deployment against a CVE list.
  app.disable("x-powered-by");

  // Before every route, so the headers land on static assets, JSON, images and
  // the 404/500 pages alike — not just the handlers that remembered to set them.
  app.use(createSecurityHeaders());

  // Home router first: it serves GET / (injected OG meta) and redirects
  // /index.html, so it must run before express.static. index:false stops the
  // static middleware from also serving the raw, uninjected index.html at /.
  app.use(createHomeRouter(locale, env, paths.indexPath));
  app.use(express.static(paths.publicDir, { index: false }));
  app.use(createHealthRouter(bank, locale, healthState));
  app.use(createOgImageRouter(locale, env));
  app.use(createShareRouter(bank, locale, env));
  app.use(createNameBankRouter(bank));
  app.use(createLocaleRouter(locale));
  app.use(createConfigRouter(env));

  // Terminal handlers, in this order and always last: the 404 catches paths no
  // router claimed, the error handler catches whatever any of them threw.
  app.use(createNotFoundHandler(locale));
  app.use(createErrorHandler(locale));

  return app;
}
