import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Player } from "../domain/player";
import type { PlayerRepository } from "../repositories/player-repository";

const player: Player = {
  id: 17,
  firstname: "Rafael",
  lastname: "Nadal",
  shortname: "R.NAD",
  sex: "M",
  country: { picture: "https://example.com/esp.png", code: "ESP" },
  picture: "https://example.com/nadal.png",
  data: { rank: 1, points: 1982, weight: 85000, height: 185, age: 33, last: [1, 0, 0, 0, 1] },
};

function createTestApp(players: Player[] = [player]) {
  const repository: PlayerRepository = {
    findAll: vi.fn().mockResolvedValue(players),
    findById: vi.fn().mockImplementation(async (id: number) => players.find((item) => item.id === id) ?? null),
  };
  return { app: createApp(repository), repository };
}

describe("player API", () => {
  it("serves the API documentation at /api-docs", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api-docs/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Swagger UI");

    const swaggerConfig = await request(app).get("/api-docs/swagger-ui-init.js");
    expect(swaggerConfig.status).toBe(200);
    expect(swaggerConfig.text).toContain("Tenisu API");
  });

  it("lists players", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/players");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ players: [player] });
  });

  it("returns a player by ID", async () => {
    const { app, repository } = createTestApp();
    const response = await request(app).get("/api/players/17");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ player });
    expect(repository.findById).toHaveBeenCalledWith(17);
  });

  it("returns 400 when the player ID is invalid", async () => {
    const { app, repository } = createTestApp();
    const response = await request(app).get("/api/players/nope");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PLAYER_ID");
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it.each(["-1", "1.5", "2147483648", "1%20OR%201=1--"]) (
    "rejects unsafe player ID input: %s",
    async (id) => {
      const { app, repository } = createTestApp();
      const response = await request(app).get(`/api/players/${id}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PLAYER_ID");
      expect(repository.findById).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when the player does not exist", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/players/999");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PLAYER_NOT_FOUND");
  });

});
