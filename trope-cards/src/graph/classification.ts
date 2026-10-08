/**
 * The pure assembly of a card's classification dimensions.
 *
 * These helpers used to live inside `projection.ts`, where only the focused
 * projection could reach them. The read-side listing (`GET /api/graph/cards`)
 * needs exactly the same assembly for a page of cards, so it lives here
 * instead: a leaf module with no reader, no database and no projection
 * knowledge, importable from the reader without inverting the layering.
 *
 * Nothing here maps, renames, groups or infers across dimensions. Axis,
 * Suit, Mechanism, Locale and Concept stay five independent axes
 * (`ADR_GRAPH_LAYER.md` §7), and every value is reported verbatim from the
 * table it came from. See {@link buildCardClassification}.
 */

import type { AxisAssignment, CardAxisValue, CardClassification } from './types'

/** One `card_axes` row: the columns grouping and ordering need. */
export type CardAxisLink = {
  readonly cardId: string
  readonly axis: CardAxisValue
  readonly ordinal: number
}

/**
 * One link row joined to its taxonomy row: the columns grouping needs,
 * whichever taxonomy it points at.
 *
 * `card_collections` spells its taxonomy id `collection_id`, `card_mechanisms`
 * spells it `mechanism_id` and `card_locales` spells it `localeId`, so the id
 * is deliberately absent here — it arrives as a getter at the call site rather
 * than as a column a union key would have to narrow.
 */
export type ClassificationLinkRow = {
  readonly cardId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/** One taxonomy membership of a card, reduced to the shape classification needs. */
export type ClassificationLink = {
  readonly linkId: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
}

/**
 * Group `card_axes` rows by card, in authored ordinal order.
 *
 * The `primary` marker comes from `ordinal === 0` and nothing else. This single
 * expression is the entirety of Issue #2's "axis is `card_axes.ordinal = 0`,
 * never `primary_type`" requirement, and `primaryType` appears nowhere near it.
 * The whole multi-valued assignment is preserved rather than collapsing to the
 * primary value, because 9 of the 47 seeded cards carry more than one axis and
 * a card can legitimately be both a rhetorical tactic and a theological
 * dispute.
 *
 * @param rows `card_axes` rows for one or more cards.
 * @returns Assignments keyed by `cards.id`, ordered by `ordinal`.
 */
export function groupCardAxes(
  rows: readonly CardAxisLink[],
): Map<string, AxisAssignment[]> {
  const byCard = new Map<string, AxisAssignment[]>()
  const ordered = [...rows].sort((a, b) => a.ordinal - b.ordinal)
  for (const row of ordered) {
    const assignment: AxisAssignment = {
      axis: row.axis,
      ordinal: row.ordinal,
      primary: row.ordinal === 0,
    }
    const list = byCard.get(row.cardId)
    if (list) list.push(assignment)
    else byCard.set(row.cardId, [assignment])
  }
  return byCard
}

/**
 * Group classification link rows by card, sorted by slug.
 *
 * @param rows `card_collections`, `card_mechanisms` or `card_locales` rows
 * joined to their taxonomy row.
 * @param taxonomyId Extracts the taxonomy row's id from a link row.
 * @returns Links keyed by `cards.id`.
 */
export function groupCardClassifications<T extends ClassificationLinkRow>(
  rows: readonly T[],
  taxonomyId: (row: T) => string,
): Map<string, ClassificationLink[]> {
  const byCard = new Map<string, ClassificationLink[]>()
  for (const row of rows) {
    const link: ClassificationLink = {
      linkId: taxonomyId(row),
      slug: row.slug,
      name: row.name,
      description: row.description,
    }
    const list = byCard.get(row.cardId)
    if (list) list.push(link)
    else byCard.set(row.cardId, [link])
  }
  for (const list of byCard.values()) {
    list.sort((a, b) => a.slug.localeCompare(b.slug))
  }
  return byCard
}

/** The classification of a card with no authored rows in any dimension. */
export const EMPTY_CARD_CLASSIFICATION: CardClassification = {
  axes: [],
  suits: [],
  suitIds: [],
  mechanismSlugs: [],
  mechanismIds: [],
  localeSlugs: [],
  localeIds: [],
}

/**
 * Build a card's independent classification dimensions.
 *
 * Suits are reported by slug because a Suit is a human-facing browse dimension,
 * and Q3 defers any reconciliation with Issue #2's proposed vocabulary — so
 * nothing here maps, renames, or infers a Suit, and in particular epistemic
 * `CONTESTED` is never surfaced as a Suit called `contested`. Axis, Suit,
 * Mechanism, Locale and Concept stay five separate dimensions.
 *
 * Locale is reported only from `card_locales`. It is not derived from Suit: a
 * Suit is a mutable curation bucket, so a card in the `south-africa` suit is
 * not thereby about South Africa. There is deliberately no default and no
 * fallback here — a card with no locale rows reports an empty list rather than
 * a guess.
 *
 * Suits report ids alongside slugs for the same reason locales do:
 * `collections` and `locales` share the slug `south-africa`, and four cards
 * are in both. A consumer comparing the two lists needs the ids to tell the
 * taxonomies apart, so slug equality between `suits` and `localeSlugs` carries
 * no meaning on its own.
 *
 * @param axes The card's `card_axes` rows, in ordinal order.
 * @param suits The card's `collections` memberships.
 * @param mechanisms The card's `mechanisms` memberships.
 * @param locales The card's `locales` memberships.
 * @returns The transport shape for one card's classification.
 */
export function buildCardClassification(
  axes: readonly AxisAssignment[],
  suits: readonly ClassificationLink[],
  mechanisms: readonly ClassificationLink[],
  locales: readonly ClassificationLink[],
): CardClassification {
  return {
    axes,
    suits: suits.map((suit) => suit.slug),
    suitIds: suits.map((suit) => suit.linkId),
    mechanismSlugs: mechanisms.map((mechanism) => mechanism.slug),
    mechanismIds: mechanisms.map((mechanism) => mechanism.linkId),
    localeSlugs: locales.map((locale) => locale.slug),
    localeIds: locales.map((locale) => locale.linkId),
  }
}
