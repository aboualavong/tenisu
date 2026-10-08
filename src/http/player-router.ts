import { Router } from "express";
import { calculatePlayerStatistics } from "../domain/player-statistics";
import { parsePlayerInput } from "./player-input";
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

  router.post("/players", async (request, response, next) => {
    if (!request.is("application/json")) {
      response.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." } });
      return;
    }

    const player = parsePlayerInput(request.body);
    if (!player) {
      response.status(400).json({ error: { code: "INVALID_PLAYER", message: "Request body must contain a valid player." } });
      return;
    }

    try {
      const createdPlayer = await repository.create(player);
      response.status(201).location(`/api/players/${createdPlayer.id}`).json({ player: createdPlayer });
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
