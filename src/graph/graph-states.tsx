/**
 * The page states of the Graph screen, each one a small presentational
 * component.
 *
 * The Graph page is a finite state machine, and each state has distinct copy
 * because the states mean different things:
 *
 * - **No focus** — nothing was requested yet; the whole page is an invitation.
 * - **Loading** — the projection is in flight.
 * - **API error** — the server answered but said no (`400`/`404`/`413`/`500`).
 *   Treated as authoritative: the user asked for something the corpus or the
 *   rules do not have, and the server's message explains what.
 * - **Malformed** — the server answered with a body that is not the
 *   {@link GraphProjection} contract. A different state than the API error
 *   because "server refused" and "server sent nonsense" need different words.
 * - **Valid but empty** — `200` with zero nodes. A real, normal answer for an
 *   unpopulated view, never an error.
 * - **Compact** (the banners below) — the projection rendered, and `meta`
 *   says it is small, truncated, shallower than requested, or carries
 *   warnings. Banners sit *above* the graph; they never replace it, because a
 *   truncated or sparse graph is still a real graph worth interacting with.
 *
 * Every component here is pure (props → string) so the whole file is covered
 * by `preact-render-to-string` under Node with no DOM.
 *
 * Icons are inline SVGs on purpose: the state components are part of the
 * Node-testable surface, and importing a `react`-coupled icon library would
 * drag real React into a suite that renders with `preact-render-to-string`.
 */

import type { GraphProjection } from '../../trope-cards/src/graph/types.ts'
import {
  type GraphViewsResponse,
  ProjectionShapeError,
} from './projection-guards'
import { GraphApiError } from './use-graph'

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

/** Info circle (inline SVG; see file header). */
const InfoIcon = ({ className }: { className?: string }) => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

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
 * Stable key for a warning list item.
 *
 * Warnings have no natural id and are not guaranteed unique, so the key
 * combines position with content — enough to be stable for the lifetime of
 * one projection, which is all React asks.
 */
function warningKey(index: number, warning: string): string {
  return `${index}:${warning}`
}

/** Invitation shown when no focus is selected. Owns the "how it works" copy. */
export const NoFocusState = () => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-8 py-16 text-center">
    <h2 className="text-2xl font-semibold">Pick a card to expand</h2>
    <p className="mt-3 max-w-md text-sm text-muted-foreground">
      The graph projects the neighbourhood of one card: its Suits, Mechanisms,
      ordered Axis, asserted Claims, the reasoning steps bridging those claims,
      and card-to-card relationships. They type a card slug — for example{' '}
      <code className="rounded bg-muted px-1 py-0.5 text-xs">
        jesus-was-a-zionist
      </code>{' '}
      — or paste a card uuid below.
    </p>
  </div>
)

/** Shown while a focus is set and its projection is loading. */
export const LoadingState = ({ labelled }: { labelled?: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
    <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
    <span>{labelled ?? 'Loading projection…'}</span>
  </div>
)

/**
 * The server said no — a decoded GraphApiError.
 *
 * `status 0` is the client-side "network error" sentinel from the fetch layer.
 * Accepts `unknown` so any rejected query — including unexpected thrown
 * values — renders instead of crashing the screen.
 */
export const ApiErrorState = ({ error }: { error: unknown }) => {
  const status = error instanceof GraphApiError ? error.status : 0
  const message = error instanceof Error ? error.message : 'The request failed.'
  const detail = error instanceof GraphApiError ? error.detail : null
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <WarningIcon className="h-4 w-4" aria-hidden="true" />
        {status > 0 ? `The API replied ${status}` : 'Network error'}
      </div>
      <p className="mt-2 text-sm">{message}</p>
      {detail ? (
        <pre className="mt-3 max-h-40 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
          {detail}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * The server sent a body that is not the documented contract.
 *
 * Accepts any thrown value: the projection-assertion errors carry the failing
 * path, while the adapter and JSON layers contribute plain messages.
 */
export const MalformedState = ({ error }: { error: unknown }) => {
  const message =
    error instanceof ProjectionShapeError
      ? `${error.path} — ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error)
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <WarningIcon className="h-4 w-4" aria-hidden="true" />
        Malformed graph response
      </div>
      <p className="mt-2 text-sm">
        The response did not match the graph projection contract. This is a bug
        to report — name the field that failed.
      </p>
      <pre className="mt-3 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
        {message}
      </pre>
    </div>
  )
}

/**
 * A valid, empty projection: `200` with zero nodes.
 *
 * The plan's contract says an unpopulated view is a fact, not a failure — it
 * renders as this state plus whatever warnings the projection reports.
 */
export const EmptyProjectionState = ({
  projection,
}: {
  projection: GraphProjection
}) => (
  <div className="rounded-xl border p-6 text-center">
    <div className="flex items-center justify-center gap-2 text-sm font-medium">
      <InfoIcon className="h-4 w-4" aria-hidden="true" />
      Nothing to show for view “{projection.view}”
    </div>
    <p className="mt-2 text-sm text-muted-foreground">
      The request was valid, but the view has no nodes for this focus. A view
      over an unpopulated layer reports this as an empty projection, not as an
      error.
    </p>
    {projection.meta.warnings.length > 0 ? (
      <dl className="mt-4 inline-block text-left text-xs text-muted-foreground">
        {projection.meta.warnings.map((warning, index) => (
          <div key={warningKey(index, warning)}>
            <dt className="font-medium">warning {index + 1}</dt>
            <dd className="mb-1">{warning}</dd>
          </div>
        ))}
      </dl>
    ) : null}
  </div>
)

/** Non-fatal problems the projection reported. Sits above the graph. */
export const WarningsBanner = ({
  warnings,
}: {
  warnings: readonly string[]
}) => (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
    <p className="font-medium">Non-fatal warnings from the projection</p>
    <ul className="mt-1 list-inside list-disc space-y-0.5">
      {warnings.map((warning, index) => (
        <li key={warningKey(index, warning)}>{warning}</li>
      ))}
    </ul>
  </div>
)

/** `maxNodes` stopped expansion before the requested depth was reached. */
export const TruncatedBanner = ({ maxNodes }: { maxNodes: number }) => (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
    Expansion hit the {maxNodes}-node cap. The graph is truncated at the soft
    limit; raise the cap or lower the depth to see the whole neighbourhood.
  </div>
)

/**
 * The projection reached fewer hops than requested.
 *
 * Distinct from truncation: expansion simply ran out of nodes to walk at
 * `reachedDepth`, so the depth requested was genuinely unattainable, not
 * capped away.
 */
export const DepthBoundedBanner = ({
  requestedDepth,
  reachedDepth,
}: {
  requestedDepth: number
  reachedDepth: number
}) => (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
    The graph runs out at depth {reachedDepth} — shallower than the requested{' '}
    {requestedDepth}. Nothing further exists to expand.
  </div>
)

/**
 * A small neighbourhood: nodes but no relationships.
 *
 * A valid graph (e.g. a depth-0 focus is exactly this), so it is a notice
 * beside the graph, not a replacement for it.
 */
export const SparseNotice = ({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) => (
  <div className="rounded-lg border p-3 text-xs text-muted-foreground">
    Sparse projection: {nodeCount} node{nodeCount === 1 ? '' : 's'} and{' '}
    {edgeCount} edges.{' '}
    {nodeCount === 1 ? 'Only the focus node is present.' : ''}
  </div>
)

/**
 * Compose the meta-driven banners into one ordered stack.
 *
 * Rendered above the graph whenever the projection is non-empty. Each banner
 * only appears when its condition holds, so the absence of a banner is itself
 * the "nothing unusual" signal.
 *
 * @param props.projection The loaded projection.
 * @param props.requestedDepth The depth sent to the API (post-clamp),
 * used for the depth-bounded message.
 */
export const ProjectionNotices = ({
  projection,
  requestedDepth,
}: {
  projection: GraphProjection
  requestedDepth: number
}) => {
  const { meta } = projection
  const depthBounded = meta.reachedDepth < requestedDepth
  return (
    <div className="space-y-2">
      {meta.warnings.length > 0 ? (
        <WarningsBanner warnings={meta.warnings} />
      ) : null}
      {meta.truncated ? <TruncatedBanner maxNodes={meta.maxNodes} /> : null}
      {depthBounded ? (
        <DepthBoundedBanner
          requestedDepth={requestedDepth}
          reachedDepth={meta.reachedDepth}
        />
      ) : null}
      {meta.nodeCount > 0 && meta.edgeCount === 0 ? (
        <SparseNotice nodeCount={meta.nodeCount} edgeCount={meta.edgeCount} />
      ) : null}
    </div>
  )
}

/**
 * The views query's own error surface, for the controls pane.
 *
 * The catalogue failing does not block an already-focusable projection the way
 * it blocks the controls, so the controls show this compact note while the
 * graph area keeps rendering whatever it can.
 *
 * @param props.error The query error to display.
 * @param props.views When loaded (and the error is stale), the catalogue to
 * render instead of nothing.
 */
export const ViewsStatus = ({
  error,
  views,
}: {
  error: unknown
  views: GraphViewsResponse | undefined
}) => {
  if (error) {
    return (
      <p className="text-xs text-destructive">
        View catalogue unavailable:{' '}
        {error instanceof Error ? error.message : 'rejected'}
      </p>
    )
  }
  if (!views) {
    return <p className="text-xs text-muted-foreground">Loading views…</p>
  }
  return null
}
