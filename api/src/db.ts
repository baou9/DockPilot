import { Pool, QueryResult } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL env var must be set');
}

export const pool = new Pool({
  connectionString,
  application_name: 'dockpilot-api'
});

export type Queryable = {
  query: <T = unknown, I extends unknown[] = unknown[]>(text: string, params?: I) => Promise<QueryResult<T>>;
};

export async function q<T = unknown, I extends unknown[] = unknown[]>(text: string, params?: I) {
  return pool.query<T, I>(text, params);
}

export async function withTransaction<T>(fn: (client: Queryable) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
