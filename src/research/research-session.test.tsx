/**
 * Tests for `research-session.ts` — the pure research-session model.
 *
 * The contract is a set of focus *references*: identity is the canonical uuid,
 * re-adding refreshes rather than duplicates, the roster is bounded, and parsing
 * is total so a corrupt `localStorage` value can never reach a render path. The
 * entry/envelope formats are pinned here because `use-research-session.ts` and
 * the panel both depend on them.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addResearchEntry,
  entryFromNode,
  entryToGraphParams,
  hasResearchEntry,
  isResearchEntry,
  parseResearchSession,
  RESEARCH_SESSION_LIMIT,
  RESEARCH_SESSION_VERSION,
  type ResearchEntry,
  removeResearchEntry,
  serializeResearchSession,
} from './research-session'

/** A deterministic one-off entry; `id` keeps the roster unique per call. */
function entry(id: string, addedAt = 0): ResearchEntry {
  return {
    id,
    type: 'claim',
    label: `Claim ${id}`,
    view: 'card-argument-taxonomy',
    depth: 2,
    addedAt,
  }
}

describe('entryFromNode', () => {
  it('copies identity, label, and the projection params at focus time', () => {
    const built = entryFromNode(
      { id: 'node-1', type: 'source', label: 'A source' },
      { focus: 'ignored', view: 'card-argument-taxonomy', depth: 3 },
      1234,
    )
    assert.deepEqual(built, {
      id: 'node-1',
      type: 'source',
      label: 'A source',
      view: 'card-argument-taxonomy',
      depth: 3,
      addedAt: 1234,
    })
  })

  it('keeps absent params as null rather than materializing server defaults', () => {
    const built = entryFromNode(
      { id: 'node-2', type: 'card', label: 'Card' },
      { focus: null, view: null, depth: null },
    )
    assert.equal(built.view, null)
    assert.equal(built.depth, null)
  })
})

describe('entryToGraphParams', () => {
  it('addresses the projection by canonical id, not label', () => {
    assert.deepEqual(entryToGraphParams(entry('uuid-9')), {
      focus: 'uuid-9',
      view: 'card-argument-taxonomy',
      depth: 2,
    })
  })
})

describe('addResearchEntry', () => {
  it('prepends a new focus', () => {
    const next = addResearchEntry([entry('a', 1)], entry('b', 2))
    assert.deepEqual(
      next.map((e) => e.id),
      ['b', 'a'],
    )
  })

  it('refreshes an existing id in place rather than duplicating it', () => {
    const refreshed: ResearchEntry = {
      id: 'a',
      type: 'source',
      label: 'Renamed',
      view: null,
      depth: null,
      addedAt: 99,
    }
    const next = addResearchEntry([entry('a', 1), entry('b', 2)], refreshed)
    assert.deepEqual(
      next.map((e) => e.id),
      ['a', 'b'],
    )
    assert.equal(next[0].label, 'Renamed')
    assert.equal(next[0].addedAt, 99)
  })

  it('caps the session at the limit, dropping the oldest', () => {
    let entries: ResearchEntry[] = []
    for (let i = 0; i < RESEARCH_SESSION_LIMIT + 3; i++) {
      entries = addResearchEntry(entries, entry(`id-${String(i)}`, i))
    }
    assert.equal(entries.length, RESEARCH_SESSION_LIMIT)
    assert.equal(entries[0].id, `id-${String(RESEARCH_SESSION_LIMIT + 2)}`)
    assert.equal(entries.at(-1)?.id, 'id-3')
  })
})

describe('removeResearchEntry / hasResearchEntry', () => {
  it('removes by id and reports membership', () => {
    const entries = [entry('a'), entry('b')]
    assert.equal(hasResearchEntry(entries, 'a'), true)
    assert.equal(hasResearchEntry(entries, 'z'), false)
    assert.deepEqual(
      removeResearchEntry(entries, 'a').map((e) => e.id),
      ['b'],
    )
  })
})

describe('serializeResearchSession / parseResearchSession', () => {
  it('round-trips a session through the versioned envelope', () => {
    const entries = [entry('a', 1), entry('b', 2)]
    const parsed = parseResearchSession(serializeResearchSession(entries))
    assert.deepEqual(parsed, entries)
  })

  it('writes the current envelope version', () => {
    const parsed = JSON.parse(serializeResearchSession([entry('a')])) as Record<
      string,
      unknown
    >
    assert.equal(parsed.version, RESEARCH_SESSION_VERSION)
  })

  it('returns [] for absent, empty, or non-JSON input', () => {
    assert.deepEqual(parseResearchSession(null), [])
    assert.deepEqual(parseResearchSession(''), [])
    assert.deepEqual(parseResearchSession('not json'), [])
    assert.deepEqual(parseResearchSession('42'), [])
  })

  it('discards a foreign version rather than guessing', () => {
    const foreign = JSON.stringify({
      version: RESEARCH_SESSION_VERSION + 1,
      entries: [entry('a')],
    })
    assert.deepEqual(parseResearchSession(foreign), [])
  })

  it('discards an envelope whose entries are not all well-formed', () => {
    const mixed = JSON.stringify({
      version: RESEARCH_SESSION_VERSION,
      entries: [entry('a'), { id: 'b' }],
    })
    assert.deepEqual(parseResearchSession(mixed), [])
  })

  it('discards a non-array entries field', () => {
    const bad = JSON.stringify({
      version: RESEARCH_SESSION_VERSION,
      entries: 'nope',
    })
    assert.deepEqual(parseResearchSession(bad), [])
  })
})

describe('isResearchEntry', () => {
  it('accepts a well-formed entry', () => {
    assert.equal(isResearchEntry(entry('a')), true)
  })

  it('rejects unknown types, empty ids, and bad field types', () => {
    assert.equal(isResearchEntry({ ...entry('a'), type: 'planet' }), false)
    assert.equal(isResearchEntry({ ...entry('a'), id: '' }), false)
    assert.equal(isResearchEntry({ ...entry('a'), view: 7 }), false)
    assert.equal(isResearchEntry({ ...entry('a'), depth: 'deep' }), false)
    assert.equal(isResearchEntry({ ...entry('a'), addedAt: Number.NaN }), false)
    assert.equal(isResearchEntry(null), false)
    assert.equal(isResearchEntry('entry'), false)
  })
})
