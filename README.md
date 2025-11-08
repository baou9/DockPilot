# DockPilot

DockPilot is a secure dashboard for monitoring and curating Dockerized applications. It discovers running containers through a docker-socket-proxy, stores metadata in PostgreSQL, and exposes a modern Nuxt 4-based UI with light/dark theming.

## Features

- Fastify + TypeScript backend with secure sessions and rate-limited authentication
- PostgreSQL persistence for users, apps, categories, and health checks
- Container discovery via Docker Engine API (through tecnativa/docker-socket-proxy)
- Automatic Nginx virtual host mapping, label-driven metadata, and periodic health checks
- Optional AI assistance for anomaly hints
- Nuxt 4 dashboard with responsive cards, category filtering, icon uploads, and theme toggle

## Getting Started

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
| `api` | Fastify backend on port 3000 (exposed as 3001 locally). |
| `ui` | Nuxt 4 frontend on port 3000. |

## Environment Variables

See `.env.example` for required configuration. Notable values:

- `SESSION_SECRET`: 64-byte secret for encrypted cookies (hex or base64).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: bootstrap owner credentials.
- `HEALTH_INTERVAL_MS`, `HEALTH_TIMEOUT_MS`: tweak health check cadence and timeout.
- `AI_ASSISTANT_ENABLED`: enable heuristic insights when paired with `OPENAI_API_KEY`.

## Development

- API: `cd api && npm install && npm run dev`
- UI: `cd ui && npm install && npm run dev`

Ensure a PostgreSQL database is accessible for API development.
