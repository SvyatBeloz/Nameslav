import type { ErrorRequestHandler, RequestHandler } from "express";
import type { LocaleConfig } from "../i18n/schema.js";
import { escapeHtml } from "../utils/html.js";

/**
 * Self-contained error page: it deliberately does NOT pull in /assets/style.css,
 * because that stylesheet is written against the .card/.panel structure of the
 * homepage and a 500 must still render when something is broken. Colors mirror
 * the site palette (see public/assets/style.css) so it doesn't look foreign.
 */
function renderErrorPage(locale: LocaleConfig, title: string, text: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(locale.locale_code)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; background: #0A0A0E; color: #F1F1F4;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    padding: 24px; text-align: center;
  }
  main { max-width: 34rem; }
  h1 { font-size: clamp(1.5rem, 5vw, 2.25rem); margin: 0 0 0.75rem; font-weight: 700; }
  p { margin: 0 0 2rem; color: #A6A6B2; line-height: 1.55; }
  a {
    display: inline-block; padding: 0.7rem 1.5rem; border-radius: 999px;
    border: 1px solid #2C2C36; color: #F1F1F4; text-decoration: none;
  }
  a:hover { border-color: #4A4A58; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(text)}</p>
<a href="/">${escapeHtml(locale.share_page.home_link)}</a>
</main>
</body>
</html>
`;
}

/** JSON for the /api/* surface, HTML for everything a human might be looking at. */
function wantsJson(path: string): boolean {
  return path.startsWith("/api/");
}

/**
 * Terminal 404. Must be mounted after every router: anything that reaches it is
 * a path no route claimed. Without it Express answers with its own English
 * `Cannot GET /x` page on an otherwise Russian-language site.
 */
export function createNotFoundHandler(locale: LocaleConfig): RequestHandler {
  return (req, res) => {
    const { not_found_title: title, not_found_text: text } = locale.errors;
    res.status(404);
    if (wantsJson(req.path)) {
      res.json({ error: "not_found" });
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(renderErrorPage(locale, title, text));
  };
}

/**
 * Terminal error handler. Logs the real error server-side and answers with a
 * generic page — unlike Express' default handler, which puts the stack trace in
 * the response body whenever NODE_ENV is anything other than "production".
 * The four-argument signature is what marks it as an error handler to Express.
 */
export function createErrorHandler(locale: LocaleConfig): ErrorRequestHandler {
  return (err, req, res, _next) => {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);

    // Headers already flushed (e.g. a render that failed mid-stream): the only
    // correct move left is to cut the connection, not to append an error page.
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const { server_error_title: title, server_error_text: text } = locale.errors;
    res.status(500);
    if (wantsJson(req.path)) {
      res.json({ error: "internal_server_error" });
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(renderErrorPage(locale, title, text));
  };
}
