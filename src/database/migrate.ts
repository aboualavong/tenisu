import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPool } from "./pool";

async function migrate(): Promise<void> {
  const pool = createPool();
  try {
    for (const migration of ["001_initial_schema.sql", "002_player_identity.sql"]) {
      const migrationPath = join(process.cwd(), "src", "database", "migrations", migration);
      const sql = await readFile(migrationPath, "utf8");
      await pool.query(sql);
    }
    console.info("Database schema is up to date.");
  } finally {
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
