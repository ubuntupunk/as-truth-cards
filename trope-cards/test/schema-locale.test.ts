import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { getTableConfig } from 'drizzle-orm/pg-core'

import {
  cardAxes,
  cardCollections,
  cardLocales,
  cardMechanisms,
  collections,
  locales,
} from '../src/db/schema/tropeGraph'

/**
 * Schema-level guarantees for the Locale dimension added by migration 0009.
 *
 * These assert shape, not data, and need no database — the same division of labour as
 * `test/schema-axis.test.ts`. Data is covered by `test/seed-locale.test.ts` and the
 * projection invariants in `test/graph-projection.test.ts`.
 *
 * The guarantee that matters here is disambiguation. The seed authors the slug
 * `south-africa` on *both* a `collections` row and a `locales` row, because a card can
 * genuinely be curated under a South Africa suit and also be a South Africa card. That is
 * only safe while the two taxonomies are separate tables with separate primary keys and
 * independently unique slugs — if they shared a table, or if `locale_id` referenced
 * `collections.id`, the two meanings would collapse and the projection would have no way to
 * report which one a consumer asked for.
 *
 * Note the column names below are SQL names (`card_id`), not the camelCase property names the
 * Drizzle query builder uses, and both are asserted as they actually appear rather than as a
 * remembered shape.
 */

const TROPE_CARDS_DIR = fileURLToPath(new URL('..', import.meta.url))
const MIGRATION = readFileSync(
  path.join(TROPE_CARDS_DIR, 'drizzle/0009_locales.sql'),
  'utf8',
)

/**
 * Column names of a table's composite primary key.
 *
 * Declared through `primaryKey({ columns })` in the table callback, which surfaces in
 * `config.primaryKeys` rather than marking the individual columns `primary` — a table with
 * only a composite key reports no primary column at all.
 *
 * @param table Table to inspect.
 * @returns Comma-joined column names, in key order. Empty if there is no composite key.
 */
function compositePrimaryKey(table: Parameters<typeof getTableConfig>[0]): string {
  return getTableConfig(table).primaryKeys
    .map((key) =>
      key.columns.map((column) => String(column.name)).join(','),
    )
    .join(';')
}

/**
 * Whether a table declares a single-column unique constraint on a column.
 *
 * A column declared `.unique()` reports the flag on the column itself; it does not appear in
 * `uniqueConstraints`, which only carries constraints written out in the table callback.
 *
 * @param table Table to inspect.
 * @param columnName SQL column name.
 * @returns True when the column is declared unique.
 */
function columnIsUnique(
  table: Parameters<typeof getTableConfig>[0],
  columnName: string,
): boolean {
  const column = getTableConfig(table).columns.find((c) => c.name === columnName)
  return column?.isUnique === true
}

describe('locales table', () => {
  it('has its own surrogate primary key rather than borrowing collections.id', () => {
    const localesId = getTableConfig(locales).columns.find((c) => c.primary)
    const collectionsId = getTableConfig(collections).columns.find((c) => c.primary)
    assert.equal(localesId?.name, 'id')
    assert.equal(collectionsId?.name, 'id')
    assert.equal(
      getTableConfig(locales).name,
      'locales',
      'the two taxonomies must remain distinct tables; a shared table would make the ' +
        'shared south-africa slug ambiguous',
    )
    assert.equal(getTableConfig(collections).name, 'collections')
  })

  it('treats slug uniqueness as per-table, so both taxonomies may use south-africa', () => {
    assert.ok(
      columnIsUnique(locales, 'slug'),
      'locales.slug must be unique within locales',
    )
    assert.ok(
      columnIsUnique(collections, 'slug'),
      'collections.slug must be unique within collections',
    )
  })

  it('carries a human-facing name and an optional description, like collections', () => {
    const names = getTableConfig(locales).columns.map((c) => c.name)
    assert.deepEqual(names, ['id', 'slug', 'name', 'description'])
    const name = getTableConfig(locales).columns.find((c) => c.name === 'name')
    assert.equal(name?.notNull, true, 'a locale must be displayable, so name is required')
  })
})

describe('card_locales table', () => {
  it('is keyed on the card and the locale, allowing many locales per card', () => {
    assert.equal(compositePrimaryKey(cardLocales), 'card_id,locale_id')
  })

  it('has a different key shape from every other classification link table', () => {
    // card_collections is keyed (card_id, collection_id) and card_mechanisms
    // (card_id, mechanism_id). card_locales must not be a copy of either under a new name,
    // or the dimensions would be indistinguishable in the schema as well as in meaning.
    assert.equal(compositePrimaryKey(cardCollections), 'card_id,collection_id')
    assert.equal(compositePrimaryKey(cardMechanisms), 'card_id,mechanism_id')
    assert.notEqual(
      compositePrimaryKey(cardLocales),
      compositePrimaryKey(cardCollections),
    )
    assert.notEqual(
      compositePrimaryKey(cardLocales),
      compositePrimaryKey(cardMechanisms),
    )
  })

  it('references a card and a locale, cascading from both', () => {
    const foreignKeys = getTableConfig(cardLocales).foreignKeys
    assert.equal(foreignKeys.length, 2, 'card_locales has two parents')
    for (const foreignKey of foreignKeys) {
      assert.equal(
        foreignKey.onDelete,
        'cascade',
        'a deleted card or locale must not leave a dangling locale link',
      )
    }
  })
})

describe('locale is a separate dimension from axis', () => {
  it('gives locale and axis different key shapes', () => {
    assert.notEqual(
      compositePrimaryKey(cardAxes),
      compositePrimaryKey(cardLocales),
      'card_axes is keyed (card_id, axis) via a surrogate id; card_locales is keyed on the ' +
        'taxonomy row it points at',
    )
    assert.equal(compositePrimaryKey(cardAxes), '')
    assert.equal(compositePrimaryKey(cardLocales), 'card_id,locale_id')
  })
})

describe('migration 0009 matches the schema', () => {
  it('creates both tables in the trope_graph schema', () => {
    assert.match(MIGRATION, /CREATE TABLE trope_graph\.locales/)
    assert.match(MIGRATION, /CREATE TABLE trope_graph\.card_locales/)
  })

  it('declares the composite key the schema declares', () => {
    assert.match(MIGRATION, /PRIMARY KEY \(card_id, locale_id\)/)
  })

  it('declares locale slug unique, so the shared slug cannot collide inside locales', () => {
    assert.match(MIGRATION, /slug text NOT NULL UNIQUE/)
  })

  it('cascades both foreign keys', () => {
    assert.match(MIGRATION, /REFERENCES trope_graph\.cards\(id\) ON DELETE CASCADE/)
    assert.match(
      MIGRATION,
      /REFERENCES trope_graph\.locales\(id\) ON DELETE CASCADE/,
    )
  })
})