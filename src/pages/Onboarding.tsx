import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { useNavigate } from 'react-router-dom'
import { completeOnboarding } from '@/auth/onboarding'
import { updateProfile } from '@/auth/profile'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { AppearanceStep } from '@/components/onboarding/appearance-step'
import { CompletionPanel } from '@/components/onboarding/completion-panel'
import { PreferencesStep } from '@/components/onboarding/preferences-step'
import { ProfileStep } from '@/components/onboarding/profile-step'
import { ResearchPreferencesPanel } from '@/components/research-preferences-panel'
import { Button } from '@/components/ui/button'
import {
  type GraphTreatment,
  graphTreatmentVars,
  readGraphTreatment,
  writeGraphTreatment,
} from '@/graph/appearance'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import {
  type ParticipationAnswer,
  type ParticipationPreferences,
  readParticipationPreferences,
  saveParticipationPreferences,
} from '@/onboarding/preferences'
import {
  answerPreference,
  applyProfileValidation,
  buildSetupSummary,
  editProfileField,
  initialWizardState,
  markCompleted,
  markProfileSaved,
  nextStep,
  normalizeWebsite,
  type ParticipationKey,
  type ProfileField,
  previousStep,
  profileHasErrors,
  profileIsDirty,
  selectTreatment,
  setupMarkers,
  skipStep,
  type WizardState,
} from '@/onboarding/wizard'

/**
 * The guided-setup route — a thin renderer over the pure journey in
 * `src/onboarding/wizard.ts`.
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved"
 * (`62:12550`): page introduction, three steps (profile → appearance →
 * research preferences) and the server-confirmed completion panel. Every
 * outcome shown after an action is confirmed by the server (profile save via
 * Better Auth's update-user endpoint, completion via
 * `POST /api/account/onboarding/complete`) or is explicitly device-local
 * (appearance, participation answers). Revisiting the route while already
 * complete shows the completion panel, never a fake "continue setup" button.
 */

/** Best-effort error message extraction for the page-level error banner. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : fallback
}

/** The browser's localStorage, or null outside a browser / privacy mode. */
function deviceStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Onboarding page: the three-step setup journey and completion panel.
 *
 * @returns The onboarding route element.
 */ const Onboarding = () => {
  const { isSignedIn, user, loading, onboardingComplete, refetch } =
    useAdminCheck()
  const navigate = useNavigate()
  const [wizard, setWizard] = useState<WizardState | null>(null)
  const [busy, setBusy] = useState<'profile' | 'finish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The completion panel's "Review Settings" opens the same editable
  // preferences panel the account Settings page uses, in place, rather than
  // navigating away from a just-finished journey.
  const [reviewingSettings, setReviewingSettings] = useState(false)
  const settingsPanel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!reviewingSettings) return
    settingsPanel.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [reviewingSettings])

  // Seed the journey once from the three real sources: the session profile,
  // the device's stored appearance, and the device's stored participation
  // answers. Server-owned completion decides whether it opens on step 1 or the
  // completion panel.
  useEffect(() => {
    if (loading || !user || wizard !== null) return
    setWizard(
      initialWizardState({
        profile: {
          name: user.name,
          bio: user.bio ?? '',
          website: user.website ?? '',
          location: user.location ?? '',
        },
        treatment: readGraphTreatment(deviceStorage()),
        preferences: readParticipationPreferences(deviceStorage()),
        completed: onboardingComplete,
      }),
    )
  }, [loading, user, wizard, onboardingComplete])

  const handleFieldChange = (field: ProfileField, value: string) => {
    if (wizard === null) return
    setWizard(editProfileField(wizard, field, value))
  }

  const handleProfileNext = async () => {
    if (wizard === null) return
    const validated = applyProfileValidation(wizard)
    if (profileHasErrors(validated.profileErrors)) {
      setWizard(validated)
      return
    }
    if (!profileIsDirty(validated)) {
      setWizard(nextStep(validated))
      return
    }
    setBusy('profile')
    setError(null)
    try {
      await updateProfile({
        name: validated.profile.name.trim(),
        bio: validated.profile.bio.trim(),
        website: normalizeWebsite(validated.profile.website),
        location: validated.profile.location.trim(),
      })
      setWizard(nextStep(markProfileSaved(validated)))
      await refetch()
    } catch (err) {
      setError(messageOf(err, 'Failed to save profile details'))
    } finally {
      setBusy(null)
    }
  }

  const handleFinish = async () => {
    if (wizard === null) return
    setBusy('finish')
    setError(null)
    try {
      let state = wizard
      if (profileIsDirty(state)) {
        await updateProfile({
          name: state.profile.name.trim(),
          bio: state.profile.bio.trim(),
          website: normalizeWebsite(state.profile.website),
          location: state.profile.location.trim(),
        })
        state = markProfileSaved(state)
      }
      await completeOnboarding()
      setWizard(markCompleted(state))
      await refetch()
    } catch (err) {
      setError(messageOf(err, 'Failed to finish setup'))
    } finally {
      setBusy(null)
    }
  }

  const handleSelectTreatment = (treatment: GraphTreatment) => {
    if (wizard === null) return
    writeGraphTreatment(treatment, deviceStorage())
    setWizard(selectTreatment(wizard, treatment))
  }

  const handleAnswer = (
    question: ParticipationKey,
    answer: ParticipationAnswer,
  ) => {
    if (wizard === null) return
    const next = answerPreference(wizard, question, answer)
    saveParticipationPreferences(next.preferences, deviceStorage())
    setWizard(next)
  }

  /**
   * Persist a settings-panel save onto the still-mounted wizard, so the
   * completion summary and the panel agree on what was actually stored.
   */
  const handleSaveSettings = async (
    next: ParticipationPreferences,
    treatment: GraphTreatment,
  ) => {
    saveParticipationPreferences(next, deviceStorage())
    writeGraphTreatment(treatment, deviceStorage())
    setWizard((previous) =>
      previous === null
        ? previous
        : {
            ...previous,
            preferences: next,
            treatment,
          },
    )
  }

  const handleReturnToDeck = () => {
    navigate('/')
  }

  const activeTreatment =
    wizard?.treatment ?? readGraphTreatment(deviceStorage())

  const shell = (content: ComponentChildren) => (
    <div
      className="flex min-h-screen flex-col bg-graph-page"
      data-treatment={activeTreatment}
      style={graphTreatmentVars(activeTreatment)}
    >
      <Header />
      <main className="flex-grow px-4 pb-16 pt-24">
        {/* The graph chrome tokens zone the setup panels; the header and
            footer stay on the site stack because they sit outside it. */}
        <div
          className="mx-auto w-full max-w-6xl"
          style={{ fontFamily: 'var(--graph-font-family)' }}
        >
          {content}
        </div>
      </main>
      <Footer />
    </div>
  )

  if (loading || (isSignedIn && wizard === null)) {
    return shell(
      <p
        className="text-sm text-muted-foreground"
        data-testid="onboarding-loading"
      >
        Loading...
      </p>,
    )
  }

  if (!isSignedIn || !user) {
    return shell(
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Guided setup
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to finish setting up your account. Your progress is preserved
          on the account, not this page.
        </p>
        <Button onClick={() => navigate('/sign-in?returnTo=/onboarding')}>
          Sign in
        </Button>
      </div>,
    )
  }

  if (wizard === null) {
    return shell(<p className="text-sm text-muted-foreground">Loading...</p>)
  }

  const intro = (
    <header className="mb-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        First use / Guided setup
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Make the deck yours.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Start with a name. Everything else is optional and can be changed later
        in Settings.
      </p>
    </header>
  )

  const errorBanner = error ? (
    <div
      role="alert"
      className="mb-6 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
      data-testid="onboarding-error"
    >
      {error}
    </div>
  ) : null

  let body: ComponentChildren
  switch (wizard.step) {
    case 'profile':
      body = (
        <ProfileStep
          values={wizard.profile}
          errors={wizard.profileErrors}
          saving={busy === 'profile'}
          markers={setupMarkers(wizard)}
          onFieldChange={handleFieldChange}
          onNext={handleProfileNext}
          onSkip={() => setWizard(skipStep(wizard))}
          onExit={() => navigate('/account')}
        />
      )
      break
    case 'appearance':
      body = (
        <AppearanceStep
          treatment={wizard.treatment}
          markers={setupMarkers(wizard)}
          onSelect={handleSelectTreatment}
          onBack={() => setWizard(previousStep(wizard))}
          onNext={() => setWizard(nextStep(wizard))}
          onSkip={() => setWizard(skipStep(wizard))}
        />
      )
      break
    case 'preferences':
      body = (
        <PreferencesStep
          values={wizard.preferences}
          markers={setupMarkers(wizard)}
          finishing={busy === 'finish'}
          onAnswer={handleAnswer}
          onBack={() => setWizard(previousStep(wizard))}
          onFinish={handleFinish}
          onSkip={() => setWizard(nextStep(wizard))}
        />
      )
      break
    case 'review':
      body = (
        <>
          <CompletionPanel
            name={user.name}
            summary={buildSetupSummary(wizard)}
            onReturn={handleReturnToDeck}
            onReviewSettings={() => setReviewingSettings(true)}
          />
          {reviewingSettings ? (
            <div className="mt-8" ref={settingsPanel}>
              <ResearchPreferencesPanel
                values={wizard.preferences}
                treatment={wizard.treatment}
                name={user.name}
                summary={null}
                onSave={handleSaveSettings}
                onEditProfile={() => navigate('/account')}
              />
            </div>
          ) : null}
        </>
      )
      break
  }

  return shell(
    <>
      {intro}
      {errorBanner}
      {body}
    </>,
  )
}

export default Onboarding
