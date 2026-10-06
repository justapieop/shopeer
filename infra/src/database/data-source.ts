import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { DataSource } from "typeorm";

/**
 * Database connection for command-line tasks (migrate, seed) that run without
 * starting the NestJS server.
 *
 * Keep it in sync with TypeOrmModule.forRootAsync in App.module.ts: same
 * environment variables, same defaults, same migrations folder.
 */
export function createCliDataSource(): DataSource {
  if (existsSync(".env")) {
    loadEnvFile(".env");
  }

  const sslEnabled: boolean = (process.env["POSTGRES_SSL_ENABLE"] ?? "true").toLowerCase().trim() === "true";

  return new DataSource({
    type: "postgres",
    host: requireEnv("POSTGRES_HOST"),
    port: Number(requireEnv("POSTGRES_PORT")),
    username: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    ssl: sslEnabled,
    useUTC: true,
    migrations: [join(import.meta.dirname, "../nest/modules/app/migrations/*.js")],
  });
}

function requireEnv(name: string): string {
  const value: string | undefined = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}: copy .env.example to .env first`);
  }

  return value;
}
