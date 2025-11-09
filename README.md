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
   - DockPilot relies on an existing PostgreSQL instance. Create the database referenced by `DATABASE_URL` and ensure the container can reach it over the network. When Docker runs on the same host as PostgreSQL, `host.docker.internal` (macOS/Windows) or the host's LAN IP (Linux) is typically the correct hostname.
5. **Apply the database schema**
   ```bash
   psql "$DATABASE_URL" -f db/schema.pg.sql
   ```
   This initializes tables, triggers, and optional storage history support.
6. **Build and start the Docker Compose stack**
   ```bash
   docker compose up -d --build
   ```

   This launches the single `dockpilot-app` container that hosts the API, UI, and lightweight gateway.
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

If you update container dependencies (for example, adjusting `api/package.json` or the root `Dockerfile`), rebuild the stack to ensure the changes take effect:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Getting Started

If you already have the prerequisites and configuration in place, the condensed setup is:

1. Apply the database schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.pg.sql
   ```
2. Copy `.env.example` to `.env` and fill in secrets.
3. Build and launch the stack:
   ```bash
   docker compose up -d --build
   ```
4. Visit the UI and log in with the owner credentials from `.env`. Change the password on first login.

## Services

| Service | Description |
| ------- | ----------- |
| `app` | Combined container that runs the API, UI (Nuxt Nitro server), and Express gateway on port 8080. |

## Environment Variables

See `.env.example` for required configuration. Notable values:

- `APP_PORT`: host port that exposes the combined gateway (defaults to 8080).
- `DATABASE_URL`: PostgreSQL connection string that points to your existing database. Ensure the hostname is reachable from inside the container (for example, `host.docker.internal`).
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
