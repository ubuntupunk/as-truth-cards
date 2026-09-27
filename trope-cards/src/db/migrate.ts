import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'

import {
  assertLocalHost,
  resolveDatabaseConfig,
  resolveDatabaseUrl,
} from './url'

/**
 * Applies the canonical Trope Graph migrations in order, with a checksum ledger.
 *
 * Why not `drizzle-kit migrate`? Because the canonical history in
 * `trope-cards/drizzle/*.sql` is hand-written, carried over from the v0.1-v0.9 tar
 * archives. `drizzle-kit migrate` requires its own journal format and would either ignore
 * these files or rewrite them. This runner keeps that provenance and adds the safety a
 * journal would have given us:
 *
 *   - Each file is applied exactly once, inside a transaction, recorded in
 *     `trope_graph.schema_migrations` with a SHA-256 of its contents.
 *   - A file whose contents changed after it was applied is reported as drift and is not
 *     re-applied, rather than silently diverging from the ledger.
 *   - A URL that does not look local is refused unless `allowRemote` is set, because the
 *     repository `.env` sets DATABASE_URL to a live Neon instance and the graph client
 *     falls back to it.
 */

/** Absolute path of `trope-cards/drizzle`. */
const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'drizzle',
)

/** Options controlling a migration run. */
export type MigrateOptions = {
  /** Report status without writing anything. */
  checkOnly?: boolean
  /** `DROP SCHEMA trope_graph CASCADE` before applying. Destroys all graph data. */
  reset?: boolean
  /** Permit a non-loopback host. */
  allowRemote?: boolean
}

/** Outcome of a migration run. */
export type MigrateResult = {
  /** Files applied by this run, or pending when `checkOnly`. */
  applied: string[]
  /** Files already recorded in the ledger with a matching checksum. */
  skipped: string[]
  /** Files whose contents no longer match the checksum recorded when applied. */
  drift: string[]
  /** Human-readable table and enum counts in `trope_graph`. */
  status: string
}

/**
 * Apply the canonical migrations.
 *
 * @param options See {@link MigrateOptions}.
 * @returns Counts and per-file outcomes.
 * @throws {Error} If a migration fails, a checksum has drifted, or the target is remote
 * and `allowRemote` was not set.
 */
export async function migrate(
  options: MigrateOptions = {},
): Promise<MigrateResult> {
  const { checkOnly = false, reset = false, allowRemote = false } = options

  const url = resolveDatabaseUrl()
  const host = assertLocalHost(url, allowRemote)

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => /^\d{4}.*\.sql$/.test(f))
    .sort()

  if (files.length === 0) {
    throw new Error(`No numbered .sql files found in ${MIGRATIONS_DIR}`)
  }

  const client = new Client(resolveDatabaseConfig(url))
  await client.connect()

  try {
    if (reset) {
      if (checkOnly) {
        console.log('[check] --reset ignored in --check mode')
      } else {
        console.log(`Resetting schema trope_graph on host "${host}" ...`)
        await client.query('DROP SCHEMA IF EXISTS trope_graph CASCADE')
      }
    }

    // In --check mode nothing may be written, so the schema and ledger are never created.
    // A missing ledger is reported as every migration pending, which is what an empty
    // database genuinely means.
    if (!checkOnly) {
      await client.query('CREATE SCHEMA IF NOT EXISTS trope_graph')
      await client.query(`
        CREATE TABLE IF NOT EXISTS trope_graph.schema_migrations (
          id          SERIAL PRIMARY KEY,
          filename    TEXT NOT NULL UNIQUE,
          checksum    TEXT NOT NULL,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
    }

    const { rows: ledgerExists } = await client.query<{ present: boolean }>(
      "SELECT to_regclass('trope_graph.schema_migrations') IS NOT NULL AS present",
    )
    const hasLedger = ledgerExists[0]?.present === true

    let recorded = new Map<string, string>()
    if (hasLedger) {
      const { rows: ledger } = await client.query(
        'SELECT filename, checksum FROM trope_graph.schema_migrations ORDER BY filename',
      )
      recorded = new Map<string, string>(
        ledger.map((r) => [String(r.filename), String(r.checksum)]),
      )
    } else if (checkOnly) {
      console.log('[check] no ledger found; all migrations are pending')
    }

    const applied: string[] = []
    const skipped: string[] = []
    const drift: string[] = []

    for (const filename of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8')
      const checksum = createHash('sha256')
        .update(sql)
        .digest('hex')
        .slice(0, 16)
      const known = recorded.get(filename)

      if (known !== undefined) {
        if (known !== checksum) drift.push(filename)
        else skipped.push(filename)
        continue
      }

      if (checkOnly) {
        applied.push(`${filename} (pending)`)
        continue
      }

      // Each migration is atomic. A failure leaves the ledger untouched for that file, so
      // the database stays consistent with the last migration that fully succeeded.
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO trope_graph.schema_migrations (filename, checksum) VALUES ($1, $2)',
          [filename, checksum],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(
          `${filename} failed and was rolled back: ${
            error instanceof Error ? error.message : String(error)
          }\n  The schema is unchanged up to the previous migration.`,
        )
      }
      applied.push(filename)
    }

    const { rows: counts } = await client.query<{
      tables: string
      enums: string
    }>(`
      SELECT
        (SELECT count(*)::text FROM information_schema.tables
          WHERE table_schema = 'trope_graph'
            AND table_type = 'BASE TABLE'
            AND table_name <> 'schema_migrations')      AS tables,
        (SELECT count(*)::text FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'trope_graph' AND t.typtype = 'e') AS enums
    `)

    return {
      applied,
      skipped,
      drift,
      status: `tables=${counts[0]?.tables ?? '?'} enums=${counts[0]?.enums ?? '?'} in trope_graph`,
    }
  } finally {
    await client.end()
  }
}
