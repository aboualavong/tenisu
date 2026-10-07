import type { Pool } from "pg";
import type { NewPlayer, Player } from "../domain/player";
import type { PlayerRepository } from "./player-repository";

const playerProjection = `
  jsonb_build_object(
    'id', p.id,
    'firstname', p.firstname,
    'lastname', p.lastname,
    'shortname', p.shortname,
    'sex', p.sex,
    'country', jsonb_build_object('picture', c.picture, 'code', c.code),
    'picture', p.picture,
    'data', jsonb_build_object(
      'rank', p.rank,
      'points', p.points,
      'weight', p.weight,
      'height', p.height,
      'age', p.age,
      'last', p.last_results
    )
  ) AS player`;

export class PostgresPlayerRepository implements PlayerRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<Player[]> {
    const result = await this.pool.query<{ player: Player }>(
      `SELECT ${playerProjection}
       FROM players p JOIN countries c ON c.code = p.country_code
       ORDER BY p.rank ASC, p.id ASC`,
    );
    return result.rows.map((row) => row.player);
  }

  async findById(id: number): Promise<Player | null> {
    const result = await this.pool.query<{ player: Player }>(
      `SELECT ${playerProjection}
       FROM players p JOIN countries c ON c.code = p.country_code
       WHERE p.id = $1`,
      [id],
    );
    return result.rows[0]?.player ?? null;
  }

  async create(player: NewPlayer): Promise<Player> {
    const client = await this.pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;
      await client.query(
        `INSERT INTO countries (code, picture)
         VALUES ($1, $2)
         ON CONFLICT (code) DO NOTHING`,
        [player.country.code, player.country.picture],
      );

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO players (
           firstname, lastname, shortname, sex, country_code, picture,
           rank, points, weight, height, age, last_results
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          player.firstname,
          player.lastname,
          player.shortname,
          player.sex,
          player.country.code,
          player.picture,
          player.data.rank,
          player.data.points,
          player.data.weight,
          player.data.height,
          player.data.age,
          player.data.last,
        ],
      );

      const generatedId = inserted.rows[0]?.id;
      if (generatedId === undefined) throw new Error("Created player ID could not be generated.");

      const result = await client.query<{ player: Player }>(
        `SELECT ${playerProjection}
         FROM players p JOIN countries c ON c.code = p.country_code
          WHERE p.id = $1`,
        [generatedId],
      );
      const createdPlayer = result.rows[0]?.player;
      if (!createdPlayer) throw new Error("Created player could not be read back.");

      await client.query("COMMIT");
      transactionStarted = false;
      return createdPlayer;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original database error.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

}
