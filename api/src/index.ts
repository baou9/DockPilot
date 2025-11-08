import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import secureSession from '@fastify/secure-session';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import path from 'path';
import { ensureOwnerUser } from './bootstrap-admin.js';
import authRoutes from './routes/auth.js';
import appsRoutes from './routes/apps.js';
import healthRoutes from './routes/health.js';
import aiRoutes from './routes/ai.js';
import { resolveSessionUser } from './utils/auth-guard.js';
import { startCollector } from './docker/collector.js';
import { startHealthCron } from './jobs/health-cron.js';
import { startAiCron, isAiEnabled } from './jobs/ai-cron.js';

const app = Fastify({
  logger: true
});

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET env var must be set');
}

let sessionKey: Buffer;
if (/^[0-9a-fA-F]+$/.test(sessionSecret) && sessionSecret.length % 2 === 0) {
  sessionKey = Buffer.from(sessionSecret, 'hex');
} else {
  sessionKey = Buffer.from(sessionSecret, 'base64');
}

if (sessionKey.length < 32) {
  throw new Error('SESSION_SECRET must decode to at least 32 bytes');
}

await app.register(helmet, {
  global: true
});

await app.register(cookie);
await app.register(secureSession, {
  key: sessionKey,
  cookieName: 'dockpilot_session',
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});

await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute'
});

await app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

await app.register(fastifyStatic, {
  root: path.resolve('uploads'),
  prefix: '/uploads/'
});

app.addHook('preHandler', async (req) => {
  await resolveSessionUser(req);
});

await ensureOwnerUser();
startCollector();
startHealthCron();
startAiCron();

app.register(authRoutes, { prefix: '/auth' });
app.register(appsRoutes, { prefix: '/apps' });
app.register(healthRoutes, { prefix: '/health' });
app.register(aiRoutes, { prefix: '/ai' });

app.get('/status', async () => ({
  ok: true,
  ai: isAiEnabled()
}));

const port = Number(process.env.PORT || 6452);
await app.listen({ port, host: '0.0.0.0' });
