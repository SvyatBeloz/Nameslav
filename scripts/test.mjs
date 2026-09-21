// Discovers *.test.ts under src/ and hands the list to Node's test runner.
//
// Why not a glob in the npm script? Both obvious spellings are broken:
//   --test src/**/*.test.ts     sh has no globstar, so this expands to exactly
//                               src/*/*.test.ts — one level deep. Tests added
//                               anywhere else are skipped SILENTLY, and a green
//                               run means nothing.
//   --test 'src/**/*.test.ts'   leaves expansion to Node, which only learned to
//                               do it in v21. The engine floor is 22 now, so
//                               this spelling would work — but it still leans
//                               on Node's glob semantics never changing, and it
//                               reports nothing useful when it matches nothing.
//   --test src/                 Node's directory discovery looks for JS naming
//                               conventions, not .ts, and tries to import
//                               src/index.ts.
// Explicit enumeration works on every supported version and, unlike a glob,
// cannot quietly match less than it should.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(projectRoot, "src");

const files = readdirSync(srcDir, { recursive: true })
  .map(String)
  .filter((entry) => entry.endsWith(".test.ts"))
  .map((entry) => relative(projectRoot, join(srcDir, entry)))
  .sort();

if (files.length === 0) {
  console.error("Не найдено ни одного *.test.ts в src/ — это почти наверняка ошибка.");
  process.exit(1);
}

const { status } = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: projectRoot },
);
process.exit(status ?? 1);
