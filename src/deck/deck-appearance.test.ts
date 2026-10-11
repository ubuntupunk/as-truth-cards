/**
 * Tests for `deck-appearance.ts` (SPEC §4.5): the URL-then-storage precedence.
 *
 * The canonical position of a treatment is the `?treatment=` parameter — a
 * shared link reproduces it — so a valid parameter always beats the stored
 * choice. Storage is only the default: unknown values and missing storage must
 * resolve to the stored choice or the atmospheric default, never throw.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GRAPH_TREATMENT_STORAGE_KEY } from '../graph/appearance'
import {
  DECK_DEFAULT_TREATMENT,
  DECK_TREATMENT_QUERY_KEY,
  parseDeckTreatment,
} from './deck-appearance'

/** A minimal in-memory `Storage`-reader. */
function reader(entries: Readonly<Record<string, string>>): {
  getItem: (key: string) => string | null
} {
  return { getItem: (key) => entries[key] ?? null }
}

describe('parseDeckTreatment', () => {
  it('names the query key and the default treatment it means', () => {
    assert.equal(DECK_TREATMENT_QUERY_KEY, 'treatment')
    assert.equal(DECK_DEFAULT_TREATMENT, 'atmospheric')
  })

  it('prefers a valid URL parameter over the stored choice', () => {
    const stored = reader({
      [GRAPH_TREATMENT_STORAGE_KEY]: 'editorial',
    })
    assert.equal(parseDeckTreatment('duotone', stored), 'duotone')
  })

  it('falls back to the stored choice when the URL has no treatment', () => {
    const stored = reader({
      [GRAPH_TREATMENT_STORAGE_KEY]: 'editorial',
    })
    assert.equal(parseDeckTreatment(null, stored), 'editorial')
    assert.equal(parseDeckTreatment(undefined, stored), 'editorial')
  })

  it('ignores an invalid parameter and trusts the stored choice', () => {
    const stored = reader({
      [GRAPH_TREATMENT_STORAGE_KEY]: 'duotone',
    })
    assert.equal(parseDeckTreatment('no-such-treatment', stored), 'duotone')
  })

  it('reaches the default when neither the URL nor storage names one', () => {
    assert.equal(parseDeckTreatment(null, null), DECK_DEFAULT_TREATMENT)
    assert.equal(parseDeckTreatment(undefined, null), DECK_DEFAULT_TREATMENT)
    assert.equal(
      parseDeckTreatment('bogus', reader({})),
      DECK_DEFAULT_TREATMENT,
    )
  })
})
