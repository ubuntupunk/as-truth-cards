import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { resolveDatabaseConfig, resolveDatabaseUrl } from './url'

/**
 * The shared connection pool for Trope Graph queries, created on first use.
 *
 * Pool size is deliberately small. The graph is a research workload driven by editorial
 * review and seeding, not by high-volume request traffic, and the host application keeps
 * its own pool for the deck tables.
 *
 * The connection string is resolved by `./url`, which also rewrites loopback URLs with no
 * password onto the Unix socket. Without that, `pg` connects over TCP where local installs
 * expect `scram-sha-256` and the connection fails; see {@link resolveDatabaseConfig}.
 *
 * Construction is deferred rather than performed at module scope because resolving the URL
 * throws when nothing is configured, and an eagerly constructed pool turns that into an
 * import-time failure for every consumer — including ones that only want the schema, or that
 * inject their own reader, or that run in an environment with no database at all. A module
 * that fails to import is a far worse failure mode than a query that fails to connect.
 */
let poolInstance: Pool | undefined

/**
 * The shared connection pool, created on first call and reused thereafter.
 *
 * @returns The process-wide pool.
 * @throws If no connection string is configured, or if one is configured but malformed.
 * @example
 * ```ts
 * import { getPool } from "./client";
 *
 * const pool = getPool();
 * await pool.query("select 1");
 * ```
 */
export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      ...resolveDatabaseConfig(resolveDatabaseUrl()),
      max: 5,
      // Neon and most managed providers present a self-signed or provider-issued certificate.
      // `pg` reads sslmode from the connection string, so this only covers the managed case
      // where the string omits it.
      ...(process.env.TROPE_GRAPH_DB_SSL === 'true'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    })
  }
  return poolInstance
}

/** The Drizzle client, created on first call over {@link getPool}. */
let dbInstance: ReturnType<typeof drizzle> | undefined

/**
 * The Drizzle client for the Trope Graph.
 *
 * Queries against the tables exported from `./schema` are schema-qualified to
 * `trope_graph` automatically, because every table is declared via
 * `pgSchema("trope_graph")` in `./schema/namespace`.
 *
 * @returns The process-wide Drizzle client.
 * @throws If no connection string is configured.
 * @example
 * ```ts
 * import { getDb } from "./client";
 * import { cards } from "./schema/tropeGraph";
 *
 * const all = await getDb().select().from(cards);
 * ```
 */
export function getDb(): ReturnType<typeof drizzle> {
  dbInstance ??= drizzle(getPool())
  return dbInstance
}
