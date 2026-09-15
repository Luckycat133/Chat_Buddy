import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Database } from '../../db/index.js';

/**
 * Liveness and readiness. Liveness never touches the database; readiness
 * runs a trivial SELECT 1 with a tight timeout (caller's pool controls
 * statement_timeout; the query is intentionally trivial).
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/readyz', async (request, reply) => {
    const db = request.server.db as Database | undefined;
    if (!db) {
      reply.code(503);
      return { ok: false, reason: 'database not configured' };
    }
    try {
      await db.execute(sql`SELECT 1`);
      return { ok: true };
    } catch (err) {
      request.log.error({ err }, 'readiness probe failed');
      reply.code(503);
      return { ok: false, reason: 'database probe failed' };
    }
  });
}
