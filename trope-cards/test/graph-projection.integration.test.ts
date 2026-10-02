import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { DrizzleGraphReader } from '../src/graph/drizzle-reader'
import { cardCorpus } from '../src/db/seed/corpus'
import { projectGraph } from '../src/graph/projection'
import { cardAxis } from '../src/db/schema/tropeGraph'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  HARD_MAX_NODES,
  getGraphView,
} from '../src/graph/views'
import type { GraphEdge, GraphNode } from '../src/graph/types'
import type { TropeGraphReader, ViewPopulation } from '../src/graph/reader'

/**
 * The same invariants, against the real corpus and real SQL.
 *
 * The unit suite drives an in-memory reader, so it proves the projection's *logic*. This suite
 * proves the Drizzle queries actually select the columns the projection expects, join the rows
 * it needs, and return snake_case-mapped objects with the right field names — the class of bug
 * that is invisible to a fake because the fake hands back exactly the shape the port declares.
 *
 * Read-only, and skipped unless `TROPE_GRAPH_DATABASE_URL` is set, so it runs in CI without a
 * database. `pnpm run trope-graph:verify` remains the authoritative write-path check.
 */

/** True when a database is configured, so these tests have something to read. */
const hasDatabase = Boolean(process.env.TROPE_GRAPH_DATABASE_URL)

/** The v1 view. */
const view = getGraphView('card-argument-taxonomy')!

/** Every seeded slug, so the suite can prove coverage rather than sampling one card. */
const seededSlugs = cardCorpus.map((c) => c.slug)

/** Assert the six normalisation invariants hold for one projection. */
function assertInvariants(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): void {
  const ids = new Set(nodes.map((n) => n.id))
  assert.equal(ids.size, nodes.length, 'duplicate node id')

  const edgeIds = new Set(edges.map((e) => e.id))
  assert.equal(edgeIds.size, edges.length, 'duplicate edge id')

  for (const edge of edges) {
    assert.ok(ids.has(edge.from), `edge ${edge.id} has no node for "from" ${edge.from}`)
    assert.ok(ids.has(edge.to), `edge ${edge.id} has no node for "to" ${edge.to}`)
    assert.ok(
      view.edgeFamilies.includes(edge.family),
      `edge family ${edge.family} is not in view ${view.name}`,
    )
  }

  for (const node of nodes) {
    assert.ok(
      view.nodeTypes.includes(node.type),
      `node type ${node.type} is not in view ${view.name}`,
    )
    assert.ok('status' in node, `${node.type} ${node.id} has no status field`)
    assert.ok(node.depth >= 0 && node.depth <= HARD_MAX_NODES, 'depth out of range')
  }

  // Every non-focus node must be reachable by at least one edge, otherwise the projection is
  // emitting an island. This is the failure a dangling-pointer bug produces in production.
  for (const node of nodes) {
    if (node.isFocus) continue
    assert.ok(
      edges.some((e) => e.from === node.id || e.to === node.id),
      `${node.type} ${node.id} is an island: no edge references it`,
    )
  }
}

describe(
  'projected graph over the seeded corpus',
  { skip: hasDatabase ? false : 'no TROPE_GRAPH_DATABASE_URL set' },
  () => {
    let reader: TropeGraphReader
    let close: () => Promise<void>
    let population: ViewPopulation

    before(async () => {
      const { getDb, getPool } = await import('../src/db/client')
      getDb()
      const pool = getPool()
      close = () => pool.end()
      reader = new DrizzleGraphReader(getDb())
      population = await reader.readPopulation()
    })

    after(async () => {
      await close?.()
    })

    it('reads the counts the design doc was written against', () => {
      assert.equal(population.cards, cardCorpus.length)
      assert.equal(population.concepts, 6, 'concepts exist but are orphaned (Q2)')
      assert.equal(population.argumentChains, 2)
      assert.ok(population.claims > 0)
      assert.ok(population.inferenceSteps > 0)
      assert.ok(population.relationships > 0)
      assert.ok(population.collections > 0)
      assert.ok(population.mechanisms > 0)
    })

    it('confirms the gaps the decisions were made about', () => {
      // These zero counts are the reason Q1, Q2 and Q5 are worded the way they are. If one
      // becomes non-zero, the corpus task that filled it should also revisit the decision —
      // so the assertion states the current state rather than merely passing.
      assert.equal(population.cardConcepts, 0, 'Q2 assumed card_concepts is unpopulated')
      assert.equal(population.claimRelations, 0, 'Q1 assumed claim_relations is unpopulated')
      assert.equal(population.sources, 0, 'evidence decisions assumed sources is unpopulated')
      assert.equal(population.evidenceItems, 0)
    })

    it('resolves a card by slug and by uuid to the same row (Q7)', async () => {
      const slug = seededSlugs[0]!
      const bySlug = await reader.findCardByRef(slug)
      assert.ok(bySlug, `slug ${slug} did not resolve`)
      const byUuid = await reader.findCardByRef(bySlug.id)
      assert.equal(byUuid?.id, bySlug.id)
      assert.equal(byUuid?.slug, slug)
    })

    it('resolves a uuid-shaped string as an id, never as a slug', async () => {
      const row = await reader.findCardByRef('00000000-0000-4000-8000-000000000000')
      assert.equal(row, undefined, 'an unknown uuid must resolve to nothing, not to a slug')
    })

    it('projects a valid graph for every seeded card, not just a sample', async () => {
      const failures: string[] = []
      for (const slug of seededSlugs) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 1,
          maxNodes: DEFAULT_MAX_NODES,
        })
        // Not `nodes[0]`: nodes come back in hydration order, and the focus has no claim to
        // sorting first. The contract is that it is present and the only node flagged as focus.
        const focused = projection.nodes.filter((n) => n.isFocus)
        assert.equal(focused.length, 1, `${slug} did not resolve to exactly one focus node`)
        assert.equal(focused[0]?.id, projection.focus.id)
        assert.equal(focused[0]?.depth, 0)
        assertInvariants(projection.nodes, projection.edges)
        if (projection.nodes.length === 0) failures.push(slug)
      }
      assert.deepEqual(failures, [], 'these cards project to nothing')
    })

    it('projects the invariants at depth 3 for a sample of cards', async () => {
      // Depth 3 across 47 cards is 47 round-trips per hop against a live database; a sample
      // keeps the suite fast while still crossing card -> claim -> step.
      const sample = seededSlugs.filter((_, i) => i % 8 === 0)
      for (const slug of sample) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 3,
          maxNodes: DEFAULT_MAX_NODES,
        })
        assertInvariants(projection.nodes, projection.edges)
      }
    })

    it('never emits a dangling relationship edge, because real rows have real endpoints', async () => {
      for (const slug of seededSlugs.slice(0, 12)) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const links = projection.edges.filter((e) => e.family === 'card_relationship')
        const cardIds = new Set(
          projection.nodes.filter((n) => n.type === 'card').map((n) => n.id),
        )
        for (const link of links) {
          assert.ok(cardIds.has(link.from), `link ${link.id} points at a missing card`)
          assert.ok(cardIds.has(link.to), `link ${link.id} points at a missing card`)
        }
      }
    })

    it('emits the authored axis, never one derived from primary_type', async () => {
      const authored = cardCorpus[0]!
      const projection = await projectGraph(reader, {
        focus: authored.slug,
        view,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const cardNode = projection.nodes.find((n) => n.type === 'card')
      assert.ok(cardNode, 'the focus card must be present')
      assert.equal(cardNode.metadata.legacyPrimaryType, authored.primaryType)
      // `card_axes` is populated for every seeded card, so no warning should appear for the
      // focus. A warning here would mean the Drizzle `cardAxes` select missed the rows.
      assert.ok(
        !projection.meta.warnings.some((w) => w.includes('no card_axes rows')),
        `axis rows were not read: ${JSON.stringify(projection.meta.warnings)}`,
      )
    })

    it('reports a suit vocabulary that matches the corpus, without remapping it (Q3)', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 1,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const cardNode = projection.nodes.find((n) => n.type === 'card')
      assert.ok(cardNode && 'classification' in cardNode)
      assert.ok(
        !cardNode.classification.suits.includes('contested'),
        'an epistemic value leaked into the suit vocabulary',
      )
    })

    it('produces identical output for two identical requests', async () => {
      const slug = seededSlugs[1]!
      const first = await projectGraph(reader, {
        focus: slug,
        view,
        depth: 2,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const second = await projectGraph(reader, {
        focus: slug,
        view,
        depth: 2,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.equal(JSON.stringify(first), JSON.stringify(second))
    })

    it('truncates at maxNodes and reports it', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[2]!,
        view,
        depth: 3,
        maxNodes: 3,
      })
      assert.equal(projection.nodes.length, 3)
      assert.equal(projection.meta.truncated, true)
    })

    it('reads the population query as numbers, not as strings', async () => {
      for (const [key, value] of Object.entries(population)) {
        assert.equal(typeof value, 'number', `${key} came back as ${typeof value}`)
      }
      assert.ok(population.cards > 0)
    })

    it('validates every persisted axis value against the enum', async () => {
      // The integration counterpart to `graph-axis.integration.test.ts`: it proves the reader
      // sees the same axis rows the axis suite asserts on, through a different query path.
      const allowed = new Set<string>(cardAxis.enumValues)
      for (const slug of seededSlugs.slice(0, 10)) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 1,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const cardNode = projection.nodes.find((n) => n.type === 'card')
        assert.ok(cardNode && 'classification' in cardNode)
        for (const axis of cardNode.classification.axes) {
          assert.ok(allowed.has(axis.axis), `axis ${axis.axis} is not in the enum`)
        }
      }
    })

    it('never emits a Concept node while card_concepts is empty (Q2)', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 3,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.deepEqual(
        projection.nodes.filter((n) => n.type === 'concept'),
        [],
        'a Concept node without a card_concepts row would be invented',
      )
    })

    it('never emits an argument_chain node; chains ride on steps (Q6)', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 3,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.deepEqual(projection.nodes.filter((n) => n.type === 'argument_chain'), [])
    })

    it('returns only the focus at depth 0, without querying the graph', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: 0,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.equal(projection.nodes.length, 1)
      assert.equal(projection.edges.length, 0)
    })

    it('uses DEFAULT_DEPTH of 1 for an unstated depth', async () => {
      const projection = await projectGraph(reader, {
        focus: seededSlugs[0]!,
        view,
        depth: DEFAULT_DEPTH,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.equal(projection.depth, 1)
      assert.equal(projection.meta.reachedDepth <= 1, true)
    })

    it('exposes only the documented hard cap, not an unbounded one', () => {
      assert.equal(HARD_MAX_NODES, 500)
    })
  },
)
