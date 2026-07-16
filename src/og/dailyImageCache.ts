import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderOgImage } from "./renderer.js";
import type { OgTemplateProps, TemplateId } from "./templates/registry.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CACHE_DIR = join(PROJECT_ROOT, "cache");

function cacheFilePath(date: string): string {
  return join(CACHE_DIR, `og-image-${date}.png`);
}

/**
 * Disk cache for the anonymous daily image only (/og-image.png) — same result
 * for everyone, recomputed once per calendar date. Share-link images are never
 * cached (see src/routes/share.ts), so this module is not used there.
 */
export async function getDailyOgImage(
  date: string,
  templateId: TemplateId,
  props: OgTemplateProps,
): Promise<Buffer> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const path = cacheFilePath(date);
  if (existsSync(path)) {
    return readFileSync(path);
  }

  const image = await renderOgImage(templateId, props);
  writeFileSync(path, image);
  return image;
}
