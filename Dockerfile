# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# ---- build API ----
FROM base AS build-api
WORKDIR /app/api
COPY api/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY api/. .
RUN npm run build

# ---- build UI ----
FROM base AS build-ui
WORKDIR /app/ui
COPY ui/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY ui/. .
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    API_PORT=3001 \
    UI_PORT=3000

COPY --from=build-api /app/api/build /app/api/build
COPY --from=build-api /app/api/package*.json /app/api/
COPY --from=build-ui /app/ui/.output /app/ui/.output
COPY --from=build-ui /app/ui/package*.json /app/ui/

WORKDIR /app/api
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

WORKDIR /app/ui
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

WORKDIR /app
COPY ops/gateway/package.json ops/gateway/server.js ./gateway/
RUN cd gateway && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

RUN mkdir -p /app/uploads

EXPOSE 8080
CMD ["node", "gateway/server.js"]
