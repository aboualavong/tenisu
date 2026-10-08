import type { NewPlayer, Player } from "../domain/player";

export interface PlayerRepository {
  findAll(): Promise<Player[]>;
  findById(id: number): Promise<Player | null>;
  create(player: NewPlayer): Promise<Player>;
}
