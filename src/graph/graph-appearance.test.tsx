/**
 * Tests for `appearance.ts` — the Graph Explorer's three treatments.
 *
 * The contract this pins is structural, not aesthetic: every treatment carries
 * the same 16 chrome surfaces, the same 12 node colours and 7 edge colours
 * (so `buildGraphStylesheet` can repaint any treatment without branching), the
 * treatments are actually *different* token sets (the switcher only works if a
 * change is observable), and storage reads are total — a missing, broken or
 * unavailable storage always degrades to a valid treatment, never an error.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GRAPH_TREATMENT_LABELS,
  GRAPH_TREATMENT_STORAGE_KEY,
  GRAPH_TREATMENT_TOKENS,
  GRAPH_TREATMENTS,
  type GraphChromeTokens,
  isGraphTreatment,
  readGraphTreatment,
} from './appearance'

describe('graph appearance vocabulary', () => {
  it('recognises exactly the three treatments', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      assert.equal(isGraphTreatment(treatment), true)
    }
    assert.equal(isGraphTreatment('ultraviolet'), false)
    assert.equal(isGraphTreatment(''), false)
    assert.equal(isGraphTreatment(undefined), false)
    assert.equal(isGraphTreatment(42), false)
  })

  it('gives every treatment a display label', () => {
    assert.deepEqual(
      GRAPH_TREATMENTS.map((treatment) => GRAPH_TREATMENT_LABELS[treatment]),
      ['Atmospheric', 'Editorial', 'Workspace'],
    )
  })
})

describe('graph appearance token shape', () => {
  it('gives every treatment the full chrome surface set', () => {
    const expectedKeys = Object.keys(
      GRAPH_TREATMENT_TOKENS.atmospheric.chrome,
    ).sort()
    const chromeKeys = Object.keys(
      GRAPH_TREATMENT_TOKENS.atmospheric.chrome,
    ) as (keyof GraphChromeTokens)[]
    assert.equal(chromeKeys.length, 16, 'all 16 INSTRUCTION surfaces')
    for (const key of chromeKeys) {
      assert.ok(key.length > 0)
    }
    for (const treatment of GRAPH_TREATMENTS) {
      assert.deepEqual(
        Object.keys(GRAPH_TREATMENT_TOKENS[treatment].chrome).sort(),
        expectedKeys,
        `${treatment} must define the same chrome surfaces`,
      )
    }
  })

  it('gives every treatment the neighbourhood palettes the stylesheet keys on', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      const tokens = GRAPH_TREATMENT_TOKENS[treatment]
      assert.equal(Object.keys(tokens.nodeColors).length, 12)
      assert.equal(Object.keys(tokens.edgeColors).length, 7)
      for (const value of Object.values(tokens.nodeColors)) {
        assert.match(value, /^#[0-9a-f]{6}$/i)
      }
      for (const value of Object.values(tokens.edgeColors)) {
        assert.match(value, /^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('treatments are observably different token sets', () => {
    const a = GRAPH_TREATMENT_TOKENS.atmospheric
    const e = GRAPH_TREATMENT_TOKENS.editorial
    const w = GRAPH_TREATMENT_TOKENS.workspace
    assert.notEqual(a.chrome.page, e.chrome.page)
    assert.notEqual(e.chrome.accent, w.chrome.accent)
    assert.notEqual(a.nodeColors.card, e.nodeColors.card)
    // All three share the full vocabulary key sets regardless of differences.
    for (const treatment of GRAPH_TREATMENTS) {
      assert.deepEqual(
        Object.keys(GRAPH_TREATMENT_TOKENS[treatment].nodeColors).sort(),
        Object.keys(a.nodeColors).sort(),
      )
      assert.deepEqual(
        Object.keys(GRAPH_TREATMENT_TOKENS[treatment].edgeColors).sort(),
        Object.keys(a.edgeColors).sort(),
      )
    }
  })

  it('chrome tokens are raw HSL triplets for --graph-* variables', () => {
    for (const treatment of GRAPH_TREATMENTS) {
      for (const value of Object.values(
        GRAPH_TREATMENT_TOKENS[treatment].chrome,
      )) {
        assert.match(value, /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/)
      }
    }
  })
})

describe('graph appearance storage', () => {
  it('defaults to atmospheric when there is no storage', () => {
    assert.equal(readGraphTreatment(null), 'atmospheric')
  })

  it('defaults to atmospheric when storage has no saved treatment', () => {
    const storage = { getItem: () => null }
    assert.equal(readGraphTreatment(storage), 'atmospheric')
  })

  it('reads back a persisted valid treatment', () => {
    const storage = {
      getItem: (key: string) =>
        key === GRAPH_TREATMENT_STORAGE_KEY ? 'workspace' : null,
    }
    assert.equal(readGraphTreatment(storage), 'workspace')
  })

  it('falls back to atmospheric for a garbage saved value', () => {
    const storage = { getItem: () => 'just-for-you' }
    assert.equal(readGraphTreatment(storage), 'atmospheric')
  })
})
