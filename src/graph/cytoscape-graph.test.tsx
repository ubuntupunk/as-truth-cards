/**
 * Tests for `cytoscape-graph.tsx` — the thin mount and its two pure exports.
 *
 * The full component needs a DOM canvas and a running Cytoscape core, which
 * is exactly why the plan keeps it thin and moves everything testable out of
 * it. Under Node we pin the two pure pieces: the layout options (focus as
 * root, animation off so rendering is deterministic) — and, via the fixture,
 * that the presentation this mount consumes is adapter-shaped, so the mount's
 * input contract holds even though the mount itself is not executed.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toCytoscapePresentation } from '../../trope-cards/src/graph/cytoscape-adapter.ts'
import { layoutOptionsFor } from './cytoscape-graph'
import { CARD_PROJECTION, ID } from './test-fixtures'

/**
 * Narrow a `LayoutOptions` to the concrete breadth-first options.
 * The layout function returns the union; the test wants the members the
 * breadth-first layout actually declares.
 */
function breadthFirst(layout: ReturnType<typeof layoutOptionsFor>) {
  assert.equal(layout.name, 'breadthfirst')
  const narrowed = layout as Extract<
    ReturnType<typeof layoutOptionsFor>,
    { name: 'breadthfirst' }
  >
  return narrowed
}

describe('layoutOptionsFor', () => {
  const presentation = toCytoscapePresentation(CARD_PROJECTION)

  it('names the focus node as the breadth-first root', () => {
    const layout = breadthFirst(layoutOptionsFor(presentation))
    assert.deepEqual(layout.roots, [ID.focusCard])
  })

  it('keeps animation off so rendering stays deterministic', () => {
    assert.equal(breadthFirst(layoutOptionsFor(presentation)).animate, false)
  })

  it('roots only the presentation the layout is asked to arrange', () => {
    assert.equal(presentation.context.focus.id, ID.focusCard)
  })
})
