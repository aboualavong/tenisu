import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

function run(action: string, fail = "") {
  const directory = mkdtempSync(join(tmpdir(), "tenisu-cloud-"));
  const log = join(directory, "calls");
  writeFileSync(log, "");
  writeFileSync(join(directory, "gcloud"), '#!/usr/bin/env bash\necho "$*" >> "$CALL_LOG"\nif [[ -n "$FAIL_MATCH" && "$*" == *"$FAIL_MATCH"* ]]; then exit 1; fi\n', { mode: 0o755 });
  const result = spawnSync("bash", [resolve("scripts/cloud.sh"), action], {
    env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, GCP_PROJECT_ID: "test-project", CALL_LOG: log, FAIL_MATCH: fail },
    encoding: "utf8",
  });
  const calls = readFileSync(log, "utf8");
  rmSync(directory, { recursive: true, force: true });
  return { ...result, calls };
}

test("stops the API before stopping SQL without deleting resources", () => {
  const result = run("stop");
  expect(result.status).toBe(0);
  expect(result.calls).toMatch(/run services update tenisu-api .*--scaling=0[\s\S]*sql instances patch tenisu-postgres .*--activation-policy=NEVER/);
  expect(result.calls).not.toContain("delete");
});

test("starts SQL before restoring automatic API scaling", () => {
  const result = run("start");
  expect(result.status).toBe(0);
  expect(result.calls).toMatch(/--activation-policy=ALWAYS[\s\S]*--scaling=auto/);
});

test("restart stops and starts both services in order", () => {
  const result = run("restart");
  expect(result.status).toBe(0);
  expect(result.calls).toMatch(/--scaling=0[\s\S]*--activation-policy=NEVER[\s\S]*--activation-policy=ALWAYS[\s\S]*--scaling=auto/);
});

test("does not stop SQL if disabling the API fails", () => {
  const result = run("stop", "--scaling=0");
  expect(result.status).not.toBe(0);
  expect(result.calls).not.toContain("--activation-policy=NEVER");
});

test("does not enable the API if starting SQL fails", () => {
  const result = run("start", "--activation-policy=ALWAYS");
  expect(result.status).not.toBe(0);
  expect(result.calls).not.toContain("--scaling=auto");
});
