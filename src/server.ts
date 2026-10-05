import "dotenv/config";
import { createApp } from "./app";
import { createPool } from "./database/pool";
import { PostgresPlayerRepository } from "./repositories/postgres-player-repository";

const port = Number(process.env.PORT ?? 3000);
const pool = createPool();
const app = createApp(new PostgresPlayerRepository(pool));
const server = app.listen(port, () => console.info(`Tenisu API listening on port ${port}.`));

function shutdown(signal: string): void {
  console.info(`${signal} received; shutting down.`);
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
