/**
 * The featured card's two actions (SPEC §6.2, §6.4–§7).
 *
 * `Read front & back` is the whole reading interaction: the 3D flip is gone,
 * so this button expands or collapses the reading in place, reported through
 * `aria-expanded` because the label alone does not tell a screen reader
 * whether the content is open.
 *
 * `Save card` exists — the acceptance criteria require the action, and hiding
 * it would leave no way to discover the capability — but it is disabled until
 * account participation ships, with the reason as visible text beside it
 * rather than a tooltip. No localStorage stand-in: a save the account layer
 * cannot see is not a save.
 *
 * `Explore in graph` is the card's transition out of the deck (ROADMAP Phase
 * A). It reuses the Graph page's own `focus` param on the same slug the
 * listing served, so entering graph exploration goes through the canonical
 * projection rather than a card-shaped copy of it.
 */

/** Props for {@link CardActions}. */
export type CardActionsProps = {
  /** Whether the full reading is currently expanded. */
  readonly readingOpen: boolean
  /** Toggles the reading. */
  readonly onToggleRead: () => void
  /**
   * The featured card's slug, so the row can offer the transition into graph
   * exploration (ROADMAP Phase A: card detail must reach the graph without a
   * second data model — the same focus param the Graph page already reads).
   */
  readonly slug: string
  /**
   * Whether there is anything to read: the reading is derived from the card's
   * projection, so while that request has failed the open control is omitted
   * rather than left to expand into nothing.
   */
  readonly readingAvailable?: boolean
}

/** The save note id, referenced by the disabled button via `aria-describedby`. */
const SAVE_CARD_NOTE_ID = 'save-card-note'

/**
 * The action row under the card's readout regions.
 *
 * @param props See {@link CardActionsProps}.
 * @returns A `<div>` with the graph transition, the read toggle and the
 * disabled save action.
 */
export function CardActions({
  readingOpen,
  onToggleRead,
  slug,
  readingAvailable = true,
}: CardActionsProps) {
  return (
    <div
      data-testid="card-actions"
      className="mt-4 flex flex-wrap items-start gap-4"
    >
      {readingAvailable ? (
        <button
          type="button"
          aria-expanded={readingOpen}
          onClick={onToggleRead}
          className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Read front &amp; back
        </button>
      ) : null}
      <a
        href={`/graph?focus=${encodeURIComponent(slug)}`}
        data-testid="explore-in-graph"
        className="min-h-[44px] rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted inline-flex items-center"
      >
        Explore in graph
      </a>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          aria-describedby={SAVE_CARD_NOTE_ID}
          data-testid="save-card"
          className="min-h-[44px] cursor-not-allowed rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-muted-foreground"
        >
          Save card
        </button>
        <p
          id={SAVE_CARD_NOTE_ID}
          className="max-w-xs text-xs text-muted-foreground"
        >
          Saving cards will be available when account participation is enabled.
        </p>
      </div>
    </div>
  )
}
