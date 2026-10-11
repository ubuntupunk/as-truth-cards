/**
 * Tests for `deck-appearance-control.tsx` (SPEC §4.5): the treatment selector.
 *
 * The control is presentational — it only reports a valid change. It must
 * offer exactly the graph treatments with their labels, mark the active one,
 * and ignore any value a hostile `<select>` cannot actually carry, so the page
 * never hands a bogus treatment to `?treatment=`.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GRAPH_TREATMENT_LABELS, GRAPH_TREATMENTS } from '../graph/appearance'
import { DeckAppearanceControl } from './deck-appearance-control'
import { walk } from './test-fixtures'

/** The `<option>` vnodes of a rendered control. */
function options(control: ReturnType<typeof renderControl>): unknown[] {
  return walk(control, (vnode) => vnode.type === 'option')
}

/** Render the control as a tree of vnodes to inspect and drive. */
function renderControl(treatment: 'atmospheric' | 'workspace' | 'editorial') {
  return walk(
    DeckAppearanceControl({ treatment, onChange: () => undefined }),
    (vnode) => vnode.type === 'select' || vnode.type === 'option',
  )
}

describe('DeckAppearanceControl', () => {
  it('offers one option per graph treatment with its label', () => {
    const seen = options(renderControl('atmospheric')).map(
      (option) =>
        (
          (option as { props?: Record<string, unknown> }).props as {
            children?: string
          }
        )?.children,
    )
    assert.deepEqual(
      seen,
      GRAPH_TREATMENTS.map((value) => GRAPH_TREATMENT_LABELS[value]),
    )
  })

  it('marks the active treatment as the selected option', () => {
    const vnodes = walk(
      DeckAppearanceControl({
        treatment: 'editorial',
        onChange: () => undefined,
      }),
      (vnode) => vnode.type === 'select',
    )
    const value = (vnodes[0] as { props?: { value?: string } }).props?.value
    assert.equal(value, 'editorial')
  })

  it('reports a change only for a valid treatment', () => {
    const changes: string[] = []
    const vnodes = walk(
      DeckAppearanceControl({
        treatment: 'atmospheric',
        onChange: (next) => changes.push(next),
      }),
      (vnode) => vnode.type === 'select',
    )
    const select = vnodes[0] as unknown as {
      props: { onChange: (event: { target: { value: string } }) => void }
    }
    select.props.onChange({ target: { value: 'workspace' } })
    select.props.onChange({ target: { value: 'no-such-treatment' } })
    assert.deepEqual(changes, ['workspace'])
  })
})
