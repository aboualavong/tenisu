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
});
