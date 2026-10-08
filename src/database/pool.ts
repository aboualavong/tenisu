import { Pool } from "pg";

export function createPool(): Pool {
  const cloudSqlConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  if (cloudSqlConnectionName) {
    const user = process.env.DATABASE_USER;
    const password = process.env.DATABASE_PASSWORD;
    const database = process.env.DATABASE_NAME;
    if (!user || !password || !database) {
      throw new Error("DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME are required for Cloud SQL.");
    }

    return new Pool({
      host: `/cloudsql/${cloudSqlConnectionName}`,
      user,
      password,
      database,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL environment variable is required.");

  return new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
