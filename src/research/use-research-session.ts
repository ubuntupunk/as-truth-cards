/**
 * `useResearchSession` — the browser-local research session, wired to state.
 *
 * This hook owns exactly one concern: keeping {@link ResearchEntry} state and
 * `localStorage` in step. It does not authenticate, call the network, or read
 * the graph; the page decides what to add. Storage is best-effort — a browser
 * with storage disabled (private mode, a locked-down policy) still gets a
 * working session for the tab, it simply does not survive a reload.
 *
 * The session is deliberately *not* cleared on sign-in or sign-out. ROADMAP
 * §150–166 requires research state to be distinct from auth state; the surest
 * way to keep them distinct is for nothing auth-related to touch this hook.
 */

import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  addResearchEntry,
  hasResearchEntry,
  parseResearchSession,
  RESEARCH_SESSION_STORAGE_KEY,
  type ResearchEntry,
  removeResearchEntry,
  serializeResearchSession,
} from './research-session'

/** The `localStorage` to use, or `null` when unavailable. */
function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Read and parse the stored session, never throwing. */
function readSession(): ResearchEntry[] {
  try {
    return parseResearchSession(
      storage()?.getItem(RESEARCH_SESSION_STORAGE_KEY) ?? null,
    )
  } catch {
    return []
  }
}

/** Persist the session, ignoring quota/availability failures. */
function writeSession(entries: readonly ResearchEntry[]): void {
  try {
    storage()?.setItem(
      RESEARCH_SESSION_STORAGE_KEY,
      serializeResearchSession(entries),
    )
  } catch {
    /* storage unavailable or full — the in-memory session still works */
  }
}

/**
 * The research-session state and its mutators.
 *
 * @returns The current entries plus `add`, `remove`, `clear`, and `has`.
 */
export function useResearchSession() {
  const [entries, setEntries] = useState<ResearchEntry[]>(readSession)

  useEffect(() => {
    writeSession(entries)
  }, [entries])

  const add = useCallback((entry: ResearchEntry) => {
    setEntries((current) => addResearchEntry(current, entry))
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((current) => removeResearchEntry(current, id))
  }, [])

  const clear = useCallback(() => {
    setEntries([])
  }, [])

  const has = useCallback(
    (id: string) => hasResearchEntry(entries, id),
    [entries],
  )

  return { entries, add, remove, clear, has }
}
