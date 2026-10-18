/**
 * Journey-level regression tests for the guided-setup state machine.
 *
 * The onboarding route renders these transitions verbatim, so these tests pin
 * the behaviour the QA pass found missing: real step progression, validation
 * gating, skip semantics that never save or assert anything, server-confirmed
 * save/completion feeding back into state, and an honest completion summary.
 * A regression here cannot be masked by an E2E that only checks `onboardedAt`.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ANSWER_LABELS,
  answerPreference,
  applyProfileValidation,
  buildSetupSummary,
  EMPTY_PROFILE_FORM,
  editProfileField,
  type InitialWizardOptions,
  initialWizardState,
  isValidWebsite,
  markCompleted,
  markProfileSaved,
  nextStep,
  normalizeWebsite,
  PROFILE_LIMITS,
  type ProfileFormValues,
  previousStep,
  profileHasErrors,
  profileIsDirty,
  profileStepIsValid,
  selectTreatment,
  setupMarkers,
  skipStep,
  validateProfileForm,
} from './wizard'

/** A fresh-account starting point. */
function fresh(overrides: Partial<InitialWizardOptions> = {}) {
  return initialWizardState({
    profile: { ...EMPTY_PROFILE_FORM, name: 'Dav' },
    treatment: 'atmospheric',
    preferences: { feedbackEmail: 'later', academicParticipation: 'later' },
    completed: false,
    ...overrides,
  })
}

describe('initialWizardState', () => {
  it('opens a fresh account on step 1 with no save claimed', () => {
    const state = fresh()
    assert.equal(state.step, 'profile')
    assert.equal(state.completed, false)
    assert.equal(state.profileSaved, false)
    assert.equal(state.savedProfile, null)
  })

  it('opens an already-complete account on the review panel', () => {
    const state = fresh({ completed: true })
    assert.equal(state.step, 'review')
    assert.equal(state.completed, true)
    assert.equal(state.profileSaved, true)
    assert.deepEqual(state.savedProfile, state.profile)
  })

  it('is not dirty at the start — seeded values are the account’s own', () => {
    assert.equal(profileIsDirty(fresh()), false)
  })
})

describe('validateProfileForm', () => {
  it('requires a display name — the one required input', () => {
    const errors = validateProfileForm({ ...EMPTY_PROFILE_FORM, name: '   ' })
    assert.ok(errors.name, 'blank name must be an error')
    assert.equal(profileHasErrors(errors), true)
  })

  it('accepts a form with only a name (everything else is optional)', () => {
    const errors = validateProfileForm({ ...EMPTY_PROFILE_FORM, name: 'Dav' })
    assert.deepEqual(errors, {})
    assert.equal(profileStepIsValid(fresh()), true)
  })

  it('rejects an implausible website and accepts real shapes', () => {
    assert.equal(isValidWebsite('not a url'), false)
    assert.equal(isValidWebsite('nodots'), false)
    assert.equal(isValidWebsite(''), true, 'empty is valid — optional field')
    assert.equal(isValidWebsite('example.org'), true)
    assert.equal(isValidWebsite('www.example.org/path'), true)
    assert.equal(isValidWebsite('https://example.org/a?b=c'), true)
    const errors = validateProfileForm({
      ...EMPTY_PROFILE_FORM,
      name: 'Dav',
      website: 'not a url',
    })
    assert.ok(errors.website)
  })

  it('enforces the field length limits', () => {
    const errors = validateProfileForm({
      name: 'x'.repeat(PROFILE_LIMITS.name + 1),
      bio: 'x'.repeat(PROFILE_LIMITS.bio + 1),
      website: '',
      location: 'x'.repeat(PROFILE_LIMITS.location + 1),
    })
    assert.ok(errors.name)
    assert.ok(errors.bio)
    assert.ok(errors.location)
  })
})

describe('normalizeWebsite', () => {
  it('adds a scheme and trims, but never double-prefixes', () => {
    assert.equal(normalizeWebsite(' example.org '), 'https://example.org')
    assert.equal(
      normalizeWebsite('http://example.org/x'),
      'http://example.org/x',
    )
    assert.equal(normalizeWebsite(''), '')
  })
})

describe('step progression', () => {
  it('walks profile → appearance → preferences → review and clamps', () => {
    let state = fresh()
    state = nextStep(state)
    assert.equal(state.step, 'appearance')
    state = nextStep(state)
    assert.equal(state.step, 'preferences')
    state = nextStep(state)
    assert.equal(state.step, 'review')
    state = nextStep(state)
    assert.equal(state.step, 'review', 'review is terminal')
  })

  it('goes back without discarding entered values', () => {
    let state = fresh()
    state = editProfileField(state, 'bio', 'Studies')
    state = nextStep(state)
    state = previousStep(state)
    assert.equal(state.step, 'profile')
    assert.equal(state.profile.bio, 'Studies')
    assert.equal(previousStep(fresh()).step, 'profile', 'no step before 1')
  })

  it('skipping a step advances it while saving/asserting nothing', () => {
    const state = skipStep(fresh())
    assert.equal(state.step, 'appearance')
    assert.equal(state.profileSaved, false)
    assert.equal(state.savedProfile, null)
    assert.equal(state.completed, false)
  })
})

describe('validation gating and saves', () => {
  it('applyProfileValidation records errors without advancing', () => {
    let state = fresh()
    state = editProfileField(state, 'name', '')
    state = applyProfileValidation(state)
    assert.ok(state.profileErrors.name)
    assert.equal(state.step, 'profile')
  })

  it('editProfileField clears only that field’s error', () => {
    let state = applyProfileValidation(editProfileField(fresh(), 'name', ''))
    assert.ok(state.profileErrors.name)
    state = editProfileField(state, 'name', 'Dav')
    assert.equal(state.profileErrors.name, undefined)
  })

  it('markProfileSaved confirms the save, clears errors, ends dirty', () => {
    let state = editProfileField(fresh(), 'name', 'Dav S.')
    assert.equal(profileIsDirty(state), true)
    state = markProfileSaved(applyProfileValidation(state))
    assert.equal(state.profileSaved, true)
    assert.deepEqual(state.savedProfile, state.profile)
    assert.deepEqual(state.profileErrors, {})
    assert.equal(profileIsDirty(state), false)
  })

  it('further edits after a save are dirty again; reverting is clean', () => {
    let state = markProfileSaved(editProfileField(fresh(), 'name', 'Dav S.'))
    state = editProfileField(state, 'name', 'Dav S. Jr.')
    assert.equal(profileIsDirty(state), true)
    state = editProfileField(state, 'name', state.savedProfile?.name ?? '')
    assert.equal(profileIsDirty(state), false)
  })
})

describe('appearance and participation choices', () => {
  it('selectTreatment swaps the treatment without mutating the input', () => {
    const state = fresh()
    const next = selectTreatment(state, 'editorial')
    assert.equal(next.treatment, 'editorial')
    assert.equal(state.treatment, 'atmospheric', 'input state untouched')
  })

  it('answerPreference records one question only', () => {
    const state = answerPreference(fresh(), 'feedbackEmail', 'yes')
    assert.equal(state.preferences.feedbackEmail, 'yes')
    assert.equal(state.preferences.academicParticipation, 'later')
  })
})

describe('completion', () => {
  it('markCompleted moves to the review panel with completed=true', () => {
    let state = nextStep(nextStep(fresh()))
    state = markCompleted(state)
    assert.equal(state.step, 'review')
    assert.equal(state.completed, true)
  })

  it('summary reports a server-saved profile by name', () => {
    let state = markProfileSaved(editProfileField(fresh(), 'name', 'Dav'))
    state = markCompleted(state)
    const summary = buildSetupSummary(state)
    assert.equal(summary.profile, 'Dav')
    assert.equal(summary.appearance, 'Atmospheric')
    assert.equal(summary.researchPreferences, 'Decide later')
  })

  it('summary never claims a skipped profile was saved', () => {
    const skipped = markCompleted(skipStep(fresh()))
    assert.equal(buildSetupSummary(skipped).profile, 'Not added')

    const dirtyUnsaved = editProfileField(fresh(), 'bio', 'typed, not saved')
    assert.equal(
      buildSetupSummary(markCompleted(dirtyUnsaved)).profile,
      'Not saved yet',
    )
  })

  it('summary reflects differing participation answers honestly', () => {
    let state = answerPreference(fresh(), 'feedbackEmail', 'no')
    state = answerPreference(state, 'academicParticipation', 'yes')
    assert.equal(
      buildSetupSummary(state).researchPreferences,
      `${ANSWER_LABELS.no} / ${ANSWER_LABELS.yes}`,
    )
  })
})

describe('setupMarkers', () => {
  it('marks the current step and completed predecessors', () => {
    const markers = setupMarkers(fresh())
    assert.deepEqual(
      markers.map((m) => [m.label, m.current, m.done]),
      [
        ['Profile', true, false],
        ['Appearance', false, false],
        ['Research preferences', false, false],
      ],
    )
  })

  it('marks everything done and nothing current on the review panel', () => {
    const markers = setupMarkers(markCompleted(fresh()))
    assert.equal(
      markers.every((m) => m.done && !m.current),
      true,
    )
  })
})

describe('seeded profiles', () => {
  it('seeds from the account’s real server-side profile values', () => {
    const profile: ProfileFormValues = {
      name: 'Dav',
      bio: 'Research and education',
      website: 'example.org',
      location: 'Cape Town',
    }
    const state = fresh({ profile })
    assert.deepEqual(state.profile, profile)
    assert.equal(profileIsDirty(state), false)
  })
})
