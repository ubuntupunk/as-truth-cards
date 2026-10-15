/**
 * Regression tests for reading Better Auth's client session envelope.
 *
 * The bug these lock down: `authClient.getSession()` resolves to `{ data, error }`,
 * but callers read `result.user` directly. Since `user` lives under `data`, a
 * healthy signed-in response looked identical to a signed-out one, so the Account
 * and Header surfaces always claimed the user was signed out even though the server
 * session (and cookie) were valid.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { unwrapSession } from './session-envelope'

const user = {
  id: 'usr_1',
  email: 'person@example.com',
  name: 'Person',
}

describe('unwrapSession', () => {
  it('reads the session out of the { data, error } envelope', () => {
    const result = unwrapSession({
      data: { user, session: { token: 'tok' } },
      // Extra envelope fields must not confuse the unwrap.
      error: null,
    } as never)

    assert.deepEqual(result, { user, session: { token: 'tok' } })
    assert.equal(result?.user?.email, 'person@example.com')
  })

  it('returns null for a signed-out envelope', () => {
    assert.equal(unwrapSession({ data: null, error: null } as never), null)
  })

  it('returns null for a null result', () => {
    assert.equal(unwrapSession(null), null)
  })

  it('still accepts a bare session object (older client builds)', () => {
    const result = unwrapSession({ user, session: { token: 'tok' } })
    assert.equal(result?.user?.email, 'person@example.com')
  })
})
