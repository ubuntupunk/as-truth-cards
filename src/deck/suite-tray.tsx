/**
 * `SuiteTray` — the curator's draft-suite surface on the Deck workspace (g2f).
 *
 * A **suite** is a roster of cards a curator has hand-assembled, usually after
 * narrowing the deck to one locale. Its durable home is a `collections` row and
 * its `card_collections` memberships — a Suit — and this surface deliberately
 * writes neither: the bead that owns it (g2f, gh#7 item 1) requires the
 * assignment to stay explicit and human, and `/api/graph` is read-only. What
 * the tray offers instead is a **hand-off**: the picked cards, as slugs, that a
 * maintainer can act on.
 *
 * The copy keeps two distinctions visible on purpose. It is a scratchpad, not
 * an account — separate from the account-bound `Save card` action, which the
 * research tray already owns — and it is not a classification: adding a card to
 * a suite says nothing about the card's locale or its existing suits, because
 * `south-africa` names a locale *and* a collection and slug equality across
 * those taxonomies means nothing (`trope-cards/src/graph/types.ts` §221–240).
 *
 * The component is pure: entries and handlers arrive as props, so the node test
 * suite can render it directly without a router or storage.
 */

import type { SuiteEntry } from './suite-session'

/** Props for {@link SuiteTray}. */
export type SuiteTrayProps = {
  /** The current roster, in curator order. */
  readonly entries: readonly SuiteEntry[]
  /** The card on screen, for the add affordance; `null` when none. */
  readonly focus: { readonly id: string; readonly label: string } | null
  /** Called to add the featured card to the suite (browser-local only). */
  readonly onAdd: () => void
  /** Called with a canonical id to drop one roster entry. */
  readonly onRemove: (id: string) => void
  /** Called to empty the roster. */
  readonly onClear: () => void
  /** Called to hand the roster off, as card slugs in curator order. */
  readonly onExport: () => void
  /**
   * The outcome of the last hand-off, so the button never claims success the
   * browser did not report. `idle` before the first attempt.
   */
  readonly exportStatus?: 'idle' | 'copied' | 'failed'
}

/**
 * The draft-suite tray.
 *
 * @param props See {@link SuiteTrayProps}.
 * @returns A `<section>` tagged `suite-tray`.
 */
export function SuiteTray({
  entries,
  focus,
  onAdd,
  onRemove,
  onClear,
  onExport,
  exportStatus = 'idle',
}: SuiteTrayProps) {
  const inSuite = focus !== null && entries.some((e) => e.id === focus.id)
  const canAdd = focus !== null && !inSuite

  return (
    <section
      data-testid="suite-tray"
      aria-label="Draft suite"
      className="rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Draft suite
        </h2>
        <span
          data-testid="suite-tray-count"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {entries.length}
        </span>
      </div>

      <p
        data-testid="suite-tray-scope"
        className="mt-1 text-xs leading-relaxed text-graph-muted-foreground"
      >
        Kept only in this browser. Picking cards never writes to the database: a
        Suite lives in <code>collections</code>, and assigning one stays a human
        decision.
      </p>

      <div className="mt-3">
        <button
          type="button"
          data-testid="suite-tray-add"
          disabled={!canAdd}
          onClick={onAdd}
          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inSuite
            ? 'In suite'
            : focus === null
              ? 'Add a card to the suite'
              : `Add “${focus.label}”`}
        </button>
      </div>

      {entries.length === 0 ? (
        <p
          data-testid="suite-tray-empty"
          className="mt-3 rounded-lg border border-dashed border-graph-border p-3 text-xs text-graph-muted-foreground"
        >
          Nothing in the draft suite. Narrow the deck to a locale, then add the
          cards the suite should hold.
        </p>
      ) : (
        <ul data-testid="suite-tray-list" className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-entry-id={entry.id}
              data-entry-slug={entry.slug}
              className="rounded-lg border border-graph-border p-2"
            >
              <span className="block min-w-0 truncate text-sm font-medium">
                {entry.title}
              </span>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <code className="truncate text-[11px] text-graph-muted-foreground">
                  {entry.slug}
                </code>
                <button
                  type="button"
                  data-testid="suite-tray-remove"
                  data-entry-id={entry.id}
                  onClick={() => onRemove(entry.id)}
                  className="shrink-0 rounded border border-input px-2 py-1 text-xs hover:bg-muted"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="suite-tray-export"
            data-export-status={exportStatus}
            onClick={onExport}
            className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            {exportStatus === 'copied'
              ? 'Copied'
              : exportStatus === 'failed'
                ? 'Copy failed'
                : 'Copy card slugs'}
          </button>
          <button
            type="button"
            data-testid="suite-tray-clear"
            onClick={onClear}
            className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            Clear suite
          </button>
        </div>
      ) : null}

      <p
        data-testid="suite-tray-invariant"
        className="mt-3 border-t border-graph-border pt-2 text-[11px] leading-relaxed text-graph-muted-foreground"
      >
        A suite is not a classification: adding a card here says nothing about
        the card's locale or its existing suits, and it stays separate from the
        account-bound Save card action.
      </p>
    </section>
  )
}
