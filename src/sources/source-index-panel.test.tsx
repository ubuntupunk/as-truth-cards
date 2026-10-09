/**
 * Tests for `source-index-panel.tsx` — the canonical source index rail.
 *
 * The contracts under test are the honest states (loading / error / empty), the
 * per-source metadata and attribution readout, and the two actions: tracing a
 * source's provenance and saving it to the research session (keyed to
 * membership, never a dead button).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { SourceSummary } from '../graph/projection-guards'
import { SourceIndexPanel } from './source-index-panel'

/** A deterministic source row. */
function source(id: string, title: string): SourceSummary {
  return {
    id,
    title,
    author: 'An Author',
    publisher: null,
    citation: 'A Citation',
    url: null,
    sourceType: 'PRIMARY_DOCUMENT',
    claimSourceCount: 2,
  }
}

/** Render the panel with the shared no-op handlers. */
function renderPanel(
  overrides: Partial<Parameters<typeof SourceIndexPanel>[0]> = {},
) {
  return render(
    <SourceIndexPanel
      sources={[]}
      total={0}
      isPending={false}
      error={null}
      selectedId={null}
      onSelect={() => {}}
      {...overrides}
    />,
  )
}

describe('source-index-panel states', () => {
  it('shows a loading state while the index is in flight', () => {
    const html = renderPanel({ isPending: true })
    assert.ok(html.includes('data-testid="source-index-loading"'))
    assert.ok(!html.includes('data-testid="source-index-list"'))
  })

  it('shows an honest error state carrying the message', () => {
    const html = renderPanel({ error: new Error('boom') })
    assert.ok(html.includes('data-testid="source-index-error"'))
    assert.ok(html.includes('boom'))
  })

  it('shows an empty state when the corpus has no sources', () => {
    const html = renderPanel({ total: 0 })
    assert.ok(html.includes('data-testid="source-index-empty"'))
  })

  it('always states the attribution-vs-evidence boundary', () => {
    const html = renderPanel()
    assert.ok(html.includes('data-testid="source-index-scope"'))
    assert.ok(html.includes('provenance lead, not verified evidence'))
  })
})

describe('source-index-panel roster', () => {
  it('renders one row per source with type, metadata and attribution', () => {
    const html = renderPanel({
      sources: [source('a', 'First Source'), source('b', 'Second Source')],
      total: 2,
    })
    assert.ok(html.includes('data-testid="source-index-list"'))
    assert.ok(html.includes('data-source-id="a"'))
    assert.ok(html.includes('data-source-id="b"'))
    assert.ok(html.includes('First Source'))
    assert.ok(html.includes('Primary document'))
    assert.ok(html.includes('A Citation'))
    assert.ok(html.includes('2 claims attributed'))
    assert.ok(html.includes('data-testid="source-index-count"'))
  })

  it('marks the selected source and presses its trace button', () => {
    const html = renderPanel({
      sources: [source('a', 'First Source')],
      total: 1,
      selectedId: 'a',
    })
    assert.ok(html.includes('data-selected="true"'))
    assert.ok(html.includes('aria-pressed="true"'))
  })

  it('notes a source with no further metadata rather than blanking it', () => {
    const sparse: SourceSummary = {
      ...source('a', 'Sparse'),
      author: null,
      publisher: null,
      citation: null,
      claimSourceCount: 0,
    }
    const html = renderPanel({ sources: [sparse], total: 1 })
    assert.ok(html.includes('data-testid="source-index-no-metadata"'))
    assert.ok(html.includes('No claims attributed'))
  })

  it('exposes a clickable URL only when the corpus recorded one', () => {
    const withUrl = { ...source('a', 'Linked'), url: 'https://example.org/a' }
    const html = renderPanel({ sources: [withUrl], total: 1 })
    assert.ok(html.includes('data-testid="source-index-url"'))
    assert.ok(html.includes('https://example.org/a'))
    assert.ok(!html.includes('data-testid="source-index-save"'))
  })
})

describe('source-index-panel save affordance', () => {
  it('offers save when the session hook is wired', () => {
    const html = renderPanel({
      sources: [source('a', 'First')],
      total: 1,
      onSave: () => {},
      isSaved: () => false,
    })
    assert.ok(html.includes('data-testid="source-index-save"'))
    assert.ok(html.includes('Save to research'))
  })

  it('marks a saved source and disables the button', () => {
    const html = renderPanel({
      sources: [source('a', 'First')],
      total: 1,
      onSave: () => {},
      isSaved: () => true,
    })
    assert.ok(html.includes('>In session<'))
    assert.ok(html.includes('disabled'))
  })
})
