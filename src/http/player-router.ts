import { Router } from "express";
import type { PlayerRepository } from "../repositories/player-repository";

export function createPlayerRouter(repository: PlayerRepository): Router {
  const router = Router();

  router.get("/players", async (_request, response, next) => {
    try {
      response.json({ players: await repository.findAll() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
