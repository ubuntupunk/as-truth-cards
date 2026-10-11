/**
 * `ResearchTray` — the session sidebar of the Deck workspace (`7:4434`).
 *
 * The tray is the Deck surface of the existing browser-local research session
 * (`useResearchSession` / `truth-cards/research-session` in `localStorage`).
 * It is explicitly a **scratchpad**, not an account: items live only in this
 * browser, are never sent to a server, and opening `/research` shows the same
 * items because both surfaces read the same storage key. The account-bound
 * `Save card` action is a different semantic and the tray's copy says so on
 * purpose — a veteran reader must never mistake a tray item for a saved card.
 *
 * The component is pure: entries and handlers arrive as props, so the node
 * test suite can render it directly without a router or storage.
 */

import {
  hasResearchEntry,
  type ResearchEntry,
} from '../research/research-session'

/** Props for {@link ResearchTray}. */
export type ResearchTrayProps = {
  /** The current session entries, most-recent-first. */
  readonly entries: readonly ResearchEntry[]
  /** The card on screen, for the add affordance; `null` when none. */
  readonly focus: { readonly id: string; readonly label: string } | null
  /** Called to add the featured card to the tray (browser-local only). */
  readonly onAdd: () => void
  /** Called with an entry to re-open it on `/research`. */
  readonly onOpen: (entry: ResearchEntry) => void
  /** Called with a canonical id to drop one entry. */
  readonly onRemove: (id: string) => void
  /** Called to empty the tray. */
  readonly onClear: () => void
}

/**
 * The research tray rail.
 *
 * @param props See {@link ResearchTrayProps}.
 * @returns An `<section>` tagged `research-tray`.
 */
export function ResearchTray({
  entries,
  focus,
  onAdd,
  onOpen,
  onRemove,
  onClear,
}: ResearchTrayProps) {
  const inTray = focus !== null && hasResearchEntry(entries, focus.id)
  const canAdd = focus !== null && !inTray

  return (
    <section
      data-testid="research-tray"
      aria-label="Research tray"
      className="rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          In your research tray
        </h2>
        <span
          data-testid="research-tray-count"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {entries.length}
        </span>
      </div>

      <p
        data-testid="research-tray-scope"
        className="mt-1 text-xs leading-relaxed text-graph-muted-foreground"
      >
        Kept only in this browser, as working memory for inquiry — never sent to
        a server and separate from your account.
      </p>

      <div className="mt-3">
        <button
          type="button"
          data-testid="research-tray-add"
          disabled={!canAdd}
          onClick={onAdd}
          className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {inTray
            ? 'In tray'
            : focus === null
              ? 'Add a card to your tray'
              : `Add “${focus.label}”`}
        </button>
      </div>

      {entries.length === 0 ? (
        <p
          data-testid="research-tray-empty"
          className="mt-3 rounded-lg border border-dashed border-graph-border p-3 text-xs text-graph-muted-foreground"
        >
          Nothing in the tray. Add a card while you browse here — the same items
          appear on Research.
        </p>
      ) : (
        <ul data-testid="research-tray-list" className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-entry-id={entry.id}
              data-entry-type={entry.type}
              className="rounded-lg border border-graph-border p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {entry.label}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {entry.type}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  data-testid="research-tray-open"
                  data-entry-id={entry.id}
                  onClick={() => onOpen(entry)}
                  className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
                >
                  Open
                </button>
                <button
                  type="button"
                  data-testid="research-tray-remove"
                  data-entry-id={entry.id}
                  onClick={() => onRemove(entry.id)}
                  className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 ? (
        <button
          type="button"
          data-testid="research-tray-clear"
          onClick={onClear}
          className="mt-3 rounded border border-input px-2 py-1 text-xs hover:bg-muted"
        >
          Clear tray
        </button>
      ) : null}

      <p
        data-testid="research-tray-account"
        className="mt-3 border-t border-graph-border pt-2 text-[11px] leading-relaxed text-graph-muted-foreground"
      >
        Saving to your account stays separate: the account-bound Save card
        action is not this tray, and tray items are never sent to one.
      </p>
    </section>
  )
}
