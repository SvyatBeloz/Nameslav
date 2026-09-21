import type { RequestHandler } from "express";

/**
 * Content Security Policy for a site that loads nothing from anywhere else.
 *
 * `default-src 'none'` is the baseline and every allowance below is deliberate:
 * - script-src 'self'    — script.js / selectorMath.js / fingerprint.js / tilt.js.
 *                          Notably WITHOUT 'unsafe-inline': the share page's
 *                          tilt handler was moved into /assets/tilt.js so this
 *                          directive could stay strict.
 * - style-src 'self' 'unsafe-inline'
 *                        — style.css, plus inline style attributes. The share
 *                          page carries the per-category accent as
 *                          `style="--hue: N"`, and script.js sets .style on the
 *                          panel. Restricting this to style-src-attr instead
 *                          would be tighter, but Firefox does not implement
 *                          that directive and would fall back to style-src,
 *                          silently dropping the accent colour.
 * - img-src 'self'       — favicon and the OG images.
 * - font-src 'self'      — nothing loads a webfont today (the UI is system-ui,
 *                          and the bundled Noto Sans is used server-side only),
 *                          but keep the door open for the site's own files.
 * - connect-src 'self'   — the three /api/*.json fetches on the homepage.
 * - base-uri / form-action / frame-ancestors 'none'
 *                        — there is no <base>, no form and no reason to be
 *                          framed; all three shut off classic injection levers.
 *
 * No Strict-Transport-Security here on purpose: TLS is terminated in front of
 * this process (the container itself speaks plain HTTP), so the app cannot know
 * whether a request arrived over HTTPS. HSTS belongs on whatever terminates it.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Security headers for every response. Hand-rolled rather than pulled in via
 * helmet: the set is small, the CSP has to be tuned to this exact asset list
 * anyway, and each line below is easier to justify in review than a library
 * default someone would have to look up.
 */
export function createSecurityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    // Stops a browser from second-guessing a declared Content-Type — the
    // classic path from "user-supplied file" to "executed as script".
    res.set("X-Content-Type-Options", "nosniff");
    // The site is a joke name generator; nobody downstream needs to know which
    // page a visitor came from, and this fits its no-data-collection stance.
    res.set("Referrer-Policy", "no-referrer");
    // Legacy companion to frame-ancestors, for browsers that predate CSP3.
    res.set("X-Frame-Options", "DENY");
    // No cross-origin window handles into this page.
    res.set("Cross-Origin-Opener-Policy", "same-origin");
    next();
  };
}
