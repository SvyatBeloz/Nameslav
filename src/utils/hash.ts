import { createHash } from "node:crypto";

/**
 * Interprets exactly 8 bytes as a big-endian uint64 and maps it to [0, 1).
 * Shared by seedToFloats (deterministic) and pickFallbackName (true randomness)
 * so both paths agree on what "a float from 8 bytes" means.
 */
export function bytesToUnitFloat(bytes: Uint8Array): number {
  if (bytes.length !== 8) {
    throw new Error(`bytesToUnitFloat expects exactly 8 bytes, got ${bytes.length}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uint64 = view.getBigUint64(0, false);
  const value = Number(uint64) / Number(2n ** 64n);
  // Number(uint64) rounds to the nearest representable double; for the
  // largest uint64 values that rounds up to exactly 2^64, so the division
  // can land on 1.0 instead of staying in [0, 1). Clamp to the largest
  // double strictly below 1 to preserve the half-open range invariant.
  return value < 1 ? value : 1 - Number.EPSILON;
}

/**
 * Turns a seed string into `count` independent floats in [0, 1).
 * Takes sha256(seed) and slices the digest into non-overlapping 8-byte chunks.
 */
export function seedToFloats(seed: string, count: number): number[] {
  const digest = createHash("sha256").update(seed).digest();
  const maxCount = Math.floor(digest.length / 8);
  if (count < 1 || count > maxCount) {
    throw new Error(`seedToFloats: count must be between 1 and ${maxCount}, got ${count}`);
  }

  const floats: number[] = [];
  for (let i = 0; i < count; i++) {
    floats.push(bytesToUnitFloat(digest.subarray(i * 8, i * 8 + 8)));
  }
  return floats;
}
