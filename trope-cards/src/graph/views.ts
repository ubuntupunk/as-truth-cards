/**
 * The projection view registry.
 *
 * A view is not a different ontology and not a different model. It is a different set of
 * adjacency rules over the same `trope_graph` tables — which node types may appear, which
 * edge families may be followed, and what a `focus` of a given type means in it
 * (`docs/GRAPH_PROJECTION_DESIGN.md` §7, `docs/ADR_GRAPH_LAYER.md` §6).
 *
 * That is also the answer to Q9. `depth` is a hop count *within the selected view's* rules,
 * so taxonomy depth and argument depth never interfere: a request for `view=argument`
 * traverses claim/inference transitions only and cannot wander into a Suit facet, and a
 * request for `view=taxonomy` cannot inflate its depth by walking argument structure. There
 * is deliberately no ontology-wide adjacency graph that depth could be measured against.
 */

import type { EdgeFamily, GraphNodeType } from './types'

/**
 * How far along the implementation sequence a view is.
 *
 * `implemented` means the projection service can produce it today. `designed` means the
 * adjacency rules are settled but a data or scope decision is outstanding. `data_blocked`
 * means the rules are settled and the schema exists, but the corpus has no rows yet — these
 * return `200` with an empty node set and a warning, never an error.
 */
export type GraphViewStatus = 'implemented' | 'designed' | 'data_blocked'

/** A node type the model knows about but this view will not emit, with the reason. */
export type ExcludedNodeType = {
  readonly type: GraphNodeType
  readonly reason: string
}

/**
 * A canonical structure that is deliberately not a node.
 *
 * Kept separate from {@link ExcludedNodeType} because these are not node types the view
 * chose to skip — they were never entity-shaped. `relationships` is a table of edges, and
 * modelling it as a node would invent an entity the ontology does not have, which is the
 * `ADR_GRAPH_LAYER.md` §12 guardrail in reverse.
 */
export type NonNodeStructure = {
  readonly structure: string
  readonly reason: string
}

/**
 * The adjacency rules for one view.
 */
export type GraphViewRule = {
  readonly name: string
  readonly description: string
  readonly status: GraphViewStatus
  /** Node types accepted as `focus`. Anything else is a 404 under §5.3 of the design doc. */
  readonly focusTypes: readonly GraphNodeType[]
  /** Node types this view may emit. */
  readonly nodeTypes: readonly GraphNodeType[]
  /** Edge families traversal may follow. */
  readonly edgeFamilies: readonly EdgeFamily[]
  /** Known node types deliberately not emitted, and why. */
  readonly excludedNodeTypes: readonly ExcludedNodeType[]
  /** Canonical structures that are edges or attributes rather than entities, and why. */
  readonly nonNodeStructures: readonly NonNodeStructure[]
  /** Maximum `depth` for this view, independently of the global cap. */
  readonly maxDepth: number
}

const CARD_ARGUMENT_TAXONOMY: GraphViewRule = {
  name: 'card-argument-taxonomy',
  description:
    'The first projection: a card with its Suits, Mechanisms, ordered Axis, asserted Claims, ' +
    'the reasoning steps bridging those claims, and its card-to-card relationships. Chosen ' +
    'because it is the only projection fully populated for all 47 cards while still ' +
    'deepening into real argument structure where it exists.',
  status: 'implemented',
  focusTypes: ['card'],
  nodeTypes: ['card', 'collection', 'mechanism', 'claim', 'inference_step'],
  edgeFamilies: [
    'domain',
    'classification',
    'claim_relation',
    'inference',
    'card_relationship',
  ],
  excludedNodeTypes: [
    {
      type: 'concept',
      reason:
        'A scope decision, not a data gap: card_concepts has 12 authored rows and the reader ' +
        'now projects them. This view is scoped by its own nodeTypes and description to Suit, ' +
        'Mechanism, Axis, Claim, step and card-to-card links, and it was chosen because it is ' +
        'the projection fully populated for all 47 cards — Concept reaches 8 of them, so ' +
        'admitting it here would make this view report an association for a minority of ' +
        'cards and silence for the rest, which is the asymmetry the view choice exists to ' +
        'avoid. The taxonomy view is the declared home for browse-and-classify structure and ' +
        'does emit Concept. Admitting Concept to this view later is a one-line nodeTypes ' +
        'change with no reader or ontology work outstanding.',
    },
    {
      type: 'argument_chain',
      reason:
        'Carried as grouping metadata on inference_step per issue #3 Q6. Becomes a node in ' +
        'the argument view, reading the same canonical rows.',
    },
    {
      type: 'source',
      reason: 'sources has 0 rows.',
    },
    {
      type: 'evidence_item',
      reason: 'All five evidence_* tables have 0 rows.',
    },
    {
      type: 'case',
      reason: 'cases, case_legal_metadata and card_cases have 0 rows.',
    },
    {
      type: 'interpretation',
      reason: 'interpretations and claim_interpretations have 0 rows.',
    },
    {
      type: 'question',
      reason: 'questions and its three link tables have 0 rows.',
    },
  ],
  nonNodeStructures: [
    {
      structure: 'relationships',
      reason:
        'A relationship is an edge, not an entity. Projected as card_relationship edges ' +
        'from the polymorphic relationships table, after the Q5 endpoint checks. Modelling ' +
        'it as a node would invent an entity the ontology does not have.',
    },
    {
      structure: 'cards.primary_type',
      reason:
        'Legacy, write-only content-shape classification. Reported as ' +
        'CardNodeMetadata.legacyPrimaryType and never used for axis (Issue #2, Q3).',
    },
    {
      structure: 'card_axes',
      reason:
        'An ordered attribute on the card node, not an edge. Axis has a closed enum ' +
        'vocabulary and one designated primary value per card, which an edge would lose.',
    },
  ],
  maxDepth: 3,
}

const TAXONOMY: GraphViewRule = {
  name: 'taxonomy',
  description:
    'Mechanism / Concept / Suit structure around a card, without argument depth. The ' +
    'browse-and-classify view.',
  status: 'designed',
  // Card only, matching what `projectGraph` can actually resolve today: focus always goes
  // through `findCardByRef`, so advertising `mechanism`/`collection` here would promise a
  // focus path the projection does not implement (mechanism focus 404s with
  // "no card matches this slug"). The descriptor is served to clients as authoritative
  // metadata by `/api/graph/views`, so it must describe the implementation that exists, not
  // the one that is designed. Mechanism/Collection focus is a deliberate future extension,
  // deferred with the rest of the not-yet-implemented focus paths.
  focusTypes: ['card'],
  nodeTypes: ['card', 'collection', 'mechanism', 'concept'],
  edgeFamilies: ['classification'],
  // Nothing excluded. Concept was the last holdout and it is now emitted: this view's own
  // description named "Mechanism / Concept / Suit structure" and its nodeTypes already listed
  // `concept`, so the contract said yes before the reader existed. No new view was invented and
  // no edge vocabulary was reused — Card -> Concept is `HAS_CONCEPT`, distinct from
  // `HAS_MECHANISM`, because the two tables have no cross-mapping.
  excludedNodeTypes: [],
  nonNodeStructures: [],
  maxDepth: 3,
}

const ARGUMENT: GraphViewRule = {
  name: 'argument',
  description:
    'Premise -> inference -> conclusion structure. Argument chains become first-class ' +
    'nodes here (issue #3 Q6) while remaining metadata on steps elsewhere, over the same ' +
    'canonical rows.',
  status: 'designed',
  focusTypes: ['card', 'claim', 'argument_chain'],
  nodeTypes: ['card', 'claim', 'inference_step', 'argument_chain'],
  edgeFamilies: ['domain', 'claim_relation', 'inference'],
  excludedNodeTypes: [
    {
      type: 'source',
      reason:
        'sources has 0 rows; the evidence view covers provenance once it lands.',
    },
    {
      type: 'evidence_item',
      reason: 'All five evidence_* tables have 0 rows.',
    },
  ],
  nonNodeStructures: [],
  maxDepth: 3,
}

const EVIDENCE: GraphViewRule = {
  name: 'evidence',
  description:
    'Claim -> evidence -> source provenance. Designed and wired, but the corpus is empty, ' +
    'so it returns an empty node set with a warning.',
  status: 'data_blocked',
  focusTypes: ['claim', 'source', 'evidence_item'],
  nodeTypes: ['claim', 'evidence_item', 'source', 'inference_step'],
  edgeFamilies: ['inference'],
  excludedNodeTypes: [
    {
      type: 'case',
      reason: 'Not part of the evidence path.',
    },
  ],
  nonNodeStructures: [],
  maxDepth: 3,
}

const IDENTITY_RETROJECTION: GraphViewRule = {
  name: 'identity-retrojection',
  description:
    'Historical subject -> evidence -> continuity claim -> modern identity -> retrospective ' +
    'mapping. The clustering that carries the only populated RETROSPECTIVE_IDENTITY and ' +
    'ANACHRONISTIC_MAPPING inference steps today.',
  status: 'designed',
  focusTypes: ['card', 'claim'],
  nodeTypes: ['card', 'claim', 'inference_step'],
  edgeFamilies: ['domain', 'claim_relation', 'inference'],
  excludedNodeTypes: [
    {
      type: 'source',
      reason: 'sources has 0 rows; will extend when provenance is populated.',
    },
  ],
  nonNodeStructures: [],
  maxDepth: 3,
}

/**
 * Every view, keyed by name.
 *
 * Insertion order is the order `/api/graph/views` reports. `card-argument-taxonomy` is
 * first because it is the default.
 */
export const GRAPH_VIEWS: ReadonlyMap<string, GraphViewRule> = new Map<
  string,
  GraphViewRule
>([
  [CARD_ARGUMENT_TAXONOMY.name, CARD_ARGUMENT_TAXONOMY],
  [TAXONOMY.name, TAXONOMY],
  [ARGUMENT.name, ARGUMENT],
  [EVIDENCE.name, EVIDENCE],
  [IDENTITY_RETROJECTION.name, IDENTITY_RETROJECTION],
])

/** The view used when `view` is omitted. */
export const DEFAULT_VIEW_NAME = CARD_ARGUMENT_TAXONOMY.name

/** Default `depth` when the parameter is omitted: the immediate neighbourhood. */
export const DEFAULT_DEPTH = 1

/** Soft node cap. Exceeding it truncates expansion and sets `meta.truncated`. */
export const DEFAULT_MAX_NODES = 200

/** Hard node cap. A request above this is rejected with 413 rather than silently clamped. */
export const HARD_MAX_NODES = 500

/** Hard depth cap across all views, per §5.1 of the design doc. */
export const HARD_MAX_DEPTH = 3

/**
 * Look up a view rule by name.
 *
 * @param name The requested view name.
 * @returns The rule, or `undefined` for an unknown name.
 * @example
 * ```ts
 * const rule = getGraphView("argument");
 * rule?.focusTypes; // ["card", "claim", "argument_chain"]
 * ```
 */
export function getGraphView(name: string): GraphViewRule | undefined {
  return GRAPH_VIEWS.get(name)
}

/**
 * Whether a view may be requested by name.
 *
 * Every registered view is requestable, including the `designed` and `data_blocked` ones. A
 * view whose data is not populated returns `200` with `nodes: []` and a warning; returning
 * 404 would make an unpopulated layer indistinguishable from a typo, and `data_blocked` is a
 * corpus state that will change without any code change.
 */
export function isGraphView(name: string): boolean {
  return GRAPH_VIEWS.has(name)
}

/**
 * Whether `type` may be emitted by `view`.
 *
 * @param view The view rule.
 * @param type The node type.
 */
export function viewEmitsNodeType(
  view: GraphViewRule,
  type: GraphNodeType,
): boolean {
  return view.nodeTypes.includes(type)
}

/**
 * Whether `family` may be traversed by `view`.
 *
 * @param view The view rule.
 * @param family The edge family.
 */
export function viewTraversesFamily(
  view: GraphViewRule,
  family: EdgeFamily,
): boolean {
  return view.edgeFamilies.includes(family)
}
