import type { Player } from "../domain/player";

export interface PlayerRepository {
  findAll(): Promise<Player[]>;
}
