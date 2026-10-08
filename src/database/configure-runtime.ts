import "dotenv/config";
import { createPool } from "./pool";
import { configureRuntimeAccess } from "./runtime-access";

async function configure(): Promise<void> {
  const password = process.env.RUNTIME_DATABASE_PASSWORD;
  if (!password) throw new Error("RUNTIME_DATABASE_PASSWORD is required.");
  const pool = createPool();
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await configureRuntimeAccess(client, password);
      await client.query("COMMIT");
      console.info("Runtime database access configured.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// A PostgreSQL error could include the password-bearing ALTER ROLE statement.
configure().catch(() => {
  console.error("Runtime database access configuration failed.");
  process.exitCode = 1;
});
