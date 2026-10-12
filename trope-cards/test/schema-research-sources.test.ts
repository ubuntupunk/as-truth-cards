import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import type { Index, UniqueConstraint } from 'drizzle-orm/pg-core'
import { getTableConfig } from 'drizzle-orm/pg-core'

import {
  discoveryCandidates,
  discoveryReviewStatus,
  sourceIdentifiers,
  sourceMetrics,
} from '../src/db/schema/researchSources'
import {
  claims,
  interpretations,
  sources,
} from '../src/db/schema/tropeGraph'

/**
 * Schema-level guarantees for the research-source layer added by migration 0012.
 *
 * These assert shape, not data, and need no database — the same division of labour as
 * `test/schema-axis.test.ts` and `test/schema-locale.test.ts`. Data is covered by the
 * migration/verify/drift gates in `pnpm run trope-graph:check`.
 *
 * The guarantees that matter are the boundaries, not the columns:
 *
 *   1. **No support edge.** None of these tables references `claims` or `interpretations`
 *      directly. A discovered, cited, or popular source is not thereby evidence for a
 *      claim; the support chain still runs through `claim_sources` / `evidence_claims`.
 *   2. **Discovery is a queue.** `promoted_source_id` is the only path from a candidate to
 *      a canonical source, and it is nullable — a candidate is not a source.
 *   3. **Metrics carry their own meaning.** `definition` is NOT NULL, so a bare number
 *      cannot be stored without stating what it measures.
 *
 * Column names below are SQL names (`source_id`), asserted as they actually appear rather
 * than as a remembered shape.
 */

const TROPE_CARDS_DIR = fileURLToPath(new URL('..', import.meta.url))
const MIGRATION = readFileSync(
  path.join(TROPE_CARDS_DIR, 'drizzle/0012_research_sources.sql'),
  'utf8',
)

/** Comma-joined column names of a non-unique (or unique) index. */
function indexColumns(index: Index): string {
  return index.config.columns
    .map((column) =>
      column && typeof column === 'object' && 'name' in column
        ? String(column.name)
        : '',
    )
    .join(',')
}

/** Comma-joined column names of a unique constraint declared in the extras array. */
function uniqueColumns(constraint: UniqueConstraint): string {
  const { columns } = constraint as unknown as {
    columns: Array<{ name: string }>
  }
  return columns.map((column) => column.name).join(',')
}

describe('discovery_review_status enum', () => {
  it('is the closed review workflow vocabulary', () => {
    assert.deepEqual(discoveryReviewStatus.enumValues, [
      'CANDIDATE',
      'APPROVED',
      'REJECTED',
      'DEFERRED',
    ])
  })

  it('lives in the trope_graph schema, not public', () => {
    assert.equal(discoveryReviewStatus.schema, 'trope_graph')
  })
})

describe('source_identifiers table', () => {
  const config = getTableConfig(sourceIdentifiers)

  it('is named source_identifiers in trope_graph', () => {
    assert.equal(config.name, 'source_identifiers')
    assert.equal(config.schema, 'trope_graph')
  })

  it('stores the scheme as open text, so a new provider needs no migration', () => {
    const column = config.columns.find((c) => c.name === 'scheme')
    assert.ok(column, 'expected a scheme column')
    assert.equal(column.notNull, true)
    assert.equal(
      column.getSQLType(),
      'text',
      'scheme must stay text: the set of identifier schemes is open-ended',
    )
  })

  it('keeps both the printed value and its normalized lookup form', () => {
    const names = config.columns.map((c) => c.name)
    assert.ok(names.includes('value'), 'the identifier as printed must be retained')
    assert.ok(
      names.includes('normalized_value'),
      'the lookup/normalization form must be stored',
    )
    assert.equal(
      config.columns.find((c) => c.name === 'normalized_value')?.notNull,
      true,
    )
  })

  it('resolves one identifier to exactly one source', () => {
    const constraint = config.uniqueConstraints.find(
      (u) => uniqueColumns(u) === 'scheme,normalized_value',
    )
    assert.ok(
      constraint,
      'expected unique (scheme, normalized_value) so a DOI cannot name two sources',
    )
  })

  it('references sources with ON DELETE CASCADE', () => {
    assert.equal(config.foreignKeys.length, 1)
    const [fk] = config.foreignKeys
    assert.ok(fk)
    assert.equal(fk.onDelete, 'cascade')
    assert.equal(fk.reference().foreignTable, sources)
  })

  it('indexes the source for the per-source identifier lookup', () => {
    const index = config.indexes.find(
      (i) => !i.config.unique && indexColumns(i) === 'source_id',
    )
    assert.ok(index, 'expected a non-unique index on source_id')
  })
})

describe('discovery_candidates table', () => {
  const config = getTableConfig(discoveryCandidates)

  it('is named discovery_candidates in trope_graph', () => {
    assert.equal(config.name, 'discovery_candidates')
    assert.equal(config.schema, 'trope_graph')
  })

  it('makes ingest idempotent per provider record', () => {
    const constraint = config.uniqueConstraints.find(
      (u) => uniqueColumns(u) === 'provider,provider_record_id',
    )
    assert.ok(
      constraint,
      'expected unique (provider, provider_record_id) so re-running discovery cannot duplicate',
    )
  })

  it('always carries provenance', () => {
    const column = config.columns.find((c) => c.name === 'provenance')
    assert.ok(column, 'expected a provenance column')
    assert.equal(
      column.notNull,
      true,
      'provenance (provider/endpoint/request) must be present for every candidate',
    )
  })

  it('defaults to CANDIDATE and stores the review status as the enum', () => {
    const column = config.columns.find((c) => c.name === 'review_status')
    assert.ok(column)
    assert.equal(column.notNull, true)
    assert.equal(column.default, 'CANDIDATE')
    assert.deepEqual(
      (column as { enumValues: string[] }).enumValues,
      [...discoveryReviewStatus.enumValues],
    )
  })

  it('is NOT a source: promotion is an explicit nullable link', () => {
    const column = config.columns.find((c) => c.name === 'promoted_source_id')
    assert.ok(column, 'expected promoted_source_id')
    assert.equal(
      column.notNull,
      false,
      'a candidate exists before it is promoted, so the link must be nullable',
    )
  })

  it('references sources from the promotion link without cascading deletion', () => {
    assert.equal(config.foreignKeys.length, 1)
    const [fk] = config.foreignKeys
    assert.ok(fk)
    assert.equal(
      fk.onDelete,
      'set null',
      'deleting a source must not delete the discovery history that produced it',
    )
    assert.equal(fk.reference().foreignTable, sources)
  })

  it('does not reference claims or interpretations — discovery is not support', () => {
    const referenced = config.foreignKeys.map(
      (fk) => getTableConfig(fk.reference().foreignTable).name,
    )
    assert.deepEqual(
      referenced,
      ['sources'],
      'the only parent is sources; a discovered work is not an edge in the support chain',
    )
    assert.ok(!referenced.includes(getTableConfig(claims).name))
    assert.ok(!referenced.includes(getTableConfig(interpretations).name))
  })
})

describe('source_metrics table', () => {
  const config = getTableConfig(sourceMetrics)

  it('is named source_metrics in trope_graph', () => {
    assert.equal(config.name, 'source_metrics')
    assert.equal(config.schema, 'trope_graph')
  })

  it('stores a numeric value rather than a preformatted string', () => {
    const column = config.columns.find((c) => c.name === 'metric_value')
    assert.ok(column)
    assert.equal(column.notNull, true)
    assert.equal(column.getSQLType(), 'numeric')
  })

  it('requires a definition, so a bare number cannot be stored', () => {
    const column = config.columns.find((c) => c.name === 'definition')
    assert.ok(column, 'expected a definition column')
    assert.equal(
      column.notNull,
      true,
      'every metric must state what it measures; popularity is not self-explanatory',
    )
  })

  it('requires an observation date and allows an optional window', () => {
    assert.equal(
      config.columns.find((c) => c.name === 'observed_at')?.notNull,
      true,
    )
    assert.equal(
      config.columns.find((c) => c.name === 'window_start')?.notNull,
      false,
    )
    assert.equal(
      config.columns.find((c) => c.name === 'window_end')?.notNull,
      false,
    )
  })

  it('re-importing one day of a metric updates rather than duplicates', () => {
    const constraint = config.uniqueConstraints.find(
      (u) =>
        uniqueColumns(u) === 'source_id,provider,metric_key,observed_at',
    )
    assert.ok(
      constraint,
      'expected unique (source_id, provider, metric_key, observed_at) as the snapshot key',
    )
  })

  it('references sources with ON DELETE CASCADE', () => {
    assert.equal(config.foreignKeys.length, 1)
    const [fk] = config.foreignKeys
    assert.ok(fk)
    assert.equal(fk.onDelete, 'cascade')
    assert.equal(fk.reference().foreignTable, sources)
  })
})

describe('sources provenance columns added by 0012', () => {
  const config = getTableConfig(sources)

  it('carries provider and retrieval/verification timestamps', () => {
    for (const name of [
      'metadata_provider',
      'metadata_retrieved_at',
      'metadata_verified_at',
      'access_status',
      'correction_status',
    ]) {
      const column = config.columns.find((c) => c.name === name)
      assert.ok(column, `expected sources.${name}`)
      assert.equal(
        column.notNull,
        false,
        `${name} must be nullable: the authored corpus predates any provider retrieval`,
      )
    }
  })
})

describe('migration 0012 matches the schema', () => {
  it('creates the review-status enum in trope_graph', () => {
    assert.match(
      MIGRATION,
      /CREATE TYPE trope_graph\.discovery_review_status AS ENUM/,
    )
  })

  it('adds the provenance columns to sources', () => {
    assert.match(
      MIGRATION,
      /ALTER TABLE trope_graph\.sources[\s\S]*metadata_provider[\s\S]*access_status/,
    )
  })

  it('creates all three tables in trope_graph', () => {
    assert.match(
      MIGRATION,
      /CREATE TABLE IF NOT EXISTS trope_graph\.source_identifiers/,
    )
    assert.match(
      MIGRATION,
      /CREATE TABLE IF NOT EXISTS trope_graph\.discovery_candidates/,
    )
    assert.match(
      MIGRATION,
      /CREATE TABLE IF NOT EXISTS trope_graph\.source_metrics/,
    )
  })

  it('declares the uniqueness rules the schema declares', () => {
    assert.match(
      MIGRATION,
      /CREATE UNIQUE INDEX IF NOT EXISTS source_identifiers_scheme_value_unique_idx[\s\S]*\(scheme, normalized_value\)/,
    )
    assert.match(
      MIGRATION,
      /CREATE UNIQUE INDEX IF NOT EXISTS discovery_candidates_provider_record_unique_idx[\s\S]*\(provider, provider_record_id\)/,
    )
    assert.match(
      MIGRATION,
      /CREATE UNIQUE INDEX IF NOT EXISTS source_metrics_observation_unique_idx[\s\S]*\(source_id, provider, metric_key, observed_at\)/,
    )
  })
})
