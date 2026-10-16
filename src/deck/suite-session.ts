/**
 * The suite-session model — the curator's draft suite (g2f), pure half.
 *
 * A **suite** is the roster of cards a curator has hand-assembled while
 * browsing, usually after narrowing the deck to one locale. Its durable home in
 * the schema is a `collections` row plus its `card_collections` memberships — a
 * Suit (`trope-cards/src/db/seed/taxonomy.ts`, `schema/tropeGraph.ts:217`).
 * This module deliberately does not write one: g2f requires the assignment to
 * stay explicit and human, and `/api/graph` is read-only, so what is kept here
 * is the **proposal** — which cards were picked, in the order they were added —
 * and the hand-off is an export a maintainer can act on.
 *
 * Entries are references, never re-authored data. Identity is the canonical
 * card uuid; slug and title are display conveniences, corrected the moment a
 * projection loads again. Nothing here infers membership: a card is in the
 * draft only because a curator pressed Add on it. In particular no locale, suit
 * or collection is read off a card to file it here — `south-africa` names both
 * a locale and a collection, so slug equality across those two taxonomies means
 * nothing on its own (`trope-cards/src/graph/types.ts` §221–240).
 *
 * Ordering is deliberate: unlike the research tray, which is a recency list,
 * a suite is a roster the curator assembled in sequence, so entries append.
 *
 * Persistence is a versioned JSON envelope, parsed totally: a missing,
 * malformed, or older payload yields an empty suite rather than throwing, so a
 * corrupt `localStorage` value can never take the page down.
 */

/** The `localStorage` key the draft suite is kept under. */
export const SUITE_SESSION_STORAGE_KEY = 'truth-cards/suite-session'

/** The envelope version. A payload with any other version is discarded. */
export const SUITE_SESSION_VERSION = 1

/** How many cards one draft suite keeps before the oldest is dropped. */
export const SUITE_SESSION_LIMIT = 100

/** One card in the draft suite. */
export type SuiteEntry = {
  /** The canonical `trope_graph` card uuid. Identity. */
  readonly id: string
  /** The card's slug at assembly time; display only, corrected on reload. */
  readonly slug: string
  /** The card's title at assembly time; display only, corrected on reload. */
  readonly title: string
  /** Epoch milliseconds the card was added, for the roster's own audit. */
  readonly addedAt: number
}

/**
 * Whether an unknown value is a well-formed {@link SuiteEntry}.
 *
 * Validation is structural and strict: a payload a future format change makes
 * unreadable is discarded whole rather than partially trusted.
 *
 * @param value The candidate, typically one member of a parsed envelope.
 * @returns `true` only when every field is present and of the right type.
 */
export function isSuiteEntry(value: unknown): value is SuiteEntry {
  if (value === null || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.slug === 'string' &&
    entry.slug.length > 0 &&
    typeof entry.title === 'string' &&
    typeof entry.addedAt === 'number' &&
    Number.isFinite(entry.addedAt)
  )
}

/**
 * Build a roster entry from a card the curator is looking at.
 *
 * @param card The card on screen; only its identity and display fields travel.
 * @param now Epoch milliseconds; injectable so tests are deterministic.
 * @returns The entry to place in the draft suite.
 */
export function suiteEntryFromCard(
  card: {
    readonly id: string
    readonly slug: string
    readonly title: string
  },
  now: number = Date.now(),
): SuiteEntry {
  return { id: card.id, slug: card.slug, title: card.title, addedAt: now }
}

/**
 * Append a card to the roster, or refresh it in place when already present.
 *
 * A suite is a set with an order: re-adding a card that is already in the
 * roster keeps its position and refreshes the stored label rather than
 * duplicating it, so the roster never carries a card twice.
 *
 * @param entries The current draft suite.
 * @param entry The entry to append or refresh.
 * @returns A new array, curator order preserved. When the append would exceed
 * {@link SUITE_SESSION_LIMIT} the oldest addition is dropped, not the newest —
 * the roster is the curator's most recent assembly.
 */
export function addSuiteEntry(
  entries: readonly SuiteEntry[],
  entry: SuiteEntry,
): SuiteEntry[] {
  const index = entries.findIndex((existing) => existing.id === entry.id)
  if (index >= 0) {
    const refreshed = [...entries]
    refreshed[index] = entry
    return refreshed
  }
  const appended = [...entries, entry]
  return appended.length > SUITE_SESSION_LIMIT
    ? appended.slice(appended.length - SUITE_SESSION_LIMIT)
    : appended
}

/**
 * Remove one card from the roster by canonical id.
 *
 * @param entries The current draft suite.
 * @param id The canonical card uuid to remove.
 * @returns A new array without any entry carrying that id.
 */
export function removeSuiteEntry(
  entries: readonly SuiteEntry[],
  id: string,
): SuiteEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

/**
 * Whether a card is already in the roster.
 *
 * @param entries The current draft suite.
 * @param id The canonical card uuid.
 * @returns `true` when present.
 */
export function hasSuiteEntry(
  entries: readonly SuiteEntry[],
  id: string,
): boolean {
  return entries.some((entry) => entry.id === id)
}

/**
 * The card slugs of the roster, in curator order.
 *
 * Slugs rather than uuids because that is what the seed and the taxonomy files
 * are written in, so the list can be handed to whoever lands the collection.
 *
 * @param entries The draft suite.
 * @returns The slugs, in the order the curator added them.
 */
export function suiteEntrySlugs(
  entries: readonly SuiteEntry[],
): readonly string[] {
  return entries.map((entry) => entry.slug)
}

/**
 * The hand-off payload for the draft suite.
 *
 * Plain JSON, no envelope: the point is that a maintainer can paste this into a
 * seed change or a review note and act on it. Nothing here asserts that the
 * cards share a locale, a suit or anything else — it is the curator's list,
 * and what it means is a human decision downstream.
 *
 * @param entries The draft suite.
 * @returns A JSON string of the card slugs in curator order.
 */
export function suiteHandoff(entries: readonly SuiteEntry[]): string {
  return JSON.stringify({ cards: suiteEntrySlugs(entries) })
}

/** The storage envelope, versioned so a format change is detectable. */
type SuiteSessionEnvelope = {
  readonly version: number
  readonly entries: readonly SuiteEntry[]
}

/**
 * Serialize a draft suite to its storage string.
 *
 * @param entries The roster to persist.
 * @returns A versioned JSON envelope.
 */
export function serializeSuiteSession(entries: readonly SuiteEntry[]): string {
  const envelope: SuiteSessionEnvelope = {
    version: SUITE_SESSION_VERSION,
    entries,
  }
  return JSON.stringify(envelope)
}

/**
 * Parse a stored draft suite, discarding anything that is not this format.
 *
 * Total by design: `null`, non-JSON, a foreign version, or an envelope whose
 * entries are not all well-formed all yield `[]`. A parse must never throw into
 * a render path.
 *
 * @param raw The raw `localStorage` value, or `null`.
 * @returns The stored roster, or `[]` when the payload is unusable.
 */
export function parseSuiteSession(raw: string | null): SuiteEntry[] {
  if (raw === null || raw.length === 0) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== 'object') return []
  const envelope = parsed as Record<string, unknown>
  if (envelope.version !== SUITE_SESSION_VERSION) return []
  if (!Array.isArray(envelope.entries)) return []
  if (!envelope.entries.every(isSuiteEntry)) return []
  return envelope.entries.map((entry) => ({ ...entry }))
}
