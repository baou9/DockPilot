import { fetch } from 'undici';
import { q } from '../db.js';

let timer: NodeJS.Timeout | undefined;

async function runHealthCheck() {
  const rows = await q<{
    id: number;
    app_url: string | null;
  }>(`SELECT id, app_url FROM apps WHERE app_url IS NOT NULL AND app_url <> ''`);

  for (const app of rows) {
    if (!app.app_url) continue;
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.HEALTH_TIMEOUT_MS || 8000));
    try {
      const res = await fetch(app.app_url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'DockPilot-health-check' }
      });
      const latency = Date.now() - start;
      await q(
        `INSERT INTO health (app_id, ok, latency_ms, status_code)
         VALUES ($1, $2, $3, $4)`,
        [app.id, res.ok, latency, res.status]
      );
    } catch (err) {
      const latency = Date.now() - start;
      await q(
        `INSERT INTO health (app_id, ok, latency_ms, error)
         VALUES ($1, false, $2, $3)`,
        [app.id, latency, err instanceof Error ? err.message : String(err)]
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function startHealthCron() {
  const interval = Number(process.env.HEALTH_INTERVAL_MS || 60_000);
  const run = async () => {
    try {
      await runHealthCheck();
    } catch (err) {
      console.error('Health check error', err);
    }
  };
  run();
  timer = setInterval(run, interval);
}

export function stopHealthCron() {
  if (timer) clearInterval(timer);
}
