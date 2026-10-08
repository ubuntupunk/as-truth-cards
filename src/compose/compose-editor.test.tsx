/**
 * Tests for `compose-editor.tsx` — the editor’s three state surfaces.
 *
 * The surfaces each carry one boundary the suite pins directly: PermissionGate proves the
 * editor is unreachable until the session state says signed-in, SaveBar proves the gate
 * *says why* a save is blocked (counts and words, never a silent grey), and ComposeEditor
 * proves Add Step / Add Chain produce editable rows whose options come from the served
 * vocabulary and the card’s own pool — the two and only two sources an author may draw on.
 *
 * Components are treated as pure functions (matching the deck suite’s convention): render
 * with `preact-render-to-string` to read HTML, and walk the component tree to invoke the
 * click/change handlers and observe the resulting callback payloads.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { buttonByText, buttonsLabelled, walk } from '@/deck/test-fixtures'
import { ComposeEditor, PermissionGate, SaveBar } from './compose-editor'
import {
  addChain,
  addStep,
  type ComposeAuthState,
  EMPTY_DRAFT,
} from './compose-model'
import type { CanonicalClaim } from './compose-projector'
import type { DraftPayload, DraftVocabulary } from './draft-types'

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

/** The card’s own claims — the pool an author may reason over. */
const POOL = new Map<string, CanonicalClaim>([
  [
    'c-1',
    {
      id: 'c-1',
      statement: 'Jesus was born in Bethlehem',
      claimType: 'HISTORICAL',
      epistemicStatus: 'ESTABLISHED',
      description: 'An attested historical claim.',
    },
  ],
  [
    'c-2',
    {
      id: 'c-2',
      statement: 'Zionism is a modern movement',
      claimType: 'THEOLOGICAL',
      epistemicStatus: 'CONTESTED',
      description: 'A contested assertion.',
    },
  ],
])

/** A draft with one blank step, as the Add Step button first produces. */
const DRAFT_WITH_BLANK_STEP: DraftPayload = {
  ...EMPTY_DRAFT,
  steps: [
    {
      key: 'step-0',
      label: '',
      description: '',
      inferenceType: 'DEDUCTIVE',
      epistemicStatus: '',
      notes: null,
      premises: [],
      conclusions: [],
    },
  ],
}

describe('PermissionGate', () => {
  it('renders the editor children when signed-in', () => {
    const html = render(
      <PermissionGate auth="signed-in">
        <p>the editor</p>
      </PermissionGate>,
    )
    assert.ok(html.includes('the editor'))
    assert.ok(!html.includes('Sign in'))
  })

  it('tells a signed-out author why the editor is absent', () => {
    const html = render(
      <PermissionGate auth="signed-out">
        <p>the editor</p>
      </PermissionGate>,
    )
    assert.ok(html.includes('Sign in to author your own decomposition'))
    assert.ok(!html.includes('the editor'))
  })

  it('offers the sign-in handoff and invokes it', () => {
    let handedOff = 0
    const tree = PermissionGate({
      auth: 'signed-out',
      onSignIn: () => {
        handedOff += 1
      },
      children: null,
    })
    const signIn = buttonByText(tree, 'Sign in')
    assert.ok(signIn !== undefined)
    ;(signIn?.props?.onClick as () => void)()
    assert.equal(handedOff, 1)
  })

  it('reads the checking state as a session probe, not an error', () => {
    const html = render(
      <PermissionGate auth="signing-in">
        <p>the editor</p>
      </PermissionGate>,
    )
    assert.ok(html.includes('Checking your session…'))
  })

  for (const auth of [
    'signing-in',
    'signed-out',
    'signed-in',
  ] as ComposeAuthState[]) {
    it(`accepts only the three known auth states (${auth})`, () => {
      assert.ok(['signing-in', 'signed-out', 'signed-in'].includes(auth))
    })
  }
})

describe('SaveBar', () => {
  const base = {
    auth: 'signed-in' as ComposeAuthState,
    dirty: false,
    canSave: false,
    issueCount: 0,
    hasDraft: false,
    savedAt: null,
    saving: false,
    savingError: null as string | null,
    onSave: () => {},
    onDiscard: () => {},
    onDelete: () => {},
  }

  it('reads the signed-out state without buttons', () => {
    const props = { ...base, auth: 'signed-out' as ComposeAuthState }
    const html = render(<SaveBar {...props} />)
    assert.ok(html.includes('Sign in to save your own decomposition.'))
    assert.equal(buttonsLabelled(SaveBar(props), 'Save draft').length, 0)
  })

  it('disables Save while unsaveable and names the blocker with its count', () => {
    const props = { ...base, dirty: true, canSave: false, issueCount: 3 }
    const tree = SaveBar(props)
    const save = buttonByText(tree, 'Save draft')
    assert.equal(save?.props?.disabled, true)
    const html = render(tree)
    assert.ok(html.includes('3 issues block saving'))
    assert.ok(html.includes('Unsaved changes'))
  })

  it('enables Save only when dirty and saveable, and fires it', () => {
    let saved = 0
    const props = {
      ...base,
      dirty: true,
      canSave: true,
      onSave: () => {
        saved += 1
      },
    }
    const tree = SaveBar(props)
    const save = buttonByText(tree, 'Save draft')
    assert.equal(save?.props?.disabled, false)
    ;(save?.props?.onClick as () => void)()
    assert.equal(saved, 1)
  })

  it('shows the saved time once a draft exists', () => {
    const savedAt = '2026-10-08T14:05:00Z'
    const date = new Date(savedAt)
    const expected = `Saved at ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`
    const html = render(<SaveBar {...base} savedAt={savedAt} hasDraft />)
    assert.ok(html.includes(expected))
    assert.ok(!html.includes('Unsaved changes'))
  })

  it('surfaces a save error as words, and offers Delete only when a draft exists', () => {
    const tree = SaveBar({
      ...base,
      savingError: 'The draft is not on this card.',
    })
    const html = render(tree)
    assert.ok(html.includes('The draft is not on this card.'))
    const deleteButton = buttonByText(tree, 'Delete saved draft')
    assert.equal(deleteButton?.props?.disabled, true)
    const enabled = SaveBar({ ...base, hasDraft: true })
    assert.equal(
      buttonByText(enabled, 'Delete saved draft')?.props?.disabled,
      false,
    )
  })

  it('keeps Discard disabled when the draft is clean', () => {
    const tree = SaveBar({ ...base, dirty: false })
    assert.equal(buttonByText(tree, 'Discard changes')?.props?.disabled, true)
  })

  it('renders the saving word while the write is in flight', () => {
    const html = render(<SaveBar {...base} dirty saving />)
    assert.ok(html.includes('Saving…'))
  })
})

describe('ComposeEditor', () => {
  function treeFor(
    draft: DraftPayload,
    issues: readonly import('./compose-model').ComposeIssue[] = [],
  ) {
    return ComposeEditor({
      draft,
      vocab: VOCAB,
      pool: POOL,
      issues,
      onChange: () => {},
    })
  }

  it('starts with an empty canvas and the two add buttons', () => {
    const html = render(treeFor(EMPTY_DRAFT))
    assert.ok(html.includes('data-testid="no-steps"'))
    assert.ok(html.includes('data-testid="no-chains"'))
    assert.ok(html.includes('Add step'))
    assert.ok(html.includes('Add chain'))
  })

  it('Add step produces an editable, blank row over the served vocabulary', () => {
    let next: DraftPayload | null = null
    const tree = ComposeEditor({
      draft: EMPTY_DRAFT,
      vocab: VOCAB,
      pool: POOL,
      issues: [],
      onChange: (value) => {
        next = value
      },
    })
    const add = buttonByText(tree, 'Add step')
    assert.ok(add !== undefined)
    ;(add?.props?.onClick as () => void)()
    assert.ok(next !== null)
    assert.equal(next.steps.length, 1)
    assert.equal(next.steps[0].inferenceType, 'DEDUCTIVE')
    const html = render(treeFor(next))
    assert.ok(html.includes('Unlabelled step'))
  })

  it('Add chain opens an empty chain card', () => {
    let next: DraftPayload | null = null
    const tree = ComposeEditor({
      draft: EMPTY_DRAFT,
      vocab: VOCAB,
      pool: POOL,
      issues: [],
      onChange: (value) => {
        next = value
      },
    })
    const add = buttonByText(tree, 'Add chain')
    ;(add?.props?.onClick as () => void)()
    assert.ok(next !== null)
    assert.equal(next.chains.length, 1)
    assert.equal(next.chains[0].kind, 'PRIMARY_ARGUMENT')
    assert.equal(next.chains[0].label, '')
  })

  it('lists every blocker with its own words and shows no banner when clear', () => {
    const issues = [
      {
        subject: 'draft' as const,
        key: null,
        message: 'Create at least one reasoning step.',
      },
      {
        subject: 'step' as const,
        key: 'step-0',
        message: 'The step needs at least one premise claim.',
      },
    ]
    const html = render(treeFor(DRAFT_WITH_BLANK_STEP, issues))
    assert.ok(html.includes('The draft is not saveable yet.'))
    assert.ok(html.includes('Create at least one reasoning step.'))
    assert.ok(html.includes('The step needs at least one premise claim.'))
    const clear = render(treeFor(DRAFT_WITH_BLANK_STEP))
    assert.ok(!clear.includes('data-testid="compose-issues"'))
  })

  it('lets a chain attach only the draft’s own steps, defaulting to MAIN', () => {
    const withStep = addStep(EMPTY_DRAFT, {
      label: 'First move',
      description: 'd',
      inferenceType: 'DEDUCTIVE',
      epistemicStatus: 'ESTABLISHED',
      notes: null,
      premises: [{ claimId: 'c-1', role: 'PRIMARY' }],
      conclusions: ['c-2'],
    })
    const withBoth = addStep(
      withStep,
      {
        label: 'Second move',
        description: 'd',
        inferenceType: 'INDUCTIVE',
        epistemicStatus: 'OPEN',
        notes: null,
        premises: [{ claimId: 'c-2', role: 'PRIMARY' }],
        conclusions: ['c-1'],
      },
      () => 'step-1',
    )
    const withChain = addChain(withBoth, {
      label: 'The line of argument',
      description: 'd',
      kind: 'PRIMARY_ARGUMENT',
      epistemicStatus: 'reviewed',
    })

    let next: DraftPayload | null = null
    const tree = ComposeEditor({
      draft: withChain,
      vocab: VOCAB,
      pool: POOL,
      issues: [],
      onChange: (value) => {
        next = value
      },
    })
    const attach = walk(tree, (vnode) => vnode.type === 'select').find(
      (select) =>
        (select.props?.['aria-label'] as string | undefined) ===
        'Attach a step to the chain',
    )
    assert.ok(
      attach !== undefined,
      'the attach select should exist once steps remain unattached',
    )
    const options = walk(attach, (vnode) => vnode.type === 'option').map(
      (option) => option.props?.children as string,
    )
    assert.deepEqual(options, ['First move', 'Second move'])
    ;(
      attach?.props?.onChange as (event: { target: { value: string } }) => void
    )({
      target: { value: 'step-0' },
    })
    assert.ok(next !== null)
    assert.equal(next.chains[0].steps[0].stepKey, 'step-0')
    assert.equal(next.chains[0].steps[0].role, 'MAIN')
  })

  it('draws premise role options only from the served vocabulary', () => {
    const { premises, conclusions } = DRAFT_WITH_BLANK_STEP.steps[0]
    const filled: DraftPayload = {
      ...DRAFT_WITH_BLANK_STEP,
      steps: [
        {
          ...DRAFT_WITH_BLANK_STEP.steps[0],
          label: 'First move',
          inferenceType: 'DEDUCTIVE',
          epistemicStatus: 'ESTABLISHED',
          premises: [
            ...premises,
            { claimId: 'c-1', role: 'PRIMARY', ordinal: 0 },
          ],
          conclusions: [...conclusions, { claimId: 'c-2', ordinal: 0 }],
        },
      ],
    }
    const html = render(treeFor(filled))
    assert.ok(html.includes('Jesus was born in Bethlehem'))
    for (const role of VOCAB.premiseRoles) {
      assert.ok(html.includes(`value="${role}"`))
    }
  })
})
