/**
 * The body of the 404 surface — the deck logo, the copy, and the exits.
 *
 * Kept separate from the routed page for the same reason
 * `route-error-fallback.tsx` is self-contained: the UI test harness renders
 * with `preact-render-to-string` under Node and therefore has no router
 * context. This component carries no hooks and no shared shell, so it renders
 * as a pure function and its copy is assertable; `pages/NotFound.tsx` composes
 * the header, footer and `useLocation` diagnostic around it.
 *
 * Its exits are plain `<a>` elements rather than router `Link`s for the same
 * reason — a full document load after an unknown URL is harmless (and the
 * error-boundary fallback already follows that precedent).
 *
 * The logo is the same image and decorative treatment the header uses
 * (`/fig-2-1.jpg` inside a circle), scaled up so the page still says whose
 * 404 it is when the header is scrolled out of view.
 */

/**
 * Render the not-found panel.
 *
 * @returns The card with the logo, the "Oy vey, Oh dear" copy, and two exits:
 * the deck (`/`) as the primary action and the explorer (`/explore`) as the
 * secondary one.
 */
export const NotFoundPanel = () => (
  <section
    data-testid="not-found-panel"
    className="mx-auto w-full max-w-md rounded-xl border border-graph-border bg-graph-surface p-8 text-center"
  >
    <img
      src="/fig-2-1.jpg"
      alt=""
      aria-hidden="true"
      className="mx-auto h-24 w-24 rounded-full object-cover"
    />
    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Not Found / 404
    </p>
    <h1 className="mt-1">Oy vey, Oh dear</h1>
    <p className="mt-3 text-muted-foreground">
      The page you're looking for can't be found.
    </p>
    <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
      <a
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to the deck
      </a>
      <a
        href="/explore"
        className="text-sm font-medium text-graph-accent underline underline-offset-4 hover:underline"
      >
        Browse the explorer
      </a>
    </div>
  </section>
)
