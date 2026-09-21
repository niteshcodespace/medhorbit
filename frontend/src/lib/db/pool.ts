import { Pool } from "pg";

// Reuse one pool across hot reloads in development.
const globalForPool = globalThis as unknown as { medhorbitPool?: Pool };

/** Server-only PostgreSQL pool, configured from DATABASE_URL. */
export function getPool(): Pool {
  if (!globalForPool.medhorbitPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set.");
    }
    globalForPool.medhorbitPool = new Pool({ connectionString });
  }
  return globalForPool.medhorbitPool;
}
