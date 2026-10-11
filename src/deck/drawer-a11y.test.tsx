/**
 * Tests for `drawer-a11y.ts` (SPEC §4.7): the pure focus-trap decision used by
 * the below-`xl` workspace drawers. The DOM-dependent behaviour (focus trap,
 * background inerting, focus return) is exercised in the browser; the pure
 * wrap decision is covered here.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldWrapTab } from './drawer-a11y'

describe('shouldWrapTab', () => {
  it('wraps forward from the last item to the first', () => {
    assert.equal(shouldWrapTab(3, 2, false), true)
  })

  it('does not wrap forward from a middle item', () => {
    assert.equal(shouldWrapTab(3, 0, false), false)
    assert.equal(shouldWrapTab(3, 1, false), false)
  })

  it('wraps backward from the first item to the last', () => {
    assert.equal(shouldWrapTab(3, 0, true), true)
  })

  it('does not wrap backward from a middle item', () => {
    assert.equal(shouldWrapTab(3, 2, true), false)
    assert.equal(shouldWrapTab(3, 1, true), false)
  })

  it('wraps when focus is outside the dialog (index -1)', () => {
    assert.equal(shouldWrapTab(3, -1, false), true)
    assert.equal(shouldWrapTab(3, -1, true), true)
  })

  it('wraps when the dialog has no focusable items', () => {
    assert.equal(shouldWrapTab(0, -1, false), true)
  })
})
