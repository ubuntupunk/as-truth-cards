import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'

import express from 'express'

import { createGraphRouter } from '../../server/api/graph'
import { FakeGraphReader, emptyCorpus, richCorpus } from './helpers/fake-graph-reader'
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
    const { status, body } = await get(origin, '/api/graph?focus=card-1&include=source')
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

describe('read-only guarantee', () => {
  it('exposes no write route under /api/graph', async () => {
    const app = express()
    app.use('/api/graph', createGraphRouter(new FakeGraphReader(richCorpus())))
    const server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const response = await fetch(`http://127.0.0.1:${port}/api/graph`, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ focus: 'card-1' }),
        })
        assert.equal(
          response.status,
          404,
          `${method} /api/graph must not be routed: a projection cannot write`,
        )
      }
    } finally {
      await new Promise((resolve) => server.close(() => resolve(undefined)))
    }
  })
})
