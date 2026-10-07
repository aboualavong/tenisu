import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Player } from "../domain/player";
import { createPool } from "./pool";

async function seed(): Promise<void> {
  const inputPath = join(process.cwd(), "headtohead.json");
  const input = JSON.parse(await readFile(inputPath, "utf8")) as { players: Player[] };
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const player of input.players) {
      await client.query(
        `INSERT INTO countries (code, picture) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET picture = EXCLUDED.picture`,
        [player.country.code, player.country.picture],
      );
      await client.query(
        `INSERT INTO players (id, firstname, lastname, shortname, sex, country_code, picture,
          rank, points, weight, height, age, last_results)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET firstname = EXCLUDED.firstname, lastname = EXCLUDED.lastname,
          shortname = EXCLUDED.shortname, sex = EXCLUDED.sex, country_code = EXCLUDED.country_code,
          picture = EXCLUDED.picture, rank = EXCLUDED.rank, points = EXCLUDED.points,
          weight = EXCLUDED.weight, height = EXCLUDED.height, age = EXCLUDED.age,
          last_results = EXCLUDED.last_results`,
        [player.id, player.firstname, player.lastname, player.shortname, player.sex, player.country.code,
          player.picture, player.data.rank, player.data.points, player.data.weight, player.data.height,
          player.data.age, player.data.last],
      );
    }
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('players', 'id'),
         COALESCE(MAX(id), 1),
         COUNT(*) > 0
       )
       FROM players`,
    );
    await client.query("COMMIT");
    console.info(`Seeded ${input.players.length} players.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error("Database seeding failed.", error);
  process.exitCode = 1;
});
