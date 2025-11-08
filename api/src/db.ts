import { Pool, type QueryResultRow, type QueryConfig, type QueryResult } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL env var must be set');
}

export const pool = new Pool({
  connectionString,
  application_name: 'dockpilot-api'
});

export type Queryable = {
  query: <T extends QueryResultRow = QueryResultRow, I extends unknown[] = unknown[]>(
    text: string | QueryConfig<I>,
    params?: I
  ) => Promise<QueryResult<T>>;
};

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string | QueryConfig<any[]>,
  params?: any[]
): Promise<T[]> {
  const res = await pool.query<T>(text as any, params as any);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string | QueryConfig<any[]>,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text as any, params as any);
  return rows[0] ?? null;
}

export async function q<T extends QueryResultRow = QueryResultRow, I extends unknown[] = unknown[]>(
  text: string | QueryConfig<I>,
  params?: I
): Promise<T[]> {
  return query<T>(text as any, params as any);
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
