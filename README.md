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

Docker Compose starts PostgreSQL, builds the API image, applies the schema, loads the sample players from `headtohead.json`, and starts the API.

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`. The Compose file uses local development credentials; replace them before using this configuration in a shared environment.

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

## Verify the API

With the API running, request the player list:

```bash
curl http://localhost:3000/api/players
```

The response is JSON and contains a `players` array. You can also try the endpoint from Swagger UI at `http://localhost:3000/api-docs/`.

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

The current migration is in `src/database/migrations/001_initial_schema.sql`. Apply it with `npm run db:migrate` after building the project.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | None | PostgreSQL connection string; set this in `.env` when running locally. Docker Compose supplies its own value. |
| `DATABASE_SSL` | `false` | Enable certificate-verified TLS for PostgreSQL |
| `DATABASE_POOL_SIZE` | `10` | Maximum number of pooled database connections |
