import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { PostgresPlayerRepository } from "./postgres-player-repository";

describe("PostgresPlayerRepository", () => {
  it("lists players by best rank first, using id to break ties", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresPlayerRepository({ query } as unknown as Pool);

    await repository.findAll();

    expect(query.mock.calls[0]?.[0]).toMatch(/ORDER BY p\.rank ASC, p\.id ASC/i);
  });

  it("looks up one player using a parameterized ID query", async () => {
    const player = { id: 17 };
    const query = vi.fn().mockResolvedValue({ rows: [{ player }] });
    const repository = new PostgresPlayerRepository({ query } as unknown as Pool);

    await expect(repository.findById(17)).resolves.toEqual(player);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE p.id = $1"), [17]);
  });

  it("inserts player and country values using a transaction and parameters", async () => {
    const player = {
      id: 17,
      firstname: "Rafael",
      lastname: "Nadal",
      shortname: "R.NAD",
      sex: "M" as const,
      country: { picture: "https://example.com/esp.png", code: "ESP" },
      picture: "https://example.com/nadal.png",
      data: { rank: 1, points: 1982, weight: 85000, height: 185, age: 33, last: [1, 0, 0, 0, 1] },
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 17 }] })
      .mockResolvedValueOnce({ rows: [{ player }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query, release: vi.fn() };
    const repository = new PostgresPlayerRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool);

    const { id: _id, ...newPlayer } = player;
    await expect(repository.create(newPlayer)).resolves.toEqual(player);
    expect(query.mock.calls[0]?.[0]).toBe("BEGIN");
    expect(query.mock.calls[1]?.[1]).toEqual(["ESP", "https://example.com/esp.png"]);
    expect(query.mock.calls[2]?.[0]).toMatch(/RETURNING id/i);
    expect(query.mock.calls[2]?.[1]).toEqual([
      "Rafael", "Nadal", "R.NAD", "M", "ESP", "https://example.com/nadal.png",
      1, 1982, 85000, 185, 33, [1, 0, 0, 0, 1],
    ]);
    expect(query.mock.calls[3]?.[1]).toEqual([17]);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("creates a player with a database-generated ID", async () => {
    const player = {
      id: 17,
      firstname: "Rafael",
      lastname: "Nadal",
      shortname: "R.NAD",
      sex: "M" as const,
      country: { picture: "https://example.com/esp.png", code: "ESP" },
      picture: "https://example.com/nadal.png",
      data: { rank: 1, points: 1982, weight: 85000, height: 185, age: 33, last: [1, 0, 0, 0, 1] },
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 17 }] })
      .mockResolvedValueOnce({ rows: [{ player }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query, release: vi.fn() };
    const repository = new PostgresPlayerRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool);

    const { id: _id, ...newPlayer } = player;
    await expect(repository.create(newPlayer)).resolves.toEqual(player);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back the transaction and preserves an insertion error", async () => {
    const player = {
      id: 17,
      firstname: "Rafael",
      lastname: "Nadal",
      shortname: "R.NAD",
      sex: "M" as const,
      country: { picture: "https://example.com/esp.png", code: "ESP" },
      picture: "https://example.com/nadal.png",
      data: { rank: 1, points: 1982, weight: 85000, height: 185, age: 33, last: [1, 0, 0, 0, 1] },
    };
    const databaseError = new Error("database failure");
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce({ rows: [] });
    const client = { query, release: vi.fn() };
    const repository = new PostgresPlayerRepository({ connect: vi.fn().mockResolvedValue(client) } as unknown as Pool);

    const { id: _id, ...newPlayer } = player;
    await expect(repository.create(newPlayer)).rejects.toBe(databaseError);
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
