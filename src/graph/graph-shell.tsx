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

/**
 * Compose the Graph Explorer chrome.
 *
 * @param props.treatment The active appearance treatment.
 * @param props.controls The control strip slot (`<GraphControls/>`).
 * @param props.workspace The workspace slot (graph + inspector grid).
 * @param props.status The status strip slot (`<GraphStatusStrip/>`).
 * @returns The shell `<main>`.
 */
export function GraphShell({
  treatment,
  controls,
  workspace,
  status,
}: {
  treatment: GraphTreatment
  controls: ComponentChildren
  workspace: ComponentChildren
  status: ComponentChildren
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
      <GraphContextBar />
      <GraphHeading />
      <ResearchDisclaimer />
      <div className="mt-6">{controls}</div>
      <div className="mt-4">{workspace}</div>
      <div className="mt-4">{status}</div>
    </main>
  )
}

/**
 * The context/breadcrumb bar — establishes that this is a research/graph
 * workspace rather than an isolated visualization. Not a page title.
 */
function GraphContextBar() {
  return (
    <nav
      data-testid="graph-context-bar"
      className="mt-6 flex items-center gap-2 text-xs text-graph-muted-foreground"
    >
      <span>Truth Cards</span>
      <BreadcrumbSeparator />
      <span>Research</span>
      <BreadcrumbSeparator />
      <span className="font-medium text-foreground">Graph Explorer</span>
    </nav>
  )
}

/** The heading block, verbatim from the Figma file. */
function GraphHeading() {
  return (
    <header
      data-testid="graph-heading"
      className="mt-4 flex items-end justify-between"
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-graph-muted-foreground">
          Relationships / Graph
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Graph Explorer
        </h1>
        <p className="mt-1 text-sm text-graph-muted-foreground">
          Trace provenance and reasoning. Keep classification in view.
        </p>
      </div>
    </header>
  )
}

/**
 * The research disclaimer — always visible above the workspace, so the
 * collection's status as research (rather than a verdict) never scrolls away.
 * The copy comes from the approved plan and claims exactly as much as the
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
      This is a research collection, not itself a historical conclusion.
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
