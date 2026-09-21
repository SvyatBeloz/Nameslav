import { escapeHtml } from "./html.js";

/** `{{SCREAMING_SNAKE}}` — the placeholder shape both page templates use. */
const PLACEHOLDER_PATTERN = /\{\{([A-Z_]+)\}\}/g;

/**
 * Fills a `public/*.html` template. Every value is HTML-escaped on the way in,
 * without exception — the templates have no slot that takes markup, which is
 * what keeps this safe to use with per-request data on the share page.
 *
 * A placeholder with no value, or a value with no placeholder, throws rather
 * than degrading quietly: a typo'd name would otherwise ship a literal
 * `{{HINT}}` to visitors, or silently drop the text it was meant to carry.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  const used = new Set<string>();

  const rendered = template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    if (!(key in values)) {
      throw new Error(`В шаблоне есть плейсхолдер {{${key}}}, но значение для него не передано`);
    }
    used.add(key);
    return escapeHtml(values[key]!);
  });

  const unused = Object.keys(values).filter((key) => !used.has(key));
  if (unused.length > 0) {
    throw new Error(
      `Переданы значения без плейсхолдеров в шаблоне: ${unused.map((k) => `{{${k}}}`).join(", ")}`,
    );
  }

  return rendered;
}
