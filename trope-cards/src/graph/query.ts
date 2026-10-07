/**
 * Request parsing for `GET /api/graph`.
 *
 * Everything a client can ask for is validated here, before a query runs, and every rejection
 * carries the status code the design doc assigns it (`docs/GRAPH_PROJECTION_DESIGN.md` §5.3):
 *
 * - `400` — a malformed `focus`, `view`, `depth`, `include`, `relationship`, or `maxNodes`.
 * - `404` — `focus` resolves to nothing, or to an entity the requested view will not accept.
 * - `413` — `depth` or `maxNodes` above the hard cap.
 * - `200` with `nodes: []` and a `meta.warnings` entry — a structurally valid view whose corpus
 *   is not populated. Never an error, so an unpopulated layer stays distinguishable from a
 *   malformed request.
 *
 * Filters are subset allow-lists and never widen a view. `include=source` against the card view
 * is rejected rather than quietly returning a smaller graph, because a silent narrowing is how a
 * caller ends up believing it asked for provenance and got nothing.
 */

import { z } from 'zod'
import type { GraphEdgeType, GraphNodeType } from './types'
import type { GraphViewRule } from './views'
import {
  DEFAULT_DEPTH,
  DEFAULT_MAX_NODES,
  DEFAULT_VIEW_NAME,
  GRAPH_VIEWS,
  getGraphView,
  HARD_MAX_DEPTH,
  HARD_MAX_NODES,
  isGraphView,
  viewBlockingGaps,
} from './views'

/** Every node type a filter may name, taken from the model rather than restated. */
const NODE_TYPES = [
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
] as const satisfies readonly GraphNodeType[]

/** Every relation word a filter may name, across the model's seven edge vocabularies. */
const EDGE_TYPE_VALUES = [
  // domain
  'ASSERTS',
  // claim_relations
  'SUPPORTS',
  'CHALLENGES',
  'QUALIFIES',
  'CONTRADICTS',
  'CONTEXTUALISES',
  'EXEMPLIFIES',
  'REQUIRES',
  'GENERALISES',
  'EQUATES',
  'ANACHRONISTICALLY_MAPS',
  'RETROSPECTIVELY_IDENTIFIES',
  // classification
  'IN_SUIT',
  'HAS_MECHANISM',
  'HAS_CONCEPT',
  // inference
  'PREMISE_OF',
  'CONCLUDES',
  'MEMBER_OF',
  'ALTERNATIVE_TO',
  'DEPENDS_ON',
  'REFINES',
  // claim_sources.relationship (free text; seed vocabulary ATTRIBUTED_TO)
  'ATTRIBUTED_TO',
  'INFORMS',
  'CRITIQUES',
  // evidence_claims.relation
  'ILLUSTRATES',
  'REPORTS',
  'ATTRIBUTES',
  // evidence_sources.relation (default DERIVED_FROM)
  'DERIVED_FROM',
  // evidence_inferences.relation (default USED_BY)
  'USED_BY',
] as const

/** Edge families a filter may qualify a relation word with. */
const EDGE_FAMILIES = [
  'domain',
  'claim_relation',
  'inference',
  'card_relationship',
  'classification',
  'source',
  'evidence',
] as const

/** A parsed, validated projection request. */
export type ParsedGraphQuery = {
  readonly focus: string
  readonly view: GraphViewRule
  readonly depth: number
  readonly maxNodes: number
  readonly includeNodeTypes?: readonly GraphNodeType[]
  readonly includeEdgeTypes?: readonly string[]
}

/** Why a request was rejected, with the status the route should send. */
export class GraphQueryError extends Error {
  constructor(
    readonly status: 400 | 404 | 413,
    readonly detail: string,
  ) {
    super(detail)
    this.name = 'GraphQueryError'
  }
}

const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'must be a uuid',
  )

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  // A slug that fails this is a path or query fragment that reached `focus` by mistake, and
  // answering it with a database lookup would be a slow way to say so.
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must be a kebab-case card slug or a uuid',
  )

const depthSchema = z.coerce
  .number()
  .int('depth must be a whole number of hops')
  .min(0, 'depth must be at least 0')
  .max(HARD_MAX_DEPTH, `depth must be at most ${HARD_MAX_DEPTH}`)

const maxNodesSchema = z.coerce
  .number()
  .int('maxNodes must be a whole number')
  .min(1, 'maxNodes must be at least 1')
  .max(HARD_MAX_NODES, `maxNodes must be at most ${HARD_MAX_NODES}`)

/**
 * Parse and validate the query string of `GET /api/graph`.
 *
 * @param query Express-style query object; every value is a string or an array of strings.
 * @returns The validated request, with defaults applied.
 * @throws {GraphQueryError} `400` for malformed input or an unknown view, `413` for a `depth`
 * or `maxNodes` above the hard cap.
 * @example
 * ```ts
 * const parsed = parseGraphQuery({ focus: "jesus-was-a-zionist", depth: "2" });
 * parsed.depth; // 2
 * parseGraphQuery({ focus: "x", depth: "9" }); // throws GraphQueryError(413)
 * ```
 */
export function parseGraphQuery(
  query: Record<string, unknown>,
): ParsedGraphQuery {
  const focus = parseFocus(query.focus)
  const view = parseView(query.view)
  const depth = parseDepth(query.depth, view)
  const maxNodes = parseMaxNodes(query.maxNodes)
  const includeNodeTypes = parseIncludeNodeTypes(query.include, view)
  const includeEdgeTypes = parseRelationship(query.relationship)

  return {
    focus,
    view,
    depth,
    maxNodes,
    ...(includeNodeTypes ? { includeNodeTypes } : {}),
    ...(includeEdgeTypes ? { includeEdgeTypes } : {}),
  }
}

/**
 * `focus` is required: a card slug, or a uuid naming a card, claim, argument chain,
 * source or evidence item (Q7).
 *
 * Only the card table answers to a slug; every other type must be addressed by its
 * canonical uuid.
 */
function parseFocus(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') {
    throw new GraphQueryError(
      400,
      'focus is required: pass a uuid for a card, claim, argument chain, source or ' +
        'evidence item, or a card slug such as ?focus=jesus-was-a-zionist',
    )
  }
  if (Array.isArray(raw)) {
    throw new GraphQueryError(400, 'focus must be given exactly once')
  }
  const value = String(raw).trim()
  const result = uuidSchema.safeParse(value)
  if (result.success) return value
  const slugResult = slugSchema.safeParse(value)
  if (slugResult.success) return value
  throw new GraphQueryError(
    400,
    `focus "${value}" is neither a uuid nor a card slug. Slugs are lowercase and ` +
      'hyphen-separated, for example "jesus-was-a-zionist".',
  )
}

/** `view` defaults to the v1 projection; an unknown name is a 400, not a silent fallback. */
function parseView(raw: unknown): GraphViewRule {
  if (raw === undefined || raw === null || raw === '') {
    const fallback = getGraphView(DEFAULT_VIEW_NAME)
    if (!fallback) {
      // A server bug, not a client mistake: the shipped default is missing from the registry.
      throw new Error(
        `the default graph view "${DEFAULT_VIEW_NAME}" is not registered`,
      )
    }
    return fallback
  }
  if (Array.isArray(raw)) {
    throw new GraphQueryError(400, 'view must be given exactly once')
  }
  const name = String(raw).trim()
  if (!isGraphView(name)) {
    throw new GraphQueryError(
      400,
      `unknown view "${name}". Available: ${[...GRAPH_VIEWS.keys()].join(', ')}`,
    )
  }
  const rule = getGraphView(name)
  if (!rule) {
    throw new GraphQueryError(400, `unknown view "${name}"`)
  }
  return rule
}

/**
 * `depth` defaults to the immediate neighbourhood and is capped twice: once against the global
 * hard cap, and once against the view's own `maxDepth`. Exceeding either is a 413 so a client
 * learns it asked for something unattainable rather than receiving a shallower graph.
 */
function parseDepth(raw: unknown, view: GraphViewRule): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_DEPTH
  if (Array.isArray(raw)) {
    throw new GraphQueryError(400, 'depth must be given exactly once')
  }
  const parsed = depthSchema.safeParse(raw)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'depth is not a valid hop count'
    if (message.includes(`at most ${HARD_MAX_DEPTH}`)) {
      throw new GraphQueryError(
        413,
        `depth is above the hard cap of ${HARD_MAX_DEPTH} hops`,
      )
    }
    throw new GraphQueryError(400, message)
  }
  if (parsed.data > view.maxDepth) {
    throw new GraphQueryError(
      413,
      `depth ${parsed.data} exceeds the maximum of ${view.maxDepth} for view "${view.name}"`,
    )
  }
  return parsed.data
}

/** `maxNodes` is a soft cap applied during expansion; above the hard cap it is a 413. */
function parseMaxNodes(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_MAX_NODES
  if (Array.isArray(raw)) {
    throw new GraphQueryError(400, 'maxNodes must be given exactly once')
  }
  const parsed = maxNodesSchema.safeParse(raw)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'maxNodes is not a valid cap'
    if (message.includes(`at most ${HARD_MAX_NODES}`)) {
      throw new GraphQueryError(
        413,
        `maxNodes is above the hard cap of ${HARD_MAX_NODES}`,
      )
    }
    throw new GraphQueryError(400, message)
  }
  return parsed.data
}

/**
 * Parse `include`, a comma-separated subset of the view's own node types.
 *
 * A subset allow-list, never a widening one: naming a node type the view cannot emit is a 400,
 * because silently ignoring it would leave the caller with a smaller graph than it asked for
 * and no indication why.
 *
 * @param raw The raw query value.
 * @param view The requested view, whose `nodeTypes` bound the allow-list.
 */
function parseIncludeNodeTypes(
  raw: unknown,
  view: GraphViewRule,
): GraphNodeType[] | undefined {
  const names = splitList(raw)
  if (names.length === 0) return undefined

  const unknown = names.filter((name) => !isMember(NODE_TYPES, name))
  if (unknown.length > 0) {
    throw new GraphQueryError(
      400,
      `include names unknown node type(s): ${unknown.join(', ')}. ` +
        `Known types: ${NODE_TYPES.join(', ')}`,
    )
  }

  const notInView = names.filter(
    (name) => !view.nodeTypes.includes(name as GraphNodeType),
  )
  if (notInView.length > 0) {
    throw new GraphQueryError(
      400,
      `include names node type(s) view "${view.name}" cannot emit: ` +
        `${notInView.join(', ')}. This filter narrows a view; it cannot widen one. ` +
        `View "${view.name}" emits: ${view.nodeTypes.join(', ')}`,
    )
  }

  return names as GraphNodeType[]
}

/**
 * Parse `relationship`, a comma-separated list of edge types.
 *
 * Each entry is either a bare relation word or `family:RELATION`. The qualified form is what
 * makes the vocabulary distinction addressable from outside the server: `SUPPORTS` matches
 * every family that uses the word, while `claim_relation:SUPPORTS` matches only the authored
 * direct semantic relation, so a caller can never receive a card-relationship link when it asked
 * for a claim relation (Q1).
 *
 * @param raw The raw query value.
 * @returns Normalised filter keys, or `undefined` when unset.
 */
function parseRelationship(raw: unknown): string[] | undefined {
  const names = splitList(raw)
  if (names.length === 0) return undefined

  const out: string[] = []
  const unknown: string[] = []

  for (const name of names) {
    const separator = name.indexOf(':')
    if (separator === -1) {
      if (isMember(EDGE_TYPE_VALUES, name.toUpperCase())) {
        out.push(name.toUpperCase())
      } else {
        unknown.push(name)
      }
      continue
    }

    // Both halves are case-normalised. The families are lowercase literals in the model while
    // the relation words are upper-case enums, so normalising only the value would make
    // `claim_relation:SUPPORTS` valid and `Claim_Relation:SUPPORTS` a 400 for no reason a
    // caller could act on.
    const family = name.slice(0, separator).toUpperCase()
    const value = name.slice(separator + 1).toUpperCase()
    if (!isMember(EDGE_FAMILIES, family)) {
      unknown.push(name)
      continue
    }
    if (value.length === 0) {
      throw new GraphQueryError(
        400,
        `relationship entry "${name}" is family-qualified but names no relation. ` +
          `Families: ${EDGE_FAMILIES.join(', ')}`,
      )
    }
    if (!isMember(EDGE_TYPE_VALUES, value)) {
      unknown.push(name)
      continue
    }
    out.push(`${family}:${value}`)
  }

  if (unknown.length > 0) {
    throw new GraphQueryError(
      400,
      `relationship names unknown edge type(s): ${unknown.join(', ')}. ` +
        `Known relations: ${EDGE_TYPE_VALUES.join(', ')}. ` +
        'A relation may also be qualified as family:RELATION to disambiguate the ' +
        `vocabularies — ${EDGE_FAMILIES.join(', ')}.`,
    )
  }

  return out
}

/**
 * Case-insensitive membership test against a vocabulary.
 *
 * The model's vocabularies are internally inconsistent about case — families are lowercase
 * literals, relation words are upper-case enums — and a caller should not have to know which.
 */
function isMember(values: readonly string[], candidate: string): boolean {
  const upper = candidate.toUpperCase()
  return values.some((value) => value.toUpperCase() === upper)
}

/** Split a comma-separated query value, tolerating repeated parameters as arrays. */
function splitList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return []
  const values = Array.isArray(raw) ? raw : [raw]
  return values
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/**
 * The `GET /api/graph/views` payload: every registered view, its adjacency rules, and the
 * current row counts behind it.
 *
 * Reporting population next to the rules is what lets a client tell "this view does not exist"
 * apart from "this view exists and has nothing to show yet", which is the difference between a
 * bug report and a backlog item.
 *
 * @param population Row counts from {@link TropeGraphReader.readPopulation}.
 * @returns The view catalogue.
 */
export function describeViews(
  population: Awaited<
    ReturnType<import('./reader').TropeGraphReader['readPopulation']>
  >,
): {
  views: {
    name: string
    description: string
    status: string
    focusTypes: readonly string[]
    nodeTypes: readonly string[]
    edgeFamilies: readonly string[]
    excludedNodeTypes: { type: string; reason: string }[]
    nonNodeStructures: { structure: string; reason: string }[]
    maxDepth: number
    populated: boolean
    blockingGaps: string[]
  }[]
  population: typeof population
} {
  const views = [...GRAPH_VIEWS.values()].map((view) => {
    const gaps = viewBlockingGaps(view, population)
    return {
      name: view.name,
      description: view.description,
      status: view.status,
      focusTypes: view.focusTypes,
      nodeTypes: view.nodeTypes,
      edgeFamilies: view.edgeFamilies,
      excludedNodeTypes: [...view.excludedNodeTypes],
      nonNodeStructures: [...view.nonNodeStructures],
      maxDepth: view.maxDepth,
      populated: gaps.length === 0,
      blockingGaps: gaps,
    }
  })

  return { views, population }
}

/** The relation words a view can traverse, for documentation and client-side validation. */
export function edgeTypeVocabulary(): readonly string[] {
  return EDGE_TYPE_VALUES
}

/** The node types the model knows, for documentation and client-side validation. */
export function nodeTypeVocabulary(): readonly GraphNodeType[] {
  return NODE_TYPES
}

/** The typed edge vocabulary, exported so the API can document it without duplicating it. */
export type { GraphEdgeType }
