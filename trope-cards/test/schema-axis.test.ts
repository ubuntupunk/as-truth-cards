import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import type { Index, UniqueConstraint } from 'drizzle-orm/pg-core'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { cardAxes, cardAxis, cards } from '../src/db/schema/tropeGraph'

/**
 * Schema-level guarantees for the Axis dimension restored by migration 0008.
 *
 * These assert shape, not data, and need no database. The data is covered by
 * `test/graph-axis.integration.test.ts` and by `pnpm run trope-graph:verify`.
 *
 * They exist because the previous state was not a bug in one place but an absence: `axis`
 * was authored on 47 cards, typed as `string[]`, and had no table at all, so nothing in the
 * toolchain could have complained. Each guarantee below is therefore stated explicitly.
 *
 * Note the column names below are SQL names (`card_id`), not the camelCase property names
 * the Drizzle query builder uses, and a `pgEnum` column reports `dataType: 'string'` with
 * the labels in `enumValues`. Both are asserted as they actually appear, because a test
 * written against a remembered shape rather than the real one is worse than no test.
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const TROPE_CARDS_DIR = path.join(REPO_ROOT, 'trope-cards')

/** The `card_type` enum, restated as plain strings for the vocabulary-disjointness check. */
const CARD_TYPE_VALUES: readonly string[] = [
  'TACTIC',
  'FACT',
  'THEOLOGY',
  'CASE',
  'REFERENCE',
]

/**
 * Column names covered by a Drizzle index.
 *
 * `Index['config']['columns']` is typed as `Partial<IndexedColumn | SQL>[]`, and the
 * `IndexedColumn` half of that union is a compiler-mangled class whose `name` is not visible
 * through the union. The names are all that is needed here, so they are read at runtime.
 *
 * @param index Index declared on a table.
 * @returns Comma-joined column names, in index order.
 */
function indexColumns(index: Index): string {
  return index.config.columns
    .map((column) =>
      column && typeof column === 'object' && 'name' in column
        ? String(column.name)
        : '',
    )
    .join(',')
}

/**
 * Comma-joined column names of a unique constraint, by declared name.
 *
 * @param constraint Unique constraint declared in a table's extras array.
 * @returns Comma-joined column names, in constraint order.
 */
function uniqueColumns(constraint: UniqueConstraint): string {
  const { columns } = constraint as unknown as {
    columns: Array<{ name: string }>
  }
  return columns.map((column) => column.name).join(',')
}

describe('card_axis enum', () => {
  it('is a closed vocabulary of the four axes the corpus uses', () => {
    assert.deepEqual(cardAxis.enumValues, [
      'TACTIC',
      'FACT_REBUTTAL',
      'THEOLOGICAL',
      'HISTORICAL',
    ])
  })

  it('lives in the trope_graph schema, not public', () => {
    assert.equal(cardAxis.schema, 'trope_graph')
  })

  it('does not reuse the card_type vocabulary', () => {
    // FACT_REBUTTAL has no card_type counterpart, and THEOLOGY, CASE and REFERENCE have no
    // axis counterpart. If these two sets ever converged, the dimensions would have been
    // conflated, which is the specific failure this enum exists to prevent.
    const axes = new Set<string>(cardAxis.enumValues)
    for (const value of CARD_TYPE_VALUES) {
      if (value === 'TACTIC') continue
      assert.ok(
        !axes.has(value),
        `card_type "${value}" must not also be an axis`,
      )
    }
    assert.ok(!CARD_TYPE_VALUES.includes('FACT_REBUTTAL'))
    assert.ok(!CARD_TYPE_VALUES.includes('HISTORICAL'))
  })
})

describe('card_axes table', () => {
  const config = getTableConfig(cardAxes)

  it('is named card_axes in trope_graph', () => {
    assert.equal(config.name, 'card_axes')
    assert.equal(config.schema, 'trope_graph')
  })

  it('requires a card and an axis', () => {
    for (const name of ['card_id', 'axis']) {
      const column = config.columns.find((c) => c.name === name)
      assert.ok(column, `expected a ${name} column`)
      assert.equal(column.notNull, true, `${name} must be NOT NULL`)
    }
  })

  it('stores the axis as the enum rather than free text', () => {
    const column = config.columns.find((c) => c.name === 'axis')
    assert.ok(column)
    assert.deepEqual(
      (column as { enumValues: string[] }).enumValues,
      [...cardAxis.enumValues],
      'the axis column must be the card_axis enum, not text',
    )
  })

  it('defaults ordinal to 0 so the primary axis needs no sentinel value', () => {
    const column = config.columns.find((c) => c.name === 'ordinal')
    assert.ok(column)
    assert.equal(column.notNull, true)
    assert.equal(column.default, 0)
  })

  it('references cards with ON DELETE CASCADE', () => {
    assert.equal(config.foreignKeys.length, 1)
    const [fk] = config.foreignKeys
    assert.ok(fk)
    assert.equal(fk.onDelete, 'cascade')
    assert.equal(fk.reference().foreignTable, cards)
  })

  it('forbids the same axis twice on one card', () => {
    // Declared with `unique()`, so it lands in uniqueConstraints rather than indexes.
    const constraint = config.uniqueConstraints.find(
      (u) => uniqueColumns(u) === 'card_id,axis',
    )
    assert.ok(constraint, 'expected a unique constraint on (card_id, axis)')
  })

  it('forbids two axes at one position, which is what designates a primary axis', () => {
    const constraint = config.uniqueConstraints.find(
      (u) => uniqueColumns(u) === 'card_id,ordinal',
    )
    assert.ok(constraint, 'expected a unique constraint on (card_id, ordinal)')
  })

  it('indexes cards for the per-card lookup the verifier does', () => {
    const index = config.indexes.find(
      (i) => !i.config.unique && indexColumns(i) === 'card_id',
    )
    assert.ok(index, 'expected a non-unique index on card_id')
  })
})

describe('migration 0008', () => {
  const migration = readFileSync(
    path.join(TROPE_CARDS_DIR, 'drizzle', '0008_card_axes.sql'),
    'utf8',
  )

  it('declares the same enum labels as the schema module', () => {
    const block = migration.match(
      /CREATE TYPE trope_graph\.card_axis AS ENUM \(([^)]*)\)/,
    )
    assert.ok(block, 'expected a CREATE TYPE for card_axis')
    const labels = [...(block[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
    assert.deepEqual(labels, [...cardAxis.enumValues])
  })

  it('creates both unique indexes, since either one alone leaves a hole', () => {
    assert.match(migration, /UNIQUE INDEX card_axes_card_axis_unique_idx/)
    assert.match(migration, /UNIQUE INDEX card_axes_card_ordinal_unique_idx/)
  })

  it('is additive: no DROP, and cards is not altered', () => {
    // Axis becomes a relation rather than a column, which is what keeps it multi-valued.
    assert.ok(
      !/\bDROP\b/i.test(migration),
      'a DROP in an additive migration would discard authored data',
    )
    assert.ok(
      !/ALTER TABLE trope_graph\.cards/i.test(migration),
      'cards must not be altered',
    )
  })
})

describe('validate-draft.mjs axis vocabulary', () => {
  it('lists the same axes as the enum', () => {
    // The validator parses seed sources as text and cannot import the TypeScript enum, so
    // it restates the vocabulary. This assertion is what stops the restatement rotting.
    const source = readFileSync(
      path.join(TROPE_CARDS_DIR, 'scripts', 'validate-draft.mjs'),
      'utf8',
    )
    const block = source.match(/const allowedAxes = new Set\(\[([^\]]*)\]/)
    assert.ok(block, 'expected an allowedAxes set in the validator')
    const listed = [...(block[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map(
      (m) => m[1] ?? '',
    )
    assert.deepEqual(
      listed.sort(),
      [...cardAxis.enumValues].sort(),
    )
  })
})
