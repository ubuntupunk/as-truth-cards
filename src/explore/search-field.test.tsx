/**
 * Tests for `search-field.tsx` — Explore's search input.
 *
 * The field is presentational: it reflects the raw term, reports every edit,
 * and offers a clear exit. These tests pin the accessible label (a real
 * `<label>`, not a placeholder standing in for one), the reporting of typed
 * text and of the clear action, and that no clear button is offered when
 * there is nothing to clear.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { walk } from '../deck/test-fixtures'
import { ExploreSearchField } from './search-field'

describe('ExploreSearchField', () => {
  it('carries a real label and the shared testid', () => {
    const html = render(ExploreSearchField({ value: '', onChange: () => {} }))
    assert.ok(html.includes('<label for="explore-search"'))
    assert.ok(html.includes('Search cards'))
    assert.ok(html.includes('data-testid="explore-search"'))
  })

  it('reports the typed text as typed', () => {
    const seen: string[] = []
    const field = ExploreSearchField({
      value: '',
      onChange: (next) => seen.push(next),
    })
    const [theInput] = walk(field, (vnode) => vnode.type === 'input')
    const onInput = theInput.props?.onInput as (event: {
      currentTarget: { value: string }
    }) => void
    onInput({ currentTarget: { value: 'zion' } })
    assert.deepEqual(seen, ['zion'])
  })

  it('offers a clear button only while something is typed', () => {
    const empty = render(ExploreSearchField({ value: '', onChange: () => {} }))
    assert.ok(!empty.includes('explore-search-clear'))

    const typed = render(
      ExploreSearchField({ value: 'zion', onChange: () => {} }),
    )
    assert.ok(typed.includes('data-testid="explore-search-clear"'))
  })

  it('clears to an empty term on the clear button', () => {
    const seen: string[] = []
    const field = ExploreSearchField({
      value: 'zion',
      onChange: (next) => seen.push(next),
    })
    const clear = walk(
      field,
      (vnode) => vnode.props?.['data-testid'] === 'explore-search-clear',
    )[0]
    ;(clear.props?.onClick as () => void)()
    assert.deepEqual(seen, [''])
  })
})
