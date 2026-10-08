/**
 * The Deck's data model: scope, navigation, and the two projection-derived
 * readouts the featured card needs.
 *
 * Everything here is pure data + pure functions (no JSX, no fetch, no hooks),
 * which is what lets the whole discovery contract — filtering, position,
 * "without repeats" shuffle, and the honest dimension readouts — be tested
 * under Node against hand-built projections.
 *
 * Three invariants are the reason this module exists rather than ad-hoc state
 * in the page:
 *
 * - **Scope filters the list, never the ontology.** An axis or research-status
 *   filter selects among cards the server already sent; it never re-derives a
 *   classification the graph did not author.
 * - **Navigation is a session over a list.** `position`/`seen` are plain
 *   values, so "previous", "shuffle next" and "without repeats" are functions
 *   rather than effects that can drift apart from what is on screen.
 * - **Absent dimensions are reported as absent.** {@link deriveCardPreview}
 *   distinguishes "this view never carries evidence" from "this card has no
 *   evidence", because a zero that means "not asked" reads as a verified
 *   absence — the same distinction the Graph status strip makes.
 * - **Counts describe the featured card alone.** The deck asks for a
 *   depth-2 projection, which also carries the cards a claim relation or a
 *   reasoning step points at; every count and every reading entry is scoped to
 *   the featured card's own rows rather than to whatever the payload happens
 *   to hold.
 */

import type { CardListingRow } from '../../trope-cards/src/graph/reader.ts'
import type {
  CardAxisValue,
  EpistemicStatusValue,
  GraphNode,
  GraphProjection,
} from '../../trope-cards/src/graph/types.ts'
import { AXIS_ORDER } from '../graph/deck-facets'
import type { GraphViewDescriptor } from '../graph/projection-guards'
import { EPISTEMIC_STATUS_ORDER } from './deck-status'

/** The filters the discovery header exposes (SPEC §6.1). */
export type DeckScope = {
  /** Axis to narrow to, or `null` for every axis. */
  readonly axis: CardAxisValue | null
  /** Research status to narrow to, or `null` for every status. */
  readonly status: EpistemicStatusValue | null
  /** Whether "Shuffle next" avoids cards the reader has already seen. */
  readonly withoutRepeats: boolean
}

/** The unfiltered deck: every card, repeats allowed. */
export const NO_SCOPE: DeckScope = {
  axis: null,
  status: null,
  withoutRepeats: false,
}

/**
 * One deck's navigable state.
 *
 * `cards` is the *scoped* list, so `position` indexes exactly what the reader
 * can see and the position indicator can never say `3 / 47` over a filtered
 * deck of 6.
 */
export type DeckSession = {
  readonly cards: readonly CardListingRow[]
  /** Index into {@link cards}. Out of range only when the deck is empty. */
  readonly position: number
  /** Positions already shown, so `withoutRepeats` can avoid them. */
  readonly seen: readonly number[]
  readonly withoutRepeats: boolean
}

/**
 * Filter the card list by the active scope.
 *
 * @param cards Cards as the listing returned them, in title order.
 * @param scope The active axis/status/repeat filters.
 * @returns The cards matching every active dimension (AND across dimensions).
 */
export function applyScope(
  cards: readonly CardListingRow[],
  scope: DeckScope,
): readonly CardListingRow[] {
  return cards.filter((card) => {
    if (
      scope.axis !== null &&
      !card.classification.axes.some((entry) => entry.axis === scope.axis)
    ) {
      return false
    }
    if (scope.status !== null && card.epistemicStatus !== scope.status) {
      return false
    }
    return true
  })
}

/**
 * Start a deck over a scoped card list.
 *
 * @param cards The scoped cards.
 * @param scope The scope they were produced by, so the session carries the
 * repeat policy navigation needs.
 * @returns A session positioned on the first card (or empty).
 */
export function startDeck(
  cards: readonly CardListingRow[],
  scope: DeckScope,
): DeckSession {
  return {
    cards,
    position: 0,
    seen: cards.length > 0 ? [0] : [],
    withoutRepeats: scope.withoutRepeats,
  }
}

/**
 * Step to the previous card, wrapping at the start.
 *
 * @param session The current session.
 * @returns The session on the preceding card, with that card marked seen.
 */
export function previousCard(session: DeckSession): DeckSession {
  const total = session.cards.length
  if (total === 0) return session
  const position = (session.position - 1 + total) % total
  return {
    ...session,
    position,
    seen: session.seen.includes(position)
      ? session.seen
      : [...session.seen, position],
  }
}

/**
 * Shuffle to the next card.
 *
 * With `withoutRepeats` active, the pool is the cards not yet shown; once
 * every card has been shown the pool falls back to "any card but this one",
 * because an exhausted deck has no unseen card to offer and hiding the control
 * would be worse than repeating honestly.
 *
 * @param session The current session.
 * @param random A `Math.random`-shaped source of entropy, injected so the
 * choice is reproducible in tests.
 * @returns The session on a shuffled-in card.
 */
export function shuffleNextCard(
  session: DeckSession,
  random: () => number,
): DeckSession {
  const total = session.cards.length
  if (total <= 1) return session

  const seen = new Set(session.seen)
  const unseen = range(total).filter((index) => !seen.has(index))
  const pool =
    session.withoutRepeats && unseen.length > 0
      ? unseen
      : range(total).filter((index) => index !== session.position)

  const pick = pool[Math.floor(random() * pool.length)] ?? session.position
  return {
    ...session,
    position: pick,
    seen: session.seen.includes(pick) ? session.seen : [...session.seen, pick],
  }
}

/**
 * Jump to a card by slug — the handoff a browse surface makes when it sends a
 * reader to a specific card (`/?focus=<slug>`).
 *
 * The session owns position, so the jump goes through it rather than around
 * it: the destination is marked `seen` exactly as stepping to it would, and a
 * slug the deck does not contain leaves the session untouched instead of
 * inventing a position. The caller's URL sync then reports whatever card is
 * actually on screen, which is what makes a stale or out-of-scope deep link
 * self-correct.
 *
 * @param session The current session.
 * @param slug The card's slug.
 * @returns The session positioned on that card, or `session` unchanged.
 */
export function jumpToCard(session: DeckSession, slug: string): DeckSession {
  const position = session.cards.findIndex((card) => card.slug === slug)
  if (position === -1 || position === session.position) return session
  return {
    ...session,
    position,
    seen: session.seen.includes(position)
      ? session.seen
      : [...session.seen, position],
  }
}

/**
 * Reconcile a live session with the list and scope now in force.
 *
 * The one rule the deck's navigation state lives or dies by, kept pure so it
 * can be tested without mounting a hook: a *different card list* restarts the
 * deck (the cards under the reader changed), while a *repeat-policy change*
 * keeps position and `seen` (the policy governs the next shuffle, not the
 * current card). Reconciling an unchanged pair returns the same object, so a
 * render loop cannot be started by the effect that calls this.
 *
 * @param current The session on screen.
 * @param scoped The card list after {@link applyScope}, as a fresh value.
 * @param scope The scope now in force.
 * @returns The session that should be on screen next.
 */
export function reconcileSession(
  current: DeckSession,
  scoped: readonly CardListingRow[],
  scope: DeckScope,
): DeckSession {
  if (current.cards !== scoped) return startDeck(scoped, scope)
  if (current.withoutRepeats === scope.withoutRepeats) return current
  return { ...current, withoutRepeats: scope.withoutRepeats }
}

/**
 * The position indicator's text: `n / total` (SPEC §6.3).
 *
 * @param session The current session.
 * @returns A 1-based position over the deck's size, or `0 / 0` when empty.
 */
export function positionLabel(session: DeckSession): string {
  if (session.cards.length === 0) return '0 / 0'
  return `${session.position + 1} / ${session.cards.length}`
}

/**
 * The position indicator's progress fraction, `0`–`1`.
 *
 * @param session The current session.
 * @returns The completed fraction of the deck.
 */
export function positionRatio(session: DeckSession): number {
  if (session.cards.length === 0) return 0
  return (session.position + 1) / session.cards.length
}

/**
 * The axes actually present in a card list, in canonical `card_axis` order.
 *
 * Derived from the cards rather than from the schema, so an axis no card
 * carries is not offered as a filter that can only ever return nothing.
 *
 * @param cards The card list on offer.
 * @returns The present axes, deduplicated, in declaration order.
 */
export function availableAxes(
  cards: readonly CardListingRow[],
): readonly CardAxisValue[] {
  const present = new Set<CardAxisValue>()
  for (const card of cards) {
    for (const entry of card.classification.axes) present.add(entry.axis)
  }
  return AXIS_ORDER.filter((axis) => present.has(axis))
}

/**
 * The research statuses actually present in a card list, in vocabulary order.
 *
 * @param cards The card list on offer.
 * @returns The present statuses, deduplicated, in declaration order.
 */
export function availableStatuses(
  cards: readonly CardListingRow[],
): readonly EpistemicStatusValue[] {
  const present = new Set<EpistemicStatusValue>()
  for (const card of cards) present.add(card.epistemicStatus)
  return EPISTEMIC_STATUS_ORDER.filter((status) => present.has(status))
}

/**
 * One dimension of the featured card's preview: how much the corpus returned,
 * and why the answer is missing when it is missing.
 *
 * `count` is `null` when there is no count to report — the view never carried
 * the dimension, the request never reached it, or the catalogue has not loaded
 * yet — and never `0` in those cases, because `0` means "asked, and found
 * none".
 */
export type DimensionReadout = {
  readonly count: number | null
  readonly note: string | null
}

/**
 * How deep the deck asks for a card's projection.
 *
 * Two hops, not the server's `DEFAULT_DEPTH` of one: `claim_sources` attribution
 * hangs off a claim and an `inference_step` is only reachable through one, so
 * both sit a hop beyond the card. At depth 1 the payload contains no `source`
 * and no `inference_step` node at all, and any count over it would be a
 * fabricated `0` — "checked, found none" about a dimension the request never
 * looked at. {@link deckProjectionDepth} still caps this at the view's own
 * `maxDepth`, so the server keeps the ceiling.
 */
export const DECK_PROJECTION_DEPTH = 2

/**
 * The depth the deck should request for one projection.
 *
 * @param descriptor The view descriptor once the catalogue has loaded, or
 * `null` while it is still in flight (then the deck's own depth stands and a
 * descriptor arriving later re-clamps it).
 * @returns The deck's depth, never above what the view declares it can serve.
 */
export function deckProjectionDepth(
  descriptor: GraphViewDescriptor | null,
): number {
  if (descriptor === null) return DECK_PROJECTION_DEPTH
  return Math.min(DECK_PROJECTION_DEPTH, descriptor.maxDepth)
}

/**
 * The featured card's compact provenance/reasoning and evidence readouts.
 *
 * All four are {@link DimensionReadout}s: each can say "not counted here" and
 * why, rather than being a bare number that cannot tell a real zero from a
 * dimension the projection never carried.
 */
export type CardPreview = {
  readonly claims: DimensionReadout
  readonly reasoningSteps: DimensionReadout
  readonly provenance: DimensionReadout
  readonly evidence: DimensionReadout
}

/**
 * What a preview is derived *for*: which card, and whether the view catalogue
 * that would explain a missing dimension ever arrived.
 */
export type CardPreviewSource = {
  /** The featured card's uuid — every count describes this card's rows. */
  readonly cardId: string
  /** The catalogue query's message when it rejected, `null` otherwise. */
  readonly catalogueError?: string | null
}

/**
 * Derive the featured card's preview from its projection and view descriptor.
 *
 * Ownership matters because the deck's depth-2 projection is not one card: it
 * pulls in the cards a claim relation or a step points at, with *their* claims
 * and sources beside them. Counting `node.type` across that payload would
 * report a neighbour's provenance as this card's, so the counts below read
 * `claims.card_id` / `inference_steps.card_id` off the node metadata and only
 * count a source or evidence item an edge ties back to one of those own rows.
 *
 * @param projection The featured card's projection (`GET /api/graph?focus=…`).
 * @param descriptor The view descriptor for that projection, or `null` while
 * the catalogue is still loading (then every dimension reports pending).
 * @param source The featured card's identity, plus the catalogue's failure
 * reason if it failed.
 * @returns One readout per dimension, each `null` exactly when no count is
 * honest.
 */
export function deriveCardPreview(
  projection: GraphProjection,
  descriptor: GraphViewDescriptor | null,
  source: CardPreviewSource,
): CardPreview {
  const { entities, nearby } = ownNeighbourhood(projection, source.cardId)
  const reach = {
    projectionDepth: projection.depth,
    catalogueError: source.catalogueError ?? null,
  }

  let claims = 0
  let steps = 0
  for (const node of projection.nodes) {
    if (node.type === 'claim' && entities.has(node.id)) claims += 1
    else if (node.type === 'inference_step' && entities.has(node.id)) steps += 1
  }

  const countNearby = (type: GraphNode['type']): number => {
    let count = 0
    for (const node of projection.nodes) {
      if (node.type === type && nearby.has(node.id)) count += 1
    }
    return count
  }

  return {
    claims: readDimension(descriptor, 'claim', 'claims', claims, {
      ...reach,
      // A card focus always has its own claims in reach at hop 1; only a
      // depth-0 request (the card alone) could not show them.
      requiredDepth: 1,
    }),
    reasoningSteps: readDimension(
      descriptor,
      'inference_step',
      'reasoning steps',
      steps,
      { ...reach, requiredDepth: DECK_PROJECTION_DEPTH },
    ),
    provenance: readDimension(
      descriptor,
      'source',
      'sources',
      countNearby('source'),
      { ...reach, requiredDepth: DECK_PROJECTION_DEPTH },
    ),
    evidence: readDimension(
      descriptor,
      'evidence_item',
      'evidence items',
      countNearby('evidence_item'),
      { ...reach, requiredDepth: DECK_PROJECTION_DEPTH },
    ),
  }
}

/**
 * The featured card's own rows in a projection that may also hold neighbours.
 *
 * `entities` is the card plus its own claims and reasoning steps, read from
 * `claims.card_id` / `inference_steps.card_id` on the node metadata.
 * `nearby` is everything an edge ties to one of those entities — where a
 * source attribution or an evidence item lives, since neither carries a
 * `card_id` of its own.
 *
 * @param projection The featured card's projection.
 * @param cardId The featured card's uuid.
 * @returns Both id sets, for scoping counts and reading lists.
 */
function ownNeighbourhood(
  projection: GraphProjection,
  cardId: string,
): {
  readonly entities: ReadonlySet<string>
  readonly nearby: ReadonlySet<string>
} {
  const entities = new Set<string>([cardId])
  for (const node of projection.nodes) {
    if (node.type === 'claim' && node.metadata.cardId === cardId) {
      entities.add(node.id)
    } else if (
      node.type === 'inference_step' &&
      node.metadata.cardId === cardId
    ) {
      entities.add(node.id)
    }
  }

  const nearby = new Set<string>()
  for (const edge of projection.edges) {
    if (entities.has(edge.from)) nearby.add(edge.to)
    if (entities.has(edge.to)) nearby.add(edge.from)
  }

  return { entities, nearby }
}

/** One claim, reasoning step or source as the expanded reading presents it. */
export type ReadingEntry = {
  readonly id: string
  readonly label: string
  /** Epistemic token for claims; `null` where the ontology stores free text. */
  readonly status: EpistemicStatusValue | null
  /** Supporting text: a claim description, a step description, a citation. */
  readonly detail: string | null
}

/** The expanded "Read front & back" content, derived from one projection. */
export type CardReading = {
  readonly claims: readonly ReadingEntry[]
  readonly steps: readonly ReadingEntry[]
  readonly sources: readonly ReadingEntry[]
}

/**
 * Derive the expanded reading's three lists from the featured projection.
 *
 * Claims, reasoning steps and sources stay three separate lists: a source is
 * provenance for a claim, never an item of evidence and never a claim itself
 * (SPEC §8), and folding them into one "references" list is exactly the
 * collapse the ontology forbids.
 *
 * The lists are scoped to the featured card for the same reason the preview's
 * counts are: at depth 2 the projection also carries the cards a claim
 * relation or a step points at, and a neighbour's claims in this card's
 * reading would be a second, quieter lie than a wrong count.
 *
 * @param projection The featured card's projection.
 * @param cardId The featured card's uuid.
 * @returns The lists, each in projection order and possibly empty.
 */
export function deriveCardReading(
  projection: GraphProjection,
  cardId: string,
): CardReading {
  const { entities, nearby } = ownNeighbourhood(projection, cardId)
  const claims: ReadingEntry[] = []
  const steps: ReadingEntry[] = []
  const sources: ReadingEntry[] = []

  for (const node of projection.nodes) {
    if (node.type === 'claim' && entities.has(node.id)) {
      claims.push({
        id: node.id,
        label: node.label,
        status: node.status.value,
        detail: node.metadata.description,
      })
    } else if (node.type === 'inference_step' && entities.has(node.id)) {
      steps.push({
        id: node.id,
        label: node.label,
        status: null,
        detail: node.metadata.description,
      })
    } else if (node.type === 'source' && nearby.has(node.id)) {
      sources.push({
        id: node.id,
        label: node.label,
        status: null,
        detail: node.metadata.citation,
      })
    }
  }

  return { claims, steps, sources }
}

/** One analytical lens the discovery prompt can suggest (SPEC §6.4). */
export type DiscoveryLens = {
  readonly label: string
  readonly question: string
}

/**
 * The four suggested lenses, as question-first prompts.
 *
 * Each is a question the reader can take to the card; none asserts what the
 * card concludes, because the prompt's job is to open an enquiry, not to
 * answer it.
 */
export const DISCOVERY_LENSES: readonly DiscoveryLens[] = [
  { label: 'language', question: 'What does the wording of this card assume?' },
  {
    label: 'place',
    question: 'Where does this card say this happens, and who names the place?',
  },
  {
    label: 'collective memory',
    question: 'What is being asked to be remembered, and by whom?',
  },
  {
    label: 'concepts',
    question: 'Which concept is doing the work in this claim?',
  },
]

/** The discovery prompt under one card. */
export type DiscoveryPromptModel = {
  readonly question: string
  readonly lenses: readonly DiscoveryLens[]
}

/**
 * Build the discovery prompt for the featured card.
 *
 * Prefers the card's authored `coreQuestion`, because that is the question the
 * research already asks; falls back to a neutral prompt that invites checking
 * rather than agreeing.
 *
 * @param card The featured card.
 * @returns The question and the suggested lenses.
 */
export function discoveryPrompt(
  card: Pick<CardListingRow, 'title' | 'coreQuestion'>,
): DiscoveryPromptModel {
  const authored = card.coreQuestion?.trim()
  return {
    question:
      authored && authored.length > 0
        ? authored
        : `What would you need to check before accepting the claim in "${card.title}"?`,
    lenses: DISCOVERY_LENSES,
  }
}

/** `0 … n-1`, so pool selection reads as a selection rather than arithmetic. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, index) => index)
}

/**
 * Read one dimension against the view descriptor and the request's reach.
 *
 * Six reasons, in order: the first reports the count the payload proved, the
 * middle four explain an absence, and only the last may report zero:
 *
 * 1. The rows are in the payload — a non-zero count is its own evidence, so
 *    no catalogue state can turn a count the projection actually returned
 *    into a pending or an absent dimension.
 * 2. The view catalogue itself is missing (its query rejected) — say so,
 *    because a dash with no reason is how a broken request masquerades as a
 *    slow one.
 * 3. The catalogue is still loading — pending, no claim yet.
 * 4. The view excludes the type, or never carried it — the server's reason.
 * 5. The request stopped short of where the dimension lives — say that
 *    instead of counting a payload that was never asked to contain it.
 * 6. Otherwise a real zero: the view carries the type, the request reached
 *    it, and it found none.
 *
 * @param descriptor The view descriptor, or `null` while loading.
 * @param type The node type carrying the dimension.
 * @param label Human name for the dimension, used in the notes.
 * @param found How many such nodes the projection returned for this card.
 * @param reach The depth the projection requested, the depth this dimension
 * needs before it can be counted, and the catalogue's failure message.
 * @returns A readout whose `count` is `null` exactly when no count is honest.
 */
function readDimension(
  descriptor: GraphViewDescriptor | null,
  type: string,
  label: string,
  found: number,
  reach: {
    readonly projectionDepth: number
    readonly requiredDepth: number
    readonly catalogueError: string | null
  },
): DimensionReadout {
  // The payload is the evidence: rows came back for this type, so nothing the
  // catalogue may later say about loading or exclusions can un-count them.
  if (found > 0) return { count: found, note: null }

  if (reach.catalogueError !== null) {
    return {
      count: null,
      note: `View catalogue unavailable: ${reach.catalogueError}`,
    }
  }
  if (descriptor === null) return { count: null, note: null }

  const exclusion = descriptor.excludedNodeTypes.find(
    (entry) => entry.type === type,
  )
  if (exclusion) return { count: null, note: exclusion.reason }
  if (!descriptor.nodeTypes.includes(type as never)) {
    return { count: null, note: `This view does not carry ${label}.` }
  }
  if (reach.projectionDepth < reach.requiredDepth) {
    return {
      count: null,
      note: `This projection reaches depth ${reach.projectionDepth}; ${label} sit deeper, so they are not counted here.`,
    }
  }
  return { count: found, note: null }
}
