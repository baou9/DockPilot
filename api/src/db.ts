import { Pool, QueryResult, QueryResultRow } from 'pg';

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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function q<T extends QueryResultRow = QueryResultRow, I extends unknown[] = unknown[]>(
  text: string,
  params?: I
): Promise<T[]> {
  return query<T>(text, params);
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
