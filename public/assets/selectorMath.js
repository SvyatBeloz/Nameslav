// Mirror of src/names/selector.ts + src/utils/hash.ts. Same math, different
// digest source (crypto.subtle here vs node:crypto server-side) — see the
// "accepted duplication" note in 05-fingerprint.md. Keep both in sync by hand.

function bytesToUnitFloat(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uint64 = view.getBigUint64(0, false);
  const value = Number(uint64) / Number(2n ** 64n);
  // Same rounding-edge-case clamp as the Node implementation: the max uint64
  // rounds up to exactly 2^64 as a double, which would otherwise yield 1.0.
  return value < 1 ? value : 1 - Number.EPSILON;
}

export async function seedToFloats(seed, count) {
  const digestBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const digest = new Uint8Array(digestBuffer);
  const maxCount = Math.floor(digest.length / 8);
  if (count < 1 || count > maxCount) {
    throw new Error(`seedToFloats: count must be between 1 and ${maxCount}, got ${count}`);
  }

  const floats = [];
  for (let i = 0; i < count; i++) {
    floats.push(bytesToUnitFloat(digest.subarray(i * 8, i * 8 + 8)));
  }
  return floats;
}

export function pickWeighted(items, weights, float) {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const target = float * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

export function pickEqual(items, float) {
  const index = Math.min(Math.floor(float * items.length), items.length - 1);
  return items[index];
}
