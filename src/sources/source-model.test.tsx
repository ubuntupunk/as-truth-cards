/**
 * Tests for `source-model.ts` — the pure Sources vocabulary.
 *
 * The contract under test is the SPEC §8.2 line the surface exists to keep: a
 * source's count is an *attribution* count (never "support", never "evidence"),
 * absent metadata is omitted rather than blanked, and every path a source opens
 * (the page's projection and a saved research entry) agrees on the `evidence`
 * view.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SourceSummary } from '../graph/projection-guards'
import {
  attributionSummary,
  humanizeSourceType,
  sourceAttributionParams,
  sourceMetadataLines,
  sourceToResearchEntry,
} from './source-model'

/** A complete source row. */
const FULL: SourceSummary = {
  id: 'c0d566c3-df3e-4080-aad1-f0a4e74a0a45',
  title: 'The Merneptah Stele',
  author: 'Commissioned by Pharaoh Merneptah',
  publisher: 'Egyptian Museum',
  citation: 'c. 1208 BCE',
  url: 'https://example.org/merneptah',
  sourceType: 'PRIMARY_DOCUMENT',
  claimSourceCount: 1,
}

describe('humanizeSourceType', () => {
  it('renders an enum-ish type as a readable label without remapping it', () => {
    assert.equal(humanizeSourceType('PRIMARY_DOCUMENT'), 'Primary document')
    assert.equal(humanizeSourceType('ACADEMIC_ARTICLE'), 'Academic article')
  })

  it('passes a bare word through unchanged', () => {
    assert.equal(humanizeSourceType('BOOK'), 'Book')
  })
})

describe('attributionSummary', () => {
  it('never says "support" or "evidence"', () => {
    for (const count of [0, 1, 3]) {
      const summary = attributionSummary(count).toLowerCase()
      assert.ok(!summary.includes('support'))
      assert.ok(!summary.includes('evidence'))
    }
  })

  it('states zero plainly and pluralizes above one', () => {
    assert.equal(attributionSummary(0), 'No claims attributed')
    assert.equal(attributionSummary(1), '1 claim attributed')
    assert.equal(attributionSummary(3), '3 claims attributed')
  })
})

describe('sourceMetadataLines', () => {
  it('returns the populated fields in Author, Publisher, Citation order', () => {
    assert.deepEqual(
      sourceMetadataLines(FULL).map((line) => line.label),
      ['Author', 'Publisher', 'Citation'],
    )
  })

  it('omits absent fields rather than blanking them', () => {
    const sparse: SourceSummary = {
      ...FULL,
      author: null,
      publisher: null,
      citation: null,
    }
    assert.deepEqual(sourceMetadataLines(sparse), [])
  })
})

describe('sourceAttributionParams', () => {
  it('always opens the evidence view at the server default depth', () => {
    assert.deepEqual(sourceAttributionParams(FULL.id), {
      focus: FULL.id,
      view: 'evidence',
      depth: null,
    })
  })
})

describe('sourceToResearchEntry', () => {
  it('stores a pointer, not a copy, keyed to the canonical id', () => {
    const entry = sourceToResearchEntry(FULL, 1234)
    assert.equal(entry.id, FULL.id)
    assert.equal(entry.type, 'source')
    assert.equal(entry.label, FULL.title)
    assert.equal(entry.addedAt, 1234)
  })

  it('stores the same projection the page opens', () => {
    const entry = sourceToResearchEntry(FULL)
    const params = sourceAttributionParams(FULL.id)
    assert.equal(entry.view, params.view)
    assert.equal(entry.depth, params.depth)
  })
})
