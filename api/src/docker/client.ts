import { fetch } from 'undici';

// Use a distinct environment variable for the socket proxy to avoid conflicts
const dockerHost = process.env.DOCKER_PROXY_URL || 'http://socket-proxy:2375';

async function handleResponse(res: any) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Docker API error ${res.status}: ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function dockerGet<T>(path: string, query?: Record<string, string | number | boolean>) {
  const url = new URL(path, dockerHost);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  return handleResponse(res) as Promise<T>;
}

export async function dockerStream(path: string) {
  const url = new URL(path, dockerHost);
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Docker stream error ${res.status}: ${text}`);
  }
  if (!res.body) {
    throw new Error('Docker stream body missing');
  }
  return res.body;
}
