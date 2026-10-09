/**
 * Runtime shape validation for the HTTP bodies the Graph and Deck pages consume.
 *
 * `fetch` hands back `unknown`. Between a `res.json()` and a typed
 * `GraphProjection` sits exactly one assumption — that the server sent the
 * documented contract — and this module is where that assumption is checked
 * rather than trusted. The checks are **presence-level**: does the body have
 * the `{ focus, view, depth, nodes, edges, meta }` envelope, does each node
 * carry `id`/`type`/`label`/`depth`/`isFocus`/`degree`/`status`/`metadata`,
 * does each edge carry `id`/`family`/`type`/`sourceTable`/`from`/`to`/
 * `attributes`/`traversal`?
 *
 * Deliberately *not* validated here:
 *
 * - **Type-specific metadata shapes.** `trope-cards/src/graph/types.ts`
 *   already discriminates the `GraphNode` union on `type`; re-checking every
 *   metadata bag would duplicate that contract in the place most likely to
 *   drift from it. The adapter refuses unknown types loudly if something gets
 *   through.
 * - **Vocabulary membership.** Whether `node.type` is one of the twelve known
 *   types is the adapter's job (`CytoscapeAdapterError`), not a shape
 *   concern. This module answers "is this a projection at all?" — the
 *   HTML-error-page case, the server-bug case, the deploy-mismatch case.
 *
 * The guard against the classic failure (an error page or proxy splash
 * reaching `JSON.parse` → a structurally wrong "projection" that renders as
 * an empty graph) is `ProjectionShapeError`, which the page shows as its own
 * state — distinct from `GraphApiError`, because "the server said no" and
 * "the server sent nonsense" need different words on screen.
 */

import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'

/**
 * One view descriptor as `/api/graph/views` reports it.
 *
 * Mirrors the return type of `describeViews` in
 * `trope-cards/src/graph/query.ts`. It is restated here rather than imported
 * because that return type is anonymous and lives behind the server's
 * module graph; the guard below is what keeps the restatement honest —
 * a server-side shape change fails `assertGraphViewsResponse` in the tests
 * the moment the payloads diverge.
 */
export type GraphViewDescriptor = {
  readonly name: string
  readonly description: string
  readonly status: string
  readonly focusTypes: readonly string[]
  readonly nodeTypes: readonly string[]
  readonly edgeFamilies: readonly string[]
  readonly excludedNodeTypes: readonly {
    readonly type: string
    readonly reason: string
  }[]
  readonly nonNodeStructures: readonly {
    readonly structure: string
    readonly reason: string
  }[]
  readonly maxDepth: number
  readonly populated: boolean
  readonly blockingGaps: readonly string[]
}

/**
 * The `GET /api/graph/views` body: the view catalogue plus current row counts.
 *
 * `population` is typed as a numeric record rather than the server's
 * `ViewPopulation` because the page only ever displays it, and a new count
 * key on the server should not be a compile error on the client.
 */
export type GraphViewsResponse = {
  readonly views: readonly GraphViewDescriptor[]
  readonly population: Readonly<Record<string, number>>
}

/**
 * The response body was JSON but not the contract this page expects.
 *
 * Always a bug — server, proxy, or deploy skew — never a user error, which is
 * why it gets its own state component instead of the API error one. The
 * `path` names where the shape first failed so the console line and the
 * on-screen message point at the same place.
 */
export class ProjectionShapeError extends Error {
  /** Dotted path of the first field that failed validation, e.g. `nodes[3].status`. */
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'ProjectionShapeError'
    this.path = path
  }
}

/**
 * Structural check: is this value a plain object?
 *
 * Exported because the fetch layer needs the same test when it digs an
 * `error`/`detail` string out of a non-2xx body.
 *
 * @param value Anything, typically `unknown` from `res.json()`.
 * @returns `true` for non-null, non-array objects.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Assert that a decoded JSON body is a `GraphProjection`.
 *
 * Throws {@link ProjectionShapeError} naming the first offending path;
 * returns normally (narrowing `value` to `GraphProjection`) otherwise.
 *
 * @param value The decoded body.
 * @throws {ProjectionShapeError} If any envelope, node, edge or `meta` field
 * is missing or of the wrong primitive type.
 * @example
 * ```ts
 * const body: unknown = await res.json()
 * assertGraphProjection(body) // narrows to GraphProjection
 * ```
 */
export function assertGraphProjection(
  value: unknown,
): asserts value is GraphProjection {
  const root = asRecord(value, '')
  const focus = asRecord(root.focus, 'focus')
  asString(focus.id, 'focus.id')
  asString(focus.type, 'focus.type')
  asNullableString(focus.slug, 'focus.slug')
  asString(root.view, 'view')
  asNumber(root.depth, 'depth')

  const nodes = asArray(root.nodes, 'nodes')
  for (let index = 0; index < nodes.length; index++) {
    assertNode(nodes[index], `nodes[${index}]`)
  }

  const edges = asArray(root.edges, 'edges')
  for (let index = 0; index < edges.length; index++) {
    assertEdge(edges[index], `edges[${index}]`)
  }

  const meta = asRecord(root.meta, 'meta')
  asNumber(meta.nodeCount, 'meta.nodeCount')
  asNumber(meta.edgeCount, 'meta.edgeCount')
  asBoolean(meta.truncated, 'meta.truncated')
  asNumber(meta.maxNodes, 'meta.maxNodes')
  asNumber(meta.reachedDepth, 'meta.reachedDepth')
  asStringArray(meta.warnings, 'meta.warnings')
}

/**
 * Assert that a decoded JSON body is a `GraphViewsResponse`.
 *
 * @param value The decoded body.
 * @throws {ProjectionShapeError} If the catalogue or any descriptor field is
 * missing or of the wrong primitive type.
 * @example
 * ```ts
 * const body: unknown = await res.json()
 * assertGraphViewsResponse(body) // narrows to GraphViewsResponse
 * ```
 */
export function assertGraphViewsResponse(
  value: unknown,
): asserts value is GraphViewsResponse {
  const root = asRecord(value, '')
  const views = asArray(root.views, 'views')
  for (let index = 0; index < views.length; index++) {
    const path = `views[${index}]`
    const view = asRecord(views[index], path)
    asString(view.name, `${path}.name`)
    asString(view.description, `${path}.description`)
    asString(view.status, `${path}.status`)
    asStringArray(view.focusTypes, `${path}.focusTypes`)
    asStringArray(view.nodeTypes, `${path}.nodeTypes`)
    asStringArray(view.edgeFamilies, `${path}.edgeFamilies`)
    const excluded = asArray(
      view.excludedNodeTypes,
      `${path}.excludedNodeTypes`,
    )
    for (let i = 0; i < excluded.length; i++) {
      const entry = asRecord(excluded[i], `${path}.excludedNodeTypes[${i}]`)
      asString(entry.type, `${path}.excludedNodeTypes[${i}].type`)
      asString(entry.reason, `${path}.excludedNodeTypes[${i}].reason`)
    }
    const structures = asArray(
      view.nonNodeStructures,
      `${path}.nonNodeStructures`,
    )
    for (let i = 0; i < structures.length; i++) {
      const entry = asRecord(structures[i], `${path}.nonNodeStructures[${i}]`)
      asString(entry.structure, `${path}.nonNodeStructures[${i}].structure`)
      asString(entry.reason, `${path}.nonNodeStructures[${i}].reason`)
    }
    asNumber(view.maxDepth, `${path}.maxDepth`)
    asBoolean(view.populated, `${path}.populated`)
    asStringArray(view.blockingGaps, `${path}.blockingGaps`)
  }

  const population = asRecord(root.population, 'population')
  for (const [key, count] of Object.entries(population)) {
    asNumber(count, `population.${key}`)
  }
}

/**
 * One card search hit as `/api/graph/search` reports it.
 *
 * `type` is always `"card"` today, but the contract is widenable: a future
 * slice may return claims, sources or concepts in the same list, keyed by
 * `type`, so the guard accepts any non-empty string rather than pinning it.
 */
export type CardSearchResult = {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string | null
  readonly type: string
  readonly rank: number
}

/** The `GET /api/graph/search` body. */
export type GraphSearchResponse = {
  readonly results: readonly CardSearchResult[]
}

/**
 * Assert that a decoded JSON body is a `GraphSearchResponse`.
 *
 * @param value The decoded body.
 * @throws {ProjectionShapeError} If the `results` envelope or any result field
 * is missing or of the wrong primitive type.
 * @example
 * ```ts
 * const body: unknown = await res.json()
 * assertGraphSearchResponse(body) // narrows to GraphSearchResponse
 * ```
 */
export function assertGraphSearchResponse(
  value: unknown,
): asserts value is GraphSearchResponse {
  const root = asRecord(value, '')
  const results = asArray(root.results, 'results')
  for (let index = 0; index < results.length; index++) {
    const path = `results[${index}]`
    const result = asRecord(results[index], path)
    asString(result.id, `${path}.id`)
    asString(result.slug, `${path}.slug`)
    asString(result.title, `${path}.title`)
    asNullableString(result.summary, `${path}.summary`)
    asString(result.type, `${path}.type`)
    asNumber(result.rank, `${path}.rank`)
  }
}

/**
 * The `GET /api/graph/cards` body: one page of cards with their
 * classification, plus the paging envelope the deck's scope badge reads.
 *
 * `total` is the count for the *same filter* the page was requested with, so
 * `n / total` on screen is a server fact rather than a client guess.
 */
export type CardListResponse = {
  readonly items: readonly CardListingRow[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

/**
 * Assert that a decoded JSON body is a `CardListResponse`.
 *
 * Classification is checked at the same presence level as everything else:
 * the six slug/id lists must be there and must be strings, and `axes` must be
 * an array. What an axis or a suit *means* is the ontology's contract, checked
 * against the real server in the graph suite — re-deriving it here would be a
 * second vocabulary on the client.
 *
 * @param value The decoded body.
 * @throws {ProjectionShapeError} If the envelope, a card field or a
 * classification list is missing or of the wrong primitive type.
 * @example
 * ```ts
 * const body: unknown = await res.json()
 * assertCardListResponse(body) // narrows to CardListResponse
 * ```
 */
export function assertCardListResponse(
  value: unknown,
): asserts value is CardListResponse {
  const root = asRecord(value, '')
  asNumber(root.total, 'total')
  asNumber(root.limit, 'limit')
  asNumber(root.offset, 'offset')

  const items = asArray(root.items, 'items')
  for (let index = 0; index < items.length; index++) {
    const path = `items[${index}]`
    const item = asRecord(items[index], path)
    asString(item.id, `${path}.id`)
    asString(item.slug, `${path}.slug`)
    asString(item.title, `${path}.title`)
    asNullableString(item.summary, `${path}.summary`)
    asNullableString(item.coreQuestion, `${path}.coreQuestion`)
    asString(item.primaryType, `${path}.primaryType`)
    asString(item.epistemicStatus, `${path}.epistemicStatus`)

    const classification = asRecord(
      item.classification,
      `${path}.classification`,
    )
    asArray(classification.axes, `${path}.classification.axes`)
    asStringArray(classification.suits, `${path}.classification.suits`)
    asStringArray(classification.suitIds, `${path}.classification.suitIds`)
    asStringArray(
      classification.mechanismSlugs,
      `${path}.classification.mechanismSlugs`,
    )
    asStringArray(
      classification.mechanismIds,
      `${path}.classification.mechanismIds`,
    )
    asStringArray(
      classification.localeSlugs,
      `${path}.classification.localeSlugs`,
    )
    asStringArray(classification.localeIds, `${path}.classification.localeIds`)
  }
}

/**
 * One canonical source as `GET /api/graph/sources` reports it.
 *
 * `claimSourceCount` is the number of `claim_sources` rows that name this
 * source. It is an *attribution* count, not an evidence count: a source
 * attached to a claim is a provenance lead, never a verified support edge, and
 * the page must not let the two blur.
 */
export type SourceSummary = {
  readonly id: string
  readonly title: string
  readonly author: string | null
  readonly publisher: string | null
  readonly citation: string | null
  readonly url: string | null
  readonly sourceType: string
  readonly claimSourceCount: number
}

/**
 * The `GET /api/graph/sources` body: one page of sources globally, plus the
 * paging envelope.
 */
export type SourcesResponse = {
  readonly items: readonly SourceSummary[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

/**
 * Assert that a decoded JSON body is a `SourcesResponse`.
 *
 * Presence-level only: `citation`, `url`, `author` and `publisher` may be
 * `null` (the corpus leaves most metadata unpopulated), but the key must exist
 * and hold a string or `null`. What a `sourceType` *means* is the ontology's
 * contract; re-deriving the vocabulary here would be a second copy of it.
 *
 * @param value The decoded body.
 * @throws {ProjectionShapeError} If the envelope, a source field or the count
 * is missing or of the wrong primitive type.
 * @example
 * ```ts
 * const body: unknown = await res.json()
 * assertSourcesResponse(body) // narrows to SourcesResponse
 * ```
 */
export function assertSourcesResponse(
  value: unknown,
): asserts value is SourcesResponse {
  const root = asRecord(value, '')
  asNumber(root.total, 'total')
  asNumber(root.limit, 'limit')
  asNumber(root.offset, 'offset')

  const items = asArray(root.items, 'items')
  for (let index = 0; index < items.length; index++) {
    const path = `items[${index}]`
    const item = asRecord(items[index], path)
    asString(item.id, `${path}.id`)
    asString(item.title, `${path}.title`)
    asNullableString(item.author, `${path}.author`)
    asNullableString(item.publisher, `${path}.publisher`)
    asNullableString(item.citation, `${path}.citation`)
    asNullableString(item.url, `${path}.url`)
    asString(item.sourceType, `${path}.sourceType`)
    asNumber(item.claimSourceCount, `${path}.claimSourceCount`)
  }
}

/** Presence-level node check; vocabulary membership is the adapter's job. */
function assertNode(value: unknown, path: string): void {
  const node = asRecord(value, path)
  asString(node.id, `${path}.id`)
  asString(node.type, `${path}.type`)
  asString(node.label, `${path}.label`)
  asNumber(node.depth, `${path}.depth`)
  asBoolean(node.isFocus, `${path}.isFocus`)
  asNumber(node.degree, `${path}.degree`)
  const status = asRecord(node.status, `${path}.status`)
  asString(status.source, `${path}.status.source`)
  if (!('value' in status)) {
    throw new ProjectionShapeError(
      `${path}.status.value`,
      'status has no value field (it may be null, but the key must be present)',
    )
  }
  asRecord(node.metadata, `${path}.metadata`)
}

/** Presence-level edge check; `type.family`/`family` agreement is the adapter's job. */
function assertEdge(value: unknown, path: string): void {
  const edge = asRecord(value, path)
  asString(edge.id, `${path}.id`)
  asString(edge.family, `${path}.family`)
  const type = asRecord(edge.type, `${path}.type`)
  asString(type.family, `${path}.type.family`)
  if (!('value' in type)) {
    throw new ProjectionShapeError(
      `${path}.type.value`,
      'edge type has no value field',
    )
  }
  asString(edge.sourceTable, `${path}.sourceTable`)
  asString(edge.from, `${path}.from`)
  asString(edge.to, `${path}.to`)
  asRecord(edge.attributes, `${path}.attributes`)
  asString(edge.traversal, `${path}.traversal`)
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProjectionShapeError(path || '(root)', 'expected an object')
  }
  return value
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProjectionShapeError(path, 'expected a non-empty string')
  }
  return value
}

function asNullableString(value: unknown, path: string): string | null {
  if (value !== null && typeof value !== 'string') {
    throw new ProjectionShapeError(path, 'expected a string or null')
  }
  return value as string | null
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ProjectionShapeError(path, 'expected a finite number')
  }
  return value
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ProjectionShapeError(path, 'expected a boolean')
  }
  return value
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProjectionShapeError(path, 'expected an array')
  }
  return value
}

function asStringArray(value: unknown, path: string): string[] {
  const items = asArray(value, path)
  for (let index = 0; index < items.length; index++) {
    if (typeof items[index] !== 'string') {
      throw new ProjectionShapeError(`${path}[${index}]`, 'expected a string')
    }
  }
  return items as string[]
}
