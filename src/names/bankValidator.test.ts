import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBank, BankValidationError } from "./bankValidator.js";
import type { Category } from "./schema.js";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    slug: "devops",
    title: "Девопс",
    version: 1,
    template: "whoami",
    weight: 10,
    role: "regular",
    sourceFile: "devops.yaml",
    names: [{ id: "kuberslav", name: "Куберслав", hint: "чинить будешь ты сегодня" }],
    ...overrides,
  };
}

test("accepts a well-formed bank with no cross-file collisions", () => {
  assert.doesNotThrow(() =>
    validateBank([
      makeCategory(),
      makeCategory({
        slug: "byt",
        sourceFile: "byt.yaml",
        names: [{ id: "bytoslav", name: "Бытослав", hint: "бытовые мелочи всплыли разом" }],
      }),
    ]),
  );
});

test("rejects duplicate id across categories", () => {
  assert.throws(
    () =>
      validateBank([
        makeCategory(),
        makeCategory({ slug: "byt", sourceFile: "byt.yaml" }),
      ]),
    BankValidationError,
  );
});

test("rejects duplicate name across categories", () => {
  assert.throws(
    () =>
      validateBank([
        makeCategory(),
        makeCategory({
          slug: "byt",
          sourceFile: "byt.yaml",
          names: [{ id: "different-id", name: "Куберслав", hint: "то же имя, другой id" }],
        }),
      ]),
    BankValidationError,
  );
});

test("rejects duplicate slug across files", () => {
  assert.throws(
    () =>
      validateBank([
        makeCategory(),
        makeCategory({
          sourceFile: "devops-2.yaml",
          names: [{ id: "other-id", name: "Другое имя", hint: "другой hint для проверки" }],
        }),
      ]),
    BankValidationError,
  );
});

test("rejects more than one category with the same non-regular role", () => {
  assert.throws(
    () =>
      validateBank([
        makeCategory({ slug: "not-found-1", role: "not_found", sourceFile: "nf1.yaml" }),
        makeCategory({
          slug: "not-found-2",
          role: "not_found",
          sourceFile: "nf2.yaml",
          names: [{ id: "other-id", name: "Другое имя", hint: "другой hint для проверки" }],
        }),
      ]),
    BankValidationError,
  );
});

test("allows multiple regular categories", () => {
  assert.doesNotThrow(() =>
    validateBank([
      makeCategory({ slug: "a", sourceFile: "a.yaml" }),
      makeCategory({
        slug: "b",
        sourceFile: "b.yaml",
        names: [{ id: "other-id", name: "Другое имя", hint: "другой hint для проверки" }],
      }),
      makeCategory({
        slug: "c",
        sourceFile: "c.yaml",
        names: [{ id: "third-id", name: "Третье имя", hint: "третий hint для проверки" }],
      }),
    ]),
  );
});

test("does not throw on an empty category (warning only)", () => {
  assert.doesNotThrow(() => validateBank([makeCategory({ names: [] })]));
});
