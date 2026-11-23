import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  argumentChainKindEnum,
  inferenceStepRoleEnum,
} from '../../trope-cards/src/db/schema/argumentChains.js'
import {
  inferencePremiseRoleEnum,
  inferenceTypeEnum,
} from '../../trope-cards/src/db/schema/claimDecomposition.js'
import {
  DECOMPOSITION_VOCABULARIES,
  draftPayloadSchema,
  type DraftPayload,
  referencedClaimIds,
} from './draft-contract.js'

/**
 * The draft contract.
 *
 * The behaviour under test is what a draft is allowed to be. Nothing here needs a database:
 * the contract is a pure function of a payload, and the referential half (claims belong to
 * the card) lives in the route. These tests pin the two things that matter — structure is
 * enforced the same way the canonical seed validators enforce it, and the vocabulary is the
 * ontology's, not a second copy — so a draft can never describe reasoning the graph could
 * not hold.
 */

const CLAIM_A = '11111111-1111-4111-8111-111111111111'
const CLAIM_B = '22222222-2222-4222-8222-222222222222'
const CLAIM_C = '33333333-3333-4333-8333-333333333333'
const CLAIM_D = '44444444-4444-4444-8444-444444444444'

/** A structurally valid draft: two steps and a complete MAIN/COUNTER chain. */
function validPayload(): {
  steps: unknown[]
  chains: unknown[]
} {
  return {
    steps: [
      {
        key: 'step-1',
        label: 'The trope reads agency as conspiracy',
        description: 'A pattern of attributing coordinated agency to a group.',
        inferenceType: 'INDUCTIVE',
        epistemicStatus: 'CONTESTED',
        notes: null,
        premises: [{ claimId: CLAIM_A, role: 'PRIMARY', ordinal: 0 }],
        conclusions: [{ claimId: CLAIM_B, ordinal: 0 }],
      },
      {
        key: 'step-2',
        label: 'The generalization is not licensed',
        description: 'The evidence does not support the totalizing conclusion.',
        inferenceType: 'DEDUCTIVE',
        epistemicStatus: 'CONTESTED',
        premises: [
          { claimId: CLAIM_C, role: 'PRIMARY', ordinal: 0 },
          { claimId: CLAIM_D, role: 'COUNTERPREMISE', ordinal: 1 },
        ],
        conclusions: [{ claimId: CLAIM_B, ordinal: 0 }],
      },
    ],
    chains: [
      {
        key: 'chain-1',
        label: 'Trope versus its rebuttal',
        description: 'The reading beside the argument against it.',
        kind: 'EDITORIAL_RECONSTRUCTION',
        epistemicStatus: 'CONTESTED',
        steps: [
          { stepKey: 'step-1', role: 'MAIN', ordinal: 0 },
          { stepKey: 'step-2', role: 'COUNTER', ordinal: 1 },
        ],
      },
    ],
  }
}

/**
 * Parse a mutated copy of {@link validPayload}.
 *
 * @param mutate Applied to a fresh, valid payload before parsing.
 * @returns The parse result.
 */
function parse(mutate: (payload: ReturnType<typeof validPayload>) => void) {
  const payload = validPayload()
  mutate(payload)
  return draftPayloadSchema.safeParse(payload)
}

/** Apply a change to the single step every mutation targets. */
function firstStep(payload: { steps: unknown[] }): Record<string, unknown> {
  return payload.steps[0] as Record<string, unknown>
}

/** Apply a change to the single chain every mutation targets. */
function firstChain(payload: { chains: unknown[] }): Record<string, unknown> {
  return payload.chains[0] as Record<string, unknown>
}

describe('draftPayloadSchema', () => {
  it('accepts a well-formed decomposition with a complete chain', () => {
    assert.equal(draftPayloadSchema.safeParse(validPayload()).success, true)
  })

  it('accepts a draft with no chains yet', () => {
    assert.equal(parse((draft) => {
      draft.chains = []
    }).success, true)
  })

  it('accepts several steps with distinct claim references', () => {
    const result = draftPayloadSchema.safeParse(validPayload())
    assert.equal(result.success, true)
  })

  it('rejects an empty toolbox of steps', () => {
    const result = parse((draft) => {
      draft.steps = []
    })
    assert.equal(result.success, false)
  })

  it('rejects a step with no premises', () => {
    const result = parse((draft) => {
      firstStep(draft).premises = []
    })
    assert.equal(result.success, false)
  })

  it('rejects a step with no conclusions', () => {
    const result = parse((draft) => {
      firstStep(draft).conclusions = []
    })
    assert.equal(result.success, false)
  })

  it('rejects the same premise claim twice in one step', () => {
    const result = parse((draft) => {
      firstStep(draft).premises = [
        { claimId: CLAIM_A, role: 'PRIMARY', ordinal: 0 },
        { claimId: CLAIM_A, role: 'CONTEXT', ordinal: 1 },
      ]
    })
    assert.equal(result.success, false)
  })

  it('rejects non-contiguous premise ordinals', () => {
    const result = parse((draft) => {
      firstStep(draft).premises = [
        { claimId: CLAIM_A, role: 'PRIMARY', ordinal: 0 },
        { claimId: CLAIM_C, role: 'CONTEXT', ordinal: 2 },
      ]
    })
    assert.equal(result.success, false)
  })

  it('rejects an inference type the ontology does not have', () => {
    const result = parse((draft) => {
      firstStep(draft).inferenceType = 'VIBES'
    })
    assert.equal(result.success, false)
  })

  it('rejects a premise role the ontology does not have', () => {
    const result = parse((draft) => {
      firstStep(draft).premises = [
        { claimId: CLAIM_A, role: 'ASSERTION', ordinal: 0 },
      ]
    })
    assert.equal(result.success, false)
  })

  it('rejects a blank epistemic status', () => {
    const result = parse((draft) => {
      firstStep(draft).epistemicStatus = '   '
    })
    assert.equal(result.success, false)
  })

  it('rejects a non-uuid claim reference', () => {
    const result = parse((draft) => {
      firstStep(draft).premises = [{ claimId: 'claim-a', role: 'PRIMARY', ordinal: 0 }]
    })
    assert.equal(result.success, false)
  })

  it('rejects duplicate step keys', () => {
    const result = parse((draft) => {
      firstStep(draft).key = 'step-1'
      ;(draft.steps[1] as Record<string, unknown>).key = 'step-1'
    })
    assert.equal(result.success, false)
  })

  it('rejects a chain kind the ontology does not have', () => {
    const result = parse((draft) => {
      firstChain(draft).kind = 'MY_TAKE'
    })
    assert.equal(result.success, false)
  })

  it('rejects a chain that references a step the draft does not have', () => {
    const result = parse((draft) => {
      firstChain(draft).steps = [
        { stepKey: 'ghost', role: 'MAIN', ordinal: 0 },
        { stepKey: 'step-2', role: 'COUNTER', ordinal: 1 },
      ]
    })
    assert.equal(result.success, false)
  })

  it('rejects a chain that references the same step twice', () => {
    const result = parse((draft) => {
      firstChain(draft).steps = [
        { stepKey: 'step-1', role: 'MAIN', ordinal: 0 },
        { stepKey: 'step-1', role: 'COUNTER', ordinal: 1 },
      ]
    })
    assert.equal(result.success, false)
  })

  it('accepts a MAIN-only chain: COUNTER is advisory for drafts, not required', () => {
    const result = parse((draft) => {
      firstChain(draft).steps = [{ stepKey: 'step-1', role: 'MAIN', ordinal: 0 }]
    })
    assert.equal(result.success, true)
  })

  it('rejects an empty chain: a valid chain needs at least one actual step', () => {
    const result = parse((draft) => {
      firstChain(draft).steps = []
    })
    assert.equal(result.success, false)
  })

  it('rejects a chain step role the ontology does not have', () => {
    const result = parse((draft) => {
      firstChain(draft).steps = [
        { stepKey: 'step-1', role: 'PRO', ordinal: 0 },
        { stepKey: 'step-2', role: 'COUNTER', ordinal: 1 },
      ]
    })
    assert.equal(result.success, false)
  })
})

describe('DECOMPOSITION_VOCABULARIES', () => {
  it('is the canonical ontology, not a parallel copy', () => {
    assert.deepEqual(DECOMPOSITION_VOCABULARIES.inferenceTypes, [
      ...inferenceTypeEnum.enumValues,
    ])
    assert.deepEqual(DECOMPOSITION_VOCABULARIES.premiseRoles, [
      ...inferencePremiseRoleEnum.enumValues,
    ])
    assert.deepEqual(DECOMPOSITION_VOCABULARIES.chainKinds, [
      ...argumentChainKindEnum.enumValues,
    ])
    assert.deepEqual(DECOMPOSITION_VOCABULARIES.stepRoles, [
      ...inferenceStepRoleEnum.enumValues,
    ])
  })
})

describe('referencedClaimIds', () => {
  it('returns each referenced claim once, premises and conclusions together', () => {
    const parsed = draftPayloadSchema.parse(validPayload())
    const ids = referencedClaimIds(parsed)
    assert.deepEqual([...ids].sort(), [CLAIM_A, CLAIM_B, CLAIM_C, CLAIM_D].sort())
  })

  it('never returns working local ids: only canonical claims reach the graph', () => {
    const parsed = draftPayloadSchema.parse({
      ...workingOnlyPayload(),
      steps: [
        {
          key: 'step-1',
          label: 'A working inference',
          description: 'Entirely non-canonical.',
          inferenceType: 'UNSPECIFIED',
          epistemicStatus: 'WORKING',
          notes: null,
          premises: [
            { kind: 'working', localId: WC_ASSERTION, role: 'PRIMARY', ordinal: 0 },
          ],
          conclusions: [{ kind: 'working', localId: WC_REASON, ordinal: 0 }],
        },
      ],
      workingClaims: [workingClaim(WC_ASSERTION), workingClaim(WC_REASON)],
    })
    assert.deepEqual(referencedClaimIds(parsed), [])
  })
})

// ---------------------------------------------------------------------------
// Working claims (S1): tagged refs inside the existing draft JSON
// ---------------------------------------------------------------------------

const WC_ASSERTION = 'wc-assertion'
const WC_REASON = 'wc-reason'

/** A working claim: researcher-authored, owned by this draft, never canonical. */
function workingClaim(localId = WC_ASSERTION) {
  return {
    localId,
    label: 'The assertion under examination',
    description: 'Written by the researcher; not a canonical claim.',
    epistemicStatus: 'WORKING',
    source: null,
  }
}

/** A saveable partial draft: working claims, but no reasoning steps yet. */
function workingOnlyPayload() {
  return {
    steps: [],
    chains: [],
    workingClaims: [workingClaim()],
  }
}

/** A step whose premises and conclusions are working refs only. */
function workingStep() {
  return {
    key: 'step-1',
    label: 'What follows from the working assertion',
    description: 'A working inference, not a canonical one.',
    inferenceType: 'UNSPECIFIED',
    epistemicStatus: 'WORKING',
    notes: null,
    premises: [
      { kind: 'working', localId: WC_ASSERTION, role: 'PRIMARY', ordinal: 0 },
    ],
    conclusions: [{ kind: 'working', localId: WC_REASON, ordinal: 0 }],
  }
}

describe('working claims', () => {
  it('accepts a partial draft with only working claims (M3)', () => {
    const result = draftPayloadSchema.safeParse(workingOnlyPayload())
    assert.equal(result.success, true, result.success ? '' : result.error.message)
    if (result.success) assert.equal(result.data.workingClaims.length, 1)
  })

  it('rejects an entirely empty payload', () => {
    assert.equal(
      draftPayloadSchema.safeParse({ steps: [], chains: [] }).success,
      false,
    )
  })

  it('defaults workingClaims to empty for legacy stored drafts', () => {
    const result = draftPayloadSchema.safeParse(validPayload())
    assert.equal(result.success, true)
    if (result.success) assert.deepEqual(result.data.workingClaims, [])
  })

  it('normalizes legacy plain claimId refs to tagged canonical refs', () => {
    const result = draftPayloadSchema.parse(validPayload())
    assert.deepEqual(result.steps[0].premises[0], {
      kind: 'canonical',
      claimId: CLAIM_A,
      role: 'PRIMARY',
      ordinal: 0,
    })
    assert.deepEqual(result.steps[0].conclusions[0], {
      kind: 'canonical',
      claimId: CLAIM_B,
      ordinal: 0,
    })
  })

  it('accepts working refs that resolve to claims in the same draft', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      workingClaims: [workingClaim(WC_ASSERTION), workingClaim(WC_REASON)],
      steps: [workingStep()],
    })
    assert.equal(result.success, true, result.success ? '' : result.error.message)
  })

  it('rejects a working ref with no matching working claim in the draft', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      steps: [workingStep()],
    })
    assert.equal(result.success, false)
  })

  it('rejects duplicate working local ids', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      workingClaims: [workingClaim(), workingClaim()],
    })
    assert.equal(result.success, false)
  })

  it('rejects a working local id that is a canonical uuid', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      workingClaims: [workingClaim(CLAIM_A)],
    })
    assert.equal(result.success, false)
  })

  it('rejects the same working ref twice in one premise list', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      workingClaims: [workingClaim()],
      steps: [
        {
          ...workingStep(),
          premises: [
            { kind: 'working', localId: WC_ASSERTION, role: 'PRIMARY', ordinal: 0 },
            { kind: 'working', localId: WC_ASSERTION, role: 'CONTEXT', ordinal: 1 },
          ],
          conclusions: [
            { kind: 'working', localId: WC_ASSERTION, ordinal: 0 },
          ],
        },
      ],
    })
    assert.equal(result.success, false)
  })

  it('rejects a working claim with a blank label', () => {
    const result = draftPayloadSchema.safeParse({
      ...workingOnlyPayload(),
      workingClaims: [{ ...workingClaim(), label: '   ' }],
    })
    assert.equal(result.success, false)
  })

  it('does not default a working claim to an established status', () => {
    const result = draftPayloadSchema.parse(workingOnlyPayload())
    assert.equal(result.workingClaims[0].epistemicStatus, 'WORKING')
  })
})

describe('validated payload typing', () => {
  it('exposes the tagged working ref shape to callers', () => {
    const payload: DraftPayload = draftPayloadSchema.parse({
      ...workingOnlyPayload(),
      steps: [workingStep()],
      workingClaims: [workingClaim(WC_ASSERTION), workingClaim(WC_REASON)],
    })
    const premise = payload.steps[0].premises[0]
    assert.equal(premise.kind, 'working')
    if (premise.kind === 'working') assert.equal(premise.localId, WC_ASSERTION)
  })
})
