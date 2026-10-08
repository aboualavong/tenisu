# Tenisu API

A REST API for tennis players, built with Node.js, TypeScript, Express, and PostgreSQL.

## Requirements

- Node.js 26 (use `nvm use` to select the version in `.nvmrc`)
- npm 12
- Docker and Docker Compose (used to run the application and PostgreSQL together, or PostgreSQL on its own)

With nvm installed, select the project Node.js version before installing dependencies:

```bash
nvm install
nvm use
npm install --global npm@12.2.0
```

## Run with Docker Compose

Create a local environment file and configure the write key before starting the services:

```bash
cp .env.example .env
sed -i "s/^PLAYER_WRITE_API_KEY=.*/PLAYER_WRITE_API_KEY=$(openssl rand -hex 32)/" .env
```

The generated key is stored in `.env`, which is ignored by Git. Keep it private. Docker Compose reads it and passes it to the API container. The API requires a key of at least 32 bytes for `POST /api/players`; if the key is unset or too short, player creation returns `503`.

Docker Compose starts PostgreSQL, builds the API image, applies all migrations, loads the sample players from `headtohead.json`, and starts the API.

```bash
npm run local:start
```

The API is available at `http://localhost:3000` from Windows and WSL. In WSL 2 NAT mode, if a Windows-hosted service cannot be reached through `localhost`, use the Windows host gateway shown by `ip route show default` instead. The Compose file uses local development database credentials; replace them before using this configuration in a shared environment.

Use the following commands from the repository root:

```bash
npm run local:status
npm run local:logs
npm run local:stop
npm run local:start
npm run local:restart
```

`local:start` builds and starts both containers in the background. `local:stop` stops them while retaining containers and database data. `local:restart` recreates both containers, preserves the database volume, and waits up to 120 seconds for services to be running or healthy. Compose waits for the database health check before starting the API. The command reruns migrations and the seed; it reuses the existing API image, so use `local:start` to rebuild code changes. The API has no health check, so Compose confirms that its container is running, not that its HTTP routes are ready. To apply code or `.env` changes, use `local:start`. Press Ctrl+C to leave the log stream.

`docker compose down` removes containers but retains the database volume. `docker compose down -v` permanently deletes local database data.

## Deploy to Google Cloud

The deployment script creates a small Cloud SQL for PostgreSQL instance, database, and application user; builds the container in Cloud Build; runs migrations and seed data as a Cloud Run Job; then deploys the API to Cloud Run. Cloud Run scales to zero and is capped at one instance. Database and player-write credentials are stored in Secret Manager. The setup job runs as `tenisu-setup` with the elevated PostgreSQL user `tenisu_app`; the API runs as `tenisu-runtime` with the restricted PostgreSQL user `tenisu_api`. Setup preserves the existing database owner and `tenisu-database-password` secret. The API uses a separate `tenisu-runtime-database-password` secret and cannot access the setup secret after deployment. Its database role can connect, use the public schema, select/insert players and countries, and use the player ID sequence; it cannot update/delete rows, change the schema, or create roles/databases. Runtime role provisioning happens through SQL to avoid Cloud SQL's default elevated user privileges. The Cloud SQL instance remains running and billable even when the API has no traffic. The script defaults to `europe-west1`; Cloud SQL uses a `db-f1-micro` shared-core instance with a 10 GB HDD, no backups, and no automatic storage growth.

In the WSL terminal where `gcloud auth list` shows your active Google account, select the project and run:

```bash
gcloud config set project YOUR_GCP_PROJECT_ID
./scripts/deploy-gcp.sh
```

The script enables the required APIs and provisions resources in `europe-west1` by default. It generates database and player-write passwords, stores them in Secret Manager, and prints the Cloud Run URL at the end. Set `GCP_REGION` to change the region before running the script. Keep the player-write key private; retrieve it only when needed with:

```bash
gcloud secrets versions access latest \
  --secret=tenisu-player-write-api-key \
  --project=YOUR_GCP_PROJECT_ID
```

The current demo is available at [the Tenisu API](https://tenisu-api-2odleubxdq-ew.a.run.app); its [Swagger UI](https://tenisu-api-2odleubxdq-ew.a.run.app/api-docs/) documents the routes.

Cloud costs depend on region, usage, and retained resources. Stopping Cloud SQL removes instance compute charges, but storage remains billable. See [Cloud SQL pricing](https://cloud.google.com/sql/pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Cloud Build pricing](https://cloud.google.com/build/pricing), and [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing).

### Manage the deployed application

Install a current [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), run `gcloud auth login`, and select the deployment project. The account needs permission to update Cloud Run and Cloud SQL and to act as the runtime service account. These commands operate on the existing `tenisu-api` service and `tenisu-postgres` instance:

```bash
export GCP_PROJECT_ID=YOUR_GCP_PROJECT_ID
export GCP_REGION=europe-west1
npm run cloud:status
npm run cloud:stop
npm run cloud:start
npm run cloud:restart
```

| Command | Behavior |
| --- | --- |
| `cloud:status` | Show the Cloud Run configuration and Cloud SQL state/activation policy. |
| `cloud:stop` | Disable the API with manual scaling to zero, then stop Cloud SQL. Preserve the URL, secrets, and database data. |
| `cloud:start` | Start Cloud SQL, then restore automatic API scaling (zero to one instance). Print the API URL. |
| `cloud:restart` | Stop and start both services in order; expect downtime while PostgreSQL starts. |
| `cloud:seed` | Execute `db:seed` through the existing setup job and wait for completion. Update players from the deployed `headtohead.json` by ID; retain other players. |
| `cloud:deploy` | Build and deploy the current source; apply migrations and seed data. Also resume a stopped deployment. |

The scripts wait for each cloud operation and stop at the first error. If an operation fails midway, inspect `cloud:status`, resolve the reported error, then rerun `cloud:start` or `cloud:stop`. A restart uses the already deployed image and does not rebuild or seed data. Cloud Run may take time to drain existing requests during shutdown. These commands assume the deployment script's single service without additional tagged revision URLs.

Cloud commands read exported `GCP_PROJECT_ID` (or the active `gcloud` project) and `GCP_REGION` (default `europe-west1`), not `.env`. Check the printed project before proceeding. See Google's documentation for [disabling Cloud Run with manual scaling](https://cloud.google.com/run/docs/configuring/services/manual-scaling) and [starting/stopping Cloud SQL](https://cloud.google.com/sql/docs/postgres/start-stop-restart-instance).

After starting, verify the printed URL:

```bash
curl --fail https://YOUR_CLOUD_RUN_URL/api/players
curl --fail https://YOUR_CLOUD_RUN_URL/api/statistics
```

Redeployment updates the seeded players by ID, so changes to those rows are overwritten by the source dataset. Other players are retained. No lifecycle script deletes database data.

To reload the provided dataset into the running cloud database:

```bash
export GCP_PROJECT_ID=YOUR_GCP_PROJECT_ID
npm run cloud:seed
```

This command runs only the seed command using the setup job's database credentials. It uses `headtohead.json` bundled in the job's deployed image, not a local upload. If the local dataset has changed, deploy the updated image first with `cloud:deploy`. Cloud SQL must be running and the setup job must already exist. The seed runs in a transaction and synchronizes the generated-ID sequence; it updates matching countries and players without deleting other rows. For a local Node.js database, use `npm run build` followed by `npm run db:seed`.

Cloud setup runs `db:setup:cloud`: migrations, seed, then transactional runtime-role/password and privilege configuration. Redeployment reapplies grants to the two application tables and their ID sequence. It removes public database CREATE/TEMPORARY and public-schema CREATE privileges in this dedicated database. An existing `tenisu_api` role with elevated attributes, role memberships, or object ownership causes setup to fail rather than granting the API those privileges. Local Compose keeps its development account and `db:setup` command.

For an existing deployment, the script switches the API to the restricted account before removing the runtime identity's old setup-secret IAM binding. Until redeployment completes, the running service retains its previous credentials. Ensure the runtime identity has no separate project-level Secret Manager access; a project-level grant would bypass secret-specific isolation.

## Run locally

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Start PostgreSQL. The database service from `compose.yaml` can be started on its own:

   ```bash
   docker compose up -d database
   ```

3. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if needed.

   Set `PLAYER_WRITE_API_KEY` to a unique random secret to enable player creation. For example, generate one with `openssl rand -hex 32`. Without this key, `POST /api/players` is disabled. Keep the key private and send it only over HTTPS outside local development.

4. Build the TypeScript application, apply the schema, and seed the sample data:

   ```bash
   npm run build
   npm run db:migrate
   npm run db:seed
   ```

5. Start the API in watch mode:

   ```bash
   npm run dev
   ```

## API documentation

The API contract is documented in the [OpenAPI specification](docs/api/openapi.yaml).
When the server is running, open [http://localhost:3000/api-docs/](http://localhost:3000/api-docs/) to explore it in Swagger UI. Swagger uses the host where it is opened, so **Try it out** calls the local API locally and the deployed API online.

### `GET /api/statistics`

Returns aggregate player statistics in the response shape `{ "statistics": {...} }`:

- `countryWithHighestWinRatio` contains the country code and the ratio of wins to recent matches aggregated across players from that country. A win is `1` in `data.last`; ties are resolved by country code in ascending alphabetical order. The ratio is rounded to four decimal places.
- `averageBmi` is the arithmetic mean of player BMI values, using weight in grams and height in centimeters, rounded to two decimal places.
- `medianHeightCm` is the median height in centimeters. For an even player count, it is the mean of the two middle heights.

Each metric is `null` if the player dataset is empty.

```bash
curl http://localhost:3000/api/statistics
```

### `GET /api/players`

Returns all players in the response shape `{ "players": [...] }`. Players are ordered by ranking ascending (rank 1 first); player id is used as a deterministic tie-breaker.

```json
{
  "players": [
    {
      "id": 17,
      "firstname": "Rafael",
      "lastname": "Nadal",
      "shortname": "R.NAD",
      "sex": "M",
      "country": {
        "picture": "https://tenisu.latelier.co/resources/Espagne.png",
        "code": "ESP"
      },
      "picture": "https://tenisu.latelier.co/resources/Nadal.png",
      "data": {
        "rank": 1,
        "points": 1982,
        "weight": 85000,
        "height": 185,
        "age": 33,
        "last": [1, 0, 0, 0, 1]
      }
    }
  ]
}
```

The API returns `404` with a `ROUTE_NOT_FOUND` error for an unknown route and `500` with an `INTERNAL_SERVER_ERROR` error when an unexpected server error occurs.

### `GET /api/players/{id}`

Returns one player in the response shape `{ "player": {...} }`. The path `id` must be a positive integer. An invalid ID returns `400` with `INVALID_PLAYER_ID`; a well-formed ID that does not match a player returns `404` with `PLAYER_NOT_FOUND`.

```bash
curl http://localhost:3000/api/players/17
```

### `POST /api/players`

Creates a player from its complete representation. The server generates the player `id`; clients must not include it in the request body. The server compares `X-API-Key` with `PLAYER_WRITE_API_KEY` using a timing-safe comparison. The configured key must be at least 32 bytes. The body must follow the `NewPlayer` schema in the OpenAPI specification; unknown fields and invalid values are rejected. A successful request returns `201 Created`, the new player in `{ "player": {...} }`, and a `Location` header pointing to `/api/players/{id}`. Malformed JSON or an invalid player returns `400`; a missing or incorrect key returns `401`; a missing or too-short server key returns `503`. Request bodies are limited to 100 KB; larger bodies return `413`.

When the country code is new, the country is inserted with the player in one transaction. If that country code already exists, its stored picture is preserved.

```bash
source .env
curl --request POST http://localhost:3000/api/players \
  --header "X-API-Key: $PLAYER_WRITE_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "firstname": "Coco",
    "lastname": "Gauff",
    "shortname": "C.GAU",
    "sex": "F",
    "country": { "picture": "https://example.com/usa.png", "code": "USA" },
    "picture": "https://example.com/gauff.png",
    "data": { "rank": 3, "points": 7200, "weight": 55000, "height": 175, "age": 20, "last": [1, 1, 0, 1, 1] }
  }'
```

## Postman

Import these three JSON files using **Import** in Postman:

- [Tenisu API collection](docs/postman/Tenisu.postman_collection.json)
- [Tenisu - Local environment](docs/postman/Tenisu-Local.postman_environment.json)
- [Tenisu - Online environment](docs/postman/Tenisu-Online.postman_environment.json)

Select **Tenisu - Local** or **Tenisu - Online** from the environment selector. Local defaults to `http://localhost:3000`; update `base_url` if you configured a different port. `player_id` defaults to seeded player `17`. Run the **Read requests** folder to check the player list, lookup, statistics, and Swagger without changing data.

For **Create player**, set the selected environment's secure `api_key` value: use `PLAYER_WRITE_API_KEY` from your private `.env` for local requests, or retrieve `tenisu-player-write-api-key` from Secret Manager for online requests as documented above. The request supplies `X-API-Key` automatically. The imported files contain no credentials; keep populated environment exports private.

Edit the JSON body and send the request from **Write requests**. Each successful send creates a persistent player; running the entire collection also executes this request if a key is configured. There is no delete endpoint. A successful response updates that environment's `player_id`, so **Get player by ID** can retrieve the new player immediately. [Postman environment documentation](https://learning.postman.com/docs/use/send-requests/variables/environment-variables/) explains how to select and edit environment values.

## Verify the API

With the API running, request statistics, the player list, or look up a player by ID:

```bash
curl http://localhost:3000/api/players
curl http://localhost:3000/api/players/17
curl http://localhost:3000/api/statistics
```

The list response is JSON and contains a `players` array; the lookup response contains a `player` object; and the statistics response contains a `statistics` object. You can also try all endpoints from Swagger UI at `http://localhost:3000/api-docs/`.

## Tests and build

The project uses Vitest and Supertest. Tests cover API routes, authentication and input validation, statistics, repository behavior, Swagger UI, and cloud lifecycle ordering/failures. Cloud tests use a fake `gcloud` executable; the suite requires neither a running database nor a cloud account.

```bash
npm test
npm run build
```

## Continuous integration

GitHub Actions runs the test suite and TypeScript build on pull requests and pushes to `main`, using Node.js 26. A separate job checks that the Docker image builds. Dependency review blocks pull requests that introduce vulnerabilities rated moderate or higher. Dependabot checks weekly for npm, GitHub Actions, Dockerfile, and Docker Compose updates.

Before merging, protect the `main` branch in GitHub repository settings: require pull requests and the `Test and build (Node 26)`, `Docker image build`, and `Review dependency changes` checks; disallow force pushes and branch deletion.

## Database design

Countries are stored separately and referenced by players through their ISO-style country code. Player ranking and physical statistics are stored as columns, while the five recent match results are stored as a constrained PostgreSQL smallint array. The seed command is repeatable and updates existing rows by id.

Migrations are in `src/database/migrations/`. `001_initial_schema.sql` creates the initial schema, and `002_player_identity.sql` enables server-generated player IDs. Docker Compose applies all migrations when the API container starts. For a local Node.js run, apply them with `npm run db:migrate` after building the project.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for local Node.js; host port for Compose (container stays on 3000). |
| `DATABASE_URL` | None | PostgreSQL connection string; set this in `.env` when running locally. Docker Compose supplies its own value. |
| `DATABASE_SSL` | `false` | Enable certificate-verified TLS for PostgreSQL |
| `DATABASE_POOL_SIZE` | `10` | Maximum number of pooled database connections |
| `PLAYER_WRITE_API_KEY` | None | Secret of at least 32 bytes required by `POST /api/players`; creation stays disabled if unset or too short. Compose reads it from `.env`; Cloud Run receives it from Secret Manager. |
| `CLOUD_SQL_CONNECTION_NAME` | None | When set, connect through the Cloud SQL Auth Proxy socket mounted by Cloud Run instead of using `DATABASE_URL`. |
| `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | None | Credentials and database name used with `CLOUD_SQL_CONNECTION_NAME`; Cloud Run injects the password from Secret Manager. |
| `RUNTIME_DATABASE_PASSWORD` | None | Setup job only: provisions the restricted runtime account from its separate Secret Manager password. Never injected into the API under this name. |

`.env.example` contains local defaults and no real secrets. Node.js loads `.env` through dotenv; Compose uses it for the host port, database pool size, and write key, and supplies its own internal database URL. The Compose database credentials are fixed development defaults. `DATABASE_POOL_SIZE` must be a positive integer and `DATABASE_SSL=true` requires a trusted database certificate. Cloud Run uses a Unix socket with `CLOUD_SQL_CONNECTION_NAME`, so it does not need `DATABASE_URL` or `DATABASE_SSL`.

Keep `.env` out of Git, Docker images, and Cloud Build uploads; the ignore files exclude it and other `.env.*` files. Never put production secrets in `.env.example`.
