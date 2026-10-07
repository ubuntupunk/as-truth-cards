/**
 * The Graph Explorer's appearance system — presentation-only.
 *
 * `GSD` cuts the current Figma Graph Explorer into **three visual treatments of
 * one information architecture** (Atmospheric / Editorial / Workspace), never
 * three implementations. This module is the single place those treatments are
 * defined: one token set per treatment, every token named for the surface it
 * styles (`INSTRUCTION.md` §10's minimally-styleable list: page background,
 * surface/panel, graph canvas, inspector, borders, typography hierarchy,
 * node/edge treatment, accent, status, controls, contextual/disclaimer).
 *
 * ## How the tokens reach the DOM
 *
 * - **Chrome** (page, surfaces, borders, accent, status, controls, disclaimer)
 *   travels as CSS custom properties on the shell wrapper, scoped per treatment
 *   through `data-treatment`. `GraphShell` applies each treatment's chrome
 *   inline (as `--graph-*` variables) directly from this module — appearance.ts
 *   is the single source of truth. `index.css` declares `:root` defaults so
 *   surfaces render sanely before/without the shell; `tailwind.config.ts` maps
 *   the `--graph-*` variables into `graph-*` color classes. Values here are raw
 *   HSL triplets so they slot straight into those variable declarations.
 * - **Node/edge palettes** are consumed by `buildGraphStylesheet(treatment)` in
 *   `graph-stylesheet.ts` — Cytoscape styles are inline JSON, not CSS, so the
 *   canvas treatment is data the stylesheet reads, not a class the page toggles.
 * - **Typography** hierarchy rides the same shell: `--graph-font-family` sets
 *   the workspace stack per treatment (the rest of the site keeps its own).
 *
 * ## The appearance selector is presentation-only
 *
 * `localStorage['trope-cards:graph-treatment']` remembers a choice so the
 * selector is a *working* control, but switching a treatment must never change
 * the projection, focus, view, depth, selection, or any semantic readout.
 * Tests pin this by rendering the shell's status/states under two treatments
 * and asserting the projection-derived text is byte-identical.
 */

import type {
  EdgeFamily,
  GraphNodeType,
} from '../../trope-cards/src/graph/types.ts'

/** The three Figma Graph Explorer treatments. */
export type GraphTreatment = 'atmospheric' | 'editorial' | 'workspace'

/** The three treatments, in display order. */
export const GRAPH_TREATMENTS: readonly GraphTreatment[] = [
  'atmospheric',
  'editorial',
  'workspace',
]

/** LocalStorage key for the persisted appearance choice. */
export const GRAPH_TREATMENT_STORAGE_KEY = 'trope-cards:graph-treatment'

/**
 * The chrome surfaces of one treatment, as HSL triplets for `--graph-*` CSS
 * custom properties (the same shape the app's theme variables use).
 */
export type GraphChromeTokens = {
  /** Page background behind the whole workspace. */
  readonly page: string
  /** Default surface/panel treatment (cards, panes). */
  readonly surface: string
  /** The graph canvas background. */
  readonly canvas: string
  /** The Entity Inspector surface. */
  readonly inspector: string
  /** Borders across the workspace. */
  readonly border: string
  /** Accent treatment (active controls, focus highlights). */
  readonly accent: string
  /** Foreground text on the accent colour. */
  readonly accentForeground: string
  /** Muted surfaces/foreground for secondary text. */
  readonly muted: string
  /** Muted foreground text. */
  readonly mutedForeground: string
  /** Focus/selection highlight in the graph and inspector. */
  readonly focus: string
  /** Epistemic/positive status treatment. */
  readonly statusOk: string
  /** Warning/data-limited status treatment. */
  readonly statusWarn: string
  /** "No truth claim" (`status none`) treatment. */
  readonly statusNone: string
  /** Control strip background. */
  readonly controls: string
  /** Contextual/disclaimer surface. */
  readonly disclaimer: string
  /** Contextual/disclaimer border. */
  readonly disclaimerBorder: string
}

/** Typography tokens for one treatment (kernel of the Figma hierarchy). */
export type GraphTypographyTokens = {
  /** Font stack for the workspace (CSS `font-family` value). */
  readonly fontFamily: string
}

/**
 * One treatment's full token set.
 *
 * `nodeColors` and `edgeColors` are the same `GraphNodeType`/`EdgeFamily`
 * records `GRAPH_STYLESHEET` already keys on — keeping them here, per
 * treatment, is what lets `buildGraphStylesheet` repaint the canvas without
 * duplicating stylesheet logic.
 */
export type GraphTreatmentTokens = {
  readonly chrome: GraphChromeTokens
  readonly typography: GraphTypographyTokens
  readonly nodeColors: Record<GraphNodeType, string>
  readonly edgeColors: Record<EdgeFamily, string>
}

/** Atmospheric — the existing calm, translucent palette, kept as the default. */
const ATMOSPHERIC: GraphTreatmentTokens = {
  chrome: {
    page: '220 14.3% 95.9%',
    surface: '0 0% 100%',
    canvas: '220 14.3% 95.9%',
    inspector: '0 0% 100%',
    border: '220 13% 91%',
    accent: '262 83.3% 57.8%',
    accentForeground: '0 0% 100%',
    muted: '220 14.3% 95.9%',
    mutedForeground: '220 8.9% 46.1%',
    focus: '221.2 83.2% 53.3%',
    statusOk: '160 84.1% 34.5%',
    statusWarn: '38 92.1% 50.2%',
    statusNone: '215 20% 60%',
    controls: '0 0% 100%',
    disclaimer: '224 71.4% 97%',
    disclaimerBorder: '224 50% 88%',
  },
  typography: {
    fontFamily: "'SF Pro Display', 'system-ui', 'Segoe UI', Roboto, sans-serif",
  },
  nodeColors: {
    card: '#6d28d9',
    claim: '#1d4ed8',
    inference_step: '#0f766e',
    argument_chain: '#0e7490',
    collection: '#be185d',
    mechanism: '#c2410c',
    concept: '#15803d',
    source: '#475569',
    evidence_item: '#a16207',
    case: '#b91c1c',
    interpretation: '#7e22ce',
    question: '#57534e',
  },
  edgeColors: {
    domain: '#334155',
    claim_relation: '#b45309',
    inference: '#6d28d9',
    card_relationship: '#0e7490',
    classification: '#15803d',
    source: '#0369a1',
    evidence: '#be185d',
  },
}

/** Editorial — paper surfaces, warm ink, serif-led hierarchy. */
const EDITORIAL: GraphTreatmentTokens = {
  chrome: {
    page: '40 33% 96%',
    surface: '40 40% 99%',
    canvas: '40 33% 94%',
    inspector: '40 40% 99%',
    border: '35 20% 82%',
    accent: '24 60% 38%',
    accentForeground: '40 40% 99%',
    muted: '35 25% 92%',
    mutedForeground: '30 12% 42%',
    focus: '24 60% 38%',
    statusOk: '150 45% 30%',
    statusWarn: '38 92% 42%',
    statusNone: '30 10% 62%',
    controls: '40 40% 99%',
    disclaimer: '40 33% 96%',
    disclaimerBorder: '35 20% 82%',
  },
  typography: {
    fontFamily: "'Georgia', 'Iowan Old Style', 'Palatino Linotype', serif",
  },
  nodeColors: {
    card: '#92400e',
    claim: '#1e3a8a',
    inference_step: '#14532d',
    argument_chain: '#155e75',
    collection: '#831843',
    mechanism: '#9a3412',
    concept: '#166534',
    source: '#3f3f46',
    evidence_item: '#78350f',
    case: '#7f1d1d',
    interpretation: '#6b21a8',
    question: '#44403c',
  },
  edgeColors: {
    domain: '#44403c',
    claim_relation: '#92400e',
    inference: '#6d28d9',
    card_relationship: '#155e75',
    classification: '#166534',
    source: '#1d4ed8',
    evidence: '#9d174d',
  },
}

/** Workspace — cool grey surfaces, tight density, utilitarian accents. */
const WORKSPACE: GraphTreatmentTokens = {
  chrome: {
    page: '220 20% 94%',
    surface: '0 0% 100%',
    canvas: '220 20% 94%',
    inspector: '220 22% 97%',
    border: '220 12% 85%',
    accent: '220 91% 36%',
    accentForeground: '210 20% 98%',
    muted: '220 15% 92%',
    mutedForeground: '220 9% 40%',
    focus: '220 91% 36%',
    statusOk: '160 84% 30%',
    statusWarn: '26 90% 45%',
    statusNone: '215 16% 58%',
    controls: '0 0% 100%',
    disclaimer: '220 20% 94%',
    disclaimerBorder: '220 12% 85%',
  },
  typography: {
    fontFamily:
      "'SF Pro Text', 'Inter', 'system-ui', 'Segoe UI', Roboto, sans-serif",
  },
  nodeColors: {
    card: '#4338ca',
    claim: '#1d4ed8',
    inference_step: '#0f766e',
    argument_chain: '#0e7490',
    collection: '#be185d',
    mechanism: '#c2410c',
    concept: '#15803d',
    source: '#475569',
    evidence_item: '#a16207',
    case: '#b91c1c',
    interpretation: '#7e22ce',
    question: '#57534e',
  },
  edgeColors: {
    domain: '#334155',
    claim_relation: '#b45309',
    inference: '#6d28d9',
    card_relationship: '#0e7490',
    classification: '#15803d',
    source: '#0369a1',
    evidence: '#be185d',
  },
}

/** The token sets, keyed by treatment. */
export const GRAPH_TREATMENT_TOKENS: Record<
  GraphTreatment,
  GraphTreatmentTokens
> = {
  atmospheric: ATMOSPHERIC,
  editorial: EDITORIAL,
  workspace: WORKSPACE,
}

/** Display label per treatment, for the appearance selector. */
export const GRAPH_TREATMENT_LABELS: Record<GraphTreatment, string> = {
  atmospheric: 'Atmospheric',
  editorial: 'Editorial',
  workspace: 'Workspace',
}

/**
 * Whether a value names a real treatment.
 *
 * @param value Anything, typically a localStorage string.
 * @returns `true` for one of {@link GRAPH_TREATMENTS}.
 */
export function isGraphTreatment(value: unknown): value is GraphTreatment {
  return (
    typeof value === 'string' &&
    (GRAPH_TREATMENTS as readonly string[]).includes(value)
  )
}

/**
 * Read the persisted appearance choice from storage.
 *
 * `storage` is a minimal interface so tests can hand over a fake without
 * touching `localStorage`; `null` (e.g. no storage in Node) yields the default.
 * Unknown values fall back to the default rather than erroring.
 *
 * @param storage A `Storage`-like reader, or `null`.
 * @returns A valid {@link GraphTreatment}.
 */
export function readGraphTreatment(
  storage: Pick<Storage, 'getItem'> | null,
): GraphTreatment {
  if (storage === null) return 'atmospheric'
  const raw = storage.getItem(GRAPH_TREATMENT_STORAGE_KEY)
  return isGraphTreatment(raw) ? raw : 'atmospheric'
}
