/**
 * Client seam for Better Auth's change-email endpoint.
 *
 * Enabling `user.changeEmail` in `server/auth.ts` gives the account a real
 * capability, but Better Auth's policy is the important part: a request mails a
 * verification link to the **new** address, and the address is only swapped once
 * that link is opened. This module keeps that policy visible to the UI — it
 * validates the request locally, sends it, and turns the endpoint's refusals into
 * copy a reader can act on.
 *
 * Two refusals are worth naming:
 *
 * - `SESSION_NOT_FRESH` — the endpoint is session-sensitive, so a change requested
 *   more than a day after sign-in is refused. Signing in again is the remedy, and
 *   the message says so rather than echoing a bare code.
 * - A same-address or malformed request — rejected before it reaches the server,
 *   so the reader gets the error beside the field and no email is sent.
 *
 * Delivery is deliberately not reported as success. `requestEmailChange` resolves
 * when the server *accepted* the request; it cannot prove the new inbox received
 * anything (see bd as-truth-cards-tid), so the caller must not say "sent".
 */

/** Where Better Auth handles an authenticated email-change request. */
export const CHANGE_EMAIL_PATH = '/api/auth/change-email'

/** Where the verification link returns the reader after the change completes. */
export const CHANGE_EMAIL_CALLBACK_PATH = '/account/settings'

/**
 * Validate a requested email change before it is sent.
 *
 * The server validates again; this pass exists so the reader gets an immediate,
 * field-local explanation and no pointless request (and no pointless email) is
 * made for a typo.
 *
 * @param currentEmail The address on the account now.
 * @param requested The address the reader typed.
 * @returns An error message, or `null` when the request is well-formed and differs.
 * @example
 * ```ts
 * validateEmailChange('dav@example.org', 'dav@example.org') // 'That is already…'
 * validateEmailChange('dav@example.org', 'new@example.org') // null
 * ```
 */
export function validateEmailChange(
  currentEmail: string,
  requested: string,
): string | null {
  const next = requested.trim()

  if (next === '') {
    return 'Enter the email address you want to use.'
  }
  if (next.length > 254) {
    return 'That email address is too long.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
    return 'Enter a valid email address.'
  }
  if (next.toLowerCase() === currentEmail.trim().toLowerCase()) {
    return 'That is already the address on this account.'
  }
  return null
}

/**
 * Ask Better Auth to start an email change.
 *
 * Resolves when the server accepted the request. That is *not* proof the new
 * inbox received the link, and the address has not changed yet — the reader must
 * open the link first.
 *
 * @param newEmail The requested address (already validated by {@link validateEmailChange}).
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @returns `true` when the server accepted the request.
 * @throws Error with an actionable message on a non-2xx response.
 */
export async function requestEmailChange(
  newEmail: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['x-better-auth-origin'] = window.location.origin
  }

  const response = await fetchImpl(CHANGE_EMAIL_PATH, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({
      newEmail: newEmail.trim(),
      callbackURL: CHANGE_EMAIL_CALLBACK_PATH,
    }),
  })

  if (!response.ok) {
    throw new Error(await readChangeEmailError(response))
  }

  const body = (await response.json()) as { status?: unknown }
  return body?.status === true
}

/**
 * Turn an endpoint refusal into actionable copy.
 *
 * The fresh-session refusal is translated because "SESSION_NOT_FRESH" is not
 * something a reader can act on. Any other message the server supplies is passed
 * through; a body-less failure gets a stable fallback.
 *
 * @param response The failed response.
 * @returns A message to show beside the form.
 */
async function readChangeEmailError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      code?: unknown
      message?: unknown
    }
    if (body?.code === 'SESSION_NOT_FRESH') {
      return 'For your security, changing your email needs a recent sign-in. Sign out, sign in again, then retry.'
    }
    if (typeof body?.message === 'string' && body.message.trim() !== '') {
      return body.message
    }
  } catch {
    // Non-JSON body: fall through to the fallback message.
  }
  return 'Failed to request the email change.'
}
