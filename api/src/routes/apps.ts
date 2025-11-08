import { promises as fs } from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { q, withTransaction } from '../db.js';
import { requireAuth } from '../utils/auth-guard.js';

const uploadsDir = path.resolve('uploads/icons');

async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir, { recursive: true });
}

type UpdateAppBody = {
  name?: string;
  app_url?: string | null;
  icon_url?: string | null;
  icon_emoji?: string | null;
  pinned?: boolean;
  notes?: string | null;
  categories?: (number | string)[];
};

export default async function appsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (req, reply) => {
    await requireAuth(req, reply);
  });

  fastify.get('/:id', async (req, reply) => {
    const appId = Number((req.params as { id: string }).id);
    if (Number.isNaN(appId)) {
      reply.code(400);
      return { error: 'invalid app id' };
    }
    const { rows } = await q(
      `SELECT a.*, COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'color', c.color))
         FILTER (WHERE c.id IS NOT NULL), '[]') AS categories
       FROM apps a
       LEFT JOIN app_categories ac ON ac.app_id = a.id
       LEFT JOIN categories c ON c.id = ac.category_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [appId]
    );
    if (!rows[0]) {
      reply.code(404);
      return { error: 'app not found' };
    }
    const row = rows[0];
    row.ports = typeof row.ports === 'string' ? JSON.parse(row.ports) : row.ports || [];
    return row;
  });

  fastify.get('/', async () => {
    const { rows } = await q(
      `SELECT a.*, COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name, 'color', c.color))
         FILTER (WHERE c.id IS NOT NULL), '[]') AS categories
       FROM apps a
       LEFT JOIN app_categories ac ON ac.app_id = a.id
       LEFT JOIN categories c ON c.id = ac.category_id
       GROUP BY a.id
       ORDER BY a.pinned DESC, a.name`
    );
    return rows.map((row) => ({
      ...row,
      ports: typeof row.ports === 'string' ? JSON.parse(row.ports) : row.ports || []
    }));
  });

  fastify.patch<{ Params: { id: string }; Body: UpdateAppBody }>('/:id', async (req, reply) => {
    const appId = Number(req.params.id);
    if (Number.isNaN(appId)) {
      reply.code(400);
      return { error: 'invalid app id' };
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'categories') continue;
      if (['name', 'app_url', 'icon_url', 'icon_emoji', 'pinned', 'notes'].includes(key)) {
        fields.push(`${key} = $${index++}`);
        if (key === 'pinned' && typeof value === 'boolean') {
          values.push(value);
        } else {
          values.push(value ?? null);
        }
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = now()`);
      await q(`UPDATE apps SET ${fields.join(', ')} WHERE id = $${index}`, [...values, appId]);
    }

    if (req.body.categories) {
      await withTransaction(async (client) => {
        const resolvedIds: number[] = [];
        for (const entry of req.body.categories || []) {
          if (typeof entry === 'number' && !Number.isNaN(entry)) {
            resolvedIds.push(entry);
            continue;
          }
          const maybeNumber = typeof entry === 'string' ? Number(entry) : NaN;
          if (!Number.isNaN(maybeNumber)) {
            resolvedIds.push(maybeNumber);
            continue;
          }
          const name = String(entry).trim();
          if (!name) continue;
          const color = '#6366f1';
          const result = await client.query<{ id: number }>(
            `INSERT INTO categories (name, color)
             VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET color = COALESCE(categories.color, EXCLUDED.color)
             RETURNING id`,
            [name, color]
          );
          resolvedIds.push(result.rows[0].id);
        }
        const unique = [...new Set(resolvedIds.filter((id) => !Number.isNaN(id)))];
        await client.query('DELETE FROM app_categories WHERE app_id = $1', [appId]);
        for (const categoryId of unique) {
          await client.query(
            `INSERT INTO app_categories (app_id, category_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [appId, categoryId]
          );
        }
      });
    }

    const { rows } = await q('SELECT * FROM apps WHERE id = $1', [appId]);
    if (!rows[0]) {
      reply.code(404);
      return { error: 'app not found' };
    }
    const row = rows[0];
    row.ports = typeof row.ports === 'string' ? JSON.parse(row.ports) : row.ports || [];
    return row;
  });

  fastify.post<{ Params: { id: string } }>('/:id/icon', async (req, reply) => {
    const appId = Number(req.params.id);
    if (Number.isNaN(appId)) {
      reply.code(400);
      return { error: 'invalid app id' };
    }

    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { error: 'file required' };
    }

    await ensureUploadsDir();
    const ext = data.filename.split('.').pop() || 'png';
    const filename = `app-${appId}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, await data.toBuffer());

    const publicPath = `/uploads/icons/${filename}`;
    await q('UPDATE apps SET icon_url = $1, updated_at = now() WHERE id = $2', [publicPath, appId]);

    return { icon_url: publicPath };
  });
}
