/**
 * Tests for `compose-projector.ts` — the canonical readout the compose screen studies.
 *
 * The projection a deploy serves is scoped to the *featured* card at depth 3, which means
 * it also carries neighbour cards' claims and steps. The whole reason the selectors exist is
 * that payload-wide reading would leak those neighbours into this card's claim pool and its
 * canonical reasoning list — so the tests' job is to pin the boundary, not the happy path.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NEIGHBOUR_PROJECTION } from '../deck/test-fixtures'
import { CARD_PROJECTION, ID } from '../graph/test-fixtures'
import { claimPool, selectComposeProjection } from './compose-projector'

describe('selectComposeProjection', () => {
  it('collects the featured card’s own claims, steps and chains in order', () => {
    const data = selectComposeProjection(CARD_PROJECTION, ID.focusCard)
    assert.deepEqual(
      data.claims.map((claim) => claim.id),
      [ID.claimOne, ID.claimTwo],
    )
    assert.deepEqual(
      data.steps.map((step) => step.id),
      [ID.stepOne, ID.stepTwo],
    )
    assert.deepEqual(
      data.chains.map((chain) => chain.id),
      [ID.chainOne],
    )
  })

  it('resolves step premise/conclusion references to the card’s own pool only', () => {
    const data = selectComposeProjection(CARD_PROJECTION, ID.focusCard)
    const step = data.steps.find((candidate) => candidate.id === ID.stepOne)
    assert.ok(step !== undefined)
    assert.deepEqual(step.premises, [{ id: ID.claimOne, role: 'PRIMARY' }])
    assert.deepEqual(step.conclusions, [{ id: ID.claimTwo }])
  })

  it('keeps neighbour claim and step nodes out of the readout', () => {
    const data = selectComposeProjection(NEIGHBOUR_PROJECTION, ID.focusCard)
    assert.ok(
      data.claims.every(
        (claim) => claim.id !== 'bf000000-0000-0000-0000-000000000112',
      ),
    )
    assert.ok(
      data.steps.every(
        (step) => step.id !== 'bf000000-0000-0000-0000-000000000122',
      ),
    )
  })

  it('resolves step references even when the step node arrives before its claims', () => {
    const reversed = {
      ...CARD_PROJECTION,
      nodes: [...CARD_PROJECTION.nodes].reverse(),
    }
    const data = selectComposeProjection(reversed, ID.focusCard)
    const step = data.steps.find((candidate) => candidate.id === ID.stepOne)
    assert.ok(step !== undefined)
    assert.deepEqual(step.premises, [{ id: ID.claimOne, role: 'PRIMARY' }])
    assert.deepEqual(step.conclusions, [{ id: ID.claimTwo }])
  })

  it('carries kind, inference type and status through for every chain and step', () => {
    const data = selectComposeProjection(CARD_PROJECTION, ID.focusCard)
    assert.equal(data.chains[0].kind, 'PRIMARY_ARGUMENT')
    assert.equal(data.steps[0].inferenceType, 'DEDUCTIVE')
    assert.equal(data.steps[0].isCanonical, true)
    assert.equal(data.steps[0].epistemicStatus, 'draft')
  })
})

describe('claimPool', () => {
  it('keys every own claim by id, and nothing else', () => {
    const pool = claimPool(CARD_PROJECTION, ID.focusCard)
    assert.deepEqual([...pool.keys()], [ID.claimOne, ID.claimTwo])
    assert.equal(
      pool.get(ID.claimOne)?.statement,
      'Jesus was born in Bethlehem',
    )
  })

  it('ignores neighbour claims', () => {
    const pool = claimPool(NEIGHBOUR_PROJECTION, ID.focusCard)
    assert.equal(pool.has('bf000000-0000-0000-0000-000000000112'), false)
  })
})
