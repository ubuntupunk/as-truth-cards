/**
 * Tests for `explore-filters.tsx` — the facet strip over the corpus.
 *
 * The strip is the Deck's chip pattern with a third dimension (Suit) and an
 * order control. These tests pin that every value the strip offers comes from
 * the loaded cards in canonical order with the shared labels, that selecting
 * reports the next query (re-click clears), that `aria-pressed` — not colour —
 * carries which value is active, that the order control hides while search
 * owns ranking, and that the clear exit appears only while filters are on.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { buttonsLabelled, walk } from '../deck/test-fixtures'
import { ExploreFilters, type ExploreFiltersProps } from './explore-filters'
import { type ExploreQuery, NO_EXPLORE_QUERY } from './explore-model'

/** The props the page hands the strip, with a recording `onChange`. */
function fixture(
  overrides: Partial<ExploreFiltersProps> = {},
): ExploreFiltersProps & { changes: ExploreQuery[] } {
  const changes: ExploreQuery[] = []
  const props: ExploreFiltersProps = {
    query: NO_EXPLORE_QUERY,
    axes: ['TACTIC', 'HISTORICAL'],
    statuses: ['ESTABLISHED', 'OPEN'],
    suits: ['classic', 'south-africa'],
    searching: false,
    onChange: (next) => changes.push(next),
    ...overrides,
  }
  return { ...props, changes }
}

/** Click the first button whose text is exactly `label`. */
function click(props: ExploreFiltersProps, label: string): void {
  const toggles = buttonsLabelled(ExploreFilters(props), label)
  ;(toggles[0].props?.onClick as () => void)()
}

describe('ExploreFilters', () => {
  it('offers every present value under its shared vocabulary label', () => {
    const html = render(ExploreFilters(fixture()))
    assert.ok(html.includes('>Tactic<'))
    assert.ok(html.includes('>Historical<'))
    assert.ok(html.includes('>Established<'))
    assert.ok(html.includes('>Open questions<'))
    assert.ok(html.includes('>Classic<'))
    assert.ok(html.includes('>South Africa<'))
    assert.ok(html.includes('data-filter-group="Suit"'))
  })

  it('reports a facet selection and clears it on re-click', () => {
    const props = fixture()
    click(props, 'Tactic')
    assert.deepEqual(props.changes.at(-1), {
      ...NO_EXPLORE_QUERY,
      axis: 'TACTIC',
    })

    // Re-click clears — as if the page had applied the reported query.
    const active = fixture({ query: { ...NO_EXPLORE_QUERY, axis: 'TACTIC' } })
    click(active, 'Tactic')
    assert.deepEqual(active.changes.at(-1), NO_EXPLORE_QUERY)
  })

  it('selects a suit without touching the same-named locale dimension', () => {
    const props = fixture()
    click(props, 'South Africa')
    assert.deepEqual(props.changes.at(-1), {
      ...NO_EXPLORE_QUERY,
      suit: 'south-africa',
    })
  })

  it('marks the active value with aria-pressed, not with colour', () => {
    const html = render(
      ExploreFilters(
        fixture({ query: { ...NO_EXPLORE_QUERY, axis: 'TACTIC' } }),
      ),
    )
    assert.match(html, /aria-pressed="true"[^>]*>Tactic</)
    assert.match(html, /aria-pressed="false"[^>]*>Historical</)
    assert.ok(!/aria-pressed="true"[^>]*>All axes</.test(html))
  })

  it('orders by status only when the reader asked for it', () => {
    const props = fixture()
    assert.ok(buttonsLabelled(ExploreFilters(props), 'Title').length === 1)
    click(props, 'Status')
    assert.deepEqual(props.changes.at(-1), {
      ...NO_EXPLORE_QUERY,
      sort: 'status',
    })
  })

  it('hides the order control while search owns the ranking', () => {
    const html = render(ExploreFilters(fixture({ searching: true })))
    assert.ok(!html.includes('data-filter-group="Order"'))
    assert.ok(html.includes('data-filter-group="Suit"'))
  })

  it('offers a clear exit only while a facet is active', () => {
    const off = render(ExploreFilters(fixture()))
    assert.ok(!off.includes('explore-clear-filters'))

    const on = render(
      ExploreFilters(
        fixture({ query: { ...NO_EXPLORE_QUERY, status: 'OPEN' } }),
      ),
    )
    assert.ok(on.includes('data-testid="explore-clear-filters"'))

    const props = fixture({
      query: { ...NO_EXPLORE_QUERY, status: 'OPEN', suit: 'classic' },
    })
    const [clear] = walk(
      ExploreFilters(props),
      (vnode) => vnode.props?.['data-testid'] === 'explore-clear-filters',
    )
    ;(clear.props?.onClick as () => void)()
    assert.deepEqual(props.changes.at(-1), NO_EXPLORE_QUERY)
  })
})
