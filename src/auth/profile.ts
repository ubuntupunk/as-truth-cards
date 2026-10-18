/**
 * Client call for Better Auth's user-update endpoint.
 *
 * Profile fields (name, bio, website, location) are ordinary Better Auth
 * `additionalFields` with client input enabled — the server rejects `role`,
 * `onboardedAt` and anything undeclared, so this seam can only ever touch the
 * public-facing profile columns. `fetchImpl` is injectable so tests exercise the
 * exact request contract without a network.
 */

/** Where Better Auth updates the current user's profile. */
export const USER_UPDATE_PATH = '/api/auth/update-user'

/** The profile fields a client may update about itself. */
export interface ProfileFields {
  name?: string
  bio?: string
  website?: string
  location?: string
}

/**
 * Best-effort extraction of a server-provided error message.
 *
 * @param response The failed response.
 * @param fallback Message to use when the body carries none.
 * @returns The server message, or `fallback`.
 */
async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body?.message === 'string' && body.message.trim() !== '') {
      return body.message
    }
  } catch {
    // Non-JSON body: fall through to the fallback message.
  }
  return fallback
}

/**
 * Save profile fields on the current account.
 *
 * Authenticated by the session cookie; Better Auth refreshes the session data in
 * the same response, so a subsequent session read reflects the new values — the
 * caller should `refetch()` rather than assume success wrote anything.
 *
 * @param fields The profile fields to update; omitted fields are left untouched.
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @returns Resolves when the server confirms the update.
 * @throws Error with the server's message (or a friendly fallback) on non-2xx.
 */
export async function updateProfile(
  fields: ProfileFields,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Same header the Better Auth JS client sends, so the origin check passes
    // even where a stripped-proxy drops the browser's `Origin` header.
    headers['x-better-auth-origin'] = window.location.origin
  }

  const response = await fetchImpl(USER_UPDATE_PATH, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(fields),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to save profile'))
  }
}
