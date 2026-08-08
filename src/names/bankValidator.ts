import {
  MAX_HINT_LENGTH,
  MAX_NAME_LENGTH,
  MIN_HINT_LENGTH,
  MIN_NAME_LENGTH,
  type Category,
} from "./schema.js";

export class BankValidationError extends Error {}

/**
 * Cross-file checks Zod can't express per-record: global uniqueness of
 * id/name/slug, "at most one category per technical role", and non-empty
 * categories. Throws BankValidationError on the first batch of hard failures;
 * soft issues (hint/name length) are logged as warnings only.
 */
export function validateBank(categories: Category[]): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slugOwners = new Map<string, string>();
  const roleOwners = new Map<string, string>();
  const idOwners = new Map<string, string>();
  const nameOwners = new Map<string, string>();

  for (const category of categories) {
    const where = `${category.sourceFile} (slug: ${category.slug})`;

    const existingSlugOwner = slugOwners.get(category.slug);
    if (existingSlugOwner) {
      errors.push(`Дублирующийся slug "${category.slug}": ${existingSlugOwner} и ${where}`);
    } else {
      slugOwners.set(category.slug, where);
    }

    if (category.role !== "regular") {
      const existingRoleOwner = roleOwners.get(category.role);
      if (existingRoleOwner) {
        errors.push(
          `Роль "${category.role}" использована более чем в одной категории: ${existingRoleOwner} и ${where}`,
        );
      } else {
        roleOwners.set(category.role, where);
      }
    }

    // Hard error, not a warning: the selectors crash on an empty category at
    // request time (pickEqual for regular, pickFallbackName for not_found),
    // so fail at startup instead of serving a 500 / blank page later.
    if (category.names.length === 0) {
      errors.push(`Пустая категория (нужна хотя бы одна запись): ${where}`);
    }

    for (const entry of category.names) {
      const entryWhere = `${where}, id: ${entry.id}`;

      const existingIdOwner = idOwners.get(entry.id);
      if (existingIdOwner) {
        errors.push(`Дублирующийся id "${entry.id}": ${existingIdOwner} и ${entryWhere}`);
      } else {
        idOwners.set(entry.id, entryWhere);
      }

      const existingNameOwner = nameOwners.get(entry.name);
      if (existingNameOwner) {
        errors.push(`Дублирующееся имя "${entry.name}": ${existingNameOwner} и ${entryWhere}`);
      } else {
        nameOwners.set(entry.name, entryWhere);
      }

      if (entry.hint.length < MIN_HINT_LENGTH || entry.hint.length > MAX_HINT_LENGTH) {
        warnings.push(
          `hint длиной ${entry.hint.length} вне диапазона [${MIN_HINT_LENGTH}, ${MAX_HINT_LENGTH}]: ${entryWhere}`,
        );
      }
      if (entry.name.length < MIN_NAME_LENGTH || entry.name.length > MAX_NAME_LENGTH) {
        warnings.push(
          `name длиной ${entry.name.length} вне диапазона [${MIN_NAME_LENGTH}, ${MAX_NAME_LENGTH}]: ${entryWhere}`,
        );
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`[bank] ${warning}`);
  }

  if (errors.length > 0) {
    throw new BankValidationError(
      `Валидация банка имён не пройдена:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}
