import { readFileSync } from "node:fs";
import { load as parseYaml } from "js-yaml";
import { LocaleSchema, type LocaleConfig } from "./schema.js";

/** Reads and validates locale.yaml. All keys are required — fails fast with the exact missing path. */
export function loadLocale(path: string): LocaleConfig {
  const raw = readFileSync(path, "utf-8");

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (cause) {
    throw new Error(`Не удалось распарсить YAML в файле ${path}: ${(cause as Error).message}`);
  }

  const result = LocaleSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Невалидная локаль в файле ${path}: ${issues}`);
  }

  return result.data;
}

export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function formatDate(timestamp: number, locale: LocaleConfig): string {
  return new Intl.DateTimeFormat(locale.locale_code, { dateStyle: locale.date_style }).format(
    new Date(timestamp),
  );
}
