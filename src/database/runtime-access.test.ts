import { expect, test, vi } from "vitest";
import type { PoolClient } from "pg";
import { configureRuntimeAccess } from "./runtime-access";

test("rejects an empty runtime password before changing the database", async () => {
  const query = vi.fn();
  await expect(configureRuntimeAccess({ query } as unknown as PoolClient, "")).rejects.toThrow("required");
  expect(query).not.toHaveBeenCalled();
});

test("refuses an existing elevated runtime role", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ unsafe: true }] });
  await expect(configureRuntimeAccess({ query } as unknown as PoolClient, "secret")).rejects.toThrow("privileges");
  expect(query).toHaveBeenCalledTimes(1);
});

test("formats the password through PostgreSQL rather than interpolating it", async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ unsafe: false }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ command: "formatted password command" }] })
    .mockResolvedValue({ rows: [] });
  await configureRuntimeAccess({ query } as unknown as PoolClient, "quote'password");
  expect(query).toHaveBeenCalledWith(expect.stringContaining("format("), ["quote'password"]);
  expect(query).toHaveBeenCalledWith("formatted password command");
});
