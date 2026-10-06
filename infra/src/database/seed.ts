import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataSource } from "typeorm";
import { createCliDataSource } from "./data-source.js";
import { runMigrations } from "./migrate.js";

const SEED_FILE: string = join(import.meta.dirname, "../../seed/dev-seed.sql");

/**
 * Loads the sample data: `pnpm db:seed`.
 *
 * Runs the migrations first, so it also works on a brand-new database where
 * the server has never been started. Safe to run again: the seed file upserts
 * its rows, which also resets the stock of the sample products.
 */
const dataSource: DataSource = createCliDataSource();

await dataSource.initialize();

try {
  await runMigrations(dataSource);
  await dataSource.query(readFileSync(SEED_FILE, "utf8"));
  console.log(`Sample data loaded from ${SEED_FILE}`);
} finally {
  await dataSource.destroy();
}
