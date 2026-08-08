import type { Bank } from "./bankLoader.js";
import type { Category, NameEntry } from "./schema.js";
import { pickFallbackName } from "./selector.js";

export interface ResolvedShare {
  category: Category;
  entry: NameEntry;
  timestamp: number;
  isFallback: boolean;
}

/**
 * Any decoding failure (bad base64, missing separator, unknown id, garbage
 * timestamp) collapses into the same not_found fallback — no explicit 404,
 * per 03-share-link.md ("this Svyatoslav is lost in time" beats a technical error).
 */
export function resolveShareToken(bank: Bank, token: string): ResolvedShare {
  try {
    const payload = Buffer.from(token, "base64url").toString("utf-8");
    const separatorIndex = payload.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error("malformed share token payload");
    }

    const id = payload.slice(0, separatorIndex);
    const timestamp = Number(payload.slice(separatorIndex + 1));

    const found = bank.idIndex.get(id);
    if (!found || !Number.isFinite(timestamp)) {
      throw new Error("unknown id or malformed timestamp");
    }

    return { category: found.category, entry: found.entry, timestamp, isFallback: false };
  } catch {
    const fallback = pickFallbackName(bank);
    return { ...fallback, timestamp: Date.now(), isFallback: true };
  }
}
