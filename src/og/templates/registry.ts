import type { ComponentType } from "react";
import { WhoamiTemplate } from "./whoami.js";

export const TEMPLATE_IDS = ["whoami", "random"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface OgTemplateProps {
  id: string;
  name: string;
  hint: string;
  categoryTitle: string;
  categorySlug: string;
  date: string;
  domain: string;
}

export type OgTemplateComponent = ComponentType<OgTemplateProps>;

/**
 * Not every TEMPLATE_ID has an implementation yet ("random" is reserved for a
 * future template) — renderOgImage throws a clear error for unmapped ids
 * rather than this being a full Record.
 */
export const TEMPLATE_COMPONENTS: Partial<Record<TemplateId, OgTemplateComponent>> = {
  whoami: WhoamiTemplate,
};
