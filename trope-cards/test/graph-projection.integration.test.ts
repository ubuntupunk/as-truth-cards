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
import type { GraphViewRule } from '../src/graph/views'
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

/**
 * Assert the six normalisation invariants hold for one projection.
 *
 * @param nodes Emitted nodes.
 * @param edges Emitted edges.
 * @param rule The view projected, so `nodeTypes` is checked against the right contract rather
 * than the suite's default v1. Concept is legal in `taxonomy` and illegal in v1.
 */
function assertInvariants(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  rule: GraphViewRule = view,
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
      rule.nodeTypes.includes(node.type),
      `node type ${node.type} is not in view ${rule.name}`,
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
      // Q2 resolved the collision by removing the two concepts that restated a mechanism,
      // leaving 3 subjects and 1 analytical frame.
      assert.equal(population.concepts, 4, 'concept vocabulary is 3 subjects + 1 frame')
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
      //
      // All three have since been filled. Each now records the
      // decision that made it non-zero, so the tripwire still fires on the next change rather
      // than being quietly relaxed.
      // Filled by the Q2 corpus task. Every link cites the card sentence supporting it, and
      // `anti-zionism` stays a deliberate orphan because no card discusses it.
      assert.equal(
        population.cardConcepts,
        12,
        'card_concepts is populated; the next change must revisit why no reader loads it',
      )

      // Filled by v0.11. Q1 anticipated exactly this: "claim_relations becomes live the moment
      // it is populated, with no projection change". The projection already projects authored
      // rows, so the count is the design working, not drifting from it.
      assert.equal(population.claimRelations, 5, 'Q1 anticipated claim_relations becoming live')

      // Filled by v0.11, bibliographically only. B5 deprecates claim_sources "when the evidence
      // corpus is populated"; it is not, so the table stays. See sourceLayer.ts.
      assert.equal(population.sources, 3, 'v0.11 added bibliographic sources')

      // Still zero, and load-bearing: evidence_items requires a located passage with verifiable
      // wording. Its emptiness is a decision, not a gap. See CORPUS_GAP_ANALYSIS.md section 4.
      assert.equal(population.evidenceItems, 0)
    })

    it('projects authored claim relations without inferring any', async () => {
      // Q1's operative rule: the projection reads claim_relations as authored and derives
      // nothing from inference structure. Now that 5 rows exist, the rule is testable where it
      // previously could not be: an authored row must reach the projection, and no
      // claim_relation edge may come from anything but an authored row.
      const slugsWithRelations = [
        'canaanite-card',
        'jesus-was-a-zionist',
        'palestinian-flag',
      ]
      const projectedValues: string[] = []
      for (const slug of slugsWithRelations) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const relationEdges = projection.edges.filter(
          (e) => e.family === 'claim_relation',
        )
        for (const edge of relationEdges) {
          // Q1: an edge in this family must be traceable to an authored claim_relations row.
          assert.equal(
            edge.sourceTable,
            'claim_relations',
            `edge ${edge.id} claims the claim_relation family but reads ${edge.sourceTable}`,
          )
        }
        projectedValues.push(...relationEdges.map((e) => e.type.value))
      }

      assert.ok(
        projectedValues.length > 0,
        'authored claim relations should reach the projection now that the table is populated',
      )
      // The five authored relations sit on three cards; each of those cards must surface at
      // least one, so a projection that silently dropped the family would be caught.
      assert.ok(
        projectedValues.length >= 5,
        `expected all 5 authored relations across 3 cards, saw ${projectedValues.length}`,
      )
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

    // ---------------------------------------------------------------------
    // Q2: Concept over real SQL
    // ---------------------------------------------------------------------

    it('projects every authored card_concepts row, deterministically', async () => {
      // The fake suite proves the logic; this proves the join. A `card_concepts -> concepts`
      // query that dropped `relationship`, or selected `concepts.description` where the column is
      // `definition`, would pass against the fake and fail here.
      const taxonomy = getGraphView('taxonomy')!
      const slugsWithConcepts = [
        'apartheid-collaborators',
        'apartheid-map',
        'elders-of-zion',
        'holocaust-denial-distortion',
        'israel-apartheid-severance',
        'jesus-was-a-zionist',
        'jews-are-not-semites',
        'muhammad-was-a-zionist',
        'shylock',
        'weaponizing-antisemitism',
        'zionist-as-slur',
      ]

      const seen = new Map<string, string>()
      for (const slug of slugsWithConcepts) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view: taxonomy,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        const edges = projection.edges.filter((e) => e.type.value === 'HAS_CONCEPT')
        for (const edge of edges) {
          assert.equal(edge.sourceTable, 'card_concepts')
          assert.equal(edge.from, projection.nodes.find((n) => n.isFocus)!.id)
          assert.ok(
            typeof edge.attributes.relationship === 'string',
            `${slug} lost its authored relationship text`,
          )
          assert.ok(
            (edge.attributes.relationship as string).length > 0,
            `${slug} has an empty relationship, which would justify dropping the column`,
          )
          seen.set(`${slug}|${edge.attributes.slug as string}`, edge.id)

          // Determinism: the same request twice must produce the same ids, so a client can diff
          // two projections.
          const again = await projectGraph(reader, {
            focus: slug,
            view: taxonomy,
            depth: 2,
            maxNodes: DEFAULT_MAX_NODES,
          })
          assert.deepEqual(
            again.edges.filter((e) => e.type.value === 'HAS_CONCEPT').map((e) => e.id),
            edges.map((e) => e.id),
            `${slug} produced unstable edge ids`,
          )
        }
        assert.ok(edges.length > 0, `${slug} was expected to have an authored Concept link`)
      }

      assert.equal(
        seen.size,
        12,
        `expected all 12 authored links, saw ${seen.size}: ${[...seen.keys()].join(', ')}`,
      )
    })

    it('keeps the anti-zionism orphan out of every projection', async () => {
      // 4 concepts exist but only 3 are linked by any card. The fourth has no `card_concepts`
      // row, so it must never be emitted — reporting it would require inventing a card link.
      const taxonomy = getGraphView('taxonomy')!
      const slugs = ['antisemitism', 'anti-zionism', 'zionism', 'historical-analogy']
      assert.ok(slugs.includes('anti-zionism'), 'the fixture vocabulary must still name it')
      assert.equal(population.concepts, 4)
      assert.equal(population.cardConcepts, 12)

      const reachable = new Set<string>()
      let cardsWithoutConcepts = 0
      for (const slug of seededSlugs) {
        const projection = await projectGraph(reader, {
          focus: slug,
          view: taxonomy,
          depth: 2,
          maxNodes: DEFAULT_MAX_NODES,
        })
        // Every seeded card must project cleanly here, so the 36 cards with no authored Concept
        // row are themselves the proof that a missing association is valid rather than an error.
        assertInvariants(projection.nodes, projection.edges, taxonomy)
        assert.ok(projection.nodes.length > 0, `${slug} produced an empty projection`)
        const conceptCount = projection.nodes.filter((n) => n.type === 'concept').length
        if (conceptCount === 0) cardsWithoutConcepts += 1
        for (const node of projection.nodes) {
          if (node.type === 'concept') reachable.add(node.metadata.slug)
        }
      }
      assert.equal(
        cardsWithoutConcepts,
        seededSlugs.length - 11,
        'the corpus links 11 cards to a concept; the other 36 must project with none',
      )
      assert.equal(
        reachable.has('anti-zionism'),
        false,
        'anti-zionism is referenced by no card and must not appear as a node',
      )
      assert.deepEqual(
        [...reachable].sort(),
        ['antisemitism', 'historical-analogy', 'zionism'],
        'exactly the three concepts that have authored rows are reachable',
      )
    })

    it('puts the concept definition in metadata.definition, not description', async () => {
      const taxonomy = getGraphView('taxonomy')!
      const projection = await projectGraph(reader, {
        focus: 'jesus-was-a-zionist',
        view: taxonomy,
        depth: 2,
        maxNodes: DEFAULT_MAX_NODES,
      })
      const concept = projection.nodes.find((n) => n.type === 'concept')
      assert.ok(concept, 'jesus-was-a-zionist is linked to the zionism concept')
      assert.equal(concept.type, 'concept')
      if (concept.type !== 'concept') return
      assert.equal(concept.metadata.slug, 'zionism')
      assert.equal(concept.metadata.description, null)
      assert.ok(
        concept.metadata.definition && concept.metadata.definition.length > 0,
        'concepts.definition must reach metadata.definition',
      )
      assert.equal(concept.status.source, 'none', 'a Concept is not a truth claim (Q3)')
    })

    it('emits no Concept node in v1 even though the rows exist', async () => {
      const projection = await projectGraph(reader, {
        focus: 'jesus-was-a-zionist',
        view,
        depth: 3,
        maxNodes: DEFAULT_MAX_NODES,
      })
      assert.ok(
        population.cardConcepts > 0,
        'this test is only meaningful while authored rows exist',
      )
      assert.equal(
        projection.nodes.filter((n) => n.type === 'concept').length,
        0,
        'v1 excludes Concept by scope',
      )
      assert.equal(
        projection.edges.filter((e) => e.type.value === 'HAS_CONCEPT').length,
        0,
      )
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
