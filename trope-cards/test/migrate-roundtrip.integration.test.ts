import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { migrate } from '../src/db/migrate'

/**
 * The canonical migration set, applied to a live database, then re-checked.
 *
 * `migrate({ checkOnly: true })` reads every file, hashes it, and compares the hash with
 * `trope_graph.schema_migrations`. Running it twice in a row is the round-trip: the first
 * pass is a statement about the database the CI/local run is pointed at, the second proves
 * the check is stable and has side effects of its own. A non-empty `drift` means an applied
 * file was edited after the fact — the exact failure the ledger exists to catch.
 *
 * Skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so it runs in CI without a database.
 */

const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** Canonical `.sql` files, matching the runner's discovery rule. */
function canonicalFiles(): string[] {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')
  return readdirSync(dir)
    .filter((name) => /^\d{4}.*\.sql$/.test(name))
    .sort()
}

describe(
  'migrate --check round-trip (integration)',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    it('reports every canonical migration applied, with no drift', async () => {
      const result = await migrate({ checkOnly: true })
      assert.deepEqual(result.applied, [], 'check mode must apply nothing')
      assert.deepEqual(result.drift, [], 'no applied file may have drifted')

      const expected = canonicalFiles()
      assert.ok(
        expected.includes('0012_research_sources.sql'),
        'the discovery migration must be part of the canonical set',
      )
      assert.equal(
        result.skipped.length,
        expected.length,
        `expected all ${expected.length} canonical migrations applied, got ${result.skipped.length}`,
      )
    })

    it('is idempotent — a second check reports the same thing', async () => {
      const first = await migrate({ checkOnly: true })
      const second = await migrate({ checkOnly: true })
      assert.deepEqual(second.skipped, first.skipped)
      assert.deepEqual(second.applied, [])
      assert.deepEqual(second.drift, [])
    })
  },
)
