import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import express from 'express'

import { createGraphRouter } from '../../server/api/graph'
import {
  FakeGraphReader,
  card,
  emptyCorpus,
  link,
  localeLink,
  richCorpus,
} from './helpers/fake-graph-reader'
import type { FakeCorpus } from './helpers/fake-graph-reader'

/**
 * The HTTP surface of `GET /api/graph` and `GET /api/graph/views`.
 *
 * Driven over a real listening socket with `fetch` rather than by calling the handler, because
 * the things most likely to break here are Express-level: a route that never mounted, a
 * `req.query` that arrives as an array where a string was expected, a status code that gets
 * swallowed by a `catch`. A handler test would pass with none of those present.
 *
 * No database. The reader is the in-memory fake, so these tests assert the route's contract
 * and not the corpus's contents.
 */

/** A JSON body plus the status, which is all any assertion here needs. */
type Response = { status: number; body: Record<string, unknown> }

/** Serve `corpus` on an ephemeral port for the duration of a suite. */
async function serve(corpus: FakeCorpus): Promise<{
  origin: string
  close: () => Promise<void>
}> {
  const app = express()
  app.use('/api/graph', createGraphRouter(new FakeGraphReader(corpus)))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address() as AddressInfo
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve(undefined))
      }),
  }
}

/** GET a path and decode it as JSON. */
async function get(origin: string, path: string): Promise<Response> {
  const response = await fetch(`${origin}${path}`)
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

describe('GET /api/graph', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    const server = await serve(richCorpus())
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('returns a projection for a valid request', async () => {
    const { status, body } = await get(origin, '/api/graph?focus=card-1')
    assert.equal(status, 200)
    assert.deepEqual(Object.keys(body).sort(), [
      'depth',
      'edges',
      'focus',
      'meta',
      'nodes',
      'view',
    ])
    assert.equal(body['view'], 'card-argument-taxonomy')
    const nodes = body['nodes'] as { id: string }[]
    assert.equal(nodes[0]?.id, 'card-1')
  })

  it('resolves a focus by slug and by uuid to the same graph', async () => {
    const bySlug = await get(origin, '/api/graph?focus=jesus-was-a-zionist')
    const byUuid = await get(origin, '/api/graph?focus=card-1')
    assert.equal(bySlug.status, 200)
    assert.deepEqual(
      (bySlug.body['nodes'] as { id: string }[]).map((n) => n.id),
      (byUuid.body['nodes'] as { id: string }[]).map((n) => n.id),
    )
    assert.equal((bySlug.body['focus'] as { slug: string }).slug, 'jesus-was-a-zionist')
    assert.equal((byUuid.body['focus'] as { slug: null }).slug, null)
  })

  it('honours depth, so a caller can ask for a wider neighbourhood', async () => {
    const one = await get(origin, '/api/graph?focus=card-1&depth=1')
    const three = await get(origin, '/api/graph?focus=card-1&depth=3')
    const depthOf = (r: Response, id: string): number | undefined =>
      (r.body['nodes'] as { id: string; depth: number }[]).find((n) => n.id === id)?.depth
    assert.equal(depthOf(one, 'step-1'), undefined)
    assert.equal(depthOf(three, 'step-1'), 2)
  })

  it('reports truncation instead of returning an under-counted graph quietly', async () => {
    const { body } = await get(origin, '/api/graph?focus=card-1&depth=3&maxNodes=3')
    const meta = body['meta'] as { truncated: boolean; maxNodes: number }
    assert.equal(meta.truncated, true)
    assert.equal(meta.maxNodes, 3)
  })

  it('is 404 for a focus no card matches', async () => {
    const { status, body } = await get(origin, '/api/graph?focus=no-such-card')
    assert.equal(status, 404)
    assert.match(String(body['error']), /no-such-card/)
  })

  it('projects a claim focus in the argument view', async () => {
    const { status, body } = await get(
      origin,
      '/api/graph?focus=claim-1&view=argument&depth=2',
    )
    assert.equal(status, 200)
    assert.deepEqual(body['focus'], {
      id: 'claim-1',
      type: 'claim',
      slug: null,
    })
    const nodes = body['nodes'] as { id: string; isFocus: boolean }[]
    assert.ok(
      nodes.some((n) => n.id === 'claim-1' && n.isFocus),
      'the focused claim must carry isFocus',
    )
  })

  it('projects a chain focus in the argument view, emitting the chain node', async () => {
    const { status, body } = await get(
      origin,
      '/api/graph?focus=chain-1&view=argument&depth=2',
    )
    assert.equal(status, 200)
    const focus = body['focus'] as { type: string }
    assert.equal(focus.type, 'argument_chain')
    const nodes = body['nodes'] as { id: string; type: string }[]
    assert.ok(
      nodes.some((n) => n.type === 'argument_chain' && n.id === 'chain-1'),
      'the focused chain must be emitted as a node',
    )
  })

  it('is 404 for a claim focus on a view that takes only cards', async () => {
    // The default view is card-only, so a claim uuid resolves and is then refused — the
    // route must surface that as the same 404 as an unresolvable focus, not a 200 with
    // an empty graph.
    const { status, body } = await get(origin, '/api/graph?focus=claim-1')
    assert.equal(status, 404)
    assert.match(String(body['error']), /claim-1/)
  })

  it('is 404 for a source focus on a view that does not accept a source', async () => {
    // richCorpus carries source-1, so the source resolves; the default view then refuses
    // it. The error must say the view rejects a source focus, not that the uuid is unknown.
    const { status, body } = await get(origin, '/api/graph?focus=source-1')
    assert.equal(status, 404)
    assert.match(String(body['error']), /source-1/)
    // `error` is the generic "could not be resolved"; `detail` carries the reason, which
    // must say the *view* rejected the focus rather than implying the uuid is unknown.
    assert.match(String(body['detail']), /does not accept a source as a focus/)
  })

  it('projects a source focus in the evidence view, which accepts one', async () => {
    const { status, body } = await get(
      origin,
      '/api/graph?focus=source-1&view=evidence&depth=2',
    )
    assert.equal(status, 200)
    assert.deepEqual(body['focus'], {
      id: 'source-1',
      type: 'source',
      slug: null,
    })
    const nodes = body['nodes'] as { id: string; isFocus: boolean }[]
    assert.ok(
      nodes.some((n) => n.id === 'source-1' && n.isFocus),
      'the focused source must carry isFocus',
    )
  })

  it('reports the empty evidence table as a data-blocked warning, not a failure', async () => {
    // richCorpus has zero evidence_items rows: the request must still be a 200 whose
    // warnings name the empty table, so the UI can distinguish "no rows in the corpus"
    // from "failed to load".
    const { status, body } = await get(
      origin,
      '/api/graph?focus=claim-1&view=evidence',
    )
    assert.equal(status, 200)
    const warnings = (body['meta'] as { warnings: string[] }).warnings
    assert.ok(Array.isArray(warnings))
    assert.ok(
      warnings.some((w) => w.includes('evidence_items has 0 rows')),
      `expected a corpus-based warning, got ${JSON.stringify(warnings)}`,
    )
  })

  it('is 404 for a focus the view will not accept', async () => {
    // `taxonomy` takes card focuses, so this asserts the error path is reachable rather than
    // that a particular view rejects a card.
    const { status } = await get(origin, '/api/graph?focus=card-1&view=taxonomy')
    assert.equal(status, 200, 'taxonomy does accept a card focus')
  })

  it('is 400 when focus is missing', async () => {
    const { status, body } = await get(origin, '/api/graph')
    assert.equal(status, 400)
    assert.match(String(body['error']), /focus is required/)
  })

  it('is 400 for an unknown view, naming the ones that exist', async () => {
    const { status, body } = await get(origin, '/api/graph?focus=card-1&view=nope')
    assert.equal(status, 400)
    assert.match(String(body['error']), /card-argument-taxonomy/)
  })

  it('is 413 for a depth past the cap', async () => {
    const { status, body } = await get(origin, '/api/graph?focus=card-1&depth=9')
    assert.equal(status, 413)
    assert.match(String(body['error']), /depth/)
  })

  it('is 413 for a maxNodes past the cap', async () => {
    const { status } = await get(origin, '/api/graph?focus=card-1&maxNodes=5000')
    assert.equal(status, 413)
  })

  it('is 400 for a non-numeric depth', async () => {
    const { status } = await get(origin, '/api/graph?focus=card-1&depth=lots')
    assert.equal(status, 400)
  })

  it('is 400 for an include that would widen the view', async () => {
    const { status, body } = await get(
      origin,
      '/api/graph?focus=card-1&include=evidence_item',
    )
    assert.equal(status, 400)
    assert.match(String(body['error']), /cannot emit/)
  })

  it('never exposes a public.cards field, at any depth', async () => {
    const { body } = await get(origin, '/api/graph?focus=card-1&depth=3')
    const serialised = JSON.stringify(body)
    for (const forbidden of ['frontDescription', 'backDescription', '"decks"']) {
      assert.ok(!serialised.includes(forbidden), `response leaked ${forbidden}`)
    }
  })

  it('exposes no graph-library type name in the payload', async () => {
    // The response is consumed by a renderer, not by a graph library. If a library shape ever
    // appears here the renderer is coupled to it, which is what the ADR forbids.
    const { body } = await get(origin, '/api/graph?focus=card-1&depth=3')
    const serialised = JSON.stringify(body)
    for (const library of ['nodes(', 'edges(', 'Cytoscape', 'Gremlin', 'graphology']) {
      assert.ok(!serialised.includes(library), `response leaked ${library}`)
    }
  })
})

describe('GET /api/graph with an unpopulated corpus', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    // A card with no claims, no classification, no steps, no relationships: the shape a
    // freshly authored card has before any corpus task has touched it.
    const corpus = emptyCorpus()
    corpus.cards = [
      {
        id: 'card-bare',
        slug: 'bare',
        title: 'Bare',
        summary: null,
        coreQuestion: null,
        primaryType: 'CASE',
        epistemicStatus: 'ESTABLISHED',
      },
    ]
    const server = await serve(corpus)
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('is 200 with a focus node and no edges, not an error', async () => {
    // An unpopulated layer is a fact about the corpus. Returning 404 or 500 would make an
    // empty-but-valid view indistinguishable from a broken request.
    const { status, body } = await get(origin, '/api/graph?focus=bare&depth=3')
    assert.equal(status, 200)
    assert.equal((body['nodes'] as unknown[]).length, 1)
    assert.deepEqual(body['edges'], [])
    assert.equal((body['meta'] as { truncated: boolean }).truncated, false)
  })

  it('still warns, so a caller can tell the layer is empty rather than filtered', async () => {
    const { body } = await get(origin, '/api/graph?focus=bare')
    const warnings = (body['meta'] as { warnings: string[] }).warnings
    assert.ok(warnings.length > 0, 'an empty classification must be reported')
  })
})

describe('GET /api/graph/views', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    const server = await serve(richCorpus())
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('lists every registered view with its rules and population', async () => {
    const { status, body } = await get(origin, '/api/graph/views')
    assert.equal(status, 200)
    const views = body['views'] as { name: string; status: string; populated: boolean }[]
    assert.ok(views.length >= 5, 'all five designed views must be listed')
    const v1 = views.find((v) => v.name === 'card-argument-taxonomy')
    assert.equal(v1?.status, 'implemented')
    // Slice 2 promoted argument from `designed`: chains are nodes there and its focus
    // paths resolve, so the API must stop advertising it as a design-only view.
    const argument = views.find((v) => v.name === 'argument')
    assert.equal(argument?.status, 'implemented')
    assert.ok('population' in body, 'the row counts travel with the view list')
  })

  it('reports an unpopulated view as present and blocked, not as absent', async () => {
    const { body } = await get(origin, '/api/graph/views')
    const views = body['views'] as {
      name: string
      status: string
      populated: boolean
      blockingGaps: string[]
    }[]
    const blocked = views.filter((v) => !v.populated)
    assert.ok(blocked.length > 0, 'the fake corpus has no evidence rows, so gaps must show')
    for (const view of blocked) {
      assert.ok(view.status !== 'implemented' || view.blockingGaps.length > 0)
    }
  })
})

describe('GET /api/graph/search', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    const corpus: FakeCorpus = {
      ...emptyCorpus(),
      cards: [
        card({ id: 'c1', slug: 'blood-libel', title: 'Blood Libel', summary: 'A medieval accusation.' }),
        card({ id: 'c2', slug: 'zionist-as-slur', title: 'Zionist-as-Slur', summary: 'The word used as an insult.' }),
        card({ id: 'c3', slug: 'elders-of-zion', title: 'Elders of Zion', summary: 'A forged document.' }),
        card({ id: 'c4', slug: 'unrelated-essay', title: 'Unrelated Card', summary: 'An essay about the libel trope.' }),
      ],
    }
    const server = await serve(corpus)
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('returns ranked card matches for a phrase query', async () => {
    const { status, body } = await get(origin, '/api/graph/search?q=blood%20libel')
    assert.equal(status, 200)
    const results = body['results'] as { id: string; type: string }[]
    assert.ok(results.length >= 1)
    assert.equal(results[0]?.id, 'c1')
    assert.equal(results[0]?.type, 'card')
  })

  it('matches a partial word by prefix', async () => {
    const { body } = await get(origin, '/api/graph/search?q=Zionis')
    const results = body['results'] as { id: string }[]
    assert.ok(results.some((r) => r.id === 'c2'), 'prefix must match a title')
  })

  it('orders title matches above summary-only matches', async () => {
    const { body } = await get(origin, '/api/graph/search?q=libel')
    const results = body['results'] as { id: string }[]
    const titleIndex = results.findIndex((r) => r.id === 'c1')
    const summaryIndex = results.findIndex((r) => r.id === 'c4')
    assert.ok(titleIndex >= 0 && summaryIndex >= 0)
    assert.ok(titleIndex < summaryIndex)
  })

  it('stamps every result with type "card" and a numeric rank', async () => {
    const { body } = await get(origin, '/api/graph/search?q=zion')
    const results = body['results'] as { type: string; rank: unknown; slug: string }[]
    assert.ok(results.length >= 1)
    for (const r of results) {
      assert.equal(r.type, 'card')
      assert.equal(typeof r.rank, 'number')
      assert.ok(r.slug.length > 0)
    }
  })

  it('returns an empty list for no matches, not an error', async () => {
    const { status, body } = await get(origin, '/api/graph/search?q=zzzz')
    assert.equal(status, 200)
    assert.deepEqual(body['results'], [])
  })

  it('is 400 when q is missing', async () => {
    const { status } = await get(origin, '/api/graph/search')
    assert.equal(status, 400)
  })

  it('is 400 when q is a single character', async () => {
    const { status } = await get(origin, '/api/graph/search?q=x')
    assert.equal(status, 400)
  })

  it('is 400 when q is repeated', async () => {
    const { status } = await get(origin, '/api/graph/search?q=a&q=b')
    assert.equal(status, 400)
  })
})

describe('GET /api/graph/cards', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    const corpus: FakeCorpus = {
      ...richCorpus(),
      sources: [],
      evidenceItems: [],
      claimSources: [],
      // A Suit and a Locale that share the `south-africa` slug on the same card, with
      // distinct taxonomy ids — the real seeded corpus has exactly this collision, and it is
      // the one shape that proves the listing keeps the dimensions apart instead of merging
      // two taxonomies because their slugs match.
      cardCollections: [
        link({ cardId: 'card-1', slug: 'zionism', name: 'Zionism' }),
        link({
          cardId: 'card-3',
          id: 'collection-south-africa',
          slug: 'south-africa',
          name: 'South Africa',
        }),
      ],
      cardLocales: [
        localeLink({
          cardId: 'card-1',
          id: 'locale-south-africa',
          slug: 'south-africa',
          name: 'South Africa',
        }),
        localeLink({
          cardId: 'card-1',
          id: 'locale-israel',
          slug: 'israel',
          name: 'Israel',
        }),
        localeLink({
          cardId: 'card-3',
          id: 'locale-south-africa',
          slug: 'south-africa',
          name: 'South Africa',
        }),
      ],
    }
    const server = await serve(corpus)
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('returns a paginated envelope with a total', async () => {
    const { status, body } = await get(origin, '/api/graph/cards')
    assert.equal(status, 200)
    const items = body['items'] as { id: string; title: string }[]
    assert.equal(body['total'], 3)
    assert.equal(body['limit'], 50)
    assert.equal(body['offset'], 0)
    assert.equal(items.length, 3)
  })

  it('returns read-only card fields and no graph internals', async () => {
    const { body } = await get(origin, '/api/graph/cards')
    const [first] = body['items'] as Record<string, unknown>[]
    assert.ok(first)
    assert.equal(typeof first.id, 'string')
    assert.equal(typeof first.slug, 'string')
    assert.equal(typeof first.title, 'string')
    for (const forbidden of ['nodes', 'edges', 'cardLocales', 'claims']) {
      assert.equal(forbidden in first, false, `${forbidden} must not leak to the client`)
    }
  })

  it('carries each card classification verbatim from the graph vocabulary', async () => {
    const { body } = await get(origin, '/api/graph/cards')
    const items = body['items'] as { id: string; classification: unknown }[]
    const one = items.find((c) => c.id === 'card-1')
    assert.ok(one)
    // Every slug is one that exists as a row in `collections`, `mechanisms` or `locales`.
    // `axes` stays empty because `FakeCorpus` carries no `card_axes` rows; axis assignment is
    // proved against Postgres in the Drizzle integration tests.
    assert.deepEqual(one.classification, {
      axes: [],
      suits: ['zionism'],
      suitIds: ['zionism'],
      mechanismSlugs: ['name-slur'],
      mechanismIds: ['name-slur'],
      localeSlugs: ['israel', 'south-africa'],
      localeIds: ['locale-israel', 'locale-south-africa'],
    })
  })

  it('keeps a suit and a locale that share a slug in separate dimensions', async () => {
    const { body } = await get(origin, '/api/graph/cards')
    const items = body['items'] as {
      id: string
      classification: {
        suits: string[]
        suitIds: string[]
        localeSlugs: string[]
        localeIds: string[]
      }
    }[]
    const shared = items.find((c) => c.id === 'card-3')
    assert.ok(shared)
    assert.deepEqual(shared.classification.suits, ['south-africa'])
    assert.deepEqual(shared.classification.suitIds, ['collection-south-africa'])
    assert.deepEqual(shared.classification.localeSlugs, ['south-africa'])
    assert.deepEqual(shared.classification.localeIds, ['locale-south-africa'])
    // Slug equality across the two lists carries no meaning: only the ids distinguish them.
    assert.notDeepEqual(shared.classification.suitIds, shared.classification.localeIds)
  })

  it('reports empty classification dimensions rather than inventing them', async () => {
    const corpus: FakeCorpus = { ...emptyCorpus(), cards: [card({ id: 'bare' })] }
    const server = await serve(corpus)
    try {
      const { body } = await get(server.origin, '/api/graph/cards')
      assert.deepEqual(body['items'], [
        {
          id: 'bare',
          slug: 'bare',
          title: 'Card bare',
          summary: null,
          coreQuestion: null,
          primaryType: 'CASE',
          epistemicStatus: 'ESTABLISHED',
          classification: {
            axes: [],
            suits: [],
            suitIds: [],
            mechanismSlugs: [],
            mechanismIds: [],
            localeSlugs: [],
            localeIds: [],
          },
        },
      ])
    } finally {
      await server.close()
    }
  })

  it('pages with limit and offset', async () => {
    const first = await get(origin, '/api/graph/cards?limit=2')
    assert.equal((first.body['items'] as unknown[]).length, 2)
    const second = await get(origin, '/api/graph/cards?limit=2&offset=2')
    assert.equal((second.body['items'] as unknown[]).length, 1)
    assert.equal(second.body['total'], 3)
    const ids = [
      ...(first.body['items'] as { id: string }[]).map((c) => c.id),
      ...(second.body['items'] as { id: string }[]).map((c) => c.id),
    ]
    assert.equal(new Set(ids).size, 3, 'pages must not overlap or drop a row')
  })

  it('filters by locale', async () => {
    const { status, body } = await get(
      origin,
      '/api/graph/cards?locale=south-africa',
    )
    assert.equal(status, 200)
    assert.equal(body['total'], 2)
    const ids = (body['items'] as { id: string }[]).map((c) => c.id)
    assert.ok(ids.includes('card-1'))
    assert.ok(ids.includes('card-3'))
  })

  it('combines the locale filter with paging', async () => {
    const { body } = await get(
      origin,
      '/api/graph/cards?locale=south-africa&limit=1&offset=1',
    )
    assert.equal(body['total'], 2)
    assert.equal((body['items'] as unknown[]).length, 1)
  })

  it('is 200 with an empty list for a locale no card carries', async () => {
    const { status, body } = await get(origin, '/api/graph/cards?locale=nowhere')
    assert.equal(status, 200)
    assert.deepEqual(body['items'], [])
    assert.equal(body['total'], 0)
  })

  it('is 400 for an unknown parameter', async () => {
    const { status } = await get(origin, '/api/graph/cards?collection=sionism')
    assert.equal(status, 400)
  })

  it('is 400 for a repeated parameter', async () => {
    const { status } = await get(origin, '/api/graph/cards?locale=a&locale=b')
    assert.equal(status, 400)
  })

  it('is 400 for a locale that is not a slug', async () => {
    const { status } = await get(origin, '/api/graph/cards?locale=South Africa')
    assert.equal(status, 400)
  })

  it('is 400 for a negative offset', async () => {
    const { status } = await get(origin, '/api/graph/cards?offset=-1')
    assert.equal(status, 400)
  })

  it('clamps an oversized limit instead of rejecting it', async () => {
    const { status, body } = await get(origin, '/api/graph/cards?limit=100000')
    assert.equal(status, 200)
    assert.equal(body['limit'], 200)
  })
})

describe('GET /api/graph/sources', () => {
  let origin = ''
  let close: () => Promise<void> = async () => {}

  before(async () => {
    const server = await serve(richCorpus())
    origin = server.origin
    close = server.close
  })

  after(async () => {
    await close()
  })

  it('returns a paginated envelope with a total', async () => {
    const { status, body } = await get(origin, '/api/graph/sources')
    assert.equal(status, 200)
    assert.equal(typeof body['total'], 'number')
    assert.equal(body['offset'], 0)
    assert.ok((body['items'] as unknown[]).length > 0)
  })

  it('stamps every source with its claim count', async () => {
    const { body } = await get(origin, '/api/graph/sources')
    const items = body['items'] as { claimSourceCount: number }[]
    for (const row of items) {
      assert.equal(typeof row.claimSourceCount, 'number')
      assert.ok(row.claimSourceCount >= 0)
    }
  })

  it('returns read-only attribution fields', async () => {
    const { body } = await get(origin, '/api/graph/sources')
    const [first] = body['items'] as Record<string, unknown>[]
    assert.ok(first)
    assert.equal(typeof first.id, 'string')
    assert.equal(typeof first.title, 'string')
    assert.equal(typeof first.sourceType, 'string')
    for (const forbidden of ['claimIds', 'evidenceIds', 'claims']) {
      assert.equal(forbidden in first, false, `${forbidden} must not leak to the client`)
    }
  })

  it('pages without overlap', async () => {
    const all = await get(origin, '/api/graph/sources')
    const total = all.body['total'] as number
    const half = await get(origin, `/api/graph/sources?limit=${Math.max(1, Math.floor(total / 2))}`)
    const rest = await get(
      origin,
      `/api/graph/sources?limit=${Math.max(1, Math.floor(total / 2))}&offset=${Math.max(1, Math.floor(total / 2))}`,
    )
    const ids = [
      ...(half.body['items'] as { id: string }[]).map((s) => s.id),
      ...(rest.body['items'] as { id: string }[]).map((s) => s.id),
    ]
    assert.equal(new Set(ids).size, ids.length, 'pages must not overlap')
  })

  it('rejects a filter this route does not accept', async () => {
    const { status } = await get(origin, '/api/graph/sources?locale=south-africa')
    assert.equal(status, 400)
  })

  it('is 400 for a repeated limit', async () => {
    const { status } = await get(origin, '/api/graph/sources?limit=1&limit=2')
    assert.equal(status, 400)
  })

  it('is 400 for a non-numeric limit', async () => {
    const { status } = await get(origin, '/api/graph/sources?limit=many')
    assert.equal(status, 400)
  })
})

describe('read-only guarantee', () => {
  it('exposes no write route under /api/graph', async () => {
    const app = express()
    app.use('/api/graph', createGraphRouter(new FakeGraphReader(richCorpus())))
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        for (const path of ['', '/cards', '/sources']) {
          const response = await fetch(`http://127.0.0.1:${port}/api/graph${path}`, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ focus: 'card-1' }),
          })
          assert.equal(
            response.status,
            404,
            `${method} /api/graph${path} must not be routed: a projection cannot write`,
          )
        }
      }
    } finally {
      await new Promise((resolve) => server.close(() => resolve(undefined)))
    }
  })
})
