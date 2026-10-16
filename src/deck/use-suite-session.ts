/**
 * `useSuiteSession` — the curator's draft suite, wired to state.
 *
 * This hook owns exactly one concern: keeping {@link SuiteEntry} state and
 * `localStorage` in step. It does not authenticate, call the network, or read
 * the graph; the page decides which card is on offer. Storage is best-effort —
 * a browser with storage disabled (private mode, a locked-down policy) still
 * gets a working roster for the tab, it simply does not survive a reload.
 *
 * Like the research session and for the same reason (ROADMAP §150–166), the
 * draft suite is deliberately *not* cleared on sign-in or sign-out: it is
 * browser-local working state, not an account record, and nothing here writes a
 * `collections` row.
 */

import { useCallback, useEffect, useState } from 'preact/hooks'
import {
  addSuiteEntry,
  hasSuiteEntry,
  parseSuiteSession,
  removeSuiteEntry,
  SUITE_SESSION_STORAGE_KEY,
  type SuiteEntry,
  serializeSuiteSession,
} from './suite-session'

/** The `localStorage` to use, or `null` when unavailable. */
function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Read and parse the stored suite, never throwing. */
function readSession(): SuiteEntry[] {
  try {
    return parseSuiteSession(
      storage()?.getItem(SUITE_SESSION_STORAGE_KEY) ?? null,
    )
  } catch {
    return []
  }
}

/** Persist the suite, ignoring quota/availability failures. */
function writeSession(entries: readonly SuiteEntry[]): void {
  try {
    storage()?.setItem(
      SUITE_SESSION_STORAGE_KEY,
      serializeSuiteSession(entries),
    )
  } catch {
    /* storage unavailable or full — the in-memory roster still works */
  }
}

/**
 * The draft-suite state and its mutators.
 *
 * @returns The current roster plus `add`, `remove`, `clear`, and `has`.
 */
export function useSuiteSession() {
  const [entries, setEntries] = useState<SuiteEntry[]>(readSession)

  useEffect(() => {
    writeSession(entries)
  }, [entries])

  const add = useCallback((entry: SuiteEntry) => {
    setEntries((current) => addSuiteEntry(current, entry))
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((current) => removeSuiteEntry(current, id))
  }, [])

  const clear = useCallback(() => {
    setEntries([])
  }, [])

  const has = useCallback((id: string) => hasSuiteEntry(entries, id), [entries])

  return { entries, add, remove, clear, has }
}
