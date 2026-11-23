/**
 * Tests for the read-only canonical panel's honesty contract.
 *
 * The panel describes corpus records, never the user's draft. Two wordings matter here: an
 * empty corpus must not look like a failed projection, and a step row must disclose its own
 * `is_canonical` flag instead of the section claiming every recorded step is canonical.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { CanonicalDecomposition } from './canonical-read'
import type { ComposeProjection } from './compose-projector'

/** An empty read panel: the projection loaded, but the card has no recorded claims. */
const EMPTY: ComposeProjection = {
  cardId: 'card-1',
  claims: [],
  steps: [],
  chains: [],
}

/** A panel with one recorded step whose is_canonical flag is false. */
const NON_CANONICAL_STEP: ComposeProjection = {
  cardId: 'card-1',
  claims: [
    {
      id: 'claim-1',
      statement: 'A recorded assertion',
      claimType: 'INTERPRETIVE',
      epistemicStatus: 'CONTESTED',
      description: null,
    },
  ],
  steps: [
    {
      id: 'step-1',
      label: 'A recorded inference',
      description: 'Recorded in the corpus, flagged non-canonical.',
      inferenceType: 'INDUCTIVE',
      epistemicStatus: 'CONTESTED',
      isCanonical: false,
      premises: [{ id: 'claim-1', role: 'PRIMARY' }],
      conclusions: [{ id: 'claim-1' }],
    },
  ],
  chains: [],
}

describe('CanonicalDecomposition', () => {
  it('names genuine corpus sparsity and points to working authoring', () => {
    const html = render(<CanonicalDecomposition data={EMPTY} />)
    assert.ok(html.includes('Canonical claims are not currently recorded'))
    assert.ok(html.includes('begin with a working assertion'))
    assert.ok(!html.includes('No claims in this projection'))
    assert.ok(!html.includes('failed'))
  })

  it('says recorded steps, not canonical steps, and discloses each row’s flag', () => {
    const html = render(<CanonicalDecomposition data={NON_CANONICAL_STEP} />)
    assert.ok(html.includes('Reasoning steps recorded for this card'))
    assert.ok(!html.includes('Canonical reasoning steps'))
    assert.ok(html.includes('is_canonical: false'))
  })

  it('states the flag explicitly for a canonical step too', () => {
    const html = render(
      <CanonicalDecomposition
        data={{
          ...NON_CANONICAL_STEP,
          steps: [{ ...NON_CANONICAL_STEP.steps[0], isCanonical: true }],
        }}
      />,
    )
    assert.ok(html.includes('is_canonical: true'))
    assert.ok(!html.includes('is_canonical: false'))
  })

  it('names absent recorded chains without implying a projection failure', () => {
    const html = render(<CanonicalDecomposition data={EMPTY} />)
    assert.ok(html.includes('No argument chains are currently recorded'))
    assert.ok(!html.includes('No argument chains in this projection'))
  })
})
