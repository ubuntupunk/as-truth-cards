/**
 * The app's route-level loading state — what the router's `Suspense` boundary
 * shows while a route's subtree is not yet ready.
 *
 * Distinct from `graph-states.tsx`'s `LoadingState`, which is a compact box
 * *inside* a page once the page has rendered. This one stands in for a whole
 * route: it is centred in the viewport and announces itself as a live status
 * region so a screen reader hears "Loading…" as focus moves to the new route.
 *
 * A pure function (props → string) with an inline SVG spinner, so it is covered
 * by `preact-render-to-string` under Node with no DOM — the same rule the other
 * state components follow (importing a `react`-coupled icon would drag real
 * React into the suite).
 */

import { cn } from '@/lib/utils'

/** Props for {@link RouteLoading}. */
export interface RouteLoadingProps {
  /** The word shown beside the spinner; defaults to "Loading…". */
  labelled?: string
  /** Extra classes for the wrapper. */
  className?: string
}

/** Spinner (inline SVG; see file header). */
const LoaderIcon = ({ className }: { className?: string }) => (
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
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

/**
 * Render the route-level loading state.
 *
 * @param props.labelled The label beside the spinner.
 * @param props.className Extra wrapper classes.
 * @returns The loading markup.
 */
export const RouteLoading = ({ labelled, className }: RouteLoadingProps) => (
  <div
    role="status"
    aria-live="polite"
    data-testid="route-loading"
    className={cn(
      'flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground',
      className,
    )}
  >
    <LoaderIcon className="h-5 w-5 animate-spin" />
    <span>{labelled ?? 'Loading…'}</span>
  </div>
)
