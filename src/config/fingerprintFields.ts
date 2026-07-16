export const KNOWN_FINGERPRINT_FIELDS = [
  "language",
  "timezone",
  "screenResolution",
  "hardwareConcurrency",
  "userAgent",
] as const;

export type FingerprintField = (typeof KNOWN_FINGERPRINT_FIELDS)[number];

/** Parses FINGERPRINT_FIELDS env var. Empty/unset -> all known fields. Fails fast on typos. */
export function parseFingerprintFields(raw: string | undefined): FingerprintField[] {
  if (!raw) {
    return [...KNOWN_FINGERPRINT_FIELDS];
  }

  const fields = raw
    .split(",")
    .map((field) => field.trim())
    .filter((field) => field.length > 0);

  const known: readonly string[] = KNOWN_FINGERPRINT_FIELDS;
  for (const field of fields) {
    if (!known.includes(field)) {
      throw new Error(
        `Неизвестное поле FINGERPRINT_FIELDS: "${field}". Допустимые значения: ${KNOWN_FINGERPRINT_FIELDS.join(", ")}`,
      );
    }
  }

  return fields as FingerprintField[];
}
