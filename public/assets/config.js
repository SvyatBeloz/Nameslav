let configPromise = null;

/** Fetches /api/config.json once and caches the result for the rest of the page's life. */
export function getConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config.json").then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load /api/config.json: ${res.status}`);
      }
      return res.json();
    });
  }
  return configPromise;
}
