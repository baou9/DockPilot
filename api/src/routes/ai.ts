import { FastifyInstance } from 'fastify';
import { requireAuth } from '../utils/auth-guard.js';
import { getCachedInsights, isAiEnabled } from '../jobs/ai-cron.js';

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (req, reply) => {
    await requireAuth(req, reply);
  });

  fastify.get('/insights', async () => {
    if (!isAiEnabled()) {
      return { enabled: false, insights: [] };
    }
    return { enabled: true, insights: getCachedInsights() };
  });
}
