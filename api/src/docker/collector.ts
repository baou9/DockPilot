import { dockerGet } from './client.js';
import { q, withTransaction } from '../db.js';
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

type DockerMount = {
  Type: 'volume' | 'bind' | 'tmpfs' | string;
  Name?: string;
  Source?: string;
  Destination?: string;
};

type DockerContainerWithSize = DockerContainer & {
  Mounts?: DockerMount[];
  SizeRw?: number;
  SizeRootFs?: number;
};

type DockerVolumeUsage = {
  Name?: string;
  UsageData?: { Size?: number };
};

type DockerSystemDf = {
  Volumes?: DockerVolumeUsage[];
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

let statsTimer: NodeJS.Timeout | undefined;
let storageTimer: NodeJS.Timeout | undefined;

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

async function collectStats() {
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

    const rows = await withTransaction(async (client) => {
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

async function collectStorageSizes() {
  const containers = await dockerGet<DockerContainerWithSize[]>('/containers/json', { all: 1, size: 1 });
  let df: DockerSystemDf = {};
  try {
    df = await dockerGet<DockerSystemDf>('/system/df');
  } catch (err) {
    console.error('Failed to fetch docker system df', err);
  }

  const volumeSizeMap = new Map<string, number>();
  for (const volume of df.Volumes || []) {
    if (!volume?.Name) continue;
    const size = volume.UsageData?.Size;
    if (typeof size === 'number') {
      volumeSizeMap.set(volume.Name, size);
    }
  }

  for (const container of containers) {
    const name = container.Names?.[0]?.replace(/^\//, '') || container.Id.slice(0, 12);
    const sizeRw = typeof container.SizeRw === 'number' ? container.SizeRw : null;
    const sizeRootfs = typeof container.SizeRootFs === 'number' ? container.SizeRootFs : null;

    const mounts = container.Mounts || [];
    const volumeMounts = mounts.filter((m) => m.Type === 'volume' && m.Name);
    let volumesSize: number | null = null;
    if (volumeMounts.length === 0) {
      volumesSize = 0;
    } else {
      let total = 0;
      let hasData = false;
      for (const mount of volumeMounts) {
        if (!mount.Name) continue;
        if (volumeSizeMap.has(mount.Name)) {
          total += volumeSizeMap.get(mount.Name)!;
          hasData = true;
        }
      }
      volumesSize = hasData ? total : null;
    }

    await q(
      `INSERT INTO apps (container_id, name, image, size_rw, size_rootfs, volumes_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (container_id) DO UPDATE SET
         name = EXCLUDED.name,
         image = EXCLUDED.image,
         size_rw = EXCLUDED.size_rw,
         size_rootfs = EXCLUDED.size_rootfs,
         volumes_size = EXCLUDED.volumes_size,
         updated_at = now()`,
      [
        container.Id,
        name,
        container.Image || null,
        sizeRw,
        sizeRootfs,
        volumesSize
      ]
    );

    if (sizeRw !== null || sizeRootfs !== null || volumesSize !== null) {
      try {
        await q(
          `INSERT INTO app_storage (app_id, size_rw, size_rootfs, volumes_size)
           SELECT id, $2, $3, $4 FROM apps WHERE container_id = $1`,
          [
            container.Id,
            sizeRw,
            sizeRootfs,
            volumesSize
          ]
        );
      } catch (err) {
        console.error('Failed to insert app storage history', container.Id, err);
      }
    }
  }
}

export function startCollector() {
  if (!process.env.DOCKER_PROXY_URL) {
    console.warn('Docker metrics collector disabled: DOCKER_PROXY_URL is not set.');
    return;
  }
  const interval = Number(process.env.COLLECTOR_INTERVAL_MS || 30_000);
  const run = async () => {
    try {
      await collectStats();
    } catch (err) {
      console.error('Collector error', err);
    }
  };
  run();
  statsTimer = setInterval(run, interval);

  const sizeInterval = Number(process.env.COLLECTOR_SIZE_INTERVAL_MS || 180_000);
  const runStorage = async () => {
    try {
      await collectStorageSizes();
    } catch (err) {
      console.error('Storage collector error', err);
    }
  };
  runStorage();
  storageTimer = setInterval(runStorage, sizeInterval);
}

export function stopCollector() {
  if (statsTimer) clearInterval(statsTimer);
  if (storageTimer) clearInterval(storageTimer);
}
