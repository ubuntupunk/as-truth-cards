/**
 * The Cytoscape mount: the only component in the phase that touches a DOM
 * canvas, and deliberately the thinnest.
 *
 * Issue #3's boundary is enforced by how little lives here. This component
 * receives an already-converted {@link CytoscapePresentation} and a selection
 * identity, and it emits only selection identities — the same `{ kind, id }`
 * shape the inspector consumes. It never reads `data()`, never recomputes a
 * field, never styles anything (the stylesheet is `GRAPH_STYLESHEET`), and
 * never decides graph semantics. Everything this phase can be tested for in
 * Node lives outside this file; what remains (create → bind taps → sync a CSS
 * class → destroy) is the untestable-by-node three percent, which is why the
 * plan pins it thin and leaves the rest of the page covered.
 *
 * ## Lifecycle
 *
 * The core is recreated whenever the presentation instance changes (that is
 * once per projection fetch). Recreation is deliberate: Cytoscape mutates its
 * own `elements` array, and reusing one core across presentations risks stale
 * style/layout state the plan's determinism guarantee is about. The `selected`
 * class is then re-applied from the current `selectedId`, because a fresh core
 * has no class state.
 *
 * Selection is presentation state only — it paints a blue overlay and feeds
 * the inspector; it asserts nothing about the ontology.
 */

import type {
  BreadthFirstLayoutOptions,
  Core,
  EventObjectCore,
  EventObjectEdge,
  EventObjectNode,
  LayoutOptions,
} from 'cytoscape'
import cytoscape from 'cytoscape'
import { useEffect, useRef } from 'preact/hooks'
import type { CytoscapePresentation } from '../../trope-cards/src/graph/cytoscape-adapter.ts'
import type { InspectorSelection } from './entity-inspector'
import { GRAPH_STYLESHEET } from './graph-stylesheet'

/** Required layout options; `animate: false` keeps rendering deterministic. */
const LAYOUT_OPTIONS: BreadthFirstLayoutOptions = {
  name: 'breadthfirst',
  directed: true,
  animate: false,
  spacingFactor: 1.2,
  padding: 24,
}

/**
 * Create the layout options for a presentation.
 *
 * The focus node is named as the layout root when it is part of the
 * projection, so the breadth-first layers the layout draws coincide with the
 * projection's own `depth` measure. This reads the focus id the presentation
 * already carries — it is arrangement, not a second source of truth.
 *
 * @param presentation The presentation whose focus should root the layout.
 * @returns A `LayoutOptions` for `cy.layout`.
 */
export function layoutOptionsFor(
  presentation: CytoscapePresentation,
): LayoutOptions {
  const focusId = presentation.context.focus.id
  return {
    ...LAYOUT_OPTIONS,
    ...(focusId ? { roots: [focusId] } : {}),
  }
}

/**
 * Master the selection class on a core, idempotently.
 *
 * Independent of the component so it can be reasoned about and changed without
 * touching the mount. Existing `.selected` classes are cleared first, then a
 * single id is highlighted; `null` clears everything.
 *
 * @param cy The Cytoscape core.
 * @param selectedId The canonical id to highlight, or `null` for none.
 */
export function applySelectionState(cy: Core, selectedId: string | null): void {
  cy.elements().removeClass('selected')
  if (selectedId === null) return
  cy.$id(selectedId).addClass('selected')
}

/**
 * Graph canvas component.
 *
 * @param props.presentation The converted presentation for the current
 * projection (elements + context).
 * @param props.selectedId The currently selected canonical node/edge id, or
 * `null`. Rendered as the Cytoscape `.selected` overlay class only.
 * @param props.onSelect Fired with the canonical id of a tapped entity, or
 * `null` when the empty canvas is tapped.
 * @returns A `<div>` Cytoscape mounts into; sized by the page's CSS.
 * @example
 * ```tsx
 * <CytoscapeGraph
 *   presentation={presentation}
 *   selectedId={selection?.id ?? null}
 *   onSelect={setSelection}
 * />
 * ```
 */
export function CytoscapeGraph({
  presentation,
  selectedId,
  onSelect,
}: {
  presentation: CytoscapePresentation
  selectedId: string | null
  onSelect: (selection: InspectorSelection) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Read through a ref so the create-effect does not need `selectedId` in its
  // dependencies (a selection change must not rebuild the canvas).
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  // (Re)create the core from a fresh presentation. Deferred until the browser
  // renders the container, since Cytoscape mounts into a real DOM node.
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    if (presentation.elements.length === 0) return

    const cy = cytoscape({
      container,
      elements: presentation.elements,
      style: GRAPH_STYLESHEET,
      layout: layoutOptionsFor(presentation),
      wheelSensitivity: 0.2,
    })
    cyRef.current = cy
    // Test affordance: the canvas has no per-node DOM for WebDriver to click, so
    // browser smoke tests reach the instance through its container to emit taps.
    ;(container as { __cy?: Core }).__cy = cy

    const onTapNode = (event: EventObjectNode) => {
      onSelectRef.current({ kind: 'node', id: event.target.id() })
    }
    const onTapEdge = (event: EventObjectEdge) => {
      onSelectRef.current({ kind: 'edge', id: event.target.id() })
    }
    const onTapBackground = (event: EventObjectCore) => {
      if (event.target === cy) {
        onSelectRef.current(null)
      }
    }

    cy.on('tap', 'node', onTapNode)
    cy.on('tap', 'edge', onTapEdge)
    cy.on('tap', onTapBackground)

    applySelectionState(cy, selectedIdRef.current)

    return () => {
      cy.off('tap')
      cy.destroy()
      cyRef.current = null
      delete (container as { __cy?: Core }).__cy
    }
  }, [presentation])

  // Keep the overlay in step with selection state, including across a fresh
  // core from the effect above.
  useEffect(() => {
    const cy = cyRef.current
    if (cy === null) return
    applySelectionState(cy, selectedId)
  }, [selectedId])

  return <div ref={containerRef} className="h-full w-full" />
}
