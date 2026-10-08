import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GraphQueryError,
  describeViews,
  parseGraphQuery,
  parseListQuery,
  parseSearchQuery,
} from '../src/graph/query'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  HARD_MAX_DEPTH,
  HARD_MAX_NODES,
  viewEmitsNodeType,
  viewTraversesFamily,
} from '../src/graph/views'
import type { ViewPopulation } from '../src/graph/reader'
import { FakeGraphReader, richCorpus } from './helpers/fake-graph-reader'

/**
 * The request contract of `GET /api/graph`.
 *
 * Every rejection here is a status code a client will branch on, so the tests assert the code
 * rather than the message: the code is the contract, the wording is documentation.
 *
 * The distinction that matters most is `400` versus `200` with a warning. A corpus layer that
 * is not populated is a fact about the project; a malformed request is a fact about the
 * caller. Collapsing them would mean a client could not tell whether to fix its code or open
 * a backlog item.
 */

/** Assert that `query` is rejected with `status`, and return the error for message checks. */
function rejects(
  query: Record<string, unknown>,
  status: 400 | 404 | 413,
): GraphQueryError {
  try {
    parseGraphQuery(query)
  } catch (error) {
    assert.ok(error instanceof GraphQueryError, `expected GraphQueryError, got ${error}`)
    assert.equal(error.status, status, `wrong status for ${JSON.stringify(query)}`)
    return error
  }
  assert.fail(`expected ${JSON.stringify(query)} to be rejected with ${status}`)
}

describe('focus', () => {
  it('accepts a kebab-case card slug', () => {
    assert.equal(
      parseGraphQuery({ focus: 'jesus-was-a-zionist' }).focus,
      'jesus-was-a-zionist',
    )
  })

  it('accepts a uuid', () => {
    const uuid = '019297f0-0000-4000-8000-000000000001'
    assert.equal(parseGraphQuery({ focus: uuid }).focus, uuid)
  })

  it('trims surrounding whitespace', () => {
    assert.equal(parseGraphQuery({ focus: '  jesus-was-a-zionist ' }).focus, 'jesus-was-a-zionist')
  })

  it('requires focus', () => {
    const error = rejects({}, 400)
    assert.match(error.detail, /focus is required/)
    // The parse error doubles as the vocabulary contract: a source or evidence uuid is a
    // first-class focus, and the message must say so before any lookup happens.
    assert.match(error.detail, /source/)
    assert.match(error.detail, /evidence/)
  })

  it('rejects an empty focus rather than resolving it', () => {
    rejects({ focus: '' }, 400)
  })

  it('rejects a repeated focus instead of picking one', () => {
    rejects({ focus: ['a', 'b'] }, 400)
  })

  it('rejects a path fragment that reached focus by mistake', () => {
    rejects({ focus: 'jesus-was-a-zionist/2' }, 400)
  })

  it('rejects an uppercase slug, which would never match the stored vocabulary', () => {
    rejects({ focus: 'Jesus-Was-A-Zionist' }, 400)
  })

  it('rejects a non-uuid, non-slug scalar', () => {
    rejects({ focus: 'DROP TABLE cards' }, 400)
  })
})

describe('view', () => {
  it('defaults to the v1 projection', () => {
    const parsed = parseGraphQuery({ focus: 'card-1' })
    assert.equal(parsed.view.name, 'card-argument-taxonomy')
    assert.equal(parsed.view.status, 'implemented')
  })

  it('accepts a registered view', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1', view: 'taxonomy' }).view.name, 'taxonomy')
  })

  it('rejects an unknown view instead of silently falling back', () => {
    const error = rejects({ focus: 'card-1', view: 'everything' }, 400)
    assert.match(error.detail, /unknown view "everything"/)
    // The message names the alternatives, so a caller can correct itself without docs.
    assert.match(error.detail, /card-argument-taxonomy/)
  })

  it('treats an empty view as absent, not as an unknown name', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1', view: '' }).view.name, 'card-argument-taxonomy')
  })
})

describe('depth', () => {
  it('defaults to the immediate neighbourhood', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1' }).depth, DEFAULT_DEPTH)
  })

  it('accepts the documented bounds, including 0', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1', depth: '0' }).depth, 0)
    assert.equal(
      parseGraphQuery({ focus: 'card-1', depth: String(HARD_MAX_DEPTH) }).depth,
      HARD_MAX_DEPTH,
    )
  })

  it('rejects a non-integer depth as malformed', () => {
    rejects({ focus: 'card-1', depth: '1.5' }, 400)
    rejects({ focus: 'card-1', depth: 'deep' }, 400)
  })

  it('rejects a negative depth as malformed rather than over-cap', () => {
    rejects({ focus: 'card-1', depth: '-1' }, 400)
  })

  it('rejects a depth above the hard cap with 413, not 400', () => {
    const error = rejects({ focus: 'card-1', depth: String(HARD_MAX_DEPTH + 1) }, 413)
    assert.match(error.detail, /hard cap/)
  })

  it('rejects a depth above the view max with 413', () => {
    // v1's own `maxDepth` equals the global hard cap, so the hard-cap message is the one a
    // caller sees today. The per-view branch exists for a future view with a tighter limit,
    // and both paths must stay 413 rather than 400: exceeding a limit is unattainable, not
    // malformed.
    const error = rejects({ focus: 'card-1', depth: '9' }, 413)
    assert.match(error.detail, /hard cap/)
    assert.equal(error.status, 413)
  })
})

describe('maxNodes', () => {
  it('defaults to 200', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1' }).maxNodes, DEFAULT_MAX_NODES)
    assert.equal(DEFAULT_MAX_NODES, 200)
  })

  it('accepts a cap up to the hard limit', () => {
    assert.equal(
      parseGraphQuery({ focus: 'card-1', maxNodes: String(HARD_MAX_NODES) }).maxNodes,
      HARD_MAX_NODES,
    )
    assert.equal(HARD_MAX_NODES, 500)
  })

  it('rejects a cap above the hard limit with 413', () => {
    rejects({ focus: 'card-1', maxNodes: String(HARD_MAX_NODES + 1) }, 413)
  })

  it('rejects a zero or negative cap as malformed', () => {
    rejects({ focus: 'card-1', maxNodes: '0' }, 400)
    rejects({ focus: 'card-1', maxNodes: '-5' }, 400)
  })
})

describe('include', () => {
  it('narrows to a subset of the view node types', () => {
    const parsed = parseGraphQuery({
      focus: 'card-1',
      include: 'claim,inference_step',
    })
    assert.deepEqual(parsed.includeNodeTypes, ['claim', 'inference_step'])
  })

  it('is absent when unset', () => {
    assert.equal(parseGraphQuery({ focus: 'card-1' }).includeNodeTypes, undefined)
  })

  it('rejects an unknown node type', () => {
    const error = rejects({ focus: 'card-1', include: 'suit' }, 400)
    assert.match(error.detail, /unknown node type\(s\): suit/)
  })

  it('refuses to widen the view', () => {
    // The dangerous case: asking for a node type the view cannot emit would either be silently
    // ignored, leaving the caller with a smaller graph than requested, or would require the
    // projection to invent nodes it has no rows for. `evidence_item` is excluded by scope
    // (empty evidence layer), so it is the widening request the default view still refuses —
    // `source` no longer is: the default view emits attribution sources.
    const error = rejects({ focus: 'card-1', include: 'evidence_item' }, 400)
    assert.match(error.detail, /cannot emit/)
    assert.match(error.detail, /narrows a view/)
  })

  it('refuses a node type the view excludes even if the model declares it', () => {
    rejects({ focus: 'card-1', include: 'concept' }, 400)
  })
})

describe('relationship', () => {
  it('accepts a bare relation word', () => {
    assert.deepEqual(parseGraphQuery({ focus: 'card-1', relationship: 'SUPPORTS' }).includeEdgeTypes, [
      'SUPPORTS',
    ])
  })

  it('accepts a family-qualified relation word, normalised to upper case', () => {
    assert.deepEqual(
      parseGraphQuery({
        focus: 'card-1',
        relationship: 'claim_relation:SUPPORTS',
      }).includeEdgeTypes,
      ['CLAIM_RELATION:SUPPORTS'],
    )
  })

  it('accepts MEMBER_OF, the inference family word for step-to-chain membership', () => {
    // Slice 2's new edge. Without it in the vocabulary a client could see MEMBER_OF edges
    // it had no way to filter back to, and the unknown-word 400 would name a word the
    // projection itself emits.
    assert.deepEqual(
      parseGraphQuery({ focus: 'card-1', relationship: 'MEMBER_OF' })
        .includeEdgeTypes,
      ['MEMBER_OF'],
    )
    assert.deepEqual(
      parseGraphQuery({ focus: 'card-1', relationship: 'inference:MEMBER_OF' })
        .includeEdgeTypes,
      ['INFERENCE:MEMBER_OF'],
    )
  })

  it('normalises case, because relation words are enums', () => {
    assert.deepEqual(
      parseGraphQuery({ focus: 'card-1', relationship: 'supports' }).includeEdgeTypes,
      ['SUPPORTS'],
    )
    assert.deepEqual(
      parseGraphQuery({ focus: 'card-1', relationship: 'Claim_Relation:supports' }).includeEdgeTypes,
      ['CLAIM_RELATION:SUPPORTS'],
    )
  })

  it('accepts a comma-separated list and repeated parameters alike', () => {
    const comma = parseGraphQuery({ focus: 'card-1', relationship: 'SUPPORTS,CHALLENGES' })
    const repeated = parseGraphQuery({ focus: 'card-1', relationship: ['SUPPORTS', 'CHALLENGES'] })
    assert.deepEqual(comma.includeEdgeTypes, repeated.includeEdgeTypes)
  })

  it('rejects an unknown relation word and lists the known ones', () => {
    const error = rejects({ focus: 'card-1', relationship: 'REFUTES' }, 400)
    assert.match(error.detail, /unknown edge type\(s\): REFUTES/)
    assert.match(error.detail, /SUPPORTS/)
  })

  it('rejects an unknown family', () => {
    rejects({ focus: 'card-1', relationship: 'vibes:SUPPORTS' }, 400)
  })

  it('rejects a family-qualified entry that names no relation', () => {
    const error = rejects({ focus: 'card-1', relationship: 'claim_relation:' }, 400)
    assert.match(error.detail, /names no relation/)
  })

  it('offers every family the model defines, so the two SUPPORTS vocabularies stay distinct', () => {
    // This is the Q1 guardrail at the API surface: a caller who asks for the authored claim
    // relation must not be handed the card-relationship edge that shares the word.
    const authored = parseGraphQuery({
      focus: 'card-1',
      relationship: 'claim_relation:SUPPORTS',
    })
    assert.deepEqual(authored.includeEdgeTypes, ['CLAIM_RELATION:SUPPORTS'])
    assert.notEqual(
      authored.includeEdgeTypes?.[0],
      'CARD_RELATIONSHIP:SUPPORTS',
      'the two families must not normalise to the same key',
    )
  })
})

describe('parseSearchQuery', () => {
  it('trims the term and preserves inner spacing and case', () => {
    const parsed = parseSearchQuery({ q: '  Blood Libel  ' })
    assert.equal(parsed.query, 'Blood Libel')
  })

  it('defaults the limit to 10', () => {
    assert.equal(parseSearchQuery({ q: 'zion' }).limit, 10)
  })

  it('clamps a large limit to the result cap instead of rejecting it', () => {
    assert.equal(parseSearchQuery({ q: 'zion', limit: '500' }).limit, 50)
  })

  it('rejects a missing term', () => {
    assert.throws(
      () => parseSearchQuery({}),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects an empty or single-character term', () => {
    for (const q of ['', '  ', 'x']) {
      assert.throws(
        () => parseSearchQuery({ q }),
        (error: unknown) =>
          error instanceof GraphQueryError && error.status === 400,
      )
    }
  })

  it('rejects a repeated term instead of picking one', () => {
    assert.throws(
      () => parseSearchQuery({ q: ['blood', 'libel'] }),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects an over-long term', () => {
    assert.throws(
      () => parseSearchQuery({ q: 'a'.repeat(201) }),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects a control-character-bearing term', () => {
    assert.throws(
      () => parseSearchQuery({ q: 'blood\u0000libel' }),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects a non-integer limit', () => {
    assert.throws(
      () => parseSearchQuery({ q: 'zion', limit: 'many' }),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })
})

describe('parseListQuery', () => {
  /** Assert a query parses to the expected limit, offset and filters. */
  function expectList(
    query: Record<string, unknown>,
    filters: readonly string[],
    expected: { limit: number; offset: number; filters?: Record<string, string> },
  ) {
    const parsed = parseListQuery(query, filters)
    assert.equal(parsed.limit, expected.limit)
    assert.equal(parsed.offset, expected.offset)
    if (expected.filters) {
      assert.deepEqual(parsed.filters, expected.filters)
    } else {
      assert.equal(parsed.filters, null)
    }
  }

  it('defaults to limit 50 and offset 0 with no filters', () => {
    expectList({}, [], { limit: 50, offset: 0 })
  })

  it('accepts a numeric limit and offset', () => {
    expectList({ limit: '25', offset: '50' }, [], { limit: 25, offset: 50 })
  })

  it('clamps an oversized limit rather than rejecting a page-size knob', () => {
    expectList({ limit: '100000' }, [], { limit: 200, offset: 0 })
  })

  it('clamps an absurd offset to the paging ceiling', () => {
    expectList({ offset: '999999999' }, [], { limit: 50, offset: 10_000 })
  })

  it('keeps a dimension-qualified filter', () => {
    expectList(
      { locale: 'south-africa' },
      ['locale'],
      { limit: 50, offset: 0, filters: { locale: 'south-africa' } },
    )
  })

  it('is null-filtered when no filter parameter is present', () => {
    expectList({ limit: '5' }, ['locale'], { limit: 5, offset: 0 })
  })

  it('rejects a filter the route never advertised', () => {
    assert.throws(
      () => parseListQuery({ collection: 'zionism' }, ['locale']),
      (error: unknown) =>
        error instanceof GraphQueryError &&
        error.status === 400 &&
        error.detail.includes('unknown parameter "collection"'),
    )
  })

  it('rejects a repeated filter', () => {
    assert.throws(
      () => parseListQuery({ locale: ['a', 'b'] }, ['locale']),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects a filter value that is not a slug', () => {
    for (const locale of ['South Africa', 'south africa', '', '  ', '../../etc']) {
      assert.throws(
        () => parseListQuery({ locale }, ['locale']),
        (error: unknown) =>
          error instanceof GraphQueryError && error.status === 400,
        `locale "${locale}" must be rejected`,
      )
    }
  })

  it('rejects a repeated limit or offset instead of picking one', () => {
    assert.throws(
      () => parseListQuery({ limit: ['1', '2'] }, []),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
    assert.throws(
      () => parseListQuery({ offset: ['0', '1'] }, []),
      (error: unknown) =>
        error instanceof GraphQueryError && error.status === 400,
    )
  })

  it('rejects a negative or non-numeric paging value', () => {
    for (const query of [
      { offset: '-1' },
      { limit: '-1' },
      { limit: 'many' },
      { offset: '1.5' },
    ]) {
      assert.throws(
        () => parseListQuery(query, []),
        (error: unknown) =>
          error instanceof GraphQueryError && error.status === 400,
        `${JSON.stringify(query)} must be rejected`,
      )
    }
  })

  it('treats an empty-string paging value as absent', () => {
    expectList({ limit: '', offset: '' }, [], { limit: 50, offset: 0 })
  })
})

describe('view registry helpers', () => {
  it('agrees with the v1 rule about which families and node types it emits', () => {
    const view = parseGraphQuery({ focus: 'card-1' }).view
    assert.ok(viewTraversesFamily(view, 'claim_relation'))
    assert.ok(viewTraversesFamily(view, 'inference'))
    assert.ok(!viewTraversesFamily(view, 'classification') === false)
    assert.ok(viewEmitsNodeType(view, 'card'))
    assert.ok(!viewEmitsNodeType(view, 'concept'))
    assert.ok(!viewEmitsNodeType(view, 'argument_chain'))
  })
})

describe('describeViews', () => {
  const populated: ViewPopulation = {
    cards: 47,
    claims: 19,
    inferenceSteps: 4,
    relationships: 11,
    collections: 12,
    mechanisms: 20,
    concepts: 6,
    cardConcepts: 0,
    locales: 1,
    cardLocales: 7,
    // The live corpus: 3 bibliography rows behind the 6 `claim_sources` attributions, so a
    // view declaring `source` reports no gap. The evidence layer stays at 0 on purpose.
    sources: 3,
    evidenceItems: 0,
    cases: 0,
    interpretations: 0,
    questions: 0,
    argumentChains: 2,
    claimRelations: 0,
    claimSources: 6,
  }

  it('reports every registered view with its rules', () => {
    const described = describeViews(populated)
    assert.ok(described.views.length >= 5)
    const v1 = described.views.find((v) => v.name === 'card-argument-taxonomy')
    assert.ok(v1, 'the v1 view must be described')
    assert.equal(v1.status, 'implemented')
    assert.equal(v1.maxDepth, 3)
    assert.ok(v1.nonNodeStructures.length > 0)
    assert.ok(v1.excludedNodeTypes.some((e) => e.type === 'concept'))
  })

  it('marks the evidence view unpopulated instead of hiding it', () => {
    const described = describeViews(populated)
    const evidence = described.views.find((v) => v.name.includes('evidence'))
    assert.ok(evidence, 'the evidence view must still be listed')
    assert.equal(evidence.status, 'data_blocked')
    assert.equal(evidence.populated, false)
  })

  it('reports argument as implemented and populated, now that chains are nodes', () => {
    const described = describeViews(populated)
    const argument = described.views.find((v) => v.name === 'argument')
    assert.ok(argument, 'the argument view must be listed')
    assert.equal(argument.status, 'implemented')
    assert.deepEqual(argument.blockingGaps, [])
    assert.equal(argument.populated, true)
  })

  it('names the table behind each blocking gap, so the gap points at a corpus task', () => {
    const described = describeViews(populated)
    const evidence = described.views.find((v) => v.name.includes('evidence'))!
    assert.ok(
      evidence.blockingGaps.some((g) => g.includes('trope_graph.evidence_items')),
      `expected a gap naming evidence_items, got ${JSON.stringify(evidence.blockingGaps)}`,
    )
  })

  it('reports the live counts it was given rather than recomputing them', () => {
    const described = describeViews(populated)
    assert.equal(described.population.cards, 47)
    assert.equal(described.population.claimRelations, 0)
  })

  it('does not mark v1 unpopulated, because every layer it emits has rows', async () => {
    const reader = new FakeGraphReader(richCorpus())
    const described = describeViews(await reader.readPopulation())
    const v1 = described.views.find((v) => v.name === 'card-argument-taxonomy')!
    assert.deepEqual(v1.blockingGaps, [])
    assert.equal(v1.populated, true)
  })

  it('describes the taxonomy view as accepting only the focus the projection resolves', () => {
    // `/api/graph/views` serves focusTypes as authoritative client metadata, so it must not
    // advertise focus paths `projectGraph` cannot resolve: taxonomy declares only `card`,
    // and a claim/chain uuid or a mechanism/collection ref 404s against it — focus resolution
    // spans card, claim and argument chain, but `focusTypes` narrows what a view accepts.
    const taxonomy = describeViews(populated).views.find(
      (v) => v.name === 'taxonomy',
    )!
    assert.deepEqual(taxonomy.focusTypes, ['card'])
  })
})
