import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const script = readFileSync("scripts/deploy-gcp.sh", "utf8");
const assignment = script.slice(
  script.indexOf('BUILD_SERVICE_ACCOUNT="'),
  script.indexOf('if [[ -z "$BUILD_SERVICE_ACCOUNT"'),
);

for (const account of [
  "projects/test-project/serviceAccounts/build@test-project.iam.gserviceaccount.com",
  "build@test-project.iam.gserviceaccount.com",
  "",
]) {
  test(`normalizes Cloud Build account ${account || "(empty)"}`, () => {
    const result = spawnSync("bash", ["-c", `
      set -euo pipefail
      gcloud() { printf '%s' "$TEST_ACCOUNT"; }
      REGION=europe-west1
      PROJECT_ID=test-project
      ${assignment}
      printf '%s' "$BUILD_SERVICE_ACCOUNT"
    `], { env: { ...process.env, TEST_ACCOUNT: account }, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(account ? "build@test-project.iam.gserviceaccount.com" : "");
  });
}

test("isolates setup credentials from the public API", () => {
  const job = script.slice(script.indexOf('gcloud run jobs deploy'), script.indexOf('gcloud run jobs execute'));
  const api = script.slice(script.indexOf('gcloud run deploy'), script.indexOf('# Migrate the old deployment'));
  expect(job).toContain('DATABASE_USER=$SETUP_DATABASE_USER');
  expect(job).toContain('DATABASE_PASSWORD=$SETUP_PASSWORD_SECRET:latest');
  expect(job).toContain('--service-account="$SETUP_SERVICE_ACCOUNT@');
  expect(api).toContain('DATABASE_USER=$RUNTIME_DATABASE_USER');
  expect(api).toContain('DATABASE_PASSWORD=$RUNTIME_PASSWORD_SECRET:latest');
  expect(api).not.toContain('$SETUP_PASSWORD_SECRET');
  expect(api).not.toContain('$SETUP_DATABASE_USER');
});


test("deploys an existing installation with separate identities and removes legacy secret access", () => {
  const directory = mkdtempSync(join(tmpdir(), "tenisu-deploy-"));
  const log = join(directory, "calls");
  writeFileSync(log, "");
  writeFileSync(join(directory, "gcloud"), `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  "auth list "*) echo reviewer@example.com ;;
  "sql instances describe "*) echo test-project:europe-west1:tenisu-postgres ;;
  "secrets versions list "*) echo 1 ;;
  "secrets versions access "*) echo fake-setup-password ;;
  "sql users list "*) echo tenisu_app ;;
  "builds get-default-service-account "*) echo projects/test-project/serviceAccounts/build@example.com ;;
  "secrets get-iam-policy "*) echo serviceAccount:tenisu-runtime@test-project.iam.gserviceaccount.com ;;
esac
`, { mode: 0o755 });
  try {
    const result = spawnSync("bash", [resolve("scripts/deploy-gcp.sh")], {
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, GCP_PROJECT_ID: "test-project", GCP_REGION: "europe-west1", CALL_LOG: log },
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(log, "utf8").split("\n");
    const job = calls.find((call) => call.startsWith("run jobs deploy "))!;
    const api = calls.find((call) => call.startsWith("run deploy "))!;
    const passwordUpdate = calls.find((call) => call.startsWith("sql users set-password tenisu_app "))!;
    expect(passwordUpdate).toContain("--password=fake-setup-password");
    expect(calls.indexOf(passwordUpdate)).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf(passwordUpdate)).toBeLessThan(calls.indexOf(job));
    expect(calls.indexOf(passwordUpdate)).toBeLessThan(calls.indexOf(api));
    expect(job).toContain("DATABASE_USER=tenisu_app");
    expect(job).toContain("--service-account=tenisu-setup@");
    expect(job).toContain("DATABASE_PASSWORD=tenisu-database-password:latest,RUNTIME_DATABASE_PASSWORD=tenisu-runtime-database-password:latest");
    expect(api).toContain("DATABASE_USER=tenisu_api");
    expect(api).toContain("DATABASE_PASSWORD=tenisu-runtime-database-password:latest");
    expect(api).not.toContain("tenisu-database-password:latest");
    const setupSecretGrants = calls.filter((call) => call.startsWith("secrets add-iam-policy-binding tenisu-database-password "));
    expect(setupSecretGrants).toHaveLength(1);
    expect(setupSecretGrants[0]).toContain("--member=serviceAccount:tenisu-setup@");
    const removal = calls.find((call) => call.startsWith("secrets remove-iam-policy-binding tenisu-database-password "))!;
    expect(removal).toContain("--member=serviceAccount:tenisu-runtime@");
    expect(calls.indexOf(removal)).toBeGreaterThan(calls.indexOf(api));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const userExists of [true, false]) {
  for (const secretExists of [true, false]) {
    test(`reconciles setup password (user exists: ${userExists}, secret exists: ${secretExists})`, () => {
      const reconciliation = script.slice(script.indexOf('DATABASE_PASSWORD=""'), script.indexOf('unset DATABASE_PASSWORD'));
      const result = spawnSync("bash", ["-c", `
        set -euo pipefail
        PROJECT_ID=test-project
        SQL_INSTANCE_NAME=tenisu-postgres
        SETUP_DATABASE_USER=tenisu_app
        SETUP_PASSWORD_SECRET=tenisu-database-password
        openssl() { echo generated-password; }
        gcloud() {
          echo "$*" >&2
          case "$*" in
            "secrets versions list "*) ${secretExists ? "echo 1" : ":"} ;;
            "secrets versions access "*) echo stored-password ;;
            "sql users list "*) ${userExists ? "echo tenisu_app" : ":"} ;;
            "secrets versions add "*) cat >/dev/null ;;
          esac
        }
        ${reconciliation}
      `], { encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const operation = userExists ? "set-password" : "create";
      expect(result.stderr).toContain(`sql users ${operation} tenisu_app --instance=tenisu-postgres --project=test-project --password=${secretExists ? "stored-password" : "generated-password"}`);
      expect(result.stderr).not.toContain(`sql users ${userExists ? "create" : "set-password"} `);
      expect(result.stderr.match(/sql users (?:create|set-password) /g)).toHaveLength(1);
    });
  }
}
