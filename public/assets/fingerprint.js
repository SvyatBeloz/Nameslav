// Fixed registry of everything that CAN be collected — does not change without
// a redeploy. Which subset actually gets used (and in what order) is decided
// server-side via /api/config.json (fingerprintFields), see 05-fingerprint.md.
export const SIGNAL_COLLECTORS = {
  language: () => navigator.language,
  timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  screenResolution: () => `${screen.width}x${screen.height}`,
  hardwareConcurrency: () => String(navigator.hardwareConcurrency),
  userAgent: () => navigator.userAgent,
};

export function buildSeed(date, fingerprintFields, salt) {
  const collected = fingerprintFields
    .map((field) => {
      const collector = SIGNAL_COLLECTORS[field];
      if (!collector) {
        // Config typo or a backend/frontend version mismatch — degrade
        // gracefully instead of breaking the page for every visitor.
        console.warn(`Неизвестное поле fingerprint: "${field}", пропущено`);
        return null;
      }
      return collector();
    })
    .filter((value) => value !== null);

  return [date, ...collected, salt].join("|");
}
