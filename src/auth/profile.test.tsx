/**
 * Tests for the profile-update seam.
 *
 * Pins the exact request contract with Better Auth's update-user endpoint
 * (path, method, session credentials, JSON body) and the failure behaviour the
 * onboarding/account pages rely on: the server's message surfaces as the error,
 * never a silent success.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { USER_UPDATE_PATH, updateProfile } from './profile'

/** A fetch stand-in recording the request and replaying a scripted response. */
function recordingFetch(response: {
  ok: boolean
  status?: number
  body?: unknown
}) {
  const calls: { input: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} })
    return {
      ok: response.ok,
      status: response.status ?? 200,
      json: async () => response.body,
    } as Response
  }
  return { calls, fetchImpl }
}

describe('updateProfile', () => {
  it('posts the fields to Better Auth’s update-user endpoint with the session', async () => {
    const { calls, fetchImpl } = recordingFetch({
      ok: true,
      body: { status: true },
    })

    await updateProfile(
      { name: 'Dav', bio: 'Research', website: 'https://example.org' },
      fetchImpl,
    )

    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, USER_UPDATE_PATH)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.credentials, 'include')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers['content-type'], 'application/json')
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      name: 'Dav',
      bio: 'Research',
      website: 'https://example.org',
    })
  })

  it('surfaces the server’s error message instead of claiming success', async () => {
    const { fetchImpl } = recordingFetch({
      ok: false,
      status: 403,
      body: { message: 'Not authenticated' },
    })

    await assert.rejects(
      updateProfile({ name: 'Dav' }, fetchImpl),
      /Not authenticated/,
    )
  })

  it('falls back to a friendly message for a bodyless failure', async () => {
    const { fetchImpl } = recordingFetch({ ok: false, status: 500 })

    await assert.rejects(
      updateProfile({ name: 'Dav' }, fetchImpl),
      /Failed to save profile/,
    )
  })
})
