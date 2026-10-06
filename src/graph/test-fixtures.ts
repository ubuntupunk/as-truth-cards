/**
 * Shared hand-built fixtures for the `src/graph/*.test.tsx` suite.
 *
 * These are *wire-shaped* fixtures: they are built as plain JSON-able objects
 * with the exact `{ nodes, edges, meta }` envelope of `GET /api/graph`, so the
 * guard tests can round-trip them through `JSON.parse(JSON.stringify(…))` and
 * prove both the fixture and the contract at once. `assertGraphProjection`
 * passing over every fixture is the vacuous guard that pins the fixtures to
 * the real wire shape — when the server contract changes, the fixtures stop
 * compiling or the guard starts failing here, in the UI suite that is supposed
 * to catch it.
 *
 * The graph models the issue-#3 boundary cases on purpose:
 *
 * - `south-africa` names **both** a Suit and a Locale, with distinct ids — the
 *   inspector must render them as separate facets.
 * - `SUPPORTS` appears as a `claim_relation` edge *and* as a
 *   `card_relationship` edge — the edge panel must keep them in separate
 *   families with notation.
 * - Classification covers all five facets (Axis, Suit, Locale, Mechanism,
 *   Concept), with Concept read only via its `HAS_CONCEPT` edge.
 * - All twelve node types are present so every `MetadataSections` branch and
 *   the focused rel/status rendering are exercised against real enum values.
 */

import type {
  CardNode,
  EpistemicStatusValue,
  GraphNode,
  GraphProjection,
  GraphProjectionMeta,
} from '../../trope-cards/src/graph/types.ts'
import type {
  GraphViewDescriptor,
  GraphViewsResponse,
} from './projection-guards'

/** Canonical ids every test file refers to, so assertions read as prose. */
export const ID = {
  focusCard: 'bf000000-0000-0000-0000-000000000001',
  cardTwo: 'bf000000-0000-0000-0000-000000000002',
  claimOne: 'bf000000-0000-0000-0000-000000000011',
  claimTwo: 'bf000000-0000-0000-0000-000000000012',
  stepOne: 'bf000000-0000-0000-0000-000000000021',
  stepTwo: 'bf000000-0000-0000-0000-000000000022',
  chainOne: 'bf000000-0000-0000-0000-000000000031',
  suitSouthAfrica: 'bf000000-0000-0000-0000-000000000041',
  mechanismRec: 'bf000000-0000-0000-0000-000000000051',
  conceptX: 'bf000000-0000-0000-0000-000000000061',
  sourceS: 'bf000000-0000-0000-0000-000000000071',
  evidenceE: 'bf000000-0000-0000-0000-000000000081',
  caseC: 'bf000000-0000-0000-0000-000000000091',
  interpretationI: 'bf000000-0000-0000-0000-0000000000a1',
  questionQ: 'bf000000-0000-0000-0000-0000000000b1',
} as const

/** Epistemic-status node status helper (cards, claims, interpretations). */
function epistemic(value: EpistemicStatusValue): {
  readonly source: 'epistemic_status'
  readonly value: EpistemicStatusValue
} {
  return { source: 'epistemic_status', value }
}

/** The focus card, arranged to hit every facet branch. */
export const FOCUS_CARD_NODE: CardNode = {
  id: ID.focusCard,
  type: 'card',
  label: 'Jesus was a Zionist',
  depth: 0,
  isFocus: true,
  degree: 6,
  status: epistemic('ESTABLISHED'),
  classification: {
    axes: [
      { axis: 'TACTIC', ordinal: 0, primary: true },
      { axis: 'HISTORICAL', ordinal: 1, primary: false },
    ],
    suits: ['classic', 'south-africa'],
    suitIds: ['bf000000-0000-0000-0000-0000000000c1', ID.suitSouthAfrica],
    mechanismSlugs: ['recontextualization'],
    mechanismIds: [ID.mechanismRec],
    localeSlugs: ['south-africa'],
    localeIds: ['bf000000-0000-0000-0000-0000000000d1'],
  },
  metadata: {
    slug: 'jesus-was-a-zionist',
    summary: 'A card about a contested historical claim.',
    coreQuestion: 'Was Jesus a Zionist?',
    legacyPrimaryType: 'TACTIC',
    legacyPrimaryTypeIsAxis: false,
  },
}

/** Other-nodes, so `domain`/`card_relationship` logic has a second card. */
export const CARD_TWO_NODE: CardNode = {
  id: ID.cardTwo,
  type: 'card',
  label: 'The Judean People’s Front',
  depth: 1,
  isFocus: false,
  degree: 1,
  status: epistemic('CONTESTED'),
  classification: {
    axes: [{ axis: 'TACTIC', ordinal: 0, primary: true }],
    suits: [],
    suitIds: [],
    mechanismSlugs: [],
    mechanismIds: [],
    localeSlugs: [],
    localeIds: [],
  },
  metadata: {
    slug: 'the-judean-peoples-front',
    summary: null,
    coreQuestion: null,
    legacyPrimaryType: 'CASE',
    legacyPrimaryTypeIsAxis: false,
  },
}

/** The twelve node types, ending with the five schema-only singletons. */
export const PROJECTION_NODES: readonly GraphNode[] = [
  FOCUS_CARD_NODE,
  CARD_TWO_NODE,
  {
    id: ID.claimOne,
    type: 'claim',
    label: 'Jesus was born in Bethlehem',
    depth: 1,
    isFocus: false,
    degree: 3,
    status: epistemic('ESTABLISHED'),
    metadata: {
      claimType: 'HISTORICAL',
      description: 'An attested historical claim.',
      cardId: ID.focusCard,
    },
  },
  {
    id: ID.claimTwo,
    type: 'claim',
    label: 'Zionism is a modern movement',
    depth: 2,
    isFocus: false,
    degree: 3,
    status: epistemic('CONTESTED'),
    metadata: {
      claimType: 'THEOLOGICAL',
      description: 'A contested assertion.',
      cardId: ID.focusCard,
    },
  },
  {
    id: ID.stepOne,
    type: 'inference_step',
    label: 'Step: premise to conclusion',
    depth: 2,
    isFocus: false,
    degree: 3,
    status: {
      source: 'independent_inference_status',
      value: 'draft',
      vocabulary: 'uncontrolled',
    },
    metadata: {
      description: 'Bridges the two claims.',
      inferenceType: 'DEDUCTIVE',
      notes: null,
      isCanonical: true,
      cardId: ID.focusCard,
      chains: [
        {
          id: ID.chainOne,
          label: 'The main argument',
          kind: 'PRIMARY_ARGUMENT',
          role: 'MAIN',
          ordinal: 0,
          membershipSource: 'argument_chain_steps',
        },
      ],
      premises: [{ claimId: ID.claimOne, role: 'PRIMARY', ordinal: 0 }],
      conclusions: [{ claimId: ID.claimTwo, ordinal: 0 }],
    },
  },
  {
    id: ID.stepTwo,
    type: 'inference_step',
    label: 'Counter-step',
    depth: 3,
    isFocus: false,
    degree: 1,
    status: {
      source: 'independent_inference_status',
      value: 'UNSUPPORTED',
      vocabulary: 'uncontrolled',
    },
    metadata: {
      description: 'Challenges the conclusion.',
      inferenceType: 'ANALOGICAL',
      notes: 'Parallel debate.',
      isCanonical: false,
      cardId: ID.focusCard,
      chains: [],
      premises: [],
      conclusions: [],
    },
  },
  {
    id: ID.chainOne,
    type: 'argument_chain',
    label: 'The main argument',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: {
      source: 'independent_inference_status',
      value: 'reviewed',
      vocabulary: 'uncontrolled',
    },
    metadata: {
      label: 'The main argument',
      description: 'The canonical reconstruction.',
      kind: 'PRIMARY_ARGUMENT',
      cardId: ID.focusCard,
      stepIds: [ID.stepOne],
    },
  },
  {
    id: ID.suitSouthAfrica,
    type: 'collection',
    label: 'South Africa',
    depth: 1,
    isFocus: false,
    degree: 1,
    status: { source: 'none', value: null },
    metadata: {
      slug: 'south-africa',
      description: 'Cards about the South Africa trope.',
      definition: null,
    },
  },
  {
    id: ID.mechanismRec,
    type: 'mechanism',
    label: 'Recontextualization',
    depth: 1,
    isFocus: false,
    degree: 1,
    status: { source: 'none', value: null },
    metadata: {
      slug: 'recontextualization',
      description: 'The move of lifting a statement into a new context.',
      definition: null,
    },
  },
  {
    id: ID.conceptX,
    type: 'concept',
    label: 'Modern recontextualization',
    depth: 1,
    isFocus: false,
    degree: 1,
    status: { source: 'none', value: null },
    metadata: {
      slug: 'modern-recontextualization',
      description: null,
      definition: 'Applying contemporary framing to historical material.',
    },
  },
  {
    id: ID.sourceS,
    type: 'source',
    label: 'A primary source',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: { source: 'none', value: null },
    metadata: {
      title: 'A primary source',
      author: 'A. Author',
      publisher: 'A Press',
      citation: 'A. Author, A primary source (A Press, 2026).',
      url: 'https://example.test/source',
      sourceType: 'PRIMARY_DOCUMENT',
    },
  },
  {
    id: ID.evidenceE,
    type: 'evidence_item',
    label: 'An evidence item',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: {
      source: 'evidence_status',
      value: 'strong',
      vocabulary: 'uncontrolled',
    },
    metadata: {
      evidenceType: 'ARCHIVE',
      locator: 'Box 4',
      quoteOrExcerpt: 'A quote',
      strength: 'strong',
    },
  },
  {
    id: ID.caseC,
    type: 'case',
    label: 'A case',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: {
      source: 'lifecycle_status',
      value: 'ACTIVE',
      vocabulary: 'case_status',
    },
    metadata: {
      title: 'A case',
      description: 'A litigated example.',
      dateStart: '2020-01-01',
      dateEnd: '2021-01-01',
      location: 'South Africa',
    },
  },
  {
    id: ID.interpretationI,
    type: 'interpretation',
    label: 'An interpretation',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: epistemic('OPEN'),
    metadata: {
      title: 'An interpretation',
      description: 'An alternative reading.',
      cardId: ID.focusCard,
    },
  },
  {
    id: ID.questionQ,
    type: 'question',
    label: 'An open question',
    depth: 3,
    isFocus: false,
    degree: 0,
    status: {
      source: 'lifecycle_status',
      value: 'OPEN',
      vocabulary: 'question_status',
    },
    metadata: {
      question: 'An open question',
      description: 'Still being researched.',
    },
  },
]

/**
 * The edge set, built with the same `${family}|${from}|${type}|${to}` composite
 * the server's `buildEdgeId` produces, so ids carry the family in them.
 */
export const PROJECTION_EDGES: GraphProjection['edges'] = [
  {
    id: 'domain|bf000000-0000-0000-0000-000000000001|ASSERTS|bf000000-0000-0000-0000-000000000011',
    family: 'domain',
    type: { family: 'domain', value: 'ASSERTS' },
    sourceTable: 'claims',
    from: ID.focusCard,
    to: ID.claimOne,
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'domain|bf000000-0000-0000-0000-000000000001|ASSERTS|bf000000-0000-0000-0000-000000000012',
    family: 'domain',
    type: { family: 'domain', value: 'ASSERTS' },
    sourceTable: 'claims',
    from: ID.focusCard,
    to: ID.claimTwo,
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'claim_relation|bf000000-0000-0000-0000-000000000011|SUPPORTS|bf000000-0000-0000-0000-000000000012',
    family: 'claim_relation',
    type: { family: 'claim_relation', value: 'SUPPORTS' },
    sourceTable: 'claim_relations',
    from: ID.claimOne,
    to: ID.claimTwo,
    attributes: {},
    traversal: 'bidirectional',
  },
  {
    id: 'inference|bf000000-0000-0000-0000-000000000011|PREMISE_OF|bf000000-0000-0000-0000-000000000021',
    family: 'inference',
    type: { family: 'inference', value: 'PREMISE_OF' },
    sourceTable: 'inference_premises',
    from: ID.claimOne,
    to: ID.stepOne,
    attributes: { role: 'PRIMARY', ordinal: 0 },
    traversal: 'bidirectional',
  },
  {
    id: 'inference|bf000000-0000-0000-0000-000000000021|CONCLUDES|bf000000-0000-0000-0000-000000000012',
    family: 'inference',
    type: { family: 'inference', value: 'CONCLUDES' },
    sourceTable: 'inference_conclusions',
    from: ID.stepOne,
    to: ID.claimTwo,
    attributes: { ordinal: 0 },
    traversal: 'bidirectional',
  },
  {
    id: 'inference|bf000000-0000-0000-0000-000000000021|CHALLENGES|bf000000-0000-0000-0000-000000000022',
    family: 'inference',
    type: {
      family: 'inference',
      value: 'CHALLENGES',
      vocabulary: 'inference_step_relation_type',
    },
    sourceTable: 'inference_step_relations',
    from: ID.stepOne,
    to: ID.stepTwo,
    attributes: {},
    traversal: 'bidirectional',
  },
  {
    id: 'classification|bf000000-0000-0000-0000-000000000001|IN_SUIT|bf000000-0000-0000-0000-000000000041',
    family: 'classification',
    type: { family: 'classification', value: 'IN_SUIT' },
    sourceTable: 'card_collections',
    from: ID.focusCard,
    to: ID.suitSouthAfrica,
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'classification|bf000000-0000-0000-0000-000000000001|HAS_MECHANISM|bf000000-0000-0000-0000-000000000051',
    family: 'classification',
    type: { family: 'classification', value: 'HAS_MECHANISM' },
    sourceTable: 'card_mechanisms',
    from: ID.focusCard,
    to: ID.mechanismRec,
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'classification|bf000000-0000-0000-0000-000000000001|HAS_CONCEPT|bf000000-0000-0000-0000-000000000061',
    family: 'classification',
    type: { family: 'classification', value: 'HAS_CONCEPT' },
    sourceTable: 'card_concepts',
    from: ID.focusCard,
    to: ID.conceptX,
    attributes: {},
    traversal: 'directed',
  },
  {
    id: 'card_relationship|bf000000-0000-0000-0000-000000000001|SUPPORTS|bf000000-0000-0000-0000-000000000002',
    family: 'card_relationship',
    type: { family: 'card_relationship', value: 'SUPPORTS' },
    sourceTable: 'relationships',
    from: ID.focusCard,
    to: ID.cardTwo,
    attributes: { status: 'CANONICAL' },
    traversal: 'directed',
  },
]

/** The rich, fully-populated projection. */
export const CARD_PROJECTION: GraphProjection = {
  focus: { id: ID.focusCard, type: 'card', slug: 'jesus-was-a-zionist' },
  view: 'card-argument-taxonomy',
  depth: 3,
  nodes: PROJECTION_NODES,
  edges: PROJECTION_EDGES,
  meta: {
    nodeCount: PROJECTION_NODES.length,
    edgeCount: PROJECTION_EDGES.length,
    truncated: false,
    maxNodes: 1000,
    reachedDepth: 3,
    warnings: [],
  },
}

/** Meta-returning helper for the truncated variant. */
function withMeta(
  projection: GraphProjection,
  meta: Partial<GraphProjectionMeta>,
): GraphProjection {
  return { ...projection, meta: { ...projection.meta, ...meta } }
}

/** Same valid projection, but truncated at the cap before depth was exhausted. */
export const TRUNCATED_PROJECTION: GraphProjection = withMeta(CARD_PROJECTION, {
  truncated: true,
  maxNodes: 3,
  reachedDepth: 2,
  nodeCount: 3,
})

/** A valid projection that is entirely unpopulated: one warning, zero nodes. */
export const EMPTY_PROJECTION: GraphProjection = {
  focus: { id: ID.focusCard, type: 'card', slug: 'jesus-was-a-zionist' },
  view: 'taxonomy',
  depth: 1,
  nodes: [],
  edges: [],
  meta: {
    nodeCount: 0,
    edgeCount: 0,
    truncated: false,
    maxNodes: 1000,
    reachedDepth: 0,
    warnings: ['No card_axes rows found for this focus'],
  },
}

/** A family-friendly projection: only the focus node, no edges. */
export const SPARSE_PROJECTION: GraphProjection = {
  focus: { id: ID.focusCard, type: 'card', slug: 'jesus-was-a-zionist' },
  view: 'card-argument-taxonomy',
  depth: 0,
  nodes: [FOCUS_CARD_NODE],
  edges: [],
  meta: {
    nodeCount: 1,
    edgeCount: 0,
    truncated: false,
    maxNodes: 1000,
    reachedDepth: 0,
    warnings: ['Projection reduced by rules'],
  },
}

/** The views catalogue, mirroring `describeViews`'s payload shape. */
export const VIEWS_RESPONSE: GraphViewsResponse = {
  views: [
    {
      name: 'card-argument-taxonomy',
      description:
        'Card assertion, claim relations, inference steps, and classification facets.',
      status: 'implemented',
      focusTypes: ['card'],
      nodeTypes: [
        'card',
        'claim',
        'inference_step',
        'argument_chain',
        'collection',
        'mechanism',
        'concept',
        'source',
        'evidence_item',
        'case',
        'interpretation',
        'question',
      ],
      edgeFamilies: [
        'domain',
        'claim_relation',
        'inference',
        'card_relationship',
        'classification',
      ],
      excludedNodeTypes: [{ type: 'source', reason: '0 rows in sources' }],
      nonNodeStructures: [],
      maxDepth: 3,
      populated: true,
      blockingGaps: [],
    },
    {
      name: 'taxonomy',
      description: 'Browse/analytical facets only.',
      status: 'not-implemented',
      focusTypes: ['card', 'collection', 'mechanism', 'concept'],
      nodeTypes: ['card', 'collection', 'mechanism', 'concept'],
      edgeFamilies: ['classification'],
      excludedNodeTypes: [],
      nonNodeStructures: [],
      maxDepth: 3,
      populated: false,
      blockingGaps: ['mechanismTagging', 'conceptRows'],
    },
  ],
  population: {
    'card-argument-taxonomy': 47,
    taxonomy: 0,
  },
}

/**
 * A single descriptor, so legend/stylesheet tests don't reach into the
 * catalogue fixture. `satisfies` keeps it honest against the contract.
 */
export const DESCRIPTOR: GraphViewDescriptor = VIEWS_RESPONSE.views[0]
