/**
 * The research-session model — Phase D (ROADMAP §127–166), the pure half.
 *
 * A **research session** is the set of canonical entities a researcher has
 * focused while exploring. It is *not* a Better Auth user session and *not* a
 * durable user activity record: it is browser-local working state, exactly the
 * distinction ROADMAP §150–158 draws. Nothing here authenticates, nothing here
 * persists to a server, and nothing here mutates `trope_graph`.
 *
 * The entries are references, never re-authored data. An entry keeps the
 * canonical node uuid, its type, its display label, and the view/depth that
 * were in force when it was focused, so re-opening one restores the same
 * projection the researcher was reading. The label is a convenience for the
 * roster; identity is the uuid, and a stale label is corrected the moment the
 * projection is loaded again.
 *
 * Persistence is a versioned JSON envelope. Parsing is total: a missing,
 * malformed, or older payload yields an empty session rather than throwing, so
 * a corrupt `localStorage` value can never take the page down. That is the same
 * "never a silently-empty projection" discipline the graph reads follow, moved
 * to local state.
 */

import type { GraphNodeType } from '../../trope-cards/src/graph/types.ts'
import type { GraphParams } from '../graph/query-params'

/** The `localStorage` key the research session is kept under. */
export const RESEARCH_SESSION_STORAGE_KEY = 'truth-cards/research-session'

/** The envelope version. A payload with any other version is discarded. */
export const RESEARCH_SESSION_VERSION = 1

/** How many focuses one research session keeps before the oldest is dropped. */
export const RESEARCH_SESSION_LIMIT = 50

/** Every node type the graph can focus, as a runtime lookup for validation. */
const RESEARCH_ENTRY_TYPES: readonly GraphNodeType[] = [
  'card',
  'claim',
  'inference_step',
  'argument_chain',
  'collection',
  'mechanism',
  'concept',
  'source',
  'evidence_item',
  'case',
  'interpretation',
  'question',
]

/**
 * One focus kept in the research session.
 *
 * `view` and `depth` are the active projection parameters at focus time, or
 * `null` when the server default was in force — kept as `null` rather than
 * materialised, so a stored entry never freezes a default that the server could
 * later change.
 */
export type ResearchEntry = {
  /** The canonical `trope_graph` node uuid. */
  readonly id: string
  /** The node's entity type. */
  readonly type: GraphNodeType
  /** The node label at focus time; display only, corrected on reload. */
  readonly label: string
  /** The view in force when focused, or `null` for the server default. */
  readonly view: string | null
  /** The depth in force when focused, or `null` for the server default. */
  readonly depth: number | null
  /** Epoch milliseconds the entry was added, for ordering the roster. */
  readonly addedAt: number
}

/** Whether a value is a `GraphNodeType` this model will store. */
function isEntryType(value: unknown): value is GraphNodeType {
  return (
    typeof value === 'string' &&
    (RESEARCH_ENTRY_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Whether an unknown value is a well-formed {@link ResearchEntry}.
 *
 * Validation is structural and strict: a payload that a future format change
 * makes unreadable is discarded whole rather than partially trusted.
 *
 * @param value The candidate, typically one member of a parsed envelope.
 * @returns `true` only when every field is present and of the right type.
 */
export function isResearchEntry(value: unknown): value is ResearchEntry {
  if (value === null || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    isEntryType(entry.type) &&
    typeof entry.label === 'string' &&
    (entry.view === null || typeof entry.view === 'string') &&
    (entry.depth === null ||
      (typeof entry.depth === 'number' && Number.isFinite(entry.depth))) &&
    typeof entry.addedAt === 'number' &&
    Number.isFinite(entry.addedAt)
  )
}

/**
 * Build a session entry from a projection node and the projection parameters.
 *
 * @param node The focused node (its `id` is the canonical uuid).
 * @param params The params the projection was requested with.
 * @param now Epoch milliseconds; injectable so tests are deterministic.
 * @returns The entry to store.
 */
export function entryFromNode(
  node: {
    readonly id: string
    readonly type: GraphNodeType
    readonly label: string
  },
  params: GraphParams,
  now: number = Date.now(),
): ResearchEntry {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    view: params.view,
    depth: params.depth,
    addedAt: now,
  }
}

/**
 * The graph params that re-open an entry.
 *
 * Focus is the canonical uuid, not the label or a slug: identity is what the
 * projection resolves, and storing the uuid means a renamed card still opens.
 *
 * @param entry A stored entry.
 * @returns Params for `serializeGraphParams`.
 */
export function entryToGraphParams(entry: ResearchEntry): GraphParams {
  return { focus: entry.id, view: entry.view, depth: entry.depth }
}

/**
 * Add or refresh an entry, most-recent-first, capped at the session limit.
 *
 * Re-adding an id that is already present moves it to the front and refreshes
 * its view/depth/label rather than duplicating it, so the roster is a set of
 * focuses and not a visit log.
 *
 * @param entries The current session.
 * @param entry The entry to add or refresh.
 * @returns A new, most-recent-first array.
 */
export function addResearchEntry(
  entries: readonly ResearchEntry[],
  entry: ResearchEntry,
): ResearchEntry[] {
  const without = entries.filter((existing) => existing.id !== entry.id)
  return [entry, ...without].slice(0, RESEARCH_SESSION_LIMIT)
}

/**
 * Remove one entry by canonical id.
 *
 * @param entries The current session.
 * @param id The canonical node uuid to remove.
 * @returns A new array without any entry carrying that id.
 */
export function removeResearchEntry(
  entries: readonly ResearchEntry[],
  id: string,
): ResearchEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

/**
 * Whether an id is already in the session.
 *
 * @param entries The current session.
 * @param id The canonical node uuid.
 * @returns `true` when present.
 */
export function hasResearchEntry(
  entries: readonly ResearchEntry[],
  id: string,
): boolean {
  return entries.some((entry) => entry.id === id)
}

/** The storage envelope, versioned so a format change is detectable. */
type ResearchSessionEnvelope = {
  readonly version: number
  readonly entries: readonly ResearchEntry[]
}

/**
 * Serialize a session to its storage string.
 *
 * @param entries The session to persist.
 * @returns A versioned JSON envelope.
 */
export function serializeResearchSession(
  entries: readonly ResearchEntry[],
): string {
  const envelope: ResearchSessionEnvelope = {
    version: RESEARCH_SESSION_VERSION,
    entries,
  }
  return JSON.stringify(envelope)
}

/**
 * Parse a stored session, discarding anything that is not this format.
 *
 * Total by design: `null`, non-JSON, a foreign version, or an envelope whose
 * entries are not all well-formed all yield `[]`. A parse must never throw into
 * a render path.
 *
 * @param raw The raw `localStorage` value, or `null`.
 * @returns The stored entries, or `[]` when the payload is unusable.
 */
export function parseResearchSession(raw: string | null): ResearchEntry[] {
  if (raw === null || raw.length === 0) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== 'object') return []
  const envelope = parsed as Record<string, unknown>
  if (envelope.version !== RESEARCH_SESSION_VERSION) return []
  if (!Array.isArray(envelope.entries)) return []
  if (!envelope.entries.every(isResearchEntry)) return []
  return envelope.entries.map((entry) => ({ ...entry }))
}
