/**
 * Render tests for the onboarding journey's presentational panels.
 *
 * The harness renders to string, so these pin the copy, field values, error
 * surfaces, progress markers and button labels of each step exactly as the
 * improved Figma panels specify them — the interactive behaviour lives in the
 * tested `src/onboarding/wizard.ts` state machine and the page seam tests.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import {
  answerPreference,
  EMPTY_PROFILE_FORM,
  initialWizardState,
  setupMarkers,
} from '@/onboarding/wizard'
import { AppearanceStep } from './appearance-step'
import { CompletionPanel } from './completion-panel'
import { PreferencesStep } from './preferences-step'
import { ProfileStep } from './profile-step'
import { SetupStrip } from './setup-strip'

const noop = () => undefined

/** A wizard state seeded like a real fresh account. */
function freshState() {
  return initialWizardState({
    profile: { ...EMPTY_PROFILE_FORM, name: 'Dav' },
    treatment: 'atmospheric',
    preferences: { feedbackEmail: 'later', academicParticipation: 'later' },
    completed: false,
  })
}

describe('SetupStrip', () => {
  it('marks the current step with aria-current and done steps with a check', () => {
    const html = render(<SetupStrip markers={setupMarkers(freshState())} />)
    assert.ok(html.includes('aria-current="step"'))
    assert.ok(html.includes('Profile'))
    assert.ok(html.includes('Appearance'))
    assert.ok(html.includes('Research preferences'))
  })
})

describe('ProfileStep', () => {
  const renderStep = (
    overrides: Partial<Parameters<typeof ProfileStep>[0]> = {},
  ) =>
    render(
      <ProfileStep
        values={{ ...EMPTY_PROFILE_FORM, name: 'Dav' }}
        errors={{}}
        saving={false}
        markers={setupMarkers(freshState())}
        onFieldChange={noop}
        onNext={noop}
        onSkip={noop}
        onExit={noop}
        {...overrides}
      />,
    )

  it('renders the step-1 copy and the seeded field values', () => {
    const html = renderStep()
    assert.ok(html.includes('Step 1 of 3'))
    assert.ok(html.includes('A name, not a credential.'))
    assert.ok(html.includes('Start with the basics'))
    assert.ok(html.includes('value="Dav"'))
    assert.ok(html.includes('Skip for now'))
    assert.ok(html.includes('Back to account'))
    assert.ok(html.includes('Next: Appearance'))
  })

  it('surfaces a validation message with role=alert next to the field', () => {
    const html = renderStep({
      values: { ...EMPTY_PROFILE_FORM, name: '' },
      errors: {
        name: 'Add a display name to continue, or use “Skip for now”.',
      },
    })
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('Add a display name to continue'))
    assert.ok(html.includes('aria-invalid="true"'))
  })

  it('shows the saving state on the primary action', () => {
    assert.ok(renderStep({ saving: true }).includes('Saving…'))
  })
})

describe('AppearanceStep', () => {
  const renderStep = (treatment: 'atmospheric' | 'editorial' | 'workspace') =>
    render(
      <AppearanceStep
        treatment={treatment}
        markers={setupMarkers(freshState())}
        onSelect={noop}
        onBack={noop}
        onNext={noop}
        onSkip={noop}
      />,
    )

  it('renders the step-2 copy and all three treatments', () => {
    const html = renderStep('atmospheric')
    assert.ok(html.includes('Step 2 of 3'))
    assert.ok(html.includes('Choose your reading room.'))
    assert.ok(html.includes('Choose an appearance'))
    for (const label of ['Atmospheric', 'Editorial', 'Workspace']) {
      assert.ok(html.includes(label), `selector must offer ${label}`)
    }
    assert.ok(html.includes('← Back: Profile'))
    assert.ok(html.includes('Next: Research preferences'))
  })

  it('marks the selected treatment with aria-pressed=true', () => {
    const html = renderStep('editorial')
    const editorial = html.indexOf('>Editorial<')
    assert.ok(editorial > 0)
    const buttonStart = html.lastIndexOf('<button', editorial)
    assert.ok(
      html.slice(buttonStart, editorial).includes('aria-pressed="true"'),
    )
  })

  it('states honestly that the choice is device-local', () => {
    assert.ok(renderStep('atmospheric').includes('stored on this device'))
  })
})

describe('PreferencesStep', () => {
  const state = answerPreference(freshState(), 'feedbackEmail', 'no')
  const html = render(
    <PreferencesStep
      values={state.preferences}
      markers={setupMarkers(state)}
      finishing={false}
      onAnswer={noop}
      onBack={noop}
      onFinish={noop}
      onSkip={noop}
    />,
  )

  it('renders both optional questions with all three answers each', () => {
    assert.ok(html.includes('Step 3 of 3'))
    assert.ok(html.includes('Participate on your terms.'))
    assert.ok(html.includes('Feedback-related email'))
    assert.ok(html.includes('Academic participation'))
    assert.equal((html.match(/type="radio"/g) ?? []).length, 6)
  })

  it('checks the answered radio and keeps “Decide later” as the other default', () => {
    assert.ok(html.includes('name="feedbackEmail" value="no" checked'))
    assert.ok(
      html.includes('name="academicParticipation" value="later" checked'),
    )
  })

  it('labels the answers device-local and finishes via a real action', () => {
    assert.ok(html.includes('stored on this device'))
    assert.ok(html.includes('Finish setup'))
    assert.ok(html.includes('← Back: Appearance'))
    assert.ok(html.includes('Skip for now'))
  })

  it('shows the finishing state while the server call is in flight', () => {
    assert.ok(
      render(
        <PreferencesStep
          values={state.preferences}
          markers={setupMarkers(state)}
          finishing
          onAnswer={noop}
          onBack={noop}
          onFinish={noop}
          onSkip={noop}
        />,
      ).includes('Finishing…'),
    )
  })
})

describe('CompletionPanel', () => {
  const html = render(
    <CompletionPanel
      name="Dav"
      summary={{
        profile: 'Dav',
        appearance: 'Atmospheric',
        researchPreferences: 'Decide later',
      }}
      onReturn={noop}
      onReviewSettings={noop}
    />,
  )

  it('renders the completion heading, summary rows and research principle', () => {
    assert.ok(html.includes('Ready to follow the question, Dav.'))
    assert.ok(html.includes('data-testid="summary-profile"'))
    assert.ok(html.includes('>Dav</dd>'))
    assert.ok(html.includes('data-testid="summary-appearance"'))
    assert.ok(html.includes('>Atmospheric</dd>'))
    assert.ok(html.includes('data-testid="summary-preferences"'))
    assert.ok(html.includes('>Decide later</dd>'))
    assert.ok(html.includes('A completed profile is not research evidence'))
  })

  it('offers the two designed destinations, never a fake continue button', () => {
    assert.ok(html.includes('Return to the deck'))
    assert.ok(html.includes('Review Settings'))
    assert.equal(html.includes('Finish setup'), false)
  })
})
