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
});
