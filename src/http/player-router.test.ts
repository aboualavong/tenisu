import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { NewPlayer, Player } from "../domain/player";
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
const testWriteApiKey = "test-player-write-key-with-at-least-32-bytes";
const { id: _playerId, ...newPlayer } = player;

function createTestApp(players: Player[] = [player], playerWriteApiKey: string | undefined = testWriteApiKey) {
  const repository: PlayerRepository = {
    findAll: vi.fn().mockResolvedValue(players),
    findById: vi.fn().mockImplementation(async (id: number) => players.find((item) => item.id === id) ?? null),
    create: vi.fn().mockImplementation(async (input: NewPlayer) => ({ ...input, id: player.id })),
  };
  return { app: createApp(repository, { playerWriteApiKey }), repository };
}

function postPlayer(app: ReturnType<typeof createApp>, payload: unknown = newPlayer) {
  return request(app)
    .post("/api/players")
    .set("x-api-key", testWriteApiKey)
    .send(payload);
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

  it("targets the hosting API origin from both local and online Swagger", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api-docs/swagger-ui-init.js");
    expect(response.status).toBe(200);
    const servers = JSON.parse(response.text.match(/"servers":\s*(\[[\s\S]*?\])/)![1]!) as { url: string }[];
    for (const origin of ["http://localhost:3000", "https://tenisu-api-2odleubxdq-ew.a.run.app"]) {
      const base = new URL(servers[0]!.url, `${origin}/api-docs/`);
      expect(new URL("api/players", base).href).toBe(`${origin}/api/players`);
    }
  });

  it("lists players", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/players");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ players: [player] });
  });

  it("creates a player and returns its resource location", async () => {
    const { app, repository } = createTestApp();
    const response = await postPlayer(app);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe("/api/players/17");
    expect(response.body).toEqual({ player });
    expect(repository.create).toHaveBeenCalledWith(newPlayer);
  });

  it("requires the configured write API key", async () => {
    const { app, repository } = createTestApp();
    const response = await request(app).post("/api/players").send(player);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(["/api/players/", "/api/Players"])("protects alternate player creation path %s", async (path) => {
    const { app, repository } = createTestApp();
    const response = await request(app).post(path).send(player);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("disables player creation when no write API key is configured", async () => {
    const { app, repository } = createTestApp([player], "");
    const response = await postPlayer(app);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("PLAYER_CREATION_DISABLED");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ["missing required fields", {}],
    ["client-supplied ID", { ...newPlayer, id: 120 }],
    ["unsupported result values", { ...newPlayer, data: { ...newPlayer.data, last: [1, 1, 1, 1, 2] } }],
    ["unexpected fields", { ...newPlayer, admin: true }],
    ["non-HTTP picture URL", { ...newPlayer, picture: "javascript:alert(1)" }],
  ])("rejects player payloads with %s", async (_case, payload) => {
    const { app, repository } = createTestApp();
    const response = await postPlayer(app, payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PLAYER");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post("/api/players")
      .set("x-api-key", testWriteApiKey)
      .set("Content-Type", "application/json")
      .send('{"id":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("rejects player creation requests that are not JSON", async () => {
    const { app, repository } = createTestApp();
    const response = await request(app)
      .post("/api/players")
      .set("x-api-key", testWriteApiKey)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify(player));

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns 413 when the request body exceeds the configured limit", async () => {
    const { app, repository } = createTestApp();
    const oversizedPlayer = { ...newPlayer, firstname: "A".repeat(102_401) };
    const response = await postPlayer(app, oversizedPlayer);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("hides database error details when player creation fails", async () => {
    const { app, repository } = createTestApp();
    vi.mocked(repository.create).mockRejectedValueOnce(new Error("database password leaked"));

    const response = await postPlayer(app);

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    });
    expect(response.text).not.toContain("database password leaked");
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

  it("returns aggregate player statistics", async () => {
    const secondPlayer: Player = {
      ...player,
      id: 18,
      country: { picture: "https://example.com/fra.png", code: "FRA" },
      data: { ...player.data, weight: 80000, height: 190, last: [1, 1, 1, 1, 1] },
    };
    const { app } = createTestApp([player, secondPlayer]);

    const response = await request(app).get("/api/statistics");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      statistics: {
        countryWithHighestWinRatio: { countryCode: "FRA", winRatio: 1 },
        averageBmi: 23.5,
        medianHeightCm: 187.5,
      },
    });
  });

  it("returns null statistics when there are no players", async () => {
    const { app } = createTestApp([]);

    const response = await request(app).get("/api/statistics");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      statistics: {
        countryWithHighestWinRatio: null,
        averageBmi: null,
        medianHeightCm: null,
      },
    });
  });

});
