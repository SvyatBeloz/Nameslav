import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { CategoryFileSchema, type Category, type NameEntry } from "./schema.js";
import { validateBank } from "./bankValidator.js";

export interface Bank {
  categories: Category[];
  idIndex: Map<string, { entry: NameEntry; category: Category }>;
}

/** Loads, parses and validates every *.yaml/*.yml category file in bankDir. Fails fast. */
export function loadBank(bankDir: string): Bank {
  const files = readdirSync(bankDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  if (files.length === 0) {
    throw new Error(`Банк имён пуст: не найдено ни одного .yaml файла в ${bankDir}`);
  }

  const categories: Category[] = [];

  for (const file of files) {
    const fullPath = join(bankDir, file);
    const raw = readFileSync(fullPath, "utf-8");

    let parsed: unknown;
    try {
      parsed = parseYaml(raw);
    } catch (cause) {
      throw new Error(`Не удалось распарсить YAML в файле ${file}: ${(cause as Error).message}`);
    }

    const result = CategoryFileSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");
      throw new Error(`Невалидная структура в файле ${file}: ${issues}`);
    }

    categories.push({
      ...result.data.category,
      names: result.data.names,
      sourceFile: file,
    });
  }

  validateBank(categories);

  const idIndex = new Map<string, { entry: NameEntry; category: Category }>();
  for (const category of categories) {
    for (const entry of category.names) {
      idIndex.set(entry.id, { entry, category });
    }
  }

  return { categories, idIndex };
}
