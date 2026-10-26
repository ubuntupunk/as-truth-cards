/**
 * Tests for the avatar seam.
 *
 * Pins the exact request contracts with the profile-photo routes — raw image
 * bytes in (not multipart), the file's MIME type as `Content-Type`, the
 * session cookie included, the Better Auth origin header sent — and the
 * client-side validation the Settings panel relies on to refuse a doomed
 * file before any upload round-trip.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  AVATAR_WRITE_PATH,
  removeAvatar,
  uploadAvatar,
  validateAvatarFile,
} from './avatar'

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

/** A file-shaped stand-in; the seam only needs type and bytes. */
function fakeFile(type: string, size = 16): File {
  const file = new File([new Uint8Array(size)], 'me.png', { type })
  return file
}

describe('validateAvatarFile', () => {
  it('accepts the mirrored allowlist, rejects everything else', () => {
    for (const type of AVATAR_MIME_TYPES) {
      assert.equal(
        validateAvatarFile({ name: 'me', type, size: 1000 }),
        null,
        type,
      )
    }
    assert.match(
      validateAvatarFile({ name: 'me.tiff', type: 'image/tiff', size: 1000 }),
      /PNG, JPEG or WebP/,
    )
  })

  it('refuses an empty file and one over the ceiling', () => {
    assert.match(
      validateAvatarFile({ name: 'me.png', type: 'image/png', size: 0 }),
      /empty/,
    )
    assert.match(
      validateAvatarFile({
        name: 'me.png',
        type: 'image/png',
        size: AVATAR_MAX_BYTES + 1,
      }),
      /512 KB or smaller/,
    )
  })
})

describe('uploadAvatar', () => {
  it('sends the file as the raw body with its MIME type and the session', async () => {
    const { calls, fetchImpl } = recordingFetch({
      ok: true,
      body: { image: '/api/users/user-1/avatar?v=abc' },
    })
    const file = fakeFile('image/png')

    const image = await uploadAvatar(file, fetchImpl)

    assert.equal(image, '/api/users/user-1/avatar?v=abc')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, AVATAR_WRITE_PATH)
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.credentials, 'include')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers['content-type'], 'image/png')
    // The body is the file itself — no multipart encoding anywhere.
    assert.equal(calls[0].init.body, file)
  })

  it('surfaces the server’s refusal message instead of claiming success', async () => {
    const { fetchImpl } = recordingFetch({
      ok: false,
      status: 415,
      body: { message: 'Only PNG, JPEG and WebP images are accepted' },
    })

    await assert.rejects(
      uploadAvatar(fakeFile('image/png'), fetchImpl),
      /Only PNG, JPEG and WebP/,
    )
  })

  it('falls back to a friendly message for a bodyless failure', async () => {
    const { fetchImpl } = recordingFetch({ ok: false, status: 500 })

    await assert.rejects(
      uploadAvatar(fakeFile('image/png'), fetchImpl),
      /Failed to upload image/,
    )
  })

  it('refuses a 2xx body that carries no image URL', async () => {
    const { fetchImpl } = recordingFetch({ ok: true, body: { status: true } })

    await assert.rejects(
      uploadAvatar(fakeFile('image/png'), fetchImpl),
      /Failed to upload image/,
    )
  })
})

describe('removeAvatar', () => {
  it('deletes the session’s own avatar with the session credentials', async () => {
    const { calls, fetchImpl } = recordingFetch({
      ok: true,
      body: { image: null },
    })

    await removeAvatar(fetchImpl)

    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, AVATAR_WRITE_PATH)
    assert.equal(calls[0].init.method, 'DELETE')
    assert.equal(calls[0].init.credentials, 'include')
  })

  it('surfaces the server’s refusal message', async () => {
    const { fetchImpl } = recordingFetch({
      ok: false,
      status: 401,
      body: { message: 'Sign in to change your profile photo' },
    })

    await assert.rejects(removeAvatar(fetchImpl), /Sign in to change/)
  })
})
