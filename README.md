# DockPilot

DockPilot is a secure dashboard for monitoring and curating Dockerized applications. It discovers running containers (when given access to the Docker API), stores metadata in PostgreSQL, and exposes a modern Nuxt 4-based UI with light/dark theming.

## Features

- Fastify + TypeScript backend with secure sessions and rate-limited authentication
- PostgreSQL persistence for users, apps, categories, and health checks
- Optional container discovery via the Docker Engine API (configure `DOCKER_PROXY_URL` to enable)
- Automatic Nginx virtual host mapping, label-driven metadata, and periodic health checks
- Per-container storage metrics (RW layer, rootfs, Docker volumes) with history snapshots
- Optional AI assistance for anomaly hints
- Nuxt 4 dashboard with responsive cards, category filtering, icon uploads, and theme toggle

## Installation

Follow the steps below to install and run DockPilot from a clean machine:

1. **Install prerequisites**
   - Docker Engine **24+** with the Docker Compose plugin (`docker compose` command).
   - Node.js **22** and npm (needed only for local development outside the Compose stack).
   - `psql` client (e.g., via PostgreSQL packages) to apply the schema.
2. **Clone the repository**
   ```bash
   git clone https://github.com/<your-org>/DockPilot.git
   cd DockPilot
   ```
3. **Provision environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide secure values for `SESSION_SECRET`, `ADMIN_PASSWORD`, `APP_PORT`, and optional Docker / AI settings.
4. **Prepare PostgreSQL**
   - If you already have a PostgreSQL instance, ensure the database defined by `DATABASE_URL` exists and is reachable from the Docker host. Set `USE_EXTERNAL_POSTGRES=true` in `.env` and skip the bundled database profile when starting Compose.
   - Otherwise, use the bundled `postgres` service (enabled via the `local-db` Compose profile).
5. **Apply the database schema**
   ```bash
   psql "$DATABASE_URL" -f db/schema.pg.sql
   ```
   This initializes tables, triggers, and optional storage history support.
6. **Build and start the Docker Compose stack**

   **A. With the bundled PostgreSQL container**
   ```bash
   docker compose --profile app --profile local-db up -d --build
   ```

   **B. With an existing PostgreSQL instance**
   ```bash
   # Ensure DATABASE_URL points at your external database and USE_EXTERNAL_POSTGRES=true
   docker compose --profile app up -d --build
   ```

   The command launches a single `dockpilot-app` container that hosts the API, UI, and lightweight gateway. Add the `local-db` profile only when you want Compose to run PostgreSQL for you.
7. **Verify service health**
   ```bash
   docker compose ps
   docker compose logs app
   ```
   Confirm the `app` container is running without errors.
8. **Access DockPilot**
   - Browse to `http://localhost:8080` (or `http://localhost:${APP_PORT}` if you overrode the port) to reach the UI.
   - Log in using `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` and complete the forced password change.

After installation, optional development workflows (e.g., running `npm run dev` inside `api` and `ui`) remain available.

### Rebuilding after dependency or Dockerfile updates

If you update container dependencies (for example, adjusting `api/package.json` or the root `Dockerfile`), rebuild the stack to ensure the changes take effect. Prior deployments from the legacy multi-container layout should first clear the old auxiliary services:

```bash
docker compose down --remove-orphans
docker compose build --no-cache
docker compose --profile app --profile local-db up -d
```

Removing orphans ensures the retired `haproxy`, `postgres`, and `socket-proxy` containers from earlier releases do not linger before you bring up the consolidated `app` service.

Remove the `local-db` profile flag if you rely on an external PostgreSQL instance.

## Getting Started

If you already have the prerequisites and configuration in place, the condensed setup is:

1. Apply the database schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.pg.sql
   ```
2. Copy `.env.example` to `.env` and fill in secrets.
3. Build and launch the stack (choose the appropriate profile set):
   ```bash
   docker compose --profile app --profile local-db up -d --build
   ```
4. Visit the UI and log in with the owner credentials from `.env`. Change the password on first login.

## Services

| Service | Description |
| ------- | ----------- |
| `app` | Combined container that runs the API, UI (Nuxt Nitro server), and Express gateway on port 8080. |
| `postgres` | PostgreSQL 16 database, enabled only when the `local-db` profile is used. |

## Environment Variables

See `.env.example` for required configuration. Notable values:

- `APP_PORT`: host port that exposes the combined gateway (defaults to 8080).
- `DATABASE_URL`: PostgreSQL connection string. Leave empty when using the bundled database and it will default to the Compose service.
- `USE_EXTERNAL_POSTGRES`: set to `true` when you do **not** want Compose to start PostgreSQL.
- `SESSION_SECRET`: 64-byte secret for encrypted cookies (hex or base64).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: bootstrap owner credentials.
- `HEALTH_INTERVAL_MS`, `HEALTH_TIMEOUT_MS`: tweak health check cadence and timeout.
- `COLLECTOR_SIZE_INTERVAL_MS`: cadence (ms) for storage polling (defaults to 3 minutes).
- `AI_ASSISTANT_ENABLED`: enable heuristic insights when paired with `OPENAI_API_KEY`.
- `DOCKER_PROXY_URL`: optional URL for a Docker Engine API endpoint. Set this when you want DockPilot to collect metrics from the host.

## Development

- API: `cd api && npm install && npm run dev`
- UI: `cd ui && npm install && npm run dev`

Ensure a PostgreSQL database is accessible for API development. When running the backend locally outside Docker, set `DATABASE_URL` accordingly and provide the rest of the environment variables listed above.
