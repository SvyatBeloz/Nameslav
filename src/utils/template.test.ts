import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "./template.js";

test("substitutes every placeholder, including repeats", () => {
  const out = renderTemplate("<a>{{X}}</a><b>{{Y}}</b><c>{{X}}</c>", { X: "1", Y: "2" });
  assert.equal(out, "<a>1</a><b>2</b><c>1</c>");
});

test("escapes every value — templates have no markup slots", () => {
  const out = renderTemplate("<p>{{T}}</p>", { T: '<img src=x onerror="alert(1)">' });
  assert.ok(!out.includes("<img"), "tag is neutralized");
  assert.ok(out.includes("&lt;img"), "escaped instead");
});

test("escaping holds inside an attribute value", () => {
  const out = renderTemplate('<main style="{{S}}">', { S: '" onmouseover="steal()' });
  assert.ok(!/style="[^"]*"\s+onmouseover/.test(out), "cannot break out of the attribute");
  assert.ok(out.includes("&quot;"));
});

test("a placeholder with no value throws instead of shipping {{NAME}} to visitors", () => {
  assert.throws(() => renderTemplate("<p>{{MISSING}}</p>", {}), /\{\{MISSING\}\}/);
});

test("a value with no placeholder throws instead of silently vanishing", () => {
  assert.throws(() => renderTemplate("<p>{{X}}</p>", { X: "1", TYPOD: "2" }), /\{\{TYPOD\}\}/);
});

test("lowercase braces are left alone, so prose about {{...}} survives", () => {
  const template = "<!-- placeholders like {{...}} are substituted --><p>{{X}}</p>";
  assert.equal(
    renderTemplate(template, { X: "ok" }),
    "<!-- placeholders like {{...}} are substituted --><p>ok</p>",
  );
});
