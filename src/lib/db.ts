import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Please define the DATABASE_URL environment variable inside .env.local");
}

// Global variable to prevent multiple pools in development hot-reloads
const globalForDb = globalThis as unknown as {
  dbPool: Pool | undefined;
};

export const pool = globalForDb.dbPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbPool = pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Optional log for debugging queries
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}
