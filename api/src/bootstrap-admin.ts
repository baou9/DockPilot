import bcrypt from 'bcryptjs';
import { q } from './db.js';

export async function ensureOwnerUser() {
  const { rows } = await q<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (rows[0] && rows[0].count !== '0') {
    return;
  }

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'change-me-now';
  const passwordHash = await bcrypt.hash(password, 12);

  await q(
    `INSERT INTO users (username, password_hash, must_change_password, is_owner)
     VALUES ($1, $2, true, true)`,
    [username, passwordHash]
  );
}
