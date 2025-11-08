# DockPilot

DockPilot is a secure dashboard for monitoring and curating Dockerized applications. It discovers running containers through a docker-socket-proxy, stores metadata in PostgreSQL, and exposes a modern Nuxt 4-based UI with light/dark theming.

## Features

- Fastify + TypeScript backend with secure sessions and rate-limited authentication
- PostgreSQL persistence for users, apps, categories, and health checks
- Container discovery via Docker Engine API (through tecnativa/docker-socket-proxy)
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
   Edit `.env` and provide secure values for `SESSION_SECRET`, `ADMIN_PASSWORD`, database URL, and any optional AI credentials.
4. **Prepare PostgreSQL**
   - If you already have a PostgreSQL instance, ensure the database defined by `DATABASE_URL` exists and is reachable from the Docker host.
   - Otherwise, keep the bundled `postgres` service enabled in `docker-compose.yml` (default configuration).
5. **Apply the database schema**
   ```bash
   psql "$DATABASE_URL" -f db/schema.pg.sql
   ```
   This initializes tables, triggers, and optional storage history support.
6. **Build and start the Docker Compose stack**
   ```bash
   docker compose up -d --build
   ```
   The command launches the docker-socket-proxy, API, UI, and (optionally) PostgreSQL services.
7. **Verify service health**
   ```bash
   docker compose ps
   docker compose logs api
   ```
   Confirm all containers are running without errors.
8. **Access DockPilot**
   - Browse to `http://localhost:8080` (or `http://localhost:<HAPROXY_HTTP_PORT>` if you overrode the port) to reach the HAProxy front end.
   - Alternatively, access the UI service directly at `http://localhost:6452` if you prefer to bypass HAProxy in development.
   - Log in using `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` and complete the forced password change.

After installation, optional development workflows (e.g., running `npm run dev` inside `api` and `ui`) remain available.

### Rebuilding after dependency or Dockerfile updates

If you update container dependencies (for example, adjusting `api/package.json` or Dockerfiles), rebuild the stack to ensure the
changes take effect:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

The `--no-cache` flag forces Docker to refresh layer caches so dependency version changes—like the Fastify helmet pin—are picked
up correctly.

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
| `socket-proxy` | Secure proxy to Docker Engine (no direct docker.sock mounts). |
| `postgres` | PostgreSQL 16 database. |
| `api` | Fastify backend on port 6452 (exposed as 6453 locally). |
| `ui` | Nuxt 4 frontend on port 6452. |
| `haproxy` | Optional edge proxy exposing the UI/API on host port `HAPROXY_HTTP_PORT` (defaults to 8080). |

## Environment Variables

See `.env.example` for required configuration. Notable values:

- `SESSION_SECRET`: 64-byte secret for encrypted cookies (hex or base64).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: bootstrap owner credentials.
- `HEALTH_INTERVAL_MS`, `HEALTH_TIMEOUT_MS`: tweak health check cadence and timeout.
- `COLLECTOR_SIZE_INTERVAL_MS`: cadence (ms) for storage polling (defaults to 3 minutes).
- `AI_ASSISTANT_ENABLED`: enable heuristic insights when paired with `OPENAI_API_KEY`.
- `DOCKER_PROXY_URL`: optional override for the internal docker-socket-proxy URL. Leave unset to rely on the Compose default and avoid clobbering any host `DOCKER_HOST` settings.
- `HAPROXY_HTTP_PORT` / `HAPROXY_HTTPS_PORT`: host-side bindings for the HAProxy service (defaults 8080/4444). Adjust if port 80/443 or 8443 (Plesk) are occupied.

## Development

- API: `cd api && npm install && npm run dev`
- UI: `cd ui && npm install && npm run dev`

Ensure a PostgreSQL database is accessible for API development.
