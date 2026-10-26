/**
 * Client calls for the profile-photo routes: upload and remove.
 *
 * The upload is a raw body, not multipart form data — the browser sends the
 * `File` directly as the request body with the image's MIME type as
 * `Content-Type`, which is exactly what `express.raw` on the server buffers.
 * That keeps this seam free of any form-data encoding and the request shape
 * identical to what the server tests assert.
 *
 * The server owns the real validation (magic-byte sniff, size ceiling), but
 * the same limits are checked here first so a bad file is refused in the
 * browser instead of after an upload round-trip. The two sides must not
 * drift: both constants carry a comment naming their twin.
 */

import { readErrorMessage } from './profile'

/** Where the session's own avatar write verbs live. */
export const AVATAR_WRITE_PATH = '/api/me/avatar'

/**
 * The upload ceiling, checked client-side before the request. Mirrors
 * `AVATAR_MAX_BYTES` in `server/api/avatars.ts` — change them together.
 */
export const AVATAR_MAX_BYTES = 512 * 1024

/**
 * The accepted image types, checked client-side before the request. Mirrors
 * `AVATAR_MIME_TYPES` in `server/api/avatars.ts` — change them together.
 */
export const AVATAR_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

/** A file candidate, shaped like the DOM `File` the panel reads. */
export interface AvatarFileCandidate {
  readonly name: string
  readonly type: string
  readonly size: number
}

/**
 * Validate a chosen image in the browser, before any upload.
 *
 * Client-side validation is courtesy, not security: the server sniffs the
 * magic bytes and enforces the ceiling again, so this only saves the user a
 * doomed round-trip.
 *
 * @param file The chosen file's name, MIME type and size.
 * @returns `null` when the file is acceptable, otherwise the user-facing
 *   reason it is not.
 * @example
 * ```ts
 * validateAvatarFile({ name: 'me.png', type: 'image/png', size: 1000 }) // null
 * validateAvatarFile({ name: 'me.tiff', type: 'image/tiff', size: 1000 })
 * // 'Choose a PNG, JPEG or WebP image.'
 * ```
 */
export function validateAvatarFile(file: AvatarFileCandidate): string | null {
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return 'Choose a PNG, JPEG or WebP image.'
  }
  if (file.size <= 0) {
    return 'The chosen image is empty.'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'The image must be 512 KB or smaller.'
  }
  return null
}

/**
 * Upload a profile photo for the signed-in account.
 *
 * Authenticated by the session cookie. On success the server has stored the
 * bytes and pointed `user.image` at the returned URL; the caller should
 * refresh the session so every consumer (settings, the public profile
 * preview) sees the new photo.
 *
 * @param file The chosen image file, sent as the raw request body.
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @returns The versioned public avatar URL the server stored on the account.
 * @throws Error with the server's message (or a friendly fallback) on non-2xx.
 */
export async function uploadAvatar(
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const headers: Record<string, string> = { 'content-type': file.type }
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Same header the Better Auth JS client sends, so the origin check passes
    // even where a stripped-proxy drops the browser's `Origin` header.
    headers['x-better-auth-origin'] = window.location.origin
  }

  const response = await fetchImpl(AVATAR_WRITE_PATH, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: file,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to upload image'))
  }
  const body = (await response.json()) as { image?: unknown }
  if (typeof body.image !== 'string' || body.image === '') {
    throw new Error('Failed to upload image')
  }
  return body.image
}

/**
 * Remove the signed-in account's profile photo.
 *
 * Authenticated by the session cookie. On success the server has deleted the
 * stored bytes and cleared `user.image`; the caller should refresh the
 * session so consumers fall back to their designed initials state.
 *
 * @param fetchImpl `fetch` implementation; injected in tests.
 * @throws Error with the server's message (or a friendly fallback) on non-2xx.
 */
export async function removeAvatar(
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const headers: Record<string, string> = {}
  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['x-better-auth-origin'] = window.location.origin
  }

  const response = await fetchImpl(AVATAR_WRITE_PATH, {
    method: 'DELETE',
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Failed to remove image'))
  }
}
