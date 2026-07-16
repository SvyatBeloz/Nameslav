import { z } from "zod";
import { ROLE_IDS } from "./roles.js";
import { TEMPLATE_IDS } from "../og/templates/registry.js";

export const NAME_ID_PATTERN = /^[a-z0-9-]+$/;

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 40;
export const MIN_HINT_LENGTH = 5;
export const MAX_HINT_LENGTH = 200;

export const NameEntrySchema = z.object({
  id: z.string().min(1).regex(NAME_ID_PATTERN, "id must match ^[a-z0-9-]+$"),
  name: z.string().min(1),
  hint: z.string().min(1),
});
export type NameEntry = z.infer<typeof NameEntrySchema>;

export const CategoryHeaderSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  version: z.number().int(),
  template: z.enum(TEMPLATE_IDS),
  weight: z.number().positive(),
  role: z.enum(ROLE_IDS),
});
export type CategoryHeader = z.infer<typeof CategoryHeaderSchema>;

export const CategoryFileSchema = z.object({
  category: CategoryHeaderSchema,
  names: z.array(NameEntrySchema),
});
export type CategoryFile = z.infer<typeof CategoryFileSchema>;

export type Category = CategoryHeader & {
  names: NameEntry[];
  /** YAML filename this category was loaded from, used for validation error messages. */
  sourceFile: string;
};
