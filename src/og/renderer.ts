import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { Renderer } from "takumi-js/node";
import { fromJsx } from "takumi-js/helpers/jsx";
import { TEMPLATE_COMPONENTS, type OgTemplateProps, type TemplateId } from "./templates/registry.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FONTS_DIR = join(PROJECT_ROOT, "public", "assets", "fonts");

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

export async function renderOgImage(templateId: TemplateId, props: OgTemplateProps): Promise<Buffer> {
  await ogRendererReady;

  const Component = TEMPLATE_COMPONENTS[templateId];
  if (!Component) {
    throw new Error(`Нет реализации OG-шаблона для template id "${templateId}"`);
  }

  const element = createElement(Component, props);
  const { node } = await fromJsx(element);
  return renderer.render(node, { width: OG_WIDTH, height: OG_HEIGHT });
}
