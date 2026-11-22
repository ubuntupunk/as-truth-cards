/**
 * Tests for `graph-shell.tsx` — the fixed chrome of the Graph Explorer.
 *
 * The shell is surfaces only: context bar, heading, research disclaimer, and
 * the three slots (controls / workspace / status) in the approved top-to-bottom
 * order. Since bd `as-truth-cards-e4k` it no longer owns a treatment zone:
 * `TreatmentProvider` mounts the one `data-treatment` wrapper above the router.
 * These tests keep the composition and the per-treatment dark palette coverage
 * (bd `as-truth-cards-ci8`) without letting the shell become a second authority.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { TreatmentProvider } from '@/components/TreatmentProvider'
import {
  GRAPH_TREATMENT_TOKENS,
  GRAPH_TREATMENTS,
  type GraphTreatment,
} from './appearance'
import { GraphShell } from './graph-shell'

/** Render the shell with string slots so the composition order is visible. */
function renderShell() {
  return render(
    <GraphShell
      controls="[[controls]]"
      workspace="[[workspace]]"
      status="[[status]]"
    />,
  )
}

/** Render a treatment's tokens from the one global authority. */
function renderTreatment(treatment: GraphTreatment) {
  return render(
    <TreatmentProvider initialTreatment={treatment}>
      <span>[[content]]</span>
    </TreatmentProvider>,
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
  it('does not mount a second treatment zone', () => {
    const html = renderShell()
    assert.equal(html.includes('data-treatment='), false)
    assert.equal(html.includes('--graph-page-light:'), false)
    assert.equal(html.includes('--graph-page-dark:'), false)
    assert.equal(html.includes('--graph-font-family:'), false)
  })

  it('still consumes the global workspace font variable', () => {
    const html = renderShell()
    assert.match(html, /font-family:\s*var\(--graph-font-family\)/)
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

describe('global treatment chrome across themes', () => {
  it('supplies a distinct dark chrome value for every surface of every treatment', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      const html = renderTreatment(treatment)
      assert.ok(html.includes(`data-treatment="${treatment}"`))
      for (const surface of CHROME_SURFACES) {
        const light = html.match(
          new RegExp(`--graph-${surface}-light:([^;"]+)`),
        )?.[1]
        const dark = html.match(
          new RegExp(`--graph-${surface}-dark:([^;"]+)`),
        )?.[1]
        assert.ok(
          light,
          `${treatment}: --graph-${surface}-light must reach the global zone`,
        )
        assert.ok(
          dark,
          `${treatment}: --graph-${surface}-dark must reach the global zone`,
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
      assert.ok(
        html.includes(
          `--graph-font-family:${GRAPH_TREATMENT_TOKENS[treatment].typography.fontFamily}`,
        ),
        `${treatment}: type token must reach the global zone`,
      )
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
