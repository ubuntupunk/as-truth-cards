/**
 * Tests for the forgot-password request flow.
 *
 * The page itself renders with hooks, which the string-rendering harness cannot
 * mount, so the logic under test is the injectable {@link requestPasswordReset}
 * seam: it must send Better Auth the right `redirectTo`, surface an API error,
 * and turn a thrown error into a message instead of rejecting.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FORGOT_PASSWORD_PATH,
  FORGOT_PASSWORD_SENT_MESSAGE,
  type PasswordResetClient,
  requestPasswordReset,
} from './ForgotPassword'
import { RESET_PASSWORD_PATH } from './ResetPassword'

/** A client double that records calls and returns a scripted result. */
function recordingClient(
  result: Awaited<ReturnType<PasswordResetClient['requestPasswordReset']>>,
) {
  const calls: { email: string; redirectTo: string }[] = []
  const client: PasswordResetClient = {
    requestPasswordReset: async (args) => {
      calls.push(args)
      return result
    },
  }
  return { client, calls }
}

describe('requestPasswordReset', () => {
  it('sends the email and a redirectTo on the reset-password path', async () => {
    const { client, calls } = recordingClient({ error: null })

    const message = await requestPasswordReset(client, {
      email: 'user@example.com',
      origin: 'https://trope.example',
    })

    assert.equal(message, null)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].email, 'user@example.com')
    assert.equal(
      calls[0].redirectTo,
      `https://trope.example${RESET_PASSWORD_PATH}`,
    )
  })

  it('returns the API error message and does not claim success', async () => {
    const { client } = recordingClient({ error: { message: 'Rate limited' } })

    const message = await requestPasswordReset(client, {
      email: 'user@example.com',
      origin: 'https://trope.example',
    })

    assert.equal(message, 'Rate limited')
  })

  it('converts a thrown error into a message rather than rejecting', async () => {
    const client: PasswordResetClient = {
      requestPasswordReset: async () => {
        throw new Error('network down')
      },
    }

    const message = await requestPasswordReset(client, {
      email: 'user@example.com',
      origin: 'https://trope.example',
    })

    assert.equal(message, 'network down')
  })

  it('falls back to a friendly message for a non-Error throw', async () => {
    const client = {
      requestPasswordReset: async () => {
        throw 'nope'
      },
    } as unknown as PasswordResetClient

    const message = await requestPasswordReset(client, {
      email: 'user@example.com',
      origin: 'https://trope.example',
    })

    assert.equal(message, 'Failed to send the reset email')
  })
})

describe('forgot-password surface constants', () => {
  it('exposes a route path and a non-enumerating success message', () => {
    assert.equal(FORGOT_PASSWORD_PATH, '/forgot-password')
    assert.ok(FORGOT_PASSWORD_SENT_MESSAGE.includes('If an account exists'))
  })
})
