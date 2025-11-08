import { promises as fs } from 'fs';
import path from 'path';

type NginxMapEntry = {
  serverName: string;
  proxyPass?: string;
};

export async function readNginxMappings(directory = process.env.NGINX_SITES_DIR || '/etc/nginx/sites-enabled') {
  const mappings: NginxMapEntry[] = [];
  try {
    const files = await fs.readdir(directory);
    for (const file of files) {
      const fullPath = path.join(directory, file);
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) continue;
      const content = await fs.readFile(fullPath, 'utf8');
      const serverNameMatch = content.match(/server_name\s+([^;]+);/);
      const proxyMatch = content.match(/proxy_pass\s+(http[^;]+);/);
      if (serverNameMatch) {
        mappings.push({
          serverName: serverNameMatch[1].trim(),
          proxyPass: proxyMatch ? proxyMatch[1].trim() : undefined
        });
      }
    }
  } catch (err) {
    return [];
  }
  return mappings;
}

export function mapUrlForContainer(mappings: NginxMapEntry[], containerName: string) {
  const match = mappings.find((m) => m.serverName.includes(containerName));
  return match?.proxyPass || null;
}
