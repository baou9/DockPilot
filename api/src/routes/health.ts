import { FastifyInstance } from 'fastify';
import { q } from '../db.js';
import { requireAuth } from '../utils/auth-guard.js';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (req, reply) => {
    await requireAuth(req, reply);
  });

  fastify.get('/:appId', async (req, reply) => {
    const appId = Number((req.params as { appId: string }).appId);
    const limit = Number((req.query as { limit?: string }).limit ?? 50);
    if (Number.isNaN(appId)) {
      reply.code(400);
      return { error: 'invalid app id' };
    }

    const rows = await q(
      `SELECT id, ts, ok, latency_ms, status_code, error
       FROM health
       WHERE app_id = $1
       ORDER BY ts DESC
       LIMIT $2`,
      [appId, limit]
    );
    return rows;
  });
}
