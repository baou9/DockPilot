import { q } from '../db.js';

export type AiInsight = {
  app_id: number;
  app_name: string;
  severity: 'info' | 'warn' | 'critical';
  message: string;
  suggestion: string;
};

const enabled = process.env.AI_ASSISTANT_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY);
let insights: AiInsight[] = [];
let timer: NodeJS.Timeout | undefined;

async function computeInsights() {
  const { rows } = await q<{
    id: number;
    name: string;
    cpu_percent: number | null;
    memory_percent: number | null;
    restarts: number | null;
  }>(
    `SELECT id, name, cpu_percent, memory_percent, restarts
     FROM apps`
  );

  const result: AiInsight[] = [];
  for (const row of rows) {
    if (row.cpu_percent !== null && row.cpu_percent > 85) {
      result.push({
        app_id: row.id,
        app_name: row.name,
        severity: 'warn',
        message: `${row.name} CPU usage is high at ${row.cpu_percent.toFixed(1)}%.`,
        suggestion: 'Investigate running workloads or adjust resource limits.'
      });
    }
    if (row.memory_percent !== null && row.memory_percent > 85) {
      result.push({
        app_id: row.id,
        app_name: row.name,
        severity: 'warn',
        message: `${row.name} memory usage is high at ${row.memory_percent.toFixed(1)}%.`,
        suggestion: 'Review memory allocations or leaks.'
      });
    }
    if ((row.restarts ?? 0) > 3) {
      result.push({
        app_id: row.id,
        app_name: row.name,
        severity: 'critical',
        message: `${row.name} restarted ${(row.restarts ?? 0)} times recently.`,
        suggestion: 'Check container logs and add liveness probes.'
      });
    }
  }
  insights = result;
}

export function startAiCron() {
  if (!enabled) return;
  const interval = Number(process.env.AI_CRON_INTERVAL_MS || 5 * 60 * 1000);
  const run = async () => {
    try {
      await computeInsights();
    } catch (err) {
      console.error('AI cron error', err);
    }
  };
  run();
  timer = setInterval(run, interval);
}

export function stopAiCron() {
  if (timer) {
    clearInterval(timer);
  }
}

export function isAiEnabled() {
  return enabled;
}

export function getCachedInsights() {
  return insights;
}
