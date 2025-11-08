import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { q } from '../db.js';
import { requireAuth, requireOwner, resolveSessionUser } from '../utils/auth-guard.js';

type LoginBody = {
  username: string;
  password: string;
};

type ChangePasswordBody = {
  oldPassword: string;
  newPassword: string;
};

type CreateUserBody = {
  username: string;
  password: string;
  is_owner?: boolean;
};

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: LoginBody }>('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  }, async (req, reply) => {
    const { username, password } = req.body;
    if (!username || !password) {
      reply.code(400);
      return { error: 'Username and password required' };
    }

    const { rows } = await q<{
      id: number;
      username: string;
      password_hash: string;
      must_change_password: boolean;
      is_owner: boolean;
    }>('SELECT * FROM users WHERE username = $1', [username]);

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      reply.code(401);
      return { error: 'Invalid credentials' };
    }

    req.session.set('userId', user.id);
    return {
      must_change_password: user.must_change_password
    };
  });

  fastify.post('/logout', async (req) => {
    req.session.delete();
    return { ok: true };
  });

  fastify.get('/me', async (req) => {
    const user = await resolveSessionUser(req);
    if (!user) {
      return { user: null };
    }
    return { user };
  });

  fastify.post<{ Body: ChangePasswordBody }>('/change-password', async (req, reply) => {
    const user = await requireAuth(req, reply);
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      reply.code(400);
      return { error: 'Both old and new password required' };
    }

    const { rows } = await q<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    const existing = rows[0];
    if (!existing || !(await bcrypt.compare(oldPassword, existing.password_hash))) {
      reply.code(400);
      return { error: 'Old password incorrect' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await q('UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2', [newHash, user.id]);

    return { ok: true };
  });

  fastify.post<{ Body: CreateUserBody }>('/users', async (req, reply) => {
    await requireOwner(req, reply);
    const { username, password, is_owner } = req.body;
    if (!username || !password) {
      reply.code(400);
      return { error: 'username and password required' };
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await q<{ id: number }>(
      `INSERT INTO users (username, password_hash, must_change_password, is_owner)
       VALUES ($1, $2, true, $3)
       RETURNING id`,
      [username, hash, Boolean(is_owner)]
    );
    return { id: rows[0].id };
  });
}
