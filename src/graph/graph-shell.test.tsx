/**
 * Tests for `graph-shell.tsx` — the fixed chrome of the Graph Explorer.
 *
 * The shell is surfaces only: context bar, heading, research disclaimer, and
 * the three slots (controls / workspace / status) in the approved top-to-bottom
 * order. The interesting contract is that a treatment's chrome reaches the DOM
 * as inline `--graph-<surface>-light` / `--graph-<surface>-dark` pairs on the
 * `data-treatment` element — which `index.css` maps onto the bare `--graph-*`
 * variables per theme — and that nothing semantic leaks into the shell.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
        order('data-testid="research-disclaimer"'),
      true,
    )
    assert.equal(
      order('data-testid="research-disclaimer"') < order('[[controls]]'),
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
    assert.ok(html.includes('Trope Cards'))
    assert.ok(
      html.includes(
        'Illustrative research collection. Claims, source leads, and inferences are unverified; no historical conclusions are established.',
      ),
    )
    assert.ok(html.includes('Research disclaimer'))
  })
})

describe('graph-shell appearance application', () => {
  it('marks the shell with the treatment and inline light/dark chrome variables', () => {
    const html = renderShell('atmospheric')
    assert.ok(html.includes('data-treatment="atmospheric"'))
    assert.ok(html.includes('--graph-page-light:220 14.3% 95.9%'))
    assert.ok(html.includes('--graph-accent-light:262 83.3% 57.8%'))
    assert.ok(html.includes('--graph-page-dark:215 28% 12%'))
    assert.ok(html.includes('--graph-accent-dark:262 90% 72%'))
    assert.equal(html.includes('--graph-page:'), false)
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
        html.includes(`--graph-page-light:${chrome.page}`),
        `${treatment} light page token must reach the DOM`,
      )
      assert.ok(
        html.includes(
          `--graph-page-dark:${GRAPH_TREATMENT_TOKENS[treatment].darkChrome.page}`,
        ),
        `${treatment} dark page token must reach the DOM`,
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

/** The chrome surfaces the app theme must repaint (bd `as-truth-cards-ci8`). */
const CHROME_SURFACES = [
  'page',
  'surface',
  'canvas',
  'inspector',
  'border',
  'accent',
  'accent-foreground',
  'muted',
  'muted-foreground',
  'focus',
  'status-ok',
  'status-warn',
  'status-none',
  'controls',
  'disclaimer',
  'disclaimer-border',
] as const

/** Read a repository file relative to this test. */
function repoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('graph-shell chrome across themes', () => {
  it('supplies a distinct dark chrome value for every surface of every treatment', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      const html = renderShell(treatment)
      for (const surface of CHROME_SURFACES) {
        const light = html.match(
          new RegExp(`--graph-${surface}-light:([^;"]+)`),
        )?.[1]
        const dark = html.match(
          new RegExp(`--graph-${surface}-dark:([^;"]+)`),
        )?.[1]
        assert.ok(
          light,
          `${treatment}: --graph-${surface}-light must reach the shell`,
        )
        assert.ok(
          dark,
          `${treatment}: --graph-${surface}-dark must reach the shell`,
        )
        assert.notEqual(
          dark,
          light,
          `${treatment}: dark ${surface} must differ from its light value`,
        )
        assert.match(
          dark,
          /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/,
          `${treatment}: dark ${surface} must be an HSL triplet`,
        )
      }
    }
  })

  it('selects light chrome normally and dark chrome under the .dark class', () => {
    const css = repoFile('src/index.css')
    const lightStart = css.indexOf('[data-treatment] {')
    const darkStart = css.indexOf('.dark [data-treatment] {')
    assert.notEqual(lightStart, -1, 'treatment zones must map light chrome')
    assert.notEqual(darkStart, -1, 'treatment zones must map dark chrome')
    const lightZone = css.slice(lightStart, darkStart)
    const darkZone = css.slice(darkStart, css.indexOf('}', darkStart))
    for (const surface of CHROME_SURFACES) {
      assert.match(
        lightZone,
        new RegExp(`--graph-${surface}:\\s*var\\(--graph-${surface}-light\\b`),
        `light mode must feed --graph-${surface} from its light variant`,
      )
      assert.match(
        darkZone,
        new RegExp(`--graph-${surface}:\\s*var\\(--graph-${surface}-dark\\b`),
        `dark mode must feed --graph-${surface} from its dark variant`,
      )
    }
  })

  it('keeps shell semantics identical when the dark class is on the page', () => {
    const shell = (
      <GraphShell
        treatment="editorial"
        controls="[[controls]]"
        workspace="[[workspace]]"
        status="[[status]]"
      />
    )
    const light = render(shell)
    const dark = render(<div className="dark">{shell}</div>)
    assert.equal(dark, `<div class="dark">${light}</div>`)
  })
})
