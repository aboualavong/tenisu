import type { Pool } from "pg";
import type { Player } from "../domain/player";
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

}
