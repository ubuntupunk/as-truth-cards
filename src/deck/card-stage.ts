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

/**
 * Name the stage as the reader meets it, for the sr-only face announcement.
 *
 * The three faces are one card's presentations (SPEC §7), so the labels are
 * face names rather than route names: the announcement says where the reader
 * is, never how they got there.
 *
 * @param stage One presentation stage.
 * @returns The human name of the active face.
 * @example
 * ```ts
 * cardStageLabel('analysis') // 'Analysis'
 * ```
 */
export function cardStageLabel(stage: CardStage): string {
  switch (stage) {
    case 'cover':
      return 'Cover'
    case 'claim':
      return 'Claim'
    case 'analysis':
      return 'Analysis'
  }
}
