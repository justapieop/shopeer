import { createCliDataSource } from "./data-source.js";
import type { DataSource, Migration } from "typeorm";

/** Creates or updates the tables without starting the server: `pnpm db:migrate`. */
export async function runMigrations(dataSource: DataSource): Promise<void> {
  const applied: Migration[] = await dataSource.runMigrations({ transaction: "all", });

  console.log(applied.length > 0
    ? `Applied migrations: ${applied.map((migration: Migration) => migration.name).join(", ")}`
    : "Database schema is already up to date");
}

if (import.meta.main) {
  const dataSource: DataSource = createCliDataSource();

  await dataSource.initialize();

  try {
    await runMigrations(dataSource);
  } finally {
    await dataSource.destroy();
  }
}
