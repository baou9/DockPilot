CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN DEFAULT TRUE NOT NULL,
  is_owner BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS apps (
  id SERIAL PRIMARY KEY,
  container_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  status TEXT,
  state TEXT,
  ports JSONB DEFAULT '[]'::jsonb NOT NULL,
  cpu_percent REAL,
  memory_percent REAL,
  restarts INTEGER DEFAULT 0,
  app_url TEXT,
  nginx_server_name TEXT,
  icon_url TEXT,
  icon_emoji TEXT,
  pinned BOOLEAN DEFAULT FALSE NOT NULL,
  notes TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS app_categories (
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, category_id)
);

CREATE TABLE IF NOT EXISTS health (
  id BIGSERIAL PRIMARY KEY,
  app_id INTEGER REFERENCES apps(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ DEFAULT now() NOT NULL,
  ok BOOLEAN NOT NULL,
  latency_ms INTEGER,
  status_code INTEGER,
  error TEXT
);

ALTER TABLE apps
  ADD COLUMN IF NOT EXISTS size_rw BIGINT,
  ADD COLUMN IF NOT EXISTS size_rootfs BIGINT,
  ADD COLUMN IF NOT EXISTS volumes_size BIGINT;

CREATE TABLE IF NOT EXISTS app_storage (
  id BIGSERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ DEFAULT now(),
  size_rw BIGINT,
  size_rootfs BIGINT,
  volumes_size BIGINT
);

CREATE INDEX IF NOT EXISTS app_storage_app_ts ON app_storage(app_id, ts DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'apps' AND trigger_name = 'apps_touch_updated_at'
  ) THEN
    CREATE TRIGGER apps_touch_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'users' AND trigger_name = 'users_touch_updated_at'
  ) THEN
    CREATE TRIGGER users_touch_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END;
$$;
