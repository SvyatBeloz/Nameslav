import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createElement, type ReactElement } from "react";
import { Renderer } from "takumi-js/node";
import { fromJsx } from "takumi-js/helpers/jsx";
import { TEMPLATE_COMPONENTS, type OgTemplateProps, type TemplateId } from "./templates/registry.js";
import { StaticOgCard, type StaticOgCardProps } from "./templates/staticCard.js";

// assets/, not public/: these ~1.2 MB of TTFs are read by the OG renderer in
// this process and never by a browser. Under public/ they were a public
// download the frontend had no use for.
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONTS_DIR = join(PROJECT_ROOT, "assets", "fonts");

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const renderer = new Renderer();

/**
 * Names in the bank are Cyrillic; Takumi's built-in default font is Latin-only.
 * Register a real Cyrillic-covering font once, before the server starts
 * accepting traffic, rather than passing `fonts` on every render() call.
 */
export const ogRendererReady: Promise<void> = (async () => {
  const regular = readFileSync(join(FONTS_DIR, "NotoSans-Regular.ttf"));
  const bold = readFileSync(join(FONTS_DIR, "NotoSans-Bold.ttf"));
  await renderer.registerFont({ name: "NotoSansOG", data: regular, weight: 400 });
  await renderer.registerFont({ name: "NotoSansOG", data: bold, weight: 700 });
})();

async function renderElement(element: ReactElement): Promise<Buffer> {
  await ogRendererReady;
  const { node } = await fromJsx(element);
  return renderer.render(node, { width: OG_WIDTH, height: OG_HEIGHT });
}

/** Renders a name entry's OG image (share links) via the template registry. */
export async function renderOgImage(templateId: TemplateId, props: OgTemplateProps): Promise<Buffer> {
  const Component = TEMPLATE_COMPONENTS[templateId];
  if (!Component) {
    throw new Error(`Нет реализации OG-шаблона для template id "${templateId}"`);
  }
  return renderElement(createElement(Component, props));
}

let staticOgImagePromise: Promise<Buffer> | null = null;

/**
 * Root-page branding card, rendered once per process and memoized — it carries
 * no per-day content, so there is nothing to invalidate and no disk cache
 * (the former dailyImageCache is gone). A failed render drops the memo so the
 * next request retries instead of caching the failure.
 */
export function getStaticOgImage(props: StaticOgCardProps): Promise<Buffer> {
  if (!staticOgImagePromise) {
    staticOgImagePromise = renderElement(createElement(StaticOgCard, props)).catch((err) => {
      staticOgImagePromise = null;
      throw err;
    });
  }
  return staticOgImagePromise;
}
