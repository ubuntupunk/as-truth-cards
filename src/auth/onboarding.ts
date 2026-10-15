/**
 * Client call for the onboarding-completion endpoint.
 *
 * Completion is persisted server-side (`POST /api/account/onboarding/complete`)
 * rather than being a client-side navigation flag, so it survives reloads and
 * other devices. `fetchImpl` is injectable so the call can be unit-tested without
 * a network.
 */

/** Where the server records onboarding completion. */
export const ONBOARDING_COMPLETE_PATH = '/api/account/onboarding/complete'

/** The persisted onboarding state the endpoint returns. */
export interface OnboardingState {
  onboardedAt: string | null
}

/**
 * Mark the current account's onboarding complete.
 *
 * Idempotent on the server (set-once); a call when already complete returns the
 * original timestamp. The session cookie is sent (`credentials: 'include'`) so
 * the request is authenticated.
 *
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @returns The persisted {@link OnboardingState}.
 * @throws Error when the request fails or the server returns a non-2xx status.
 */
export async function completeOnboarding(
  fetchImpl: typeof fetch = fetch,
): Promise<OnboardingState> {
  const response = await fetchImpl(ONBOARDING_COMPLETE_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Failed to save onboarding progress')
  }

  return (await response.json()) as OnboardingState
}
