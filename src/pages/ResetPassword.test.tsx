/**
 * Tests for the reset-password flow.
 *
 * As with the forgot-password page, the hook-rendering page itself is out of the
 * string-renderer's reach, so these cover the three injectable seams: the token
 * gate, the client-side confirmation check, and the submit helper — including
 * that a password mismatch never reaches Better Auth.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORDS_DO_NOT_MATCH_MESSAGE,
  RESET_PASSWORD_PATH,
  type ResetPasswordClient,
  resetTokenState,
  submitResetPassword,
  validateNewPassword,
} from './ResetPassword'

/** A client double that records calls and returns a scripted result. */
function recordingClient(
  result: Awaited<ReturnType<ResetPasswordClient['resetPassword']>>,
) {
  const calls: { newPassword: string; token: string }[] = []
  const client: ResetPasswordClient = {
    resetPassword: async (args) => {
      calls.push(args)
      return result
    },
  }
  return { client, calls }
}

describe('resetTokenState', () => {
  it('is ready when a token is present', () => {
    assert.equal(resetTokenState({ token: 'abc', error: null }), 'ready')
  })

  it('is invalid when Better Auth rejected the token', () => {
    assert.equal(
      resetTokenState({ token: 'abc', error: 'INVALID_TOKEN' }),
      'invalid',
    )
  })

  it('is invalid when the link carried no token at all', () => {
    assert.equal(resetTokenState({ token: null, error: null }), 'invalid')
  })
})

describe('validateNewPassword', () => {
  it('accepts matching passwords', () => {
    assert.equal(validateNewPassword('correct horse', 'correct horse'), null)
  })

  it('rejects a mismatch with a user-facing message', () => {
    assert.equal(
      validateNewPassword('correct horse', 'battery staple'),
      PASSWORDS_DO_NOT_MATCH_MESSAGE,
    )
  })
})

describe('submitResetPassword', () => {
  it('submits the new password and token, then resolves success', async () => {
    const { client, calls } = recordingClient({ error: null })

    const message = await submitResetPassword(client, {
      token: 'tok_123',
      password: 'new-pass',
      confirm: 'new-pass',
    })

    assert.equal(message, null)
    assert.deepEqual(calls, [{ newPassword: 'new-pass', token: 'tok_123' }])
  })

  it('never calls Better Auth when the confirmation does not match', async () => {
    const { client, calls } = recordingClient({ error: null })

    const message = await submitResetPassword(client, {
      token: 'tok_123',
      password: 'new-pass',
      confirm: 'typo',
    })

    assert.equal(message, PASSWORDS_DO_NOT_MATCH_MESSAGE)
    assert.equal(calls.length, 0)
  })

  it('surfaces the API error message', async () => {
    const { client } = recordingClient({ error: { message: 'Token expired' } })

    const message = await submitResetPassword(client, {
      token: 'tok_123',
      password: 'new-pass',
      confirm: 'new-pass',
    })

    assert.equal(message, 'Token expired')
  })

  it('converts a thrown error into a message rather than rejecting', async () => {
    const client: ResetPasswordClient = {
      resetPassword: async () => {
        throw new Error('offline')
      },
    }

    const message = await submitResetPassword(client, {
      token: 'tok_123',
      password: 'new-pass',
      confirm: 'new-pass',
    })

    assert.equal(message, 'offline')
  })
})

describe('reset-password surface constants', () => {
  it('exposes a route path and an invalid-link message', () => {
    assert.equal(RESET_PASSWORD_PATH, '/reset-password')
    assert.ok(INVALID_RESET_TOKEN_MESSAGE.includes('invalid or has expired'))
  })
})
