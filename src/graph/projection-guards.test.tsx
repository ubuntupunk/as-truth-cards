/**
 * Tests for `projection-guards.ts` — runtime shape validation of the two wire
 * bodies (`GraphProjection`, `GraphViewsResponse`).
 *
 * Every fixture is round-tripped through `JSON.parse(JSON.stringify(…))`
 * before being asserted against, because the guards are the client's stand-in
 * for `res.json()`: if they pass a *case* but fail over the wire, the test
 * lied. This double duty is the vacuous guard that pins the fixtures to the
 * real contract.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertGraphProjection,
  assertGraphSearchResponse,
  assertGraphViewsResponse,
  assertSourcesResponse,
  isRecord,
  ProjectionShapeError,
} from './projection-guards'
import {
  CARD_PROJECTION,
  EMPTY_PROJECTION,
  SPARSE_PROJECTION,
  TRUNCATED_PROJECTION,
  VIEWS_RESPONSE,
} from './test-fixtures'

/** The fixture as it crosses the wire: JSON text → unknown. */
function asWire(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

describe('assertGraphProjection', () => {
  it('accepts every valid fixture after a JSON round trip', () => {
    for (const fixture of [
      CARD_PROJECTION,
      EMPTY_PROJECTION,
      SPARSE_PROJECTION,
      TRUNCATED_PROJECTION,
    ]) {
      assert.doesNotThrow(
        () => assertGraphProjection(asWire(fixture)),
        fixture.view,
      )
    }
  })

  it('narrows the value in place', () => {
    const value: unknown = asWire(CARD_PROJECTION)
    assertGraphProjection(value)
    // Narrowed to GraphProjection: property access typechecks.
    assert.equal(value.focus.type, 'card')
  })

  it('rejects a body that is a string, array, or null', () => {
    assert.throws(
      () => assertGraphProjection('<html>proxy splash</html>'),
      ProjectionShapeError,
    )
    assert.throws(() => assertGraphProjection([]), ProjectionShapeError)
    assert.throws(() => assertGraphProjection(null), ProjectionShapeError)
  })

  it('rejects a missing meta envelope', () => {
    const body = asWire(CARD_PROJECTION) as Record<string, unknown>
    delete body.meta
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError && error.path === 'meta',
    )
  })

  it('names the path of a missing status.value key', () => {
    const body = asWire(CARD_PROJECTION) as {
      nodes: { status: Record<string, unknown> }[]
    }
    delete body.nodes[0].status.value
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'nodes[0].status.value',
    )
  })

  it('rejects a node missing its metadata bag', () => {
    const body = asWire(CARD_PROJECTION) as { nodes: Record<string, unknown>[] }
    delete body.nodes[1].metadata
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'nodes[1].metadata',
    )
  })

  it('rejects an edge missing attributes', () => {
    const body = asWire(CARD_PROJECTION) as {
      edges: Record<string, unknown>[]
    }
    delete body.edges[0].attributes
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'edges[0].attributes',
    )
  })

  it('rejects a non-numeric depth', () => {
    const body = asWire(CARD_PROJECTION) as Record<string, unknown>
    body.depth = 'three'
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) => error instanceof ProjectionShapeError,
    )
  })

  it('rejects a non-array nodes field', () => {
    const body = asWire(CARD_PROJECTION) as Record<string, unknown>
    body.nodes = { 0: 'not an array' }
    assert.throws(
      () => assertGraphProjection(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError && error.path === 'nodes',
    )
  })
})

describe('assertGraphViewsResponse', () => {
  it('accepts the views fixture after a JSON round trip', () => {
    assert.doesNotThrow(() => assertGraphViewsResponse(asWire(VIEWS_RESPONSE)))
  })

  it('rejects a descriptor missing maxDepth', () => {
    const body = asWire(VIEWS_RESPONSE) as {
      views: Record<string, unknown>[]
    }
    delete body.views[0].maxDepth
    assert.throws(
      () => assertGraphViewsResponse(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'views[0].maxDepth',
    )
  })

  it('rejects a population value that is not a number', () => {
    const body = asWire(VIEWS_RESPONSE) as {
      population: Record<string, unknown>
    }
    body.population.taxonomy = 'five'
    assert.throws(
      () => assertGraphViewsResponse(body),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'population.taxonomy',
    )
  })
})

describe('assertGraphSearchResponse', () => {
  const response = {
    results: [
      {
        id: 'c1',
        slug: 'blood-libel',
        title: 'Blood Libel',
        summary: null,
        type: 'card',
        rank: 1.5,
      },
      {
        id: 'c2',
        slug: 'zionist-as-slur',
        title: 'Zionist-as-Slur',
        summary: 'The word used as an insult.',
        type: 'card',
        rank: 0.333,
      },
    ],
  }

  it('accepts a valid response after a JSON round trip', () => {
    assert.doesNotThrow(() => assertGraphSearchResponse(asWire(response)))
  })

  it('accepts a null summary', () => {
    assert.doesNotThrow(() => assertGraphSearchResponse(asWire(response)))
  })

  it('rejects a body missing the results envelope', () => {
    assert.throws(
      () => assertGraphSearchResponse(asWire({ nope: true })),
      (error: unknown) =>
        error instanceof ProjectionShapeError && error.path === 'results',
    )
  })

  it('rejects a result missing its rank', () => {
    const body = {
      results: [
        {
          id: 'c1',
          slug: 'blood-libel',
          title: 'Blood Libel',
          summary: null,
          type: 'card',
        },
      ],
    }
    assert.throws(
      () => assertGraphSearchResponse(asWire(body)),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'results[0].rank',
    )
  })

  it('rejects a non-array results field', () => {
    assert.throws(
      () => assertGraphSearchResponse(asWire({ results: 'nope' })),
      (error: unknown) =>
        error instanceof ProjectionShapeError && error.path === 'results',
    )
  })
})

describe('assertSourcesResponse', () => {
  const response = {
    items: [
      {
        id: 's1',
        title: 'The Merneptah Stele',
        author: 'Commissioned by Pharaoh Merneptah',
        publisher: null,
        citation: null,
        url: null,
        sourceType: 'PRIMARY_DOCUMENT',
        claimSourceCount: 1,
      },
      {
        id: 's2',
        title: 'The Qur’an',
        author: null,
        publisher: null,
        citation: null,
        url: 'https://example.org/quran',
        sourceType: 'PRIMARY_DOCUMENT',
        claimSourceCount: 3,
      },
    ],
    total: 3,
    limit: 50,
    offset: 0,
  }

  it('accepts a valid response after a JSON round trip', () => {
    assert.doesNotThrow(() => assertSourcesResponse(asWire(response)))
  })

  it('narrows the value in place', () => {
    const value: unknown = asWire(response)
    assertSourcesResponse(value)
    assert.equal(value.items[0].claimSourceCount, 1)
  })

  it('rejects a body missing the paging envelope', () => {
    assert.throws(
      () => assertSourcesResponse(asWire({ items: [] })),
      (error: unknown) =>
        error instanceof ProjectionShapeError && error.path === 'total',
    )
  })

  it('rejects a source missing its attribution count', () => {
    const body = {
      items: [
        {
          id: 's1',
          title: 'No Count',
          author: null,
          publisher: null,
          citation: null,
          url: null,
          sourceType: 'PRIMARY_DOCUMENT',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }
    assert.throws(
      () => assertSourcesResponse(asWire(body)),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'items[0].claimSourceCount',
    )
  })

  it('rejects a non-string, non-null author', () => {
    const body = {
      ...response,
      items: [{ ...response.items[0], author: 7 }],
    }
    assert.throws(
      () => assertSourcesResponse(asWire(body)),
      (error: unknown) =>
        error instanceof ProjectionShapeError &&
        error.path === 'items[0].author',
    )
  })
})

describe('isRecord', () => {
  it('admits plain objects only', () => {
    assert.equal(isRecord({}), true)
    assert.equal(isRecord([]), false)
    assert.equal(isRecord(null), false)
    assert.equal(isRecord('x'), false)
  })
})
