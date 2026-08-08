import { randomBytes } from "node:crypto";
import { bytesToUnitFloat } from "../utils/hash.js";
import type { Bank } from "./bankLoader.js";
import type { Category, NameEntry } from "./schema.js";

/** Picks an item from `items` weighted by the matching entry in `weights`, using `float` in [0, 1). */
export function pickWeighted<T>(items: T[], weights: number[], float: number): T {
  if (items.length === 0) {
    throw new Error("pickWeighted: items must not be empty");
  }
  if (items.length !== weights.length) {
    throw new Error("pickWeighted: items and weights must have the same length");
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    throw new Error("pickWeighted: total weight must be positive");
  }

  const target = float * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i]!;
    if (target < cumulative) {
      return items[i]!;
    }
  }
  return items[items.length - 1]!;
}

/** Picks an item from `items` with equal probability, using `float` in [0, 1). */
export function pickEqual<T>(items: T[], float: number): T {
  if (items.length === 0) {
    throw new Error("pickEqual: items must not be empty");
  }
  const index = Math.min(Math.floor(float * items.length), items.length - 1);
  return items[index]!;
}

/**
 * True-randomness pick used only as a fallback for broken/unknown share tokens.
 * Note: `pickPersonalName` (date + fingerprint) is intentionally NOT implemented
 * here — it runs entirely in the browser, see public/assets/selectorMath.js.
 */
export function pickFallbackName(bank: Bank): { category: Category; entry: NameEntry } {
  const notFoundCategory = bank.categories.find((category) => category.role === "not_found");
  if (!notFoundCategory) {
    throw new Error("Bank has no category with role 'not_found'");
  }

  const float = bytesToUnitFloat(randomBytes(8));
  const entry = pickEqual(notFoundCategory.names, float);
  return { category: notFoundCategory, entry };
}
