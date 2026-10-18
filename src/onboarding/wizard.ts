/**
 * The guided-setup state machine — pure, DOM-free, and seam-free.
 *
 * The onboarding route is a thin renderer over this module: every transition
 * (step progression, validation, skipping, appearance choice, participation
 * answers, server-confirmed save/completion) is a pure function of state, so
 * the journey itself is regression-tested without a browser. Side effects —
 * saving the profile, completing onboarding, persisting device preferences —
 * belong to the page, which calls the seams in `src/auth` and the storage
 * helpers and then feeds the result back through `markProfileSaved` /
 * `markCompleted`.
 *
 * Figma authority: "Account / Onboarding — Atmospheric · Improved"
 * (`62:12550`, file `qmVMnfR9DpQFyYtaiSizYD`) — three steps plus the
 * completion panel.
 */

import { GRAPH_TREATMENT_LABELS, type GraphTreatment } from '@/graph/appearance'
import type {
  ParticipationAnswer,
  ParticipationPreferences,
} from './preferences'

/** A step of the setup journey; `review` is the post-completion panel. */
export type OnboardingStep = 'profile' | 'appearance' | 'preferences' | 'review'

/** The three progressive steps, in order (`review` is terminal, not numbered). */
export const SETUP_STEPS: readonly OnboardingStep[] = [
  'profile',
  'appearance',
  'preferences',
]

/** Strip labels exactly as the improved panels label the three steps. */
export const SETUP_STEP_LABELS: readonly string[] = [
  'Profile',
  'Appearance',
  'Research preferences',
]

/** The editable profile fields collected in step 1. */
export interface ProfileFormValues {
  name: string
  bio: string
  website: string
  location: string
}

/** An empty form, also the shape seed for partial inputs. */
export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  name: '',
  bio: '',
  website: '',
  location: '',
}

/** One editable profile field. */
export type ProfileField = keyof ProfileFormValues

/** Per-field validation messages; absent key means valid. */
export type ProfileFieldErrors = Partial<Record<ProfileField, string>>

/** Field length limits, mirroring what the profile surfaces can sensibly show. */
export const PROFILE_LIMITS: Readonly<Record<ProfileField, number>> = {
  name: 100,
  bio: 500,
  website: 200,
  location: 120,
}

/** The full wizard state; reducers return a new object, never mutate. */
export interface WizardState {
  readonly step: OnboardingStep
  readonly profile: ProfileFormValues
  readonly initialProfile: ProfileFormValues
  readonly profileErrors: ProfileFieldErrors
  /** Whether step 1's values have been confirmed by the server this journey. */
  readonly profileSaved: boolean
  readonly savedProfile: ProfileFormValues | null
  readonly treatment: GraphTreatment
  readonly preferences: ParticipationPreferences
  /** Whether the server has confirmed onboarding completion. */
  readonly completed: boolean
}

/** Inputs for {@link initialWizardState}; every value comes from a real source. */
export interface InitialWizardOptions {
  /** The account's current profile, as read from the session. */
  profile: ProfileFormValues
  /** The device's persisted appearance choice. */
  treatment: GraphTreatment
  /** The device's persisted participation answers. */
  preferences: ParticipationPreferences
  /** Server-owned onboarding state (`onboardedAt` present). */
  completed: boolean
}

/**
 * Build the starting state for the journey.
 *
 * A completed account opens on the review panel — revisiting `/onboarding` must
 * never imply the account is unfinished — while a fresh account opens on step 1
 * seeded with its current server-side profile values.
 *
 * @param options The account, device and server inputs above.
 * @returns The initial {@link WizardState}.
 */
export function initialWizardState(options: InitialWizardOptions): WizardState {
  const profile: ProfileFormValues = {
    ...EMPTY_PROFILE_FORM,
    ...options.profile,
  }
  return {
    step: options.completed ? 'review' : 'profile',
    profile,
    initialProfile: { ...profile },
    profileErrors: {},
    profileSaved: options.completed,
    savedProfile: options.completed ? { ...profile } : null,
    treatment: options.treatment,
    preferences: options.preferences,
    completed: options.completed,
  }
}

/**
 * A single label-shaped host a website value must satisfy.
 *
 * Accepts bare domains (`example.org`), `www.` hosts, and full `http(s)` URLs
 * with paths; rejects anything with whitespace or without a dotted host.
 */
const WEBSITE_SHAPE =
  /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/[^\s]*)?$/i

/**
 * Validate an optional website value.
 *
 * @param value The raw field value.
 * @returns Whether the value is empty or a plausible website/URL.
 */
export function isValidWebsite(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (trimmed.length > PROFILE_LIMITS.website) return false
  return WEBSITE_SHAPE.test(trimmed)
}

/**
 * Normalise a website value for storage.
 *
 * @param value The raw field value.
 * @returns The trimmed value with an `https://` scheme added when missing.
 */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * Validate the step-1 form.
 *
 * Display name is the one required input ("A name, not a credential"); every
 * other field is optional but bounded, and the website must look like one.
 *
 * @param values The current form values.
 * @returns Per-field errors; empty object means the step may be submitted.
 */
export function validateProfileForm(
  values: ProfileFormValues,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  const name = values.name.trim()
  if (name === '') {
    errors.name = 'Add a display name to continue, or use “Skip for now”.'
  } else if (name.length > PROFILE_LIMITS.name) {
    errors.name = `Display name must be ${PROFILE_LIMITS.name} characters or fewer.`
  }
  if (values.bio.length > PROFILE_LIMITS.bio) {
    errors.bio = `Bio must be ${PROFILE_LIMITS.bio} characters or fewer.`
  }
  if (!isValidWebsite(values.website)) {
    errors.website = 'Enter a website like example.org.'
  }
  if (values.location.length > PROFILE_LIMITS.location) {
    errors.location = `Location must be ${PROFILE_LIMITS.location} characters or fewer.`
  }
  return errors
}

/**
 * Whether an error record carries at least one message.
 *
 * @param errors A {@link ProfileFieldErrors} record.
 * @returns True when any field is invalid.
 */
export function profileHasErrors(errors: ProfileFieldErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined)
}

/**
 * Edit one profile field, clearing that field's validation message.
 *
 * @param state The current state.
 * @param field The field being edited.
 * @param value The new raw value.
 * @returns The next state.
 */
export function editProfileField(
  state: WizardState,
  field: ProfileField,
  value: string,
): WizardState {
  const profileErrors = { ...state.profileErrors }
  delete profileErrors[field]
  return {
    ...state,
    profile: { ...state.profile, [field]: value },
    profileErrors,
  }
}

/**
 * Re-run step-1 validation and record the messages.
 *
 * @param state The current state.
 * @returns The state carrying current {@link validateProfileForm} results.
 */
export function applyProfileValidation(state: WizardState): WizardState {
  return { ...state, profileErrors: validateProfileForm(state.profile) }
}

/**
 * Whether the step-1 form currently passes validation.
 *
 * @param state The current state.
 * @returns True when {@link validateProfileForm} finds no errors.
 */
export function profileStepIsValid(state: WizardState): boolean {
  return !profileHasErrors(validateProfileForm(state.profile))
}

/**
 * Whether the form has edits the server has not confirmed yet.
 *
 * Compared against the last confirmed save (falling back to the session-start
 * values), so a saved-then-revisited step reads as clean and only real unsaved
 * edits count as dirty.
 *
 * @param state The current state.
 * @returns True when any field differs from the last confirmed values.
 */
export function profileIsDirty(state: WizardState): boolean {
  const baseline = state.savedProfile ?? state.initialProfile
  return (Object.keys(EMPTY_PROFILE_FORM) as readonly ProfileField[]).some(
    (field) => state.profile[field] !== baseline[field],
  )
}

/**
 * The step after the given one; `review` is terminal.
 *
 * @param step The current step.
 * @returns The next step, or `review` when already there.
 */
function stepAfter(step: OnboardingStep): OnboardingStep {
  const order: readonly OnboardingStep[] = [...SETUP_STEPS, 'review']
  const index = order.indexOf(step)
  return order[Math.min(index + 1, order.length - 1)] ?? 'review'
}

/**
 * The step before the given one; step 1 has no predecessor in the journey.
 *
 * @param step The current step.
 * @returns The previous step, or `profile` at the start.
 */
function stepBefore(step: OnboardingStep): OnboardingStep {
  const order: readonly OnboardingStep[] = [...SETUP_STEPS, 'review']
  const index = order.indexOf(step)
  return order[Math.max(index - 1, 0)] ?? 'profile'
}

/**
 * Advance one step. Callers gate step-1 progression on validation themselves;
 * skipping is the same transition because a skipped step is simply passed.
 *
 * @param state The current state.
 * @returns The next state.
 */
export function nextStep(state: WizardState): WizardState {
  return { ...state, step: stepAfter(state.step) }
}

/**
 * Go back one step without discarding any entered values.
 *
 * @param state The current state.
 * @returns The previous step's state.
 */
export function previousStep(state: WizardState): WizardState {
  return { ...state, step: stepBefore(state.step) }
}

/**
 * Skip the current optional step — the design's "Skip for now" action.
 *
 * @param state The current state.
 * @returns The next state, with nothing saved or asserted.
 */
export function skipStep(state: WizardState): WizardState {
  return nextStep(state)
}

/**
 * Choose an appearance treatment (step 2).
 *
 * @param state The current state.
 * @param treatment The chosen treatment.
 * @returns The next state.
 */
export function selectTreatment(
  state: WizardState,
  treatment: GraphTreatment,
): WizardState {
  return { ...state, treatment }
}

/** One of the two optional participation questions. */
export type ParticipationKey = keyof ParticipationPreferences

/**
 * Answer one of the two optional participation questions (step 3).
 *
 * @param state The current state.
 * @param question Which question is being answered.
 * @param answer The chosen answer.
 * @returns The next state.
 */
export function answerPreference(
  state: WizardState,
  question: ParticipationKey,
  answer: ParticipationAnswer,
): WizardState {
  return {
    ...state,
    preferences: { ...state.preferences, [question]: answer },
  }
}

/**
 * Record that the server confirmed the profile save.
 *
 * @param state The state whose profile was just persisted.
 * @returns The state marked saved, with validation messages cleared.
 */
export function markProfileSaved(state: WizardState): WizardState {
  return {
    ...state,
    profileErrors: {},
    profileSaved: true,
    savedProfile: { ...state.profile },
  }
}

/**
 * Record that the server confirmed onboarding completion.
 *
 * @param state The state after `completeOnboarding` succeeded.
 * @returns The completed state, opening the review panel.
 */
export function markCompleted(state: WizardState): WizardState {
  return { ...state, step: 'review', completed: true }
}

/** One entry of the step-1/2/3 progress strip. */
export interface SetupMarker {
  label: string
  current: boolean
  done: boolean
}

/**
 * Derive the progress-strip markers for the current state.
 *
 * @param state The current state.
 * @returns Three markers (Profile / Appearance / Research preferences).
 */
export function setupMarkers(state: WizardState): SetupMarker[] {
  const reviewing = state.step === 'review'
  const currentIndex = reviewing
    ? SETUP_STEPS.length
    : SETUP_STEPS.indexOf(state.step)
  return SETUP_STEPS.map((step, index) => ({
    label: SETUP_STEP_LABELS[index] ?? step,
    current: !reviewing && index === currentIndex,
    done: reviewing || index < currentIndex,
  }))
}

/** Human labels for the participation answers, matching the panel copy. */
export const ANSWER_LABELS: Readonly<Record<ParticipationAnswer, string>> = {
  yes: 'Yes',
  no: 'No',
  later: 'Decide later',
}

/** The completion panel's summary rows. */
export interface SetupSummary {
  profile: string
  appearance: string
  researchPreferences: string
}

/**
 * Build the completion summary from what actually happened.
 *
 * The profile row reflects the server-confirmed save — never the mere presence
 * of typed input — so a skipped or unsaved profile reads honestly.
 *
 * @param state The completed (or reviewing) state.
 * @returns The three summary row values.
 */
export function buildSetupSummary(state: WizardState): SetupSummary {
  const profile = state.savedProfile
    ? state.savedProfile.name.trim() || 'Not added'
    : profileIsDirty(state)
      ? 'Not saved yet'
      : 'Not added'
  const { feedbackEmail, academicParticipation } = state.preferences
  const researchPreferences =
    feedbackEmail === academicParticipation
      ? ANSWER_LABELS[feedbackEmail]
      : `${ANSWER_LABELS[feedbackEmail]} / ${ANSWER_LABELS[academicParticipation]}`
  return {
    profile,
    appearance: GRAPH_TREATMENT_LABELS[state.treatment],
    researchPreferences,
  }
}
