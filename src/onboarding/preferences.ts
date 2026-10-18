/**
 * Device-local participation preferences collected in guided setup.
 *
 * The two optional questions in setup step 3 (feedback-related email, academic
 * participation) have no server-side home yet: the account schema deliberately
 * carries no digest or preference columns (Milestone 7 inventory; "no new
 * account fields"), and Settings is still a stub. Until account-level email
 * settings exist, the answers live in this device's `localStorage` — the same
 * persistence class as the theme choice — and the UI says so rather than
 * implying the account recorded them.
 */

/** One answer to either optional participation question. */
export type ParticipationAnswer = 'yes' | 'no' | 'later'

/** The two optional participation questions, answered independently. */
export interface ParticipationPreferences {
  readonly feedbackEmail: ParticipationAnswer
  readonly academicParticipation: ParticipationAnswer
}

/** Every valid answer value, for validation and UI iteration. */
export const PARTICIPATION_ANSWERS: readonly ParticipationAnswer[] = [
  'yes',
  'no',
  'later',
]

/** Where the preferences are persisted on this device. */
export const PARTICIPATION_PREFERENCES_STORAGE_KEY =
  'trope-cards:onboarding-participation'

/** "Decide later" is the honest default: nothing is asserted on the user's behalf. */
export const DEFAULT_PARTICIPATION_PREFERENCES: ParticipationPreferences = {
  feedbackEmail: 'later',
  academicParticipation: 'later',
}

/**
 * Narrow an untrusted value to a valid answer.
 *
 * @param value Any value read from storage or an event.
 * @returns Whether the value is a known {@link ParticipationAnswer}.
 */
export function isParticipationAnswer(
  value: unknown,
): value is ParticipationAnswer {
  return (
    typeof value === 'string' &&
    (PARTICIPATION_ANSWERS as readonly string[]).includes(value)
  )
}

/**
 * Read the persisted preferences, tolerating absence and garbage.
 *
 * @param storage A `Storage`-like reader, or `null` when unavailable.
 * @returns The stored preferences, or the {@link DEFAULT_PARTICIPATION_PREFERENCES}.
 */
export function readParticipationPreferences(
  storage: Pick<Storage, 'getItem'> | null,
): ParticipationPreferences {
  if (storage === null) return DEFAULT_PARTICIPATION_PREFERENCES
  try {
    const raw = storage.getItem(PARTICIPATION_PREFERENCES_STORAGE_KEY)
    if (raw === null) return DEFAULT_PARTICIPATION_PREFERENCES
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      feedbackEmail: isParticipationAnswer(parsed?.feedbackEmail)
        ? parsed.feedbackEmail
        : DEFAULT_PARTICIPATION_PREFERENCES.feedbackEmail,
      academicParticipation: isParticipationAnswer(
        parsed?.academicParticipation,
      )
        ? parsed.academicParticipation
        : DEFAULT_PARTICIPATION_PREFERENCES.academicParticipation,
    }
  } catch {
    // Corrupt JSON: behave as if nothing had been chosen yet.
    return DEFAULT_PARTICIPATION_PREFERENCES
  }
}

/**
 * Persist the preferences on this device.
 *
 * @param preferences The answers to store.
 * @param storage A `Storage`-like writer, or `null` when unavailable.
 */
export function saveParticipationPreferences(
  preferences: ParticipationPreferences,
  storage: Pick<Storage, 'setItem'> | null,
): void {
  if (storage === null) return
  storage.setItem(
    PARTICIPATION_PREFERENCES_STORAGE_KEY,
    JSON.stringify(preferences),
  )
}
