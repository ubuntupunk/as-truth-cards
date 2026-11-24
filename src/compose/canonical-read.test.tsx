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
import type { ComposeAuthState } from './compose-model'
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

/** A populated readout: two claims, one step, and one chain. */
const POPULATED: ComposeProjection = {
  cardId: 'card-1',
  claims: [
    NON_CANONICAL_STEP.claims[0],
    {
      id: 'claim-2',
      statement: 'A second recorded assertion',
      claimType: 'INTERPRETIVE',
      epistemicStatus: 'OPEN',
      description: null,
    },
  ],
  steps: NON_CANONICAL_STEP.steps,
  chains: [
    {
      id: 'chain-1',
      label: 'A recorded path',
      description: 'Recorded in the corpus.',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: 'WORKING',
      stepIds: ['step-1'],
    },
  ],
}

const renderPanel = (
  data: ComposeProjection | null,
  auth: ComposeAuthState = 'signed-in',
) => render(<CanonicalDecomposition data={data} auth={auth} />)

describe('CanonicalDecomposition', () => {
  it('names genuine corpus sparsity and points to working authoring', () => {
    const html = renderPanel(EMPTY)
    assert.ok(html.includes('Canonical claims are not currently recorded'))
    assert.ok(html.includes('begin with a working assertion'))
    assert.ok(!html.includes('No claims in this projection'))
    assert.ok(!html.includes('failed'))
  })

  it('says recorded steps in plain language and keeps the raw flag on demand', () => {
    const html = renderPanel(NON_CANONICAL_STEP)
    assert.ok(html.includes('Reasoning steps recorded for this card'))
    assert.ok(!html.includes('Canonical reasoning steps'))
    assert.ok(html.includes('Not yet canonical'))
    assert.ok(html.includes('Raw is_canonical flag'))
    assert.ok(html.includes('is_canonical: false'))
    assert.ok(html.includes('This recorded reasoning comes from the corpus.'))
    assert.ok(!html.includes('canonical decomposition'))
  })

  it('states the flag explicitly for a canonical step too', () => {
    const html = renderPanel({
      ...NON_CANONICAL_STEP,
      steps: [{ ...NON_CANONICAL_STEP.steps[0], isCanonical: true }],
    })
    assert.ok(html.includes('is_canonical: true'))
    assert.ok(!html.includes('is_canonical: false'))
    assert.ok(html.includes('· Canonical'))
    assert.ok(!html.includes('Not yet canonical'))
  })

  it('names the pending state as recorded reasoning', () => {
    const html = renderPanel(null)
    assert.ok(html.includes('Loading the recorded reasoning…'))
    assert.ok(!html.includes('canonical decomposition'))
  })

  it('names absent recorded chains without implying a projection failure', () => {
    const html = renderPanel(EMPTY)
    assert.ok(html.includes('No argument chains are currently recorded'))
    assert.ok(!html.includes('No argument chains in this projection'))
  })

  it('collapses a populated panel for a signed-in author with honest counts', () => {
    const html = renderPanel(POPULATED, 'signed-in')
    assert.ok(html.includes('<details'))
    assert.ok(!/<details[^>]*\sopen/.test(html))
    assert.ok(html.includes('>Recorded reasoning</h2>'))
    assert.ok(html.includes('READ ONLY · CORPUS'))
    assert.ok(html.includes('2 claims · 1 step · 1 chain'))
    assert.ok(html.includes('Read recorded'))
    assert.ok(html.includes('<h3'))
    assert.ok(!html.includes('<h4'))
  })

  it('keeps a populated panel open when the author is signed out', () => {
    const html = renderPanel(POPULATED, 'signed-out')
    assert.ok(/<details[^>]*\sopen/.test(html))
    assert.ok(html.includes('Hide recorded reasoning'))
    assert.ok(html.includes('A recorded inference'))
  })

  it('keeps the zero-claim explanation visible without a disclosure', () => {
    const html = renderPanel(EMPTY, 'signed-in')
    assert.ok(!html.includes('<details'))
    assert.ok(html.includes('0 claims · 0 steps · 0 chains'))
    assert.ok(html.includes('Canonical claims are not currently recorded'))
    assert.ok(html.includes('No reasoning steps are currently recorded'))
    assert.ok(html.includes('No argument chains are currently recorded'))
  })
})
