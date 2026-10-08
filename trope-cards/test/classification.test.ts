import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CardAxisLink } from '../src/graph/classification'
import {
  buildCardClassification,
  EMPTY_CARD_CLASSIFICATION,
  groupCardAxes,
  groupCardClassifications,
} from '../src/graph/classification'

/**
 * The pure classification assembly, unit-tested without a reader or a projection.
 *
 * These are the rules the read-side listing and the focused projection now share, so they are
 * asserted once, here, rather than re-proved against whichever surface happens to be under
 * test: `primary` comes from `ordinal === 0` and nothing else, dimensions keep authored order
 * (or sort by slug), and a Suit never stands in for a Locale however alike their slugs are.
 */

/** A `card_axes` row for one card. */
function axis(
  cardId: string,
  value: CardAxisLink['axis'],
  ordinal: number,
): CardAxisLink {
  return { cardId, axis: value, ordinal }
}

/** A `card_collections` join row, as `groupCardClassifications` receives it at the call site. */
function suit(
  cardId: string,
  collectionId: string,
  slug: string,
): { cardId: string; collectionId: string; slug: string; name: string; description: string | null } {
  return { cardId, collectionId, slug, name: slug, description: null }
}

/** A `card_locales` join row. */
function locale(
  cardId: string,
  localeId: string,
  slug: string,
): { cardId: string; localeId: string; slug: string; name: string; description: string | null } {
  return { cardId, localeId, slug, name: slug, description: null }
}

describe('groupCardAxes', () => {
  it('marks the row with ordinal 0 as primary, wherever it appears in the input', () => {
    const grouped = groupCardAxes([
      axis('card-1', 'TACTIC', 1),
      axis('card-1', 'THEOLOGICAL', 0),
      axis('card-1', 'HISTORICAL', 2),
    ])

    const assignments = grouped.get('card-1')
    assert.ok(assignments)
    assert.deepEqual(
      assignments.map((a) => [a.axis, a.ordinal, a.primary]),
      [
        ['THEOLOGICAL', 0, true],
        ['TACTIC', 1, false],
        ['HISTORICAL', 2, false],
      ],
      'assignments are reported in ordinal order, not input order',
    )
  })

  it('reports no primary when a card has no row with ordinal 0', () => {
    const grouped = groupCardAxes([
      axis('card-1', 'TACTIC', 1),
      axis('card-1', 'FACT_REBUTTAL', 2),
    ])

    assert.deepEqual(
      grouped.get('card-1')?.map((a) => a.primary),
      [false, false],
      'primary must be ordinal 0, never "the first row I happened to see"',
    )
  })

  it("keeps each card's whole multi-valued assignment, keyed by card id", () => {
    const grouped = groupCardAxes([
      axis('card-1', 'TACTIC', 0),
      axis('card-2', 'HISTORICAL', 0),
      axis('card-1', 'THEOLOGICAL', 1),
    ])

    assert.deepEqual(
      grouped.get('card-1')?.map((a) => a.axis),
      ['TACTIC', 'THEOLOGICAL'],
    )
    assert.deepEqual(
      grouped.get('card-2')?.map((a) => a.axis),
      ['HISTORICAL'],
    )
    assert.equal(grouped.size, 2)
  })

  it('returns no entry for an axis-less card set', () => {
    assert.equal(groupCardAxes([]).size, 0)
  })
})

describe('groupCardClassifications', () => {
  it('groups by card and sorts members by slug', () => {
    const grouped = groupCardClassifications(
      [
        suit('card-1', 'collection-zionism', 'zionism'),
        suit('card-1', 'collection-classic', 'classic'),
      ],
      (row) => row.collectionId,
    )

    assert.deepEqual(
      grouped.get('card-1')?.map((l) => l.slug),
      ['classic', 'zionism'],
    )
  })

  it('keeps two taxonomies of the same slug apart by id', () => {
    const rows = [
      suit('card-3', 'collection-south-africa', 'south-africa'),
      locale('card-3', 'locale-south-africa', 'south-africa'),
    ]
    const grouped = groupCardClassifications(rows, (row) =>
      'collectionId' in row ? row.collectionId : row.localeId,
    )

    const links = grouped.get('card-3') ?? []
    assert.equal(links.length, 2, 'two taxonomies, two links, never merged')
    assert.notEqual(links[0]?.linkId, links[1]?.linkId)
  })

  it('does not merge two cards that share a slug', () => {
    const grouped = groupCardClassifications(
      [
        suit('card-1', 'collection-classic', 'classic'),
        suit('card-2', 'collection-classic-2', 'classic'),
      ],
      (row) => row.collectionId,
    )

    assert.equal(grouped.size, 2)
    assert.equal(grouped.get('card-1')?.length, 1)
    assert.equal(grouped.get('card-2')?.length, 1)
  })
})

describe('buildCardClassification', () => {
  it('reports a suit and a locale of the same slug as separate dimensions', () => {
    const classification = buildCardClassification(
      [],
      [
        {
          linkId: 'collection-south-africa',
          slug: 'south-africa',
          name: 'South Africa',
          description: null,
        },
      ],
      [],
      [
        {
          linkId: 'locale-south-africa',
          slug: 'south-africa',
          name: 'South Africa',
          description: null,
        },
      ],
    )

    assert.deepEqual(classification.suits, ['south-africa'])
    assert.deepEqual(classification.suitIds, ['collection-south-africa'])
    assert.deepEqual(classification.localeSlugs, ['south-africa'])
    assert.deepEqual(classification.localeIds, ['locale-south-africa'])
  })

  it('carries axes through unchanged rather than re-deriving them', () => {
    const axes = groupCardAxes([axis('card-1', 'TACTIC', 0)])
    const classification = buildCardClassification(
      axes.get('card-1') ?? [],
      [],
      [],
      [],
    )

    assert.deepEqual(classification.axes, [
      { axis: 'TACTIC', ordinal: 0, primary: true },
    ])
  })

  it('reports mechanisms and locales together without conflating them', () => {
    const classification = buildCardClassification(
      [],
      [],
      [
        {
          linkId: 'mechanism-zionism',
          slug: 'zionism',
          name: 'Zionism',
          description: null,
        },
      ],
      [
        {
          linkId: 'collection-zionism',
          slug: 'zionism',
          name: 'Zionism',
          description: null,
        },
      ],
    )

    assert.deepEqual(classification.mechanismSlugs, ['zionism'])
    assert.deepEqual(classification.localeSlugs, ['zionism'])
    assert.deepEqual(classification.suits, [])
    assert.deepEqual(classification.suitIds, [])
  })

  it('is the empty classification when no dimension has authored rows', () => {
    assert.deepEqual(
      buildCardClassification([], [], [], []),
      EMPTY_CARD_CLASSIFICATION,
    )
  })
})
