import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const nestRoot = join(sourceRoot, "nest");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function isOperation(path) {
  const file = relative(nestRoot, path).replaceAll("\\", "/");
  // Persistence adapters and composition roots are responsible for TypeORM.
  return !file.endsWith(".repository.ts") && !file.endsWith(".module.ts") &&
    !file.includes("/migrations/") && file !== "common/transformers.ts";
}

function imports(file) {
  // TS 7 provides token scanning separately from the native compiler API.
  // Skip comments and inspect decoded string literals, including dynamic imports.
  const scanner = createScanner(true, undefined, readFileSync(file, "utf8"));
  const tokens = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    tokens.push({ kind, text: scanner.getTokenText(), value: scanner.getTokenValue() });
  }
  const results = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const next = tokens[i + 1];
    if ((token.kind === SyntaxKind.ImportKeyword || token.text === "require") &&
        next?.kind === SyntaxKind.OpenParenToken) {
      const specifier = tokens[i + 2];
      assert.equal(specifier?.kind, SyntaxKind.StringLiteral,
        `${file}: operation dependencies must use static module paths`);
      results.push({ specifier: specifier.value, names: [] });
    } else if (token.kind === SyntaxKind.ImportKeyword && next?.kind === SyntaxKind.StringLiteral) {
      results.push({ specifier: next.value, names: [] });
    } else if ((token.kind === SyntaxKind.ImportKeyword || token.kind === SyntaxKind.ExportKeyword) &&
        next?.kind !== SyntaxKind.DotToken) {
      const names = [];
      for (let j = i + 1; j < tokens.length && tokens[j].kind !== SyntaxKind.SemicolonToken; j++) {
        if (tokens[j].kind === SyntaxKind.FromKeyword && tokens[j + 1]?.kind === SyntaxKind.StringLiteral) {
          results.push({ specifier: tokens[j + 1].value, names });
          break;
        }
        if (tokens[j].kind === SyntaxKind.Identifier) names.push(tokens[j].value || tokens[j].text);
      }
    }
  }
  return results;
}

it("infrastructure operations reach persistence through application use cases", () => {
  const operations = sourceFiles(nestRoot).filter(isOperation);
  assert.ok(operations.length > 0, "No infrastructure operations were checked");
  const checked = new Set();
  const inspect = (file) => {
    if (checked.has(file)) return;
    checked.add(file);
    for (const { specifier, names } of imports(file)) {
      const persistencePackage = /^(?:typeorm|@nestjs\/typeorm)(?:\/|$)/.test(specifier);
      assert.equal(persistencePackage, false, `${file}: imports ${specifier} directly`);
      assert.ok(!specifier.startsWith("@shopeer/infra"), `${file}: self imports can bypass the operation boundary`);
      for (const name of names) {
        assert.ok(!/(?:Repository|EntityManager|DataSource|UnitOfWork|RepositorySet)$/.test(name),
          `${file}: imports persistence dependency ${name}; use an application use case`);
      }
      if (specifier.startsWith(".")) {
        const dependency = resolve(dirname(file), specifier).replace(/\.js$/, ".ts");
        const path = relative(sourceRoot, dependency).replaceAll("\\", "/");
        assert.ok(!path.startsWith("database/") && !path.endsWith(".repository.ts") &&
          !path.endsWith(".module.ts") && !path.includes("/migrations/") &&
          path !== "nest/common/transformers.ts", `${file}: depends on persistence/composition file ${path}`);
        if (dependency.endsWith(".ts")) inspect(dependency);
      }
    }
  };
  operations.forEach(inspect);
});
