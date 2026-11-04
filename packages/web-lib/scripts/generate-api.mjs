import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const source = process.argv[2] ?? process.env.OPENAPI_SCHEMA ?? "http://localhost:3000/openapi.json";
const input = /^https?:\/\//i.test(source)
  ? new URL(source)
  : pathToFileURL(resolve(source));
const output = new URL("../src/api/schema.d.ts", import.meta.url);

try {
  const ast = await openapiTS(input);
  await mkdir(new URL("../src/api/", import.meta.url), { recursive: true });
  await writeFile(output, COMMENT_HEADER + astToString(ast));
  console.log(`Generated API types from ${source}`);
} catch (error) {
  console.error(`Could not generate API types from ${source}. Start the API or provide a schema URL/file.`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
