/**
 * `DeckWorkspace` — the responsive three-column deck layout (Figma `7:4434`).
 *
 * On wide viewports (`xl`, ≥1280px) the workspace is three columns — browse
 * rail (232px) · card discovery (fluid) · research tray (320px) — matching the
 * approved Figma proportions while the fluid middle keeps the card's reading
 * measure. Below `xl` the rails collapse entirely: they are hidden from the
 * grid and reachable only through the two toolbar buttons, which open them as
 * accessible modal drawers (`role="dialog"`, backdrop, Escape handled by the
 * page). Nothing here forces a fixed width into the viewport, so no breakpoint
 * can create horizontal scroll.
 *
 * The component is pure and controlled: the page owns which drawer is open and
 * the rail contents are slots, so the node test suite can render the grid and
 * both drawer states without a router or DOM.
 */

import type { ComponentChildren } from 'preact'

/** Which rail is open as a drawer below `xl`; `null` when both are closed. */
export type DeckDrawerKind = 'browse' | 'tray'

/** Props for {@link DeckWorkspace}. */
export type DeckWorkspaceProps = {
  /** The browse rail content (also mounted inside the browse drawer). */
  readonly browseRail: ComponentChildren
  /** The research tray content (also mounted inside the tray drawer). */
  readonly tray: ComponentChildren
  /** The card-discovery content of the fluid middle column. */
  readonly children: ComponentChildren
  /** The open drawer below `xl`, or `null`. */
  readonly drawer: DeckDrawerKind | null
  /** Open a drawer; the page owns the state. */
  readonly onOpenDrawer: (kind: DeckDrawerKind) => void
  /** Close whatever drawer is open. */
  readonly onCloseDrawer: () => void
}

/** The labelled title of each drawer, for its dialog and close affordance. */
const DRAWER_TITLES: Record<DeckDrawerKind, string> = {
  browse: 'Browse categories',
  tray: 'Research tray',
}

/** The mobile toolbar + drawer toggle treatment. */
const TOOLBAR_BUTTON =
  'rounded-md border border-graph-border bg-graph-surface px-3 py-2 text-xs font-medium text-graph-muted-foreground hover:text-foreground'

/**
 * The deck workspace grid and its responsive drawers.
 *
 * @param props See {@link DeckWorkspaceProps}.
 * @returns The grid, the mobile toolbar, and the open drawer (if any).
 */
export function DeckWorkspace({
  browseRail,
  tray,
  children,
  drawer,
  onOpenDrawer,
  onCloseDrawer,
}: DeckWorkspaceProps) {
  return (
    <>
      <div
        data-testid="deck-workspace"
        className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[232px_minmax(0,1fr)_320px] xl:items-start"
      >
        <div className="hidden min-w-0 xl:sticky xl:top-24 xl:block">
          {browseRail}
        </div>
        <div className="min-h-0 min-w-0">{children}</div>
        <div className="hidden min-w-0 xl:sticky xl:top-24 xl:block">
          {tray}
        </div>
      </div>

      <div className="mt-6 xl:hidden">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Workspace rails</legend>
          <button
            type="button"
            data-testid="deck-open-browse"
            aria-haspopup="dialog"
            aria-expanded={drawer === 'browse'}
            onClick={() => onOpenDrawer('browse')}
            className={TOOLBAR_BUTTON}
          >
            Browse categories
          </button>
          <button
            type="button"
            data-testid="deck-open-tray"
            aria-haspopup="dialog"
            aria-expanded={drawer === 'tray'}
            onClick={() => onOpenDrawer('tray')}
            className={TOOLBAR_BUTTON}
          >
            Research tray
          </button>
        </fieldset>
      </div>

      {drawer !== null ? (
        <div data-testid="deck-drawer-layer">
          <button
            type="button"
            aria-label="Close drawer"
            data-testid="deck-drawer-backdrop"
            onClick={onCloseDrawer}
            className="fixed inset-0 z-40 cursor-default bg-black/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={DRAWER_TITLES[drawer]}
            data-testid={`deck-drawer-${drawer}`}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-graph-border bg-graph-surface p-4 shadow-xl"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {DRAWER_TITLES[drawer]}
              </h2>
              <button
                type="button"
                data-testid="deck-drawer-close"
                onClick={onCloseDrawer}
                className="rounded border border-input px-2 py-1 text-xs hover:bg-muted"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              {drawer === 'browse' ? browseRail : tray}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
