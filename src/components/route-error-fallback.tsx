/**
 * The fallback a route's {@link ErrorBoundary} renders when a view throws
 * during render.
 *
 * This is the answer to the defect the bead names — *"crashes will show blank
 * screen"* — so it is deliberately self-contained: it carries no header, footer
 * or query client of its own. A crash inside a shared shell component (the
 * header, the router) must not be able to re-crash the very screen that is
 * meant to explain it, so the fallback renders only markup that cannot fail.
 *
 * It is a pure function (props → string) and uses an inline SVG rather than an
 * icon package: the boundary lives in the Node-testable surface, and importing
 * a `react`-coupled icon set would drag real React into a suite that renders
 * with `preact-render-to-string` (the same rule `graph-states.tsx` follows).
 *
 * Two exits are offered on purpose. **Try again** resets the boundary and
 * re-renders the same subtree — right for a transient failure. **Go to the
 * deck** is a plain link to `/`, the one route that is always safe to land on,
 * so a deterministically-broken view never traps the user.
 */

import { cn } from '@/lib/utils'

/** Props for {@link RouteErrorFallback}. */
export interface RouteErrorFallbackProps {
  /** The value the view threw; anything thrown is accepted. */
  error: Error
  /** Resets the boundary and re-renders the crashed subtree. */
  onRetry: () => void
  /** The route path the crash happened on, shown when present. */
  label?: string
  /** Extra classes for the wrapper. */
  className?: string
}

/** Warning triangle (inline SVG; see file header). */
const WarningIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
)

/**
 * Render the crashed-view fallback.
 *
 * @param props.error The thrown value, already normalised to an `Error`.
 * @param props.onRetry Reset handler for the enclosing boundary.
 * @param props.label The route path, when the boundary was given one.
 * @param props.className Extra wrapper classes.
 * @returns The fallback markup.
 */
export const RouteErrorFallback = ({
  error,
  onRetry,
  label,
  className,
}: RouteErrorFallbackProps) => (
  <div
    role="alert"
    data-testid="route-error-fallback"
    className={cn(
      'flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center',
      className,
    )}
  >
    <WarningIcon className="h-8 w-8 text-destructive" />
    <h1 className="text-xl font-semibold">Something went wrong</h1>
    <p className="max-w-md text-sm text-muted-foreground">
      {label
        ? `The “${label}” view crashed while rendering.`
        : 'This view crashed while rendering.'}{' '}
      Nothing you did was sent or saved — the page can be reloaded safely.
    </p>
    <pre className="max-h-40 max-w-full overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
      {error.message}
    </pre>
    <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
      <a
        href="/"
        className="text-sm font-medium text-graph-accent underline underline-offset-4 hover:underline"
      >
        Go to the deck
      </a>
    </div>
  </div>
)
