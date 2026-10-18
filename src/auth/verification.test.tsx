/**
 * Tests for the verification-resend seam.
 *
 * Pins the request contract with Better Auth's send-verification-email
 * endpoint and the honest response handling: `status: true` means the server
 * accepted the request (not that the address can receive mail), and failures
 * carry the server's message.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  requestVerificationEmail,
  SEND_VERIFICATION_EMAIL_PATH,
} from './verification'

/** A fetch stand-in recording the request and replaying a scripted response. */
function recordingFetch(response: { ok: boolean; body?: unknown }) {
  const calls: { input: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} })
    return {
      ok: response.ok,
      status: response.ok ? 200 : 400,
      json: async () => response.body,
    } as Response
  }
  return { calls, fetchImpl }
}

describe('requestVerificationEmail', () => {
  it('posts the session’s own email to the resend endpoint', async () => {
    const { calls, fetchImpl } = recordingFetch({
      ok: true,
      body: { status: true },
    })

    const accepted = await requestVerificationEmail(
      'dav@example.org',
      fetchImpl,
    )

    assert.equal(accepted, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, SEND_VERIFICATION_EMAIL_PATH)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.credentials, 'include')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      email: 'dav@example.org',
    })
  })

  it('reports status:false as not-accepted without throwing', async () => {
    const { fetchImpl } = recordingFetch({ ok: true, body: { status: false } })
    assert.equal(
      await requestVerificationEmail('dav@example.org', fetchImpl),
      false,
    )
  })

  it('surfaces the server’s message on failure', async () => {
    const { fetchImpl } = recordingFetch({
      ok: false,
      body: { message: 'Too many requests' },
    })

    await assert.rejects(
      requestVerificationEmail('dav@example.org', fetchImpl),
      /Too many requests/,
    )
  })

  it('falls back to a friendly message for a bodyless failure', async () => {
    const { fetchImpl } = recordingFetch({ ok: false })

    await assert.rejects(
      requestVerificationEmail('dav@example.org', fetchImpl),
      /Failed to send the verification email/,
    )
  })
})
