/**
 * Tests for `card-navigation.tsx` — Previous / position / Shuffle next
 * (SPEC §6.3).
 *
 * The row must state the position as `n / total` *and* as a progress bar a
 * screen reader can read, keep Previous cyclic rather than dead at the start,
 * and disable Shuffle only when a single-card deck has nowhere to shuffle to.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { CardNavigation, type CardNavigationProps } from './card-navigation'
import { NO_SCOPE, previousCard, startDeck } from './deck-model'
import { ALL_CARDS, buttonByText, OPEN_CARD, walk } from './test-fixtures'

/** The navigation row over the fixture deck, with recording callbacks. */
function fixture(
  overrides: Partial<CardNavigationProps> = {},
): CardNavigationProps & { calls: { previous: number; shuffle: number } } {
  const calls = { previous: 0, shuffle: 0 }
  const props: CardNavigationProps = {
    session: startDeck(ALL_CARDS, NO_SCOPE),
    onPrevious: () => {
      calls.previous += 1
    },
    onShuffle: () => {
      calls.shuffle += 1
    },
    ...overrides,
  }
  return { ...props, calls }
}

describe('CardNavigation', () => {
  it('states the position as n / total, one-based', () => {
    const html = render(<CardNavigation {...fixture()} />)
    assert.ok(html.includes('data-testid="position-label"'))
    assert.ok(html.includes('1 / 3'))
  })

  it('reports the same position through the progress bar', () => {
    const html = render(
      <CardNavigation
        {...fixture({ session: previousCard(startDeck(ALL_CARDS, NO_SCOPE)) })}
      />,
    )
    assert.match(html, /aria-valuenow="3"/)
    assert.match(html, /aria-valuemax="3"/)
    assert.match(html, /aria-valuemin="0"/)
    assert.ok(html.includes('aria-label="Deck progress"'))
  })

  it('says 0 / 0 rather than 1 / 0 for an empty deck', () => {
    const html = render(
      <CardNavigation {...fixture({ session: startDeck([], NO_SCOPE) })} />,
    )
    assert.ok(html.includes('0 / 0'))
    assert.match(html, /aria-valuenow="0"/)
  })

  it('steps to the previous card cyclically', () => {
    const props = fixture()
    const tree = CardNavigation(props)
    const html = render(tree)
    const previous = buttonByText(tree, 'Previous')
    assert.ok(previous)
    assert.ok(html.includes('Previous'))
    ;(previous?.props?.onClick as () => void)()
    assert.equal(props.calls.previous, 1)
    assert.equal(previous?.props?.disabled, false)
  })

  it('shuffles forward and stays enabled while there is a deck to shuffle', () => {
    const props = fixture()
    const shuffle = buttonByText(CardNavigation(props), 'Shuffle next')
    assert.ok(shuffle)
    assert.equal(shuffle?.props?.disabled, false)
    ;(shuffle?.props?.onClick as () => void)()
    assert.equal(props.calls.shuffle, 1)
  })

  it('disables Shuffle only when a one-card deck has nowhere to go', () => {
    const props = fixture({ session: startDeck([OPEN_CARD], NO_SCOPE) })
    const shuffle = buttonByText(CardNavigation(props), 'Shuffle next')
    assert.equal(shuffle?.props?.disabled, true)
    assert.ok(render(<CardNavigation {...props} />).includes('disabled'))
  })

  it('disables both controls when the deck is empty', () => {
    const props = fixture({ session: startDeck([], NO_SCOPE) })
    const tree = CardNavigation(props)
    assert.equal(buttonByText(tree, 'Previous')?.props?.disabled, true)
    assert.equal(buttonByText(tree, 'Shuffle next')?.props?.disabled, true)
  })

  it('keeps both controls as real buttons with 44px targets', () => {
    const props = fixture()
    const tree = CardNavigation(props)
    const html = render(tree)
    assert.equal(walk(tree, (node) => node.type === 'button').length, 2)
    assert.ok(html.includes('min-h-[44px]'))
    assert.ok(html.includes('data-testid="card-navigation"'))
    assert.ok(html.includes('aria-label="Card navigation"'))
  })
})
