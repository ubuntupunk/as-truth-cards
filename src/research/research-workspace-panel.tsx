/**
 * `ResearchWorkspacePanel` — the research-session roster.
 *
 * The one surface that distinguishes the Research Workspace from the Graph
 * Explorer: a persistent list of the canonical entities a researcher has
 * focused, so exploration can be resumed rather than restarted. It is pure —
 * props in, vnodes out — which lets the node test suite render it directly.
 *
 * The copy states the ROADMAP §150–166 boundary on purpose: the session lives
 * in the browser, is separate from an account, and is not yet synced to one.
 * Overstating persistence would be the same class of error as fabricating
 * provenance, so the account line says exactly how little is wired today.
 */

import type { ResearchEntry } from './research-session'
import { hasResearchEntry } from './research-session'

/** How a view/depth pair reads in a roster row. */
function projectionLabel(entry: ResearchEntry): string {
  const view = entry.view ?? 'default view'
  const depth =
    entry.depth === null ? 'default depth' : `depth ${String(entry.depth)}`
  return `${view} · ${depth}`
}

/**
 * The research session rail.
 *
 * @param props.entries The current session entries, most-recent-first.
 * @param props.focus The current focus node, or `null` when none is loaded.
 * @param props.onAddFocus Called to add the current focus; omitted disables
 * the add affordance entirely.
 * @param props.onOpen Called with an entry to re-open its projection.
 * @param props.onRemove Called with a canonical id to drop one entry.
 * @param props.onClear Called to empty the session.
 * @returns The roster section.
 */
export function ResearchWorkspacePanel({
  entries,
  focus,
  onAddFocus,
  onOpen,
  onRemove,
  onClear,
}: {
  entries: readonly ResearchEntry[]
  focus: { readonly id: string; readonly label: string } | null
  onAddFocus?: () => void
  onOpen: (entry: ResearchEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const inSession = focus !== null && hasResearchEntry(entries, focus.id)
  const canAdd = focus !== null && onAddFocus !== undefined && !inSession

  return (
    <section
      data-testid="research-session"
      aria-label="Research session"
      className="rounded-xl border border-graph-border bg-graph-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Research session
        </h2>
        <span
          data-testid="research-session-count"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {entries.length} focused
        </span>
      </div>

      <p
        data-testid="research-session-scope"
        className="mt-1 text-xs text-graph-muted-foreground"
      >
        Kept in this browser. A research session is separate from your account —
        signing in never moves or clears it.
      </p>

      <div className="mt-3">
        {focus !== null && onAddFocus !== undefined ? (
          <button
            type="button"
            data-testid="research-session-add"
            disabled={!canAdd}
            onClick={onAddFocus}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {inSession ? 'In session' : `Add “${focus.label}”`}
          </button>
        ) : (
          <p
            data-testid="research-session-add-hint"
            className="text-xs text-graph-muted-foreground"
          >
            Open a card, claim, or source in the workspace to keep it here.
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <p
          data-testid="research-session-empty"
          className="mt-3 rounded-lg border border-dashed p-3 text-xs text-graph-muted-foreground"
        >
          Nothing focused yet. The graph below is the canonical corpus; adding a
          focus saves a pointer to it, never a copy of it.
        </p>
      ) : (
        <>
          <ul data-testid="research-session-list" className="mt-3 space-y-2">
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
                <div className="mt-0.5 text-[11px] text-graph-muted-foreground">
                  {projectionLabel(entry)}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    data-testid="research-session-open"
                    data-entry-id={entry.id}
                    onClick={() => onOpen(entry)}
                    className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    data-testid="research-session-remove"
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
          <button
            type="button"
            data-testid="research-session-clear"
            onClick={onClear}
            className="mt-3 rounded border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            Clear session
          </button>
        </>
      )}

      <p
        data-testid="research-session-account"
        className="mt-3 border-t border-graph-border pt-2 text-[11px] text-graph-muted-foreground"
      >
        Account-bound saving is not enabled yet. This session is not sent to any
        account, and anonymous exploration is unaffected.
      </p>
    </section>
  )
}
