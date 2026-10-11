/**
 * The three presentation stages of one canonical card (SPEC §7).
 *
 * These are stages of a single card, not three records and not a literal
 * three-sided object: `cover` is the deck's browse/discovery representation,
 * `claim` states what is under examination, and `analysis` presents how it is
 * examined. The type lives here rather than in `featured-card.tsx` so both the
 * card and its action row can name a stage without importing each other.
 */

/** One presentation stage of the featured card. */
export type CardStage = 'cover' | 'claim' | 'analysis'

/** The stage deck browsing shows first: the Cover (SPEC §7.4). */
export const DEFAULT_CARD_STAGE: CardStage = 'cover'
