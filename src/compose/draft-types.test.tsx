/**
 * Tests for `draft-types.ts` — the client-side presence guards.
 *
 * These guards are deliberately thin: they confirm the vocabulary catalogue is populated and
 * the draft envelope is a draft (not an error page), while leaving payload structure to the
 * server. The tests pin exactly that much — a populated catalogue passes, an empty or
 * half-formed one does not; a `{ draft: null }` read passes as "no draft", a non-envelope
 * does not.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isDraftEnvelope,
  isVocabulariesResponse,
  type VocabulariesResponse,
} from './draft-types'

const VOCABULARIES: VocabulariesResponse = {
  vocabularies: {
    inferenceTypes: ['DEDUCTIVE'],
    premiseRoles: ['PRIMARY'],
    chainKinds: ['PRIMARY_ARGUMENT'],
    stepRoles: ['MAIN'],
  },
}

describe('isVocabulariesResponse', () => {
  it('accepts a populated catalogue', () => {
    assert.equal(isVocabulariesResponse(VOCABULARIES), true)
  })

  it('rejects a catalogue missing a family', () => {
    const { stepRoles: _drop, ...rest } = VOCABULARIES.vocabularies
    assert.equal(isVocabulariesResponse({ vocabularies: rest }), false)
  })

  it('rejects an empty family', () => {
    assert.equal(
      isVocabulariesResponse({
        vocabularies: { ...VOCABULARIES.vocabularies, inferenceTypes: [] },
      }),
      false,
    )
  })

  it('rejects a non-object body', () => {
    assert.equal(isVocabulariesResponse(null), false)
    assert.equal(isVocabulariesResponse('nope'), false)
    assert.equal(isVocabulariesResponse({ vocabularies: null }), false)
  })
})

describe('isDraftEnvelope', () => {
  it('reads a signed-in user with no draft as an explicit null', () => {
    assert.equal(isDraftEnvelope({ draft: null }), true)
  })

  it('accepts a stored draft row', () => {
    assert.equal(
      isDraftEnvelope({
        draft: {
          cardSlug: 'a-card',
          createdAt: '2026-10-08T00:00:00.000Z',
          updatedAt: '2026-10-08T00:00:00.000Z',
          payload: { steps: [], chains: [] },
        },
      }),
      true,
    )
  })

  it('rejects a row whose payload is not a draft shape', () => {
    assert.equal(
      isDraftEnvelope({
        draft: {
          cardSlug: 'a-card',
          createdAt: 'x',
          updatedAt: 'x',
          payload: {},
        },
      }),
      false,
    )
  })

  it('rejects a non-envelope body, so an error page cannot masquerade as a draft', () => {
    assert.equal(isDraftEnvelope({ error: 'not found' }), false)
    assert.equal(isDraftEnvelope(undefined), false)
  })
})
