/**
 * Tests for `deck-scope.tsx` — the badge row above the featured card
 * (SPEC §6.1).
 *
 * The row is presentational: it says how many cards the reader is looking at
 * and turns each filter into a toggle badge whose `aria-pressed` carries state.
 * These tests pin the copy (`6 of 47 cards`, the research-status wording),
 * that a served-but-truncated list admits it, and that clicking a badge emits
 * the next scope — applying that scope to cards is `applyScope`'s job, covered
 * by the model suite.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { DeckScope } from './deck-model'
import { NO_SCOPE } from './deck-model'
import { DeckScopeBadges, type DeckScopeBadgesProps } from './deck-scope'
import { buttons, buttonsLabelled, walk } from './test-fixtures'

/** The props the page hands the badge row, with a recording `onChange`. */
function fixture(
  overrides: Partial<DeckScopeBadgesProps> = {},
): DeckScopeBadgesProps & { changes: DeckScope[] } {
  const changes: DeckScope[] = []
  const props: DeckScopeBadgesProps = {
    total: 47,
    served: 47,
    shown: 6,
    scope: { ...NO_SCOPE, axis: 'TACTIC', status: 'OPEN' },
    axes: ['TACTIC', 'HISTORICAL'],
    statuses: ['ESTABLISHED', 'OPEN'],
    onChange: (next) => changes.push(next),
    ...overrides,
  }
  return { ...props, changes }
}

/** Click the first button whose text is exactly `label`, recording the result. */
function click(props: DeckScopeBadgesProps, label: string): void {
  const toggles = buttonsLabelled(DeckScopeBadges(props), label)
  ;(toggles[0].props?.onClick as () => void)()
}

describe('DeckScopeBadges', () => {
  it('reports how many of the cards are on screen', () => {
    const html = render(<DeckScopeBadges {...fixture()} />)
    assert.ok(html.includes('6 of 47 cards'))
  })

  it('pluralises off the corpus when one card survives the scope', () => {
    const html = render(
      <DeckScopeBadges {...fixture({ shown: 1, total: 47 })} />,
    )
    assert.ok(html.includes('1 of 47 cards'))
    assert.ok(!/1 of 47 card(?!s)/.test(html))
  })

  it('counts plainly when the whole list was served', () => {
    const html = render(
      <DeckScopeBadges {...fixture({ shown: 47, total: 47 })} />,
    )
    assert.ok(html.includes('47 cards'))
    assert.ok(!html.includes('47 of 47'))
  })

  it('admits truncation when the server capped the list', () => {
    const html = render(
      <DeckScopeBadges {...fixture({ served: 200, total: 512, shown: 6 })} />,
    )
    assert.ok(html.includes('6 of 512 cards (first 200 loaded)'))
  })

  it('offers one badge per available axis and status, plus All exits', () => {
    const vnode = DeckScopeBadges(fixture())
    assert.equal(buttonsLabelled(vnode, 'Tactic').length, 1)
    assert.equal(buttonsLabelled(vnode, 'Historical').length, 1)
    assert.equal(buttonsLabelled(vnode, 'Open questions').length, 1)
    assert.equal(buttonsLabelled(vnode, 'All axes').length, 1)
    assert.equal(buttonsLabelled(vnode, 'All statuses').length, 1)
  })

  it('marks the active axis with aria-pressed, not with colour', () => {
    const html = render(<DeckScopeBadges {...fixture()} />)
    assert.match(html, /aria-pressed="true"[^>]*>Tactic</)
    assert.match(html, /aria-pressed="false"[^>]*>Historical</)
    assert.ok(!/aria-pressed="true"[^>]*>All axes</.test(html))
  })

  it('uses the spec’s research-status wording, never the raw enum', () => {
    const html = render(<DeckScopeBadges {...fixture()} />)
    assert.ok(html.includes('Open questions'))
    assert.ok(html.includes('Established'))
    assert.ok(!html.includes('OPEN'))
    assert.ok(!html.includes('ESTABLISHED'))
  })

  it('clears the axis when its own badge is clicked again', () => {
    const props = fixture()
    click(props, 'Tactic')
    assert.equal(props.changes.at(-1)?.axis, null)
    assert.equal(props.changes.at(-1)?.status, 'OPEN')
  })

  it('applies an axis through the same onChange payload', () => {
    const props = fixture({ scope: NO_SCOPE })
    click(props, 'Historical')
    assert.deepEqual(props.changes.at(-1), { ...NO_SCOPE, axis: 'HISTORICAL' })
  })

  it('toggles the repeat policy without touching the card filters', () => {
    const props = fixture()
    click(props, 'Without repeats')
    const next = props.changes.at(-1)
    assert.equal(next?.withoutRepeats, true)
    assert.equal(next?.axis, 'TACTIC')
    assert.equal(next?.status, 'OPEN')
  })

  it('reports the repeat policy state on the toggle itself', () => {
    const on = render(
      <DeckScopeBadges
        {...fixture({ scope: { ...NO_SCOPE, withoutRepeats: true } })}
      />,
    )
    assert.match(on, /aria-pressed="true"[^>]*data-testid="deck-scope-repeat"/)
    const off = render(<DeckScopeBadges {...fixture()} />)
    assert.match(
      off,
      /aria-pressed="false"[^>]*data-testid="deck-scope-repeat"/,
    )
  })

  it('exposes the count and the strip as the hooks the page wired', () => {
    const vnode = DeckScopeBadges(fixture())
    const testids = walk(vnode, (node) =>
      ['deck-scope-count', 'deck-scope-repeat'].includes(
        String(node.props?.['data-testid'] ?? ''),
      ),
    ).map((node) => node.props?.['data-testid'])
    assert.deepEqual(testids, ['deck-scope-count', 'deck-scope-repeat'])
    assert.equal(buttons(vnode).length, 7)
  })
})
