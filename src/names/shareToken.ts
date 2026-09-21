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
 * The widest range a JS Date can represent: ±8.64e15 ms around the epoch
 * (ECMA-262 "Time Values and Time Range"). Anything beyond it produces an
 * Invalid Date, and Intl.DateTimeFormat then throws RangeError — which used to
 * surface as a 500 on both share routes for a hand-crafted token, instead of
 * the fallback this function promises.
 */
const MAX_TIMESTAMP_MS = 8.64e15;

/** A plain, optionally negative integer literal — nothing else is a timestamp. */
const TIMESTAMP_PATTERN = /^-?\d+$/;

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
    const rawTimestamp = payload.slice(separatorIndex + 1);

    const found = bank.idIndex.get(id);
    if (!found) {
      throw new Error("unknown id");
    }
    // Matched as a literal rather than fed straight to Number(), which is far
    // too forgiving for a value that reaches Intl.DateTimeFormat: it reads "",
    // " " and "\n" as 0 (an "<id>:" token would render as 1 January 1970),
    // "0x10" as 16, and "1e300" as a finite-but-unformattable number.
    if (!TIMESTAMP_PATTERN.test(rawTimestamp)) {
      throw new Error("malformed timestamp");
    }
    const timestamp = Number(rawTimestamp);
    if (Math.abs(timestamp) > MAX_TIMESTAMP_MS) {
      throw new Error("timestamp outside the representable Date range");
    }

    return { category: found.category, entry: found.entry, timestamp, isFallback: false };
  } catch {
    // Seeded with the raw token, not with randomness: the share page and its OG
    // image resolve the same token in two independent requests and have to
    // agree on which lost Svyatoslav they show (see pickFallbackName).
    const fallback = pickFallbackName(bank, token);
    return { ...fallback, timestamp: Date.now(), isFallback: true };
  }
}
