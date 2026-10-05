import { Router } from "express";
import { calculatePlayerStatistics } from "../domain/player-statistics";
import type { PlayerRepository } from "../repositories/player-repository";

const maxPlayerId = 2_147_483_647;

export function createPlayerRouter(repository: PlayerRepository): Router {
  const router = Router();

  router.get("/statistics", async (_request, response, next) => {
    try {
      const players = await repository.findAll();
      response.json({ statistics: calculatePlayerStatistics(players) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/players", async (_request, response, next) => {
    try {
      response.json({ players: await repository.findAll() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/players/:id", async (request, response, next) => {
    const { id: rawId } = request.params;
    if (!/^\d+$/.test(rawId)) {
      response.status(400).json({ error: { code: "INVALID_PLAYER_ID", message: "Player ID must be a positive integer." } });
      return;
    }

    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0 || id > maxPlayerId) {
      response.status(400).json({ error: { code: "INVALID_PLAYER_ID", message: "Player ID must be a positive integer." } });
      return;
    }

    try {
      const player = await repository.findById(id);
      if (!player) {
        response.status(404).json({ error: { code: "PLAYER_NOT_FOUND", message: "Player not found." } });
        return;
      }
      response.json({ player });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
