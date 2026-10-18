/**
 * Client call for Better Auth's verification-resend endpoint.
 *
 * Email verification is an existing Better Auth capability wired to Resend in
 * `server/auth.ts`; this module is the missing client seam so an authenticated,
 * unverified user can resolve their own status honestly instead of staring at a
 * dead "Unverified" label. `fetchImpl` is injectable for tests.
 */

/** Where Better Auth dispatches a verification email. */
export const SEND_VERIFICATION_EMAIL_PATH = '/api/auth/send-verification-email'

/**
 * Ask the server to re-send the verification email for an address.
 *
 * The response is deliberately non-enumerating (a request for an address the
 * server will not mail answers the same way), so callers must not treat `true`
 * as proof the address can receive mail — only that the request was accepted.
 *
 * @param email The address to verify; callers pass the session's own email.
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @returns `true` when the server accepted the request.
 * @throws Error with the server's message (or a friendly fallback) on non-2xx.
 */
export async function requestVerificationEmail(
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['x-better-auth-origin'] = window.location.origin
  }

  const response = await fetchImpl(SEND_VERIFICATION_EMAIL_PATH, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to send the verification email'),
    )
  }

  const body = (await response.json()) as { status?: unknown }
  return body?.status === true
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
