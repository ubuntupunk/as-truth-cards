/**
 * Tests for `query-params.ts` — the URL ⇄ API param translation layer.
 *
 * The key contract under test is that the serializer and the parser agree
 * (`parseGraphParams(serializeGraphParams(x))` round-trips), and that both
 * only ever emit the three parameter names the server's `parseGraphQuery`
 * recognises — a renamed server key surfaces here as a failing test, which is
 * the point of centralising it.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  clampDepth,
  depthOptions,
  EMPTY_GRAPH_PARAMS,
  parseGraphParams,
  serializeGraphParams,
} from './query-params'

describe('parseGraphParams', () => {
  it('returns empty params for an empty or absent query string', () => {
    assert.deepEqual(parseGraphParams(''), EMPTY_GRAPH_PARAMS)
    assert.deepEqual(parseGraphParams('?'), EMPTY_GRAPH_PARAMS)
    assert.deepEqual(
      parseGraphParams(new URLSearchParams()),
      EMPTY_GRAPH_PARAMS,
    )
  })

  it('parses a focus-only query', () => {
    assert.deepEqual(parseGraphParams('?focus=jesus-was-a-zionist'), {
      focus: 'jesus-was-a-zionist',
      view: null,
      depth: null,
    })
  })

  it('parses focus + view + depth', () => {
    const params = parseGraphParams(
      '?focus=bf000000-0000-0000-0000-000000000001&view=card-argument-taxonomy&depth=2',
    )
    assert.deepEqual(params, {
      focus: 'bf000000-0000-0000-0000-000000000001',
      view: 'card-argument-taxonomy',
      depth: 2,
    })
  })

  it('accepts a URLSearchParams instance directly', () => {
    const params = parseGraphParams(
      new URLSearchParams('focus=abc&view=xyz&depth=1'),
    )
    assert.equal(params.focus, 'abc')
    assert.equal(params.view, 'xyz')
    assert.equal(params.depth, 1)
  })

  it('trims whitespace and treats blank focus as absent', () => {
    assert.equal(parseGraphParams('?focus=%20%20').focus, null)
    assert.equal(parseGraphParams('?focus=foo%20bar').focus, 'foo bar')
  })

  it('degrades an unusable depth to null instead of erroring', () => {
    assert.equal(parseGraphParams('?focus=x&depth=abc').depth, null)
    assert.equal(parseGraphParams('?focus=x&depth=-3').depth, null)
    assert.equal(parseGraphParams('?focus=x&depth=1.9').depth, 1)
    assert.equal(parseGraphParams('?focus=x&depth=0').depth, 0)
  })

  it('keeps a malformed focus verbatim — the server owns that error', () => {
    assert.equal(
      parseGraphParams('?focus=%20not%20a%20slug%20').focus,
      'not a slug',
    )
  })
})

describe('serializeGraphParams', () => {
  it('omits null fields and keeps the ordering focus, view, depth', () => {
    assert.equal(serializeGraphParams(EMPTY_GRAPH_PARAMS), '')
    assert.equal(
      serializeGraphParams({
        focus: 'slugged-card',
        view: null,
        depth: 0,
      }),
      'focus=slugged-card&depth=0',
    )
    assert.equal(
      serializeGraphParams({
        focus: 'a',
        view: 'taxonomy',
        depth: 3,
      }),
      'focus=a&view=taxonomy&depth=3',
    )
  })

  it('round-trips through the parser', () => {
    const samples: Parameters<typeof serializeGraphParams>[0][] = [
      EMPTY_GRAPH_PARAMS,
      { focus: 'x', view: null, depth: null },
      { focus: 'a b', view: 'taxonomy', depth: 1 },
      { focus: 'x', view: 'v', depth: 0 },
    ]
    for (const sample of samples) {
      assert.deepEqual(
        parseGraphParams(serializeGraphParams(sample)),
        sample,
        `round-trip failed for ${JSON.stringify(sample)}`,
      )
    }
  })
})

describe('clampDepth', () => {
  it('clamps above the ceiling and below the floor', () => {
    assert.equal(clampDepth(9, 3), 3)
    assert.equal(clampDepth(-1, 3), 0)
    assert.equal(clampDepth(3, 3), 3)
  })

  it('passes null through untouched', () => {
    assert.equal(clampDepth(null, 3), null)
  })

  it('never produces a negative ceiling', () => {
    assert.equal(clampDepth(0, -2), 0)
  })
})

describe('depthOptions', () => {
  it('offers 0..maxDepth inclusive', () => {
    assert.deepEqual(depthOptions(3), [0, 1, 2, 3])
    assert.deepEqual(depthOptions(0), [0])
  })

  it('degenerates to [0] for a negative max', () => {
    assert.deepEqual(depthOptions(-1), [0])
  })
})
