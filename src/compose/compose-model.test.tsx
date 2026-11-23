/**
 * Tests for `compose-model.ts` — the pure authoring model.
 *
 * The model is exactly the "drafting invariants" the server enforces, held before save: a
 * step has premises and conclusions over the card's own claims, a claim is referenced at
 * most once per list, ordinals stay dense on every edit, and a chain reaches only the
 * draft's own steps. These tests pin those invariants as pure-function facts, so the
 * editor's handlers and the save gate share one tested contract.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addChain,
  addChainStep,
  addConclusion,
  addPremise,
  addStep,
  addWorkingClaim,
  addWorkingConclusion,
  addWorkingPremise,
  canSaveDraft,
  draftIssues,
  draftsEqual,
  EMPTY_DRAFT,
  isWorkingLocalId,
  nextWorkingLocalId,
  removeChain,
  removeChainStep,
  removeConclusion,
  removePremise,
  removeStep,
  removeWorkingClaim,
  removeWorkingConclusion,
  removeWorkingPremise,
  setChainStepRole,
  setPremiseRole,
  updateChain,
  updateStep,
  updateWorkingClaim,
} from './compose-model'
import type {
  DraftChain,
  DraftPayload,
  DraftStep,
  DraftVocabulary,
} from './draft-types'

/** A served vocabulary with a couple of options per family. */
const VOCAB: DraftVocabulary = {
  inferenceTypes: ['DEDUCTIVE', 'INDUCTIVE', 'UNSPECIFIED'],
  premiseRoles: ['PRIMARY', 'CONTEXT', 'BRIDGE', 'COUNTERPREMISE'],
  chainKinds: [
    'PRIMARY_ARGUMENT',
    'COUNTERARGUMENT',
    'EDITORIAL_RECONSTRUCTION',
  ],
  stepRoles: ['MAIN', 'COUNTER', 'ALTERNATIVE', 'CONTEXT'],
}

/** A minimal, valid step over two claims. */
const stepInput = {
  label: 'The figure is authoritative',
  description: 'Because the census is credible.',
  inferenceType: 'DEDUCTIVE' as const,
  epistemicStatus: 'ESTABLISHED',
  notes: null,
  premises: [{ claimId: 'c-1', role: 'PRIMARY' as const }],
  conclusions: ['c-2'],
}

/** A draft with one valid step (still chain-less, so not yet saveable). */
function oneStepDraft(): DraftPayload {
  return addStep(EMPTY_DRAFT, stepInput)
}

/** A fully saveable draft: two steps, one chain naming step-0 MAIN and step-1 COUNTER. */
function saveableDraft(): DraftPayload {
  const withStep = addStep(EMPTY_DRAFT, stepInput)
  const second = addStep(
    withStep,
    {
      label: 'A counter-read',
      description: 'Challenges the premise.',
      inferenceType: 'ANALOGICAL',
      epistemicStatus: 'CONTEXT_DEPENDENT',
      notes: null,
      premises: [{ claimId: 'c-2', role: 'COUNTERPREMISE' }],
      conclusions: ['c-1'],
    },
    () => 'step-1',
  )
  const withChain = addChain(second, {
    label: 'The author argues',
    description: 'One way to read the card.',
    kind: 'PRIMARY_ARGUMENT',
    epistemicStatus: 'reviewed',
  })
  const withMain = addChainStep(withChain, 'chain-0', 'step-0', 'MAIN')
  return addChainStep(withMain, 'chain-0', 'step-1', 'COUNTER')
}

describe('addStep', () => {
  it('appends a step with a deterministic key and dense ordinals', () => {
    const draft = oneStepDraft()
    assert.equal(draft.steps.length, 1)
    const step = draft.steps[0]
    assert.equal(step.key, 'step-0')
    assert.deepEqual(
      step.premises.map((premise) => premise.ordinal),
      [0],
    )
    assert.deepEqual(
      step.conclusions.map((conclusion) => conclusion.ordinal),
      [0],
    )
  })

  it('uniquifies keys when a factory proposes a key that is already taken', () => {
    const first = addStep(EMPTY_DRAFT, stepInput, () => 'step-0')
    const proposals = ['step-0', 'step-0', 'step-1']
    let cursor = 0
    const factory = () => proposals[Math.min(cursor++, proposals.length - 1)]
    const second = addStep(first, stepInput, factory)
    assert.deepEqual(
      second.steps.map((step) => step.key),
      ['step-0', 'step-1'],
    )
  })
})

describe('updateStep / updateChain', () => {
  it('patches typed fields in place without touching claims', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0]
    const next = updateStep(draft, step.key, { label: 'Renamed' })
    const changed = next.steps[0]
    assert.equal(changed.label, 'Renamed')
    assert.equal(changed.epistemicStatus, step.epistemicStatus)
    assert.equal(changed.premises.length, 1)
  })

  it('leaves the draft equivalent for an unknown key', () => {
    const draft = oneStepDraft()
    assert.equal(
      draftsEqual(updateStep(draft, 'nope', { label: 'x' }), draft),
      true,
    )
  })

  it('patches a chain label and kind', () => {
    const withChain = addChain(oneStepDraft(), {
      label: 'Chain',
      description: 'd',
      kind: 'EDITORIAL_RECONSTRUCTION',
      epistemicStatus: '',
    })
    const next = updateChain(withChain, 'chain-0', {
      label: 'Renamed chain',
      kind: 'COUNTERARGUMENT',
    })
    const chain = next.chains[0]
    assert.equal(chain.label, 'Renamed chain')
    assert.equal(chain.kind, 'COUNTERARGUMENT')
  })
})

describe('removeStep', () => {
  it('removes the step and every chain that named it', () => {
    const draft = saveableDraft()
    assert.equal(draft.chains[0].steps.length, 2)
    const next = removeStep(draft, 'step-0')
    assert.equal(next.steps.length, 1)
    assert.equal(next.chains.length, 0)
  })

  it('reindexes the surviving chains deterministically', () => {
    const draft = saveableDraft()
    const next = removeStep(draft, 'step-0')
    for (const chain of next.chains) {
      assert.deepEqual(
        chain.steps.map((step) => step.ordinal),
        [],
      )
    }
  })
})

describe('premises and conclusions', () => {
  it('adds a premise once and ignores a second add of the same claim', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0]
    const once = addPremise(draft, step.key, 'c-3', 'CONTEXT')
    assert.equal(once.steps[0].premises.length, 2)
    const twice = addPremise(once, step.key, 'c-3', 'BRIDGE')
    const roles = twice.steps[0].premises
      .filter((p) => p.kind === 'canonical' && p.claimId === 'c-3')
      .map((p) => p.role)
    assert.deepEqual(roles, ['CONTEXT'])
  })

  it('reassigns dense ordinals after a premise is removed', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0]
    const withMore = addPremise(draft, step.key, 'c-3', 'CONTEXT')
    const removed = removePremise(withMore, step.key, 'c-1')
    assert.deepEqual(
      removed.steps[0].premises.map((premise) => premise.ordinal),
      [0],
    )
  })

  it('switches a premise role', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0]
    const next = setPremiseRole(draft, step.key, 'c-1', 'BRIDGE')
    assert.equal(next.steps[0].premises[0].role, 'BRIDGE')
  })

  it('keeps conclusions once-only and reindexes on remove', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0]
    const once = addConclusion(draft, step.key, 'c-3')
    const twice = addConclusion(once, step.key, 'c-3')
    assert.equal(twice.steps[0].conclusions.length, 2)
    const removed = removeConclusion(twice, step.key, 'c-2')
    assert.deepEqual(
      removed.steps[0].conclusions.map((conclusion) => conclusion.ordinal),
      [0],
    )
    assert.deepEqual(
      removed.steps[0].conclusions.map((conclusion) =>
        conclusion.kind === 'canonical'
          ? conclusion.claimId
          : conclusion.localId,
      ),
      ['c-3'],
    )
  })
})

describe('chains', () => {
  function chainWithTwoSteps(): DraftPayload {
    const withStep = addStep(EMPTY_DRAFT, stepInput)
    const second = addStep(
      withStep,
      {
        label: 'Counter',
        description: 'd',
        inferenceType: 'INDUCTIVE',
        epistemicStatus: 'OPEN',
        notes: null,
        premises: [{ claimId: 'c-2', role: 'PRIMARY' }],
        conclusions: ['c-1'],
      },
      () => 'step-1',
    )
    const withChain = addChain(second, {
      label: 'Both arguments',
      description: 'd',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: '',
    })
    return addChainStep(withChain, 'chain-0', 'step-1', 'COUNTER')
  }

  it('attaches only the draft’s own steps', () => {
    const draft = addChain(oneStepDraft(), {
      label: 'C',
      description: 'd',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: '',
    })
    const ignored = addChainStep(draft, 'chain-0', 'step-9', 'MAIN')
    assert.equal(ignored.chains[0].steps.length, 0)
  })

  it('attaches a step once, then reindexes on removal', () => {
    const draft = addChainStep(chainWithTwoSteps(), 'chain-0', 'step-0', 'MAIN')
    const attached = draft.chains[0]
    assert.deepEqual(
      attached.steps.map((step) => step.stepKey),
      ['step-1', 'step-0'],
    )
    const next = removeChainStep(draft, 'chain-0', 'step-1')
    assert.deepEqual(
      next.chains[0].steps.map((step) => step.ordinal),
      [0],
    )
  })

  it('relabels a step’s role within a chain', () => {
    const draft = chainWithTwoSteps()
    const next = setChainStepRole(draft, 'chain-0', 'step-1', 'ALTERNATIVE')
    assert.equal(next.chains[0].steps[0].role, 'ALTERNATIVE')
  })

  it('removes a chain', () => {
    const draft = chainWithTwoSteps()
    const next = removeChain(draft, 'chain-0')
    assert.equal(next.chains.length, 0)
    assert.equal(next.steps.length, 2)
  })
})

describe('draftsEqual', () => {
  it('distinguishes a label change and an omitted chain', () => {
    const base = oneStepDraft()
    const renamed = updateStep(base, 'step-0', { label: 'Different' })
    assert.equal(draftsEqual(base, renamed), false)
    assert.equal(draftsEqual(base, base), true)
  })

  it('is order-sensitive about steps', () => {
    const second = addStep(
      oneStepDraft(),
      {
        ...stepInput,
        label: 'Second',
        premises: [{ claimId: 'c-3', role: 'PRIMARY' }],
        conclusions: ['c-4'],
      },
      () => 'step-1',
    )
    const swapped: DraftPayload = {
      steps: [second.steps[1], second.steps[0]],
      chains: [],
      workingClaims: [],
    }
    assert.equal(draftsEqual(second, swapped), false)
  })
})

describe('the save gate (draftIssues + canSaveDraft)', () => {
  it('refuses an empty draft', () => {
    assert.equal(canSaveDraft(EMPTY_DRAFT), false)
    assert.ok(
      draftIssues(EMPTY_DRAFT).some((issue) => issue.subject === 'draft'),
    )
  })

  it('reports label, status, premise and conclusion defects per step', () => {
    const draft = addStep(EMPTY_DRAFT, {
      label: '',
      description: 'd',
      inferenceType: 'UNSPECIFIED',
      epistemicStatus: '',
      notes: null,
      premises: [],
      conclusions: [],
    })
    const messages = draftIssues(draft).filter(
      (issue) => issue.subject === 'step',
    )
    assert.ok(messages.some((issue) => issue.message.includes('label')))
    assert.ok(
      messages.some((issue) => issue.message.includes('epistemic status')),
    )
    assert.ok(messages.some((issue) => issue.message.includes('premise')))
    assert.ok(messages.some((issue) => issue.message.includes('conclusion')))
  })

  it('refuses a chain lacking a MAIN step', () => {
    const draft = addChain(oneStepDraft(), {
      label: 'Chain',
      description: 'd',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: 'reviewed',
    })
    const messages = draftIssues(draft).filter(
      (issue) => issue.subject === 'chain',
    )
    assert.ok(messages.some((issue) => issue.message.includes('MAIN')))
    assert.ok(!messages.some((issue) => issue.message.includes('COUNTER')))
  })

  it('accepts a MAIN-only chain: CHALLENGE is advisory for drafts', () => {
    const withChain = addChain(oneStepDraft(), {
      label: 'Chain',
      description: 'd',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: 'reviewed',
    })
    const withMain = addChainStep(withChain, 'chain-0', 'step-0', 'MAIN')
    assert.equal(canSaveDraft(withMain), true)
  })

  it('flags an orphaned chain step, so a payload from elsewhere cannot slip through', () => {
    // `removeStep` cascades, so the model never produces this state itself. The gate still
    // checks for it because the server reads drafts it did not author (an older payload, a
    // contract that tightened), and an orphaned reference is exactly what it would reject.
    const orphan: DraftPayload = {
      steps: [],
      workingClaims: [],
      chains: [
        {
          key: 'chain-0',
          label: 'C',
          description: 'd',
          kind: 'PRIMARY_ARGUMENT',
          epistemicStatus: 'reviewed',
          steps: [{ stepKey: 'step-0', role: 'MAIN', ordinal: 0 }],
        },
      ],
    }
    const found = draftIssues(orphan).find((issue) =>
      issue.message.includes('no longer has'),
    )
    assert.ok(found !== undefined)
  })

  it('passes a fully-authorised draft', () => {
    assert.equal(canSaveDraft(saveableDraft()), true)
  })

  it('orders defects by subject: draft, steps, then chains', () => {
    const issues = draftIssues(saveableDraft())
    const ranks = issues.map((issue) =>
      issue.subject === 'draft' ? 0 : issue.subject === 'step' ? 1 : 2,
    )
    assert.deepEqual(
      ranks,
      [...ranks].sort((a, b) => a - b),
    )
  })

  it('carries the defect’s key so the editor can point at it', () => {
    const draft = oneStepDraft()
    const stepIssues = draftIssues(draft).filter(
      (issue) => issue.subject === 'step',
    )
    assert.ok(stepIssues.every((issue) => issue.key === 'step-0'))
  })
})

describe('shape transportability of the model output', () => {
  it('produces only strings, numbers, booleans and nulls (JSON-safe)', () => {
    const json = JSON.stringify(saveableDraft())
    assert.ok(json.includes('"steps"'))
    assert.ok(json.includes('"chains"'))
  })

  it('chains keep an explicit kind the editor can round-trip', () => {
    const draft = addChain(oneStepDraft(), {
      label: 'C',
      description: 'd',
      kind: 'COUNTERARGUMENT',
      epistemicStatus: '',
    })
    const chain = draft.chains[0] as DraftChain
    assert.equal(chain.kind, 'COUNTERARGUMENT')
  })

  it('keeps premise role vocabulary within the served set', () => {
    const draft = oneStepDraft()
    const step = draft.steps[0] as DraftStep
    assert.ok(
      step.premises.every((premise) =>
        VOCAB.premiseRoles.includes(premise.role),
      ),
    )
  })
})

describe('working claims', () => {
  const claimInput = {
    label: 'The assertion under examination',
    description: 'Written by the researcher, not a corpus claim.',
    epistemicStatus: 'WORKING',
    source: null,
  }
  const UUID = '11111111-1111-4111-8111-111111111111'

  /** A draft with two working claims and no steps — a saveable partial draft. */
  function workingDraft() {
    const first = addWorkingClaim(EMPTY_DRAFT, 'wc-assertion', claimInput)
    return addWorkingClaim(first, 'wc-reason', {
      ...claimInput,
      label: 'The reason offered',
    })
  }

  it('makes a working-only draft saveable (M3) without implying canonical status', () => {
    const draft = workingDraft()
    assert.equal(draft.workingClaims.length, 2)
    assert.equal(draft.steps.length, 0)
    assert.equal(canSaveDraft(draft), true)
    assert.equal(draft.workingClaims[0].epistemicStatus, 'WORKING')
  })

  it('rejects a uuid-shaped local id so a working ref cannot masquerade as canonical', () => {
    assert.equal(isWorkingLocalId(UUID), false)
    assert.equal(isWorkingLocalId('wc-1'), true)
    const draft = addWorkingClaim(EMPTY_DRAFT, UUID, claimInput)
    assert.equal(draft.workingClaims.length, 0)
  })

  it('ignores a duplicate local id rather than creating two claims', () => {
    const first = addWorkingClaim(EMPTY_DRAFT, 'wc-1', claimInput)
    const second = addWorkingClaim(first, 'wc-1', claimInput)
    assert.equal(second.workingClaims.length, 1)
    assert.ok(
      draftIssues(second).some((issue) => issue.message.includes('unique')) ===
        false,
    )
  })

  it('reuses a freed local id instead of silently ignoring Add', () => {
    const first = addWorkingClaim(EMPTY_DRAFT, 'wc-1', claimInput)
    const second = addWorkingClaim(first, 'wc-2', claimInput)
    const withoutFirst = removeWorkingClaim(second, 'wc-1')
    assert.equal(nextWorkingLocalId(withoutFirst), 'wc-1')
    const added = addWorkingClaim(
      withoutFirst,
      nextWorkingLocalId(withoutFirst),
      claimInput,
    )
    assert.deepEqual(
      added.workingClaims.map((claim) => claim.localId),
      ['wc-2', 'wc-1'],
    )
  })

  it('flags duplicate local ids and blank statuses when a draft is hand-edited', () => {
    const draft: DraftPayload = {
      ...EMPTY_DRAFT,
      workingClaims: [
        { ...claimInput, localId: 'wc-1', label: '' },
        { ...claimInput, localId: 'wc-1', epistemicStatus: '' },
      ],
    }
    const messages = draftIssues(draft).map((issue) => issue.message)
    assert.ok(messages.some((message) => message.includes('unique')))
    assert.ok(messages.some((message) => message.includes('label')))
    assert.ok(messages.some((message) => message.includes('status')))
  })

  it('adds and removes working refs that resolve inside the draft', () => {
    const withClaim = workingDraft()
    const withStep = addStep(withClaim, {
      label: 'A working inference',
      description: 'Reasons over the researcher’s own assertions.',
      inferenceType: 'UNSPECIFIED',
      epistemicStatus: 'WORKING',
      notes: null,
      premises: [],
      conclusions: [],
    })
    const stepKey = withStep.steps[0].key
    const withPremise = addWorkingPremise(
      withStep,
      stepKey,
      'wc-assertion',
      'CONTEXT',
    )
    const withConclusion = addWorkingConclusion(
      withPremise,
      stepKey,
      'wc-reason',
    )
    assert.equal(withConclusion.steps[0].premises[0].kind, 'working')
    assert.equal(withConclusion.steps[0].conclusions[0].kind, 'working')
    assert.equal(canSaveDraft(withConclusion), true)

    const without = removeWorkingClaim(withConclusion, 'wc-assertion')
    assert.equal(without.workingClaims.length, 1)
    assert.equal(without.steps[0].premises.length, 0)
    assert.equal(without.steps[0].conclusions.length, 1)

    const restored = addPremise(without, stepKey, 'c-1', 'PRIMARY')
    assert.equal(canSaveDraft(restored), true)
    assert.equal(
      removeWorkingConclusion(restored, stepKey, 'wc-reason').steps[0]
        .conclusions.length,
      0,
    )
    assert.equal(
      removeWorkingPremise(restored, stepKey, 'wc-assertion').steps[0].premises
        .length,
      1,
    )
  })

  it('ignores a working ref whose claim was never authored', () => {
    const draft = addStep(workingDraft(), {
      label: 'A working inference',
      description: 'A dangling reference must not be created.',
      inferenceType: 'UNSPECIFIED',
      epistemicStatus: 'WORKING',
      notes: null,
      premises: [],
      conclusions: [],
    })
    const stepKey = draft.steps[0].key
    const withGhost = addWorkingPremise(draft, stepKey, 'wc-ghost', 'PRIMARY')
    assert.deepEqual(withGhost, draft)
  })

  it('flags a dangling working ref in a hand-edited draft', () => {
    const draft = addStep(workingDraft(), {
      label: 'A working inference',
      description: 'Hand-edited into an invalid state.',
      inferenceType: 'UNSPECIFIED',
      epistemicStatus: 'WORKING',
      notes: null,
      premises: [{ claimId: 'c-1', role: 'PRIMARY' }],
      conclusions: ['c-2'],
    })
    const edited: DraftPayload = {
      ...draft,
      steps: [
        {
          ...draft.steps[0],
          premises: [
            {
              kind: 'working',
              localId: 'wc-ghost',
              role: 'PRIMARY',
              ordinal: 0,
            },
          ],
        },
      ],
    }
    assert.ok(
      draftIssues(edited).some((issue) =>
        issue.message.includes('does not resolve'),
      ),
    )
  })

  it('patches a working claim without changing its local id', () => {
    const draft = updateWorkingClaim(workingDraft(), 'wc-reason', {
      ...claimInput,
      label: 'Renamed reason',
    })
    assert.equal(draft.workingClaims[1].localId, 'wc-reason')
    assert.equal(draft.workingClaims[1].label, 'Renamed reason')
  })
})
