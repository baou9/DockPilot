import { dockerGet } from './client.js';
import { withTransaction } from '../db.js';
import { readNginxMappings } from './nginx-map.js';

type DockerPort = {
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
  IP?: string;
};

type DockerContainer = {
  Id: string;
  Names: string[];
  Image: string;
  State: string;
  Status: string;
  RestartCount?: number;
  Labels: Record<string, string>;
  Ports: DockerPort[];
};

type DockerStats = {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[];
    };
    system_cpu_usage?: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage?: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
  };
};

let timer: NodeJS.Timeout | undefined;

function calcCpuPercent(stats: DockerStats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0);
  const cpuCount = stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * cpuCount * 100;
  }
  return 0;
}

function calcMemPercent(stats: DockerStats) {
  if (!stats.memory_stats || stats.memory_stats.limit === 0) {
    return 0;
  }
  return (stats.memory_stats.usage / stats.memory_stats.limit) * 100;
}

async function collectOnce() {
  const containers = await dockerGet<DockerContainer[]>('/containers/json', { all: 1 });
  const nginxMappings = await readNginxMappings();

  for (const container of containers) {
    let cpuPercent = 0;
    let memPercent = 0;
    try {
      const stats = await dockerGet<DockerStats>(`/containers/${container.Id}/stats`, { stream: false });
      cpuPercent = calcCpuPercent(stats);
      memPercent = calcMemPercent(stats);
    } catch (err) {
      console.error('Failed to fetch stats', container.Id, err);
    }

    const labels = container.Labels || {};
    const name = labels['com.docker.compose.service'] || container.Names?.[0]?.replace(/^\//, '') || container.Id.slice(0, 12);
    const matchedMapping = nginxMappings.find((m) => m.serverName.includes(name));
    const presetUrl = labels['com.av.url'] || matchedMapping?.proxyPass || null;
    const presetCategories = labels['com.av.categories']?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    const iconEmoji = labels['com.av.icon'] || null;

    const ports = container.Ports?.map((p) => ({
      private: p.PrivatePort,
      public: p.PublicPort,
      type: p.Type,
      ip: p.IP
    })) || [];

    const { rows } = await withTransaction(async (client) => {
      const upsert = await client.query<{ id: number }>(
        `INSERT INTO apps
          (container_id, name, image, status, state, ports, cpu_percent, memory_percent, restarts, app_url, nginx_server_name, icon_emoji, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, now())
         ON CONFLICT (container_id) DO UPDATE SET
           name = EXCLUDED.name,
           image = EXCLUDED.image,
           status = EXCLUDED.status,
           state = EXCLUDED.state,
           ports = EXCLUDED.ports,
           cpu_percent = EXCLUDED.cpu_percent,
           memory_percent = EXCLUDED.memory_percent,
           restarts = EXCLUDED.restarts,
           last_seen = now(),
           app_url = COALESCE(apps.app_url, EXCLUDED.app_url),
           nginx_server_name = COALESCE(apps.nginx_server_name, EXCLUDED.nginx_server_name),
           icon_emoji = COALESCE(apps.icon_emoji, EXCLUDED.icon_emoji)
         RETURNING id`,
        [
          container.Id,
          name,
          container.Image,
          container.Status,
          container.State,
          JSON.stringify(ports),
          cpuPercent,
          memPercent,
          container.RestartCount ?? 0,
          presetUrl,
          matchedMapping?.serverName || null,
          iconEmoji
        ]
      );

      const appId = upsert.rows[0].id;

      for (const categoryName of presetCategories) {
        const color = '#4b9fff';
        const cat = await client.query<{ id: number }>(
          `INSERT INTO categories (name, color)
           VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET color = COALESCE(categories.color, EXCLUDED.color)
           RETURNING id`,
          [categoryName, color]
        );
        await client.query(
          `INSERT INTO app_categories (app_id, category_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [appId, cat.rows[0].id]
        );
      }

      return upsert.rows;
    });

    if (rows.length === 0) {
      console.warn('Failed to upsert app for container', container.Id);
    }
  }
}

export function startCollector() {
  const interval = Number(process.env.COLLECTOR_INTERVAL_MS || 30_000);
  const run = async () => {
    try {
      await collectOnce();
    } catch (err) {
      console.error('Collector error', err);
    }
  };
  run();
  timer = setInterval(run, interval);
}

export function stopCollector() {
  if (timer) clearInterval(timer);
}
