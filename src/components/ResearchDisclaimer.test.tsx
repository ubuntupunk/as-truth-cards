/**
 * Tests for `ResearchDisclaimer` — the shared epistemic disclaimer.
 *
 * The whole point of extracting this component is that Decks, Graph, Research,
 * and Sources mount *identical* wording from one place. The contract is the
 * approved copy, a stable test id, and a `className` override that lets each
 * surface keep its own colour tokens without forking the text.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { ResearchDisclaimer } from './ResearchDisclaimer'

const APPROVED_COPY =
  'Illustrative research collection. Claims, source leads, and inferences are unverified; no historical conclusions are established.'

describe('ResearchDisclaimer', () => {
  it('renders the approved label and copy verbatim', () => {
    const html = render(<ResearchDisclaimer />)
    assert.ok(html.includes('data-testid="research-disclaimer"'))
    assert.ok(html.includes('Research disclaimer'))
    assert.ok(html.includes(APPROVED_COPY))
  })

  it('carries the standard theme tokens by default', () => {
    const html = render(<ResearchDisclaimer />)
    assert.ok(html.includes('border-border'))
    assert.ok(html.includes('bg-muted'))
    assert.ok(html.includes('text-muted-foreground'))
  })

  it('accepts a surface-specific className without changing the copy', () => {
    const html = render(
      <ResearchDisclaimer className="mt-5 border-graph-disclaimer-border bg-graph-disclaimer text-graph-muted-foreground" />,
    )
    assert.ok(html.includes('border-graph-disclaimer-border'))
    assert.ok(html.includes('bg-graph-disclaimer'))
    assert.ok(html.includes(APPROVED_COPY))
  })
})
