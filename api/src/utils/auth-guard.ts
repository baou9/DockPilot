import { FastifyReply, FastifyRequest } from 'fastify';
import { q } from '../db.js';

export interface SessionUser {
  id: number;
  username: string;
  must_change_password: boolean;
  is_owner: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

type SessionData = {
  userId?: number;
};

export async function resolveSessionUser(req: FastifyRequest) {
  const session = req.session as SessionData | undefined;
  if (!session?.userId) {
    return null;
  }

  const { rows } = await q<SessionUser>(
    'SELECT id, username, must_change_password, is_owner FROM users WHERE id = $1',
    [session.userId]
  );
  const user = rows[0];
  if (!user) {
    return null;
  }
  req.user = user;
  return user;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = await resolveSessionUser(req);
  if (!user) {
    reply.code(401);
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  const user = await requireAuth(req, reply);
  if (!user.is_owner) {
    reply.code(403);
    throw new Error('Forbidden');
  }
  return user;
}
