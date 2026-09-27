import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { resolveDatabaseConfig, resolveDatabaseUrl } from './url'

/**
 * The shared connection pool for Trope Graph queries.
 *
 * Pool size is deliberately small. The graph is a research workload driven by editorial
 * review and seeding, not by high-volume request traffic, and the host application keeps
 * its own pool for the deck tables.
 *
 * The connection string is resolved by `./url`, which also rewrites loopback URLs with no
 * password onto the Unix socket. Without that, `pg` connects over TCP where local installs
 * expect `scram-sha-256` and the connection fails; see {@link resolveDatabaseConfig}.
 */
export const pool = new Pool({
  ...resolveDatabaseConfig(resolveDatabaseUrl()),
  max: 5,
  // Neon and most managed providers present a self-signed or provider-issued certificate.
  // `pg` reads sslmode from the connection string, so this only covers the managed case
  // where the string omits it.
  ...(process.env.TROPE_GRAPH_DB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
})

/**
 * The Drizzle client for the Trope Graph.
 *
 * Queries against the tables exported from `./schema` are schema-qualified to
 * `trope_graph` automatically, because every table is declared via
 * `pgSchema("trope_graph")` in `./schema/namespace`.
 *
 * @example
 * ```ts
 * import { db } from "./client";
 * import { cards } from "./schema/tropeGraph";
 *
 * const all = await db.select().from(cards);
 * ```
 */
export const db = drizzle(pool)
