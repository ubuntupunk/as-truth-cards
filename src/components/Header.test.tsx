/**
 * Tests for the global `Header` navigation contract.
 *
 * Two things matter here. Discoverability: Compose (`/research/compose`) is a
 * real, fully implemented surface and must be a first-class navigation entry, so
 * it is reachable in one click from anywhere. Honesty: the active entry must not
 * misreport where the user is — in particular Research and Compose must never
 * both read as current.
 *
 * The Header renders `<Link>`s and reads router state, which this SSR harness
 * cannot provide, so the exported navigation table and its pure matching
 * function are the units under test — they are exactly what the Header maps to
 * `aria-current`.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNavEntryActive, NAV_ENTRIES } from './Header'

/** Find a nav entry by its label. */
function entry(label: string) {
  const found = NAV_ENTRIES.find((item) => item.label === label)
  assert.ok(found, `expected a ${label} nav entry`)
  return found
}

describe('Header navigation entries', () => {
  it('exposes Compose as a navigable destination', () => {
    const compose = entry('Compose')
    assert.equal(compose.path, '/research/compose')
  })

  it('lists every top-level surface reachable from the header', () => {
    assert.deepEqual(
      NAV_ENTRIES.map((item) => item.label),
      ['Decks', 'Explorer', 'Graph', 'Research', 'Compose', 'Sources'],
    )
  })
})

describe('Header active-section matching', () => {
  it('marks Compose current on its route and not Research', () => {
    assert.equal(isNavEntryActive(entry('Compose'), '/research/compose'), true)
    assert.equal(
      isNavEntryActive(entry('Research'), '/research/compose'),
      false,
    )
  })

  it('marks Research current only on the Research workspace', () => {
    assert.equal(isNavEntryActive(entry('Research'), '/research'), true)
    assert.equal(isNavEntryActive(entry('Research'), '/graph'), false)
  })

  it('keeps Sources current while a source is selected', () => {
    assert.equal(isNavEntryActive(entry('Sources'), '/sources'), true)
    assert.equal(isNavEntryActive(entry('Sources'), '/sources/abc'), true)
  })

  it('matches exact top-level routes exactly', () => {
    assert.equal(isNavEntryActive(entry('Decks'), '/'), true)
    assert.equal(isNavEntryActive(entry('Decks'), '/explore'), false)
    assert.equal(isNavEntryActive(entry('Graph'), '/graph'), true)
  })
})
