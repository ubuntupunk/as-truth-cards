/**
 * `GraphShell` — the Graph Explorer's fixed chrome, in the approved target
 * composition (top to bottom): context bar → heading block → research
 * disclaimer → controls strip → workspace → status strip.
 *
 * The shell owns **surfaces only**. All graph semantics live in the page
 * (`Graph.tsx`) and the components slotted in below; the shell itself renders
 * zero projections, zero selections, zero server state. Slots render in order
 * so `preact-render-to-string` tests can verify the hierarchy without a DOM.
 *
 * ## How a treatment is applied
 *
 * The shell no longer owns a treatment zone. `TreatmentProvider` mounts the one
 * `data-treatment` wrapper above the router with the light/dark token pairs from
 * `appearance.ts`; `index.css` maps the active pair onto the bare `--graph-*`
 * properties consumed by the Tailwind `graph-*` classes. The shell only consumes
 * `--graph-font-family` for its workspace typography, so switching a treatment
 * repaints chrome without touching a single semantic value.
 */

import type { ComponentChildren, JSX } from 'preact'
import { PageBreadcrumb, PageHeading } from '../components/page-shell'
import { ResearchDisclaimer } from '../components/ResearchDisclaimer'
import {
  PAGE_GUTTER_CLASS,
  PAGE_MAIN_CLASS,
  PAGE_WIDTH_CLASS,
} from '../lib/page-layout'
import { cn } from '../lib/utils'

/** Shared copy defaults; both graph-backed pages use the same shell. */
const DEFAULT_CONTEXT_LABEL = 'Graph Explorer'
const DEFAULT_EYEBROW = 'Relationships / Graph'
const DEFAULT_HEADING = 'Graph Explorer'
const DEFAULT_SUBTITLE =
  'Trace provenance and reasoning. Keep classification in view.'

/**
 * Compose the graph-backed page chrome. Defaults reproduce the Graph Explorer
 * verbatim; the Research Workspace overrides only the copy, so the two pages
 * cannot drift in disclaimer, spacing, or variable wiring.
 *
 * @param props.controls The control strip slot (`<GraphControls/>`); omitted on
 * surfaces that fix their view and have no controls.
 * @param props.workspace The workspace slot (graph + inspector grid).
 * @param props.status The status strip slot (`<GraphStatusStrip/>`); omitted on
 * surfaces whose readout is not yet meaningful (e.g. Sources before a source is
 * selected), so an all-pending strip never renders as noise.
 * @param props.contextLabel The last breadcrumb segment.
 * @param props.eyebrow The small uppercase kicker above the heading.
 * @param props.heading The page `<h1>`.
 * @param props.subtitle The one-line description under the heading.
 * @returns The shell `<main>`.
 */
export function GraphShell({
  controls,
  workspace,
  status,
  contextLabel = DEFAULT_CONTEXT_LABEL,
  eyebrow = DEFAULT_EYEBROW,
  heading = DEFAULT_HEADING,
  subtitle = DEFAULT_SUBTITLE,
}: {
  controls?: ComponentChildren
  workspace: ComponentChildren
  status?: ComponentChildren
  contextLabel?: string
  eyebrow?: string
  heading?: string
  subtitle?: string
}) {
  const style: JSX.CSSProperties = {
    fontFamily: 'var(--graph-font-family)',
  }
  return (
    <main
      data-testid="graph-shell"
      style={style}
      className={cn(PAGE_MAIN_CLASS, PAGE_GUTTER_CLASS)}
    >
      <div className={PAGE_WIDTH_CLASS}>
        <PageBreadcrumb
          contextLabel={contextLabel}
          testId="graph-context-bar"
        />
        <PageHeading
          eyebrow={eyebrow}
          title={heading}
          description={subtitle}
          testId="graph-heading"
        />
        {/* The disclaimer copy lives in `components/ResearchDisclaimer` so every
            research surface (Graph, Research, Sources, Decks) mounts identical
            wording; this shell only supplies the shared chrome. */}
        <ResearchDisclaimer className="mt-5 border-graph-disclaimer-border bg-graph-disclaimer text-graph-muted-foreground" />
        {controls !== undefined && controls !== null ? (
          <div className="mt-6">{controls}</div>
        ) : null}
        <div className="mt-4">{workspace}</div>
        {status !== undefined && status !== null ? (
          <div className="mt-4">{status}</div>
        ) : null}
      </div>
    </main>
  )
}
