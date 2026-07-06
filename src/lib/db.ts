import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Please define the DATABASE_URL environment variable inside .env.local");
}

// Global variable to prevent multiple clients in development hot-reloads
const globalForDb = globalThis as unknown as {
  dbSql: any;
};

// Neon stateless HTTP query client (bypasses prepared statement caching and pooler issues)
export const sqlClient = globalForDb.dbSql ?? neon(connectionString);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbSql = sqlClient;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  
  // Format parameters to match node-postgres undefined values (convert to null)
  const formattedParams = params 
    ? params.map(p => p === undefined ? null : p) 
    : [];
    
  const rows = await sqlClient(text, formattedParams) as any[];
  
  const duration = Date.now() - start;
  // console.log('executed HTTP query', { duration, rowsCount: rows.length });
  
  return {
    rows,
    rowCount: rows.length
  };
}
