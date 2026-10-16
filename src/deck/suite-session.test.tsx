/**
 * Tests for `suite-session.ts` — the pure draft-suite model (g2f).
 *
 * The contract is a roster of card *references*: identity is the canonical
 * uuid, re-adding refreshes a card in place instead of duplicating it, the
 * order is the curator's (append — unlike the research tray's recency list),
 * the roster is bounded, and parsing is total so a corrupt `localStorage` value
 * can never reach a render path. The hand-off is pinned too: it carries slugs
 * in curator order and asserts nothing about locale or suit.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addSuiteEntry,
  hasSuiteEntry,
  isSuiteEntry,
  parseSuiteSession,
  removeSuiteEntry,
  SUITE_SESSION_LIMIT,
  SUITE_SESSION_VERSION,
  type SuiteEntry,
  serializeSuiteSession,
  suiteEntryFromCard,
  suiteEntrySlugs,
  suiteHandoff,
} from './suite-session'

/** A deterministic roster entry; `id` keeps the roster unique per call. */
function entry(id: string, addedAt = 0): SuiteEntry {
  return { id, slug: `card-${id}`, title: `Card ${id}`, addedAt }
}

describe('suiteEntryFromCard', () => {
  it('copies identity, slug and title, and stamps the time', () => {
    const built = suiteEntryFromCard(
      { id: 'uuid-1', slug: 'an-open-question', title: 'An open question' },
      1234,
    )
    assert.deepEqual(built, {
      id: 'uuid-1',
      slug: 'an-open-question',
      title: 'An open question',
      addedAt: 1234,
    })
  })

  it('stores no locale and no suit, however the card is classified', () => {
    const built = suiteEntryFromCard(
      { id: 'uuid-1', slug: 'south-africa', title: 'A South Africa case' },
      0,
    )
    assert.deepEqual(Object.keys(built).sort(), [
      'addedAt',
      'id',
      'slug',
      'title',
    ])
  })
})

describe('addSuiteEntry', () => {
  it('appends, keeping the order the curator assembled', () => {
    const next = addSuiteEntry([entry('a', 1)], entry('b', 2))
    assert.deepEqual(
      next.map((e) => e.id),
      ['a', 'b'],
    )
  })

  it('refreshes an existing id in place rather than duplicating or moving it', () => {
    const refreshed: SuiteEntry = {
      id: 'a',
      slug: 'card-a',
      title: 'Renamed',
      addedAt: 99,
    }
    const next = addSuiteEntry([entry('a', 1), entry('b', 2)], refreshed)
    assert.deepEqual(
      next.map((e) => e.id),
      ['a', 'b'],
    )
    assert.equal(next[0].title, 'Renamed')
    assert.equal(next[0].addedAt, 99)
  })

  it('caps the roster at the limit, dropping the oldest addition', () => {
    let entries: SuiteEntry[] = []
    for (let i = 0; i < SUITE_SESSION_LIMIT + 3; i++) {
      entries = addSuiteEntry(entries, entry(`id-${String(i)}`, i))
    }
    assert.equal(entries.length, SUITE_SESSION_LIMIT)
    assert.equal(entries[0].id, 'id-3')
    assert.equal(entries.at(-1)?.id, `id-${String(SUITE_SESSION_LIMIT + 2)}`)
  })
})

describe('removeSuiteEntry / hasSuiteEntry', () => {
  it('removes by id and reports membership', () => {
    const entries = [entry('a'), entry('b')]
    assert.equal(hasSuiteEntry(entries, 'a'), true)
    assert.equal(hasSuiteEntry(entries, 'z'), false)
    assert.deepEqual(
      removeSuiteEntry(entries, 'a').map((e) => e.id),
      ['b'],
    )
  })
})

describe('suiteEntrySlugs / suiteHandoff', () => {
  it('lists the slugs in curator order', () => {
    assert.deepEqual(suiteEntrySlugs([entry('a'), entry('b')]), [
      'card-a',
      'card-b',
    ])
  })

  it('hands off plain JSON card slugs, and asserts nothing else', () => {
    const payload = JSON.parse(
      suiteHandoff([entry('a', 1), entry('b', 2)]),
    ) as Record<string, unknown>
    assert.deepEqual(payload, { cards: ['card-a', 'card-b'] })
  })
})

describe('serializeSuiteSession / parseSuiteSession', () => {
  it('round-trips a roster through the versioned envelope', () => {
    const entries = [entry('a', 1), entry('b', 2)]
    const parsed = parseSuiteSession(serializeSuiteSession(entries))
    assert.deepEqual(parsed, entries)
  })

  it('writes the current envelope version', () => {
    const parsed = JSON.parse(serializeSuiteSession([entry('a')])) as Record<
      string,
      unknown
    >
    assert.equal(parsed.version, SUITE_SESSION_VERSION)
  })

  it('returns [] for absent, empty, or non-JSON input', () => {
    assert.deepEqual(parseSuiteSession(null), [])
    assert.deepEqual(parseSuiteSession(''), [])
    assert.deepEqual(parseSuiteSession('not json'), [])
    assert.deepEqual(parseSuiteSession('42'), [])
  })

  it('discards a foreign version rather than guessing', () => {
    const foreign = JSON.stringify({
      version: SUITE_SESSION_VERSION + 1,
      entries: [entry('a')],
    })
    assert.deepEqual(parseSuiteSession(foreign), [])
  })

  it('discards an envelope whose entries are not all well-formed', () => {
    const mixed = JSON.stringify({
      version: SUITE_SESSION_VERSION,
      entries: [entry('a'), { id: 'b' }],
    })
    assert.deepEqual(parseSuiteSession(mixed), [])
  })

  it('discards a non-array entries field', () => {
    const bad = JSON.stringify({
      version: SUITE_SESSION_VERSION,
      entries: 'nope',
    })
    assert.deepEqual(parseSuiteSession(bad), [])
  })
})

describe('isSuiteEntry', () => {
  it('accepts a well-formed entry', () => {
    assert.equal(isSuiteEntry(entry('a')), true)
  })

  it('rejects empty ids, empty slugs, and bad field types', () => {
    assert.equal(isSuiteEntry({ ...entry('a'), id: '' }), false)
    assert.equal(isSuiteEntry({ ...entry('a'), slug: '' }), false)
    assert.equal(isSuiteEntry({ ...entry('a'), title: 7 }), false)
    assert.equal(isSuiteEntry({ ...entry('a'), addedAt: Number.NaN }), false)
    assert.equal(isSuiteEntry(null), false)
    assert.equal(isSuiteEntry('entry'), false)
  })
})
