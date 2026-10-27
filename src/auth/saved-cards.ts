/**
 * Client helpers for saved cards API.
 */

import { readErrorMessage } from './profile'

export async function listSavedCards(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl('/api/saved-cards', { credentials: 'include' })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to load saved cards'))
  }
  const body = (await res.json()) as { saved?: Array<{ slug: string }> }
  return (body.saved ?? []).map((s) => s.slug)
}

export async function checkSaved(slug: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const res = await fetchImpl(`/api/saved-cards/check/${encodeURIComponent(slug)}`, { credentials: 'include' })
  if (!res.ok) {
    if (res.status === 401) return false
    throw new Error(await readErrorMessage(res, 'Failed to check saved card'))
  }
  const body = (await res.json()) as { saved?: boolean }
  return body.saved === true
}

export async function saveCard(slug: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl('/api/saved-cards', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cardSlug: slug }),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to save card'))
  }
}

export async function unsaveCard(slug: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`/api/saved-cards/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to unsave card'))
  }
}
