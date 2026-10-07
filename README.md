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
docker compose up --build
```

The API is available at `http://localhost:3000` from Windows and WSL. In WSL 2 NAT mode, if a Windows-hosted service cannot be reached through `localhost`, use the Windows host gateway shown by `ip route show default` instead. The Compose file uses local development database credentials; replace them before using this configuration in a shared environment.

To stop the services, run `docker compose down`. Add `-v` only if you also want to delete the local PostgreSQL data volume.

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
When the server is running, open [http://localhost:3000/api-docs/](http://localhost:3000/api-docs/) to explore it in Swagger UI.

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

## Verify the API

With the API running, request statistics, the player list, or look up a player by ID:

```bash
curl http://localhost:3000/api/players
curl http://localhost:3000/api/players/17
curl http://localhost:3000/api/statistics
```

The list response is JSON and contains a `players` array; the lookup response contains a `player` object; and the statistics response contains a `statistics` object. You can also try all endpoints from Swagger UI at `http://localhost:3000/api-docs/`.

## Tests and build

The project uses Vitest and Supertest. Tests cover the players route and Swagger UI, and verify the repository's rank ordering without requiring a running database.

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
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | None | PostgreSQL connection string; set this in `.env` when running locally. Docker Compose supplies its own value. |
| `DATABASE_SSL` | `false` | Enable certificate-verified TLS for PostgreSQL |
| `DATABASE_POOL_SIZE` | `10` | Maximum number of pooled database connections |
| `PLAYER_WRITE_API_KEY` | None | Secret of at least 32 bytes required by `POST /api/players`; creation stays disabled if unset or too short. Compose reads it from `.env`. |
