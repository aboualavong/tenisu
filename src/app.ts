import cors from "cors";
import express from "express";
import helmet from "helmet";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import type { PlayerRepository } from "./repositories/player-repository";
import { errorHandler } from "./http/error-handler";
import { createPlayerRouter } from "./http/player-router";
import { createPlayerWriteAuth } from "./http/player-write-auth";

const openApiDocument = parse(readFileSync(resolve(process.cwd(), "docs/api/openapi.yaml"), "utf8"));

export function createApp(
  repository: PlayerRepository,
  options: { playerWriteApiKey?: string } = { playerWriteApiKey: process.env.PLAYER_WRITE_API_KEY },
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    "/api",
    createPlayerWriteAuth(options.playerWriteApiKey),
    express.json({ limit: "100kb" }),
    createPlayerRouter(repository),
  );
  app.use((_request, response) => {
    response.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } });
  });
  app.use(errorHandler);
  return app;
}
