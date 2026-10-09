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
 * `data-treatment` marks the shell, and the treatment's chrome tokens ride the
 * element as inline `--graph-*` custom properties (plus `--graph-font-family`)
 * straight from `GRAPH_TREATMENT_TOKENS` in `appearance.ts` — that module is
 * the single source of truth; `tailwind.config.ts` maps the variables to
 * `graph-*` color classes and `index.css` supplies `:root` defaults so
 * surfaces render sanely before the shell mounts. Switching a treatment
 * therefore repaints chrome without touching a single semantic value.
 */

import type { ComponentChildren, JSX } from 'preact'

import { GRAPH_TREATMENT_TOKENS, type GraphTreatment } from './appearance'

/** Every chrome token, as the `--graph-*` custom property it feeds. */
const CHROME_VARIABLES: Record<
  keyof typeof GRAPH_TREATMENT_TOKENS.atmospheric.chrome,
  string
> = {
  page: '--graph-page',
  surface: '--graph-surface',
  canvas: '--graph-canvas',
  inspector: '--graph-inspector',
  border: '--graph-border',
  accent: '--graph-accent',
  accentForeground: '--graph-accent-foreground',
  muted: '--graph-muted',
  mutedForeground: '--graph-muted-foreground',
  focus: '--graph-focus',
  statusOk: '--graph-status-ok',
  statusWarn: '--graph-status-warn',
  statusNone: '--graph-status-none',
  controls: '--graph-controls',
  disclaimer: '--graph-disclaimer',
  disclaimerBorder: '--graph-disclaimer-border',
}

/**
 * The chrome + typography of a treatment as a CSS variable map.
 *
 * @param treatment The active treatment.
 * @returns An object of `--graph-*` custom property names to HSL values.
 */
function treatmentVars(treatment: GraphTreatment): Record<string, string> {
  const { chrome, typography } = GRAPH_TREATMENT_TOKENS[treatment]
  const vars: Record<string, string> = {
    '--graph-font-family': typography.fontFamily,
  }
  for (const [key, value] of Object.entries(chrome)) {
    const name = CHROME_VARIABLES[key as keyof typeof CHROME_VARIABLES]
    if (name) vars[name] = value
  }
  return vars
}

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
 * @param props.treatment The active appearance treatment.
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
  treatment,
  controls,
  workspace,
  status,
  contextLabel = DEFAULT_CONTEXT_LABEL,
  eyebrow = DEFAULT_EYEBROW,
  heading = DEFAULT_HEADING,
  subtitle = DEFAULT_SUBTITLE,
}: {
  treatment: GraphTreatment
  controls?: ComponentChildren
  workspace: ComponentChildren
  status?: ComponentChildren
  contextLabel?: string
  eyebrow?: string
  heading?: string
  subtitle?: string
}) {
  const style: JSX.CSSProperties = {
    ...treatmentVars(treatment),
    fontFamily: 'var(--graph-font-family)',
  }
  return (
    <main
      data-testid="graph-shell"
      data-treatment={treatment}
      style={style}
      className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6"
    >
      <GraphContextBar contextLabel={contextLabel} />
      <GraphHeading eyebrow={eyebrow} heading={heading} subtitle={subtitle} />
      <ResearchDisclaimer />
      {controls !== undefined && controls !== null ? (
        <div className="mt-6">{controls}</div>
      ) : null}
      <div className="mt-4">{workspace}</div>
      {status !== undefined && status !== null ? (
        <div className="mt-4">{status}</div>
      ) : null}
    </main>
  )
}

/**
 * The context/breadcrumb bar — establishes that this is a research/graph
 * workspace rather than an isolated visualization. Not a page title.
 */
function GraphContextBar({ contextLabel }: { contextLabel: string }) {
  return (
    <nav
      data-testid="graph-context-bar"
      className="mt-6 flex items-center gap-2 text-xs text-graph-muted-foreground"
    >
      <span>Trope Cards</span>
      <BreadcrumbSeparator />
      <span>Research</span>
      <BreadcrumbSeparator />
      <span className="font-medium text-foreground">{contextLabel}</span>
    </nav>
  )
}

/** The heading block, verbatim from the Figma file when left at defaults. */
function GraphHeading({
  eyebrow,
  heading,
  subtitle,
}: {
  eyebrow: string
  heading: string
  subtitle: string
}) {
  return (
    <header
      data-testid="graph-heading"
      className="mt-4 flex items-end justify-between"
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-graph-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {heading}
        </h1>
        <p className="mt-1 text-sm text-graph-muted-foreground">{subtitle}</p>
      </div>
    </header>
  )
}

/**
 * The research disclaimer — always visible above the workspace, so the
 * collection's status as research (rather than a verdict) never scrolls away.
 * The copy is the approved Figma wording and claims exactly as much as the
 * graph data supports: nothing more.
 */
function ResearchDisclaimer() {
  return (
    <div
      data-testid="graph-disclaimer"
      className="mt-5 rounded-lg border border-graph-disclaimer-border bg-graph-disclaimer px-4 py-3 text-sm text-graph-muted-foreground"
    >
      <span className="mr-1.5 font-semibold text-foreground">
        Research disclaimer
      </span>
      Illustrative research collection. Claims, source leads, and inferences are
      unverified; no historical conclusions are established.
    </div>
  )
}

/** Small slash between breadcrumb segments. */
function BreadcrumbSeparator() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path d="m13 5-6 14" />
    </svg>
  )
}
