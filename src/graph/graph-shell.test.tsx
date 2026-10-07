/**
 * Tests for `graph-shell.tsx` — the fixed chrome of the Graph Explorer.
 *
 * The shell is surfaces only: context bar, heading, research disclaimer, and
 * the three slots (controls / workspace / status) in the approved top-to-bottom
 * order. The interesting contract is that a treatment's chrome reaches the DOM
 * as inline `--graph-*` variables on the `data-treatment` element — that is what
 * makes the appearance switcher a working control without any class toggling —
 * and that nothing semantic leaks into the shell.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import {
  GRAPH_TREATMENT_TOKENS,
  GRAPH_TREATMENTS,
  type GraphTreatment,
} from './appearance'
import { GraphShell } from './graph-shell'

/** Render the shell with string slots so the composition order is visible. */
function renderShell(treatment: GraphTreatment = 'atmospheric') {
  return render(
    <GraphShell
      treatment={treatment}
      controls="[[controls]]"
      workspace="[[workspace]]"
      status="[[status]]"
    />,
  )
}

describe('graph-shell composition', () => {
  it('renders the regions in the approved top-to-bottom order', () => {
    const html = renderShell()
    const order = (marker: string) => html.indexOf(marker)
    assert.ok(order('data-testid="graph-context-bar"') >= 0)
    assert.equal(
      order('data-testid="graph-context-bar"') <
        order('data-testid="graph-heading"'),
      true,
    )
    assert.equal(
      order('data-testid="graph-heading"') <
        order('data-testid="graph-disclaimer"'),
      true,
    )
    assert.equal(
      order('data-testid="graph-disclaimer"') < order('[[controls]]'),
      true,
    )
    assert.equal(order('[[controls]]') < order('[[workspace]]'), true)
    assert.equal(order('[[workspace]]') < order('[[status]]'), true)
  })

  it('shows the exact Figma heading copy', () => {
    const html = renderShell()
    assert.ok(html.includes('>Relationships / Graph<'))
    assert.ok(html.includes('>Graph Explorer<'))
    assert.ok(
      html.includes(
        'Trace provenance and reasoning. Keep classification in view.',
      ),
    )
  })

  it('establishes the workspace as research with its disclaimer', () => {
    const html = renderShell()
    assert.ok(html.includes('Truth Cards'))
    assert.ok(
      html.includes(
        'This is a research collection, not itself a historical conclusion.',
      ),
    )
    assert.ok(html.includes('Research disclaimer'))
  })
})

describe('graph-shell appearance application', () => {
  it('marks the shell with the treatment and inline chrome variables', () => {
    const html = renderShell('atmospheric')
    assert.ok(html.includes('data-treatment="atmospheric"'))
    assert.ok(html.includes('--graph-page:220 14.3% 95.9%'))
    assert.ok(html.includes('--graph-accent:262 83.3% 57.8%'))
    assert.ok(html.includes('--graph-font-family:'))
  })

  it('applies a different token set per treatment', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      const html = renderShell(treatment)
      assert.ok(
        html.includes(`data-treatment="${treatment}"`),
        `${treatment} must mark the shell`,
      )
      const { chrome, typography } = GRAPH_TREATMENT_TOKENS[treatment]
      assert.ok(
        html.includes(`--graph-page:${chrome.page}`),
        `${treatment} page token must reach the DOM`,
      )
      assert.ok(
        html.includes(`--graph-font-family:${typography.fontFamily}`),
        `${treatment} type token must reach the DOM`,
      )
      // None of the graph-* utility classes leak into the shell markup.
      assert.ok(!html.includes('bg-graph-canvas'))
    }
  })
})
