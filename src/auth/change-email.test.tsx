/**
 * Tests for `change-email.ts` — the client seam to Better Auth's change-email
 * endpoint.
 *
 * Two contracts matter: local validation (so a typo neither hits the endpoint nor
 * causes mail) and refusal handling (the session-freshness refusal is translated
 * into something a reader can act on). The request itself never claims delivery —
 * the helper resolves on acceptance only, which the tests pin down.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CHANGE_EMAIL_CALLBACK_PATH,
  CHANGE_EMAIL_PATH,
  requestEmailChange,
  validateEmailChange,
} from './change-email'

/** A fetch stand-in that records the request and returns a canned response. */
function fetchStub(response: Response) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const impl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return response
  }
  return { impl, calls }
}

describe('validateEmailChange', () => {
  const current = 'dav@example.org'

  it('requires a value', () => {
    assert.equal(
      validateEmailChange(current, '   '),
      'Enter the email address you want to use.',
    )
  })

  it('rejects a malformed address', () => {
    assert.equal(
      validateEmailChange(current, 'not-an-email'),
      'Enter a valid email address.',
    )
    assert.equal(
      validateEmailChange(current, 'a@b'),
      'Enter a valid email address.',
    )
  })

  it('rejects the address already on the account, case-insensitively', () => {
    assert.equal(
      validateEmailChange(current, 'DAV@Example.org'),
      'That is already the address on this account.',
    )
  })

  it('rejects an absurdly long address', () => {
    const long = `${'a'.repeat(250)}@example.org`
    assert.equal(
      validateEmailChange(current, long),
      'That email address is too long.',
    )
  })

  it('accepts a different, well-formed address', () => {
    assert.equal(validateEmailChange(current, ' new@example.org '), null)
  })
})

describe('requestEmailChange', () => {
  it('posts the trimmed address and the return path to the auth endpoint', async () => {
    const { impl, calls } = fetchStub(
      new Response(JSON.stringify({ status: true }), { status: 200 }),
    )

    const accepted = await requestEmailChange(' new@example.org ', impl)

    assert.equal(accepted, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, CHANGE_EMAIL_PATH)
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(calls[0].init?.credentials, 'include')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      newEmail: 'new@example.org',
      callbackURL: CHANGE_EMAIL_CALLBACK_PATH,
    })
  })

  it('does not treat a non-true status as acceptance', async () => {
    const { impl } = fetchStub(
      new Response(JSON.stringify({ status: false }), { status: 200 }),
    )
    assert.equal(await requestEmailChange('new@example.org', impl), false)
  })

  it('translates the fresh-session refusal into an actionable message', async () => {
    const { impl } = fetchStub(
      new Response(
        JSON.stringify({
          code: 'SESSION_NOT_FRESH',
          message: 'Session is not fresh',
        }),
        { status: 403 },
      ),
    )

    await assert.rejects(
      () => requestEmailChange('new@example.org', impl),
      /recent sign-in.*Sign out, sign in again/i,
    )
  })

  it('passes through a server-provided message', async () => {
    const { impl } = fetchStub(
      new Response(JSON.stringify({ message: 'Email is the same' }), {
        status: 400,
      }),
    )

    await assert.rejects(
      () => requestEmailChange('new@example.org', impl),
      /Email is the same/,
    )
  })

  it('falls back to a stable message when the body carries none', async () => {
    const { impl } = fetchStub(new Response('no', { status: 500 }))

    await assert.rejects(
      () => requestEmailChange('new@example.org', impl),
      /Failed to request the email change/,
    )
  })
})
