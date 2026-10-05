import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { cardCorpus } from '../src/db/seed/corpus'
import { DrizzleGraphReader } from '../src/graph/drizzle-reader'
import { toGraphology } from '../src/graph/graphology-adapter'
import {
  connectedComponents,
  degreeReport,
  reachableFrom,
} from '../src/graph/analysis'
import { projectGraph } from '../src/graph/projection'
import type { TropeGraphReader } from '../src/graph/reader'
import { DEFAULT_MAX_NODES, getGraphView } from '../src/graph/views'

/**
 * The adapter and the analysis helpers, against the real corpus and real SQL.
 *
 * The unit suite proves the adapter's logic over projections built by a fake reader. This one
 * proves the adapter survives the shapes the seeded ontology actually produces — the ones a
 * fixture author would not have thought to write. Specifically: two `relationships` rows
 * sharing a typed pair, cards whose Locale slug equals their Suit slug, and inference steps
 * whose status vocabulary differs from a claim's.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set.
 */

/** True when a database is configured, so these tests have something to read. */
const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** The v1 view. */
const view = getGraphView('card-argument-taxonomy')!

/** Every seeded slug, so the suite proves coverage rather than sampling one card. */
const seededSlugs = cardCorpus.map((c) => c.slug)

describe(
  'graphology adapter over the seeded ontology',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let reader: TropeGraphReader
    let pool: { end: () => Promise<void> } | undefined

    before(async () => {
      // Imported here rather than at module scope: `client.ts` constructs a pool as an import
      // side effect, which would throw before the skip above could be evaluated.
      const { getDb, getPool } = await import('../src/db/client')
      const { assertLocalHostFromEnv } = await import('../src/db/url')
      assertLocalHostFromEnv()
      pool = getPool()
      reader = new DrizzleGraphReader(getDb())
    })

    after(async () => {
      await pool?.end()
    })

    it('adapts a projection for every seeded card, not just a sample', async () => {
      for (const slug of seededSlugs) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const graph = toGraphology(projection)
        assert.equal(graph.order, projection.nodes.length, `${slug}: node count`)
        assert.equal(graph.size, projection.edges.length, `${slug}: edge count`)
      }
    })

    it('preserves node ids, edge ids and direction for every seeded card', async () => {
      for (const slug of seededSlugs) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const graph = toGraphology(projection)
        for (const node of projection.nodes) {
          assert.ok(graph.hasNode(node.id), `${slug}: missing node ${node.id}`)
        }
        for (const edge of projection.edges) {
          assert.ok(graph.hasEdge(edge.id), `${slug}: missing edge ${edge.id}`)
          assert.equal(graph.source(edge.id), edge.from, `${slug}: ${edge.id} from`)
          assert.equal(graph.target(edge.id), edge.to, `${slug}: ${edge.id} to`)
        }
      }
    })

    it('keeps both rows of a repeated relationships pair as two edges', async () => {
      // `relationships` has no uniqueness on its endpoint pair, so the seeded corpus can and
      // does hold two rows for one pair distinguished only by `status`. Graphology's simple
      // `Graph` class rejects that outright, which is why the adapter is multi.
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 3,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const byPair = new Map<string, number>()
      for (const edge of projection.edges) {
        const key = `${edge.from}->${edge.to}`
        byPair.set(key, (byPair.get(key) ?? 0) + 1)
      }
      const graph = toGraphology(projection)
      for (const [pair, count] of byPair) {
        const parallel = projection.edges.filter((e) => `${e.from}->${e.to}` === pair)
        assert.ok(count > 0)
        for (const edge of parallel) {
          assert.ok(graph.hasEdge(edge.id), `parallel edge ${edge.id} must survive`)
        }
      }
      assert.equal(graph.size, projection.edges.length)
    })

    it('keeps a card that shares the south-africa slug across Suit and Locale', async () => {
      // The seeded corpus has four cards in both taxonomies, so the adapted node carries the
      // same slug in two different dimensions. The ids must still differ.
      const projection = await projectGraph(reader, {
        focus: 'apartheid-collaborators',
        view,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const graph = toGraphology(projection)
      const cardNode = graph.nodes().find((id) => graph.getNodeAttribute(id, 'type') === 'card')
      assert.ok(cardNode)
      const classification = graph.getNodeAttribute(cardNode, 'classification')
      assert.ok(classification && 'localeSlugs' in classification)
      assert.deepEqual(classification.localeSlugs, ['south-africa'])
      assert.equal(classification.localeIds.length, 1)
      assert.equal(
        classification.suitIds.length,
        classification.suits.length,
        'suit ids must stay parallel to suit slugs through the adapter',
      )
    })

    it('keeps axis ordinals and locales intact through the adapter', async () => {
      const projection = await projectGraph(reader, {
        focus: 'apartheid-collaborators',
        view,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const graph = toGraphology(projection)
      const cardNode = graph.nodes().find((id) => graph.getNodeAttribute(id, 'type') === 'card')
      assert.ok(cardNode)
      const classification = graph.getNodeAttribute(cardNode, 'classification')
      assert.ok(classification && 'axes' in classification)
      const ordinals = classification.axes.map((a: { ordinal: number }) => a.ordinal)
      assert.ok(ordinals.includes(0), 'the primary axis must survive as ordinal 0')
      assert.deepEqual(ordinals, [...ordinals].sort((a, b) => a - b))
    })

    it('keeps status vocabularies separate per node type', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 3,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const graph = toGraphology(projection)
      const sources = new Set(
        [...graph.nodes()].map((id) => graph.getNodeAttribute(id, 'status').source),
      )
      // The seed has cards with claims and inference steps, so both vocabularies must appear
      // and must not have been merged into one.
      assert.ok(sources.has('epistemic_status'), 'card/claim status must survive')
      assert.ok(sources.has('independent_inference_status'), 'step status must survive')
    })

    it('traverses deterministically from every seeded focus', async () => {
      // Determinism is the property the analysis layer promises; over real data the only way to
      // know it holds is to run it across the whole corpus rather than one fixture.
      for (const slug of seededSlugs) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const graph = toGraphology(projection)
        const first = reachableFrom(graph, projection.focus.id, { maxDepth: 2, maxNodes: 200 })
        const second = reachableFrom(
          toGraphology(projection),
          projection.focus.id,
          { maxDepth: 2, maxNodes: 200 },
        )
        assert.deepEqual(first.nodeIds, second.nodeIds, `${slug}: reachability must be stable`)
        assert.deepEqual(first.nodeIds, [...first.nodeIds].sort(), `${slug}: sorted`)
        assert.deepEqual(degreeReport(graph), degreeReport(toGraphology(projection)), slug)
        assert.deepEqual(
          connectedComponents(graph).flat().sort(),
          projection.nodes.map((n) => n.id).sort(),
          `${slug}: components must cover every node`,
        )
      }
    })

    it('reports a component per card with no argument structure', async () => {
      // 38 of 47 seeded cards have no claims, so the corpus is mostly isolated nodes. Analysis
      // must describe that honestly rather than implying connectivity that is not there.
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const graph = toGraphology(projection)
      const components = connectedComponents(graph)
      assert.equal(components.flat().length, projection.nodes.length)
    })
  },
)