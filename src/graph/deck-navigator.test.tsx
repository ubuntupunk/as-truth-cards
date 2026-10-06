/**
 * Tests for `deck-navigator.tsx` — the mockup's navigator sidebar.
 *
 * The navigator is deliberately a pure component (facets/filter in, `onChange`
 * out), which lets these tests exercise both surfaces without a DOM:
 *
 * - **Markup** — `preact-render-to-string` asserts the mockup structure: the
 *   three groups and their "— new" tags, the coloured suit dots, and the
 *   disabled "schema-only type" rows.
 * - **Behaviour** — because every sub-component is a plain function and the
 *   rows are plain vnodes, the tree returned by `DeckNavigator({...})` is
 *   walked directly and each row's `onClick` closure is invoked. That pins the
 *   single-select toggle wiring: selecting re-selects/clears within a group,
 *   dimensions compose through `{...filter}`, and an empty-in-projection facet
 *   is marked `disabled` rather than silently dropped.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import {
  applyFacetFilter,
  deriveFacets,
  type FacetFilter,
  NO_FACET_FILTER,
} from './deck-facets'
import { DeckNavigator } from './deck-navigator'
import { CARD_PROJECTION, SPARSE_PROJECTION } from './test-fixtures'

type FacetRowVNode = VNode<{
  label: string
  count?: number
  selected?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}>

/** Collect every FacetRow vnode in a navigator tree, in render order. */
function rowsOf(root: VNode): FacetRowVNode[] {
  const out: FacetRowVNode[] = []
  const walk = (value: unknown): void => {
    if (value === null || value === undefined || typeof value !== 'object')
      return
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    const vnode = value as VNode & { props?: Record<string, unknown> }
    // A FacetRow is a component vnode carrying the row's props as-is.
    if (
      typeof vnode.props?.label === 'string' &&
      typeof vnode.props?.onClick === 'function'
    ) {
      out.push(vnode as FacetRowVNode)
      return
    }
    // Descend like Preact does: invoke function components with their props,
    // otherwise walk element children.
    if (typeof vnode.type === 'function') {
      walk((vnode.type as (props: unknown) => unknown)(vnode.props))
      return
    }
    walk(vnode.props?.children)
  }
  walk(root)
  return out
}

/** Build a navigator tree and return the rows plus a recorded change spy. */
function build(filter: FacetFilter, projection = CARD_PROJECTION) {
  const changes: FacetFilter[] = []
  const tree = DeckNavigator({
    facets: deriveFacets(projection),
    filter,
    onChange: (next) => changes.push(next),
  })
  return { rows: rowsOf(tree), changes }
}

describe('deck-navigator markup', () => {
  it('renders the three mockup groups, with the new-tags on Suit and Axis', () => {
    const html = render(
      <DeckNavigator
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onChange={() => {}}
      />,
    )
    assert.ok(html.includes('>Ontology type</p>'))
    assert.ok(html.includes('>Suit'))
    assert.ok(html.includes('>— new</span>'))
    assert.ok(html.includes('>Axis'))
  })

  it('lists ontology types in mockup order with counts', () => {
    const { rows } = build(NO_FACET_FILTER)
    const labels = rows.slice(0, 8).map((row) => row.props.label)
    assert.deepEqual(labels, [
      'All',
      'Claims',
      'Evidence',
      'Sources',
      'Cases',
      'Concepts',
      'Interpretations',
      'Inferences',
    ])
    assert.equal(
      rows.find((row) => row.props.label === 'Claims')?.props.count,
      2,
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Inferences')?.props.count,
      2,
    )
  })

  it('renders suit rows with the mockup dot colours', () => {
    const html = render(
      <DeckNavigator
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onChange={() => {}}
      />,
    )
    assert.ok(html.includes('background-color:#ef4444'))
    assert.ok(html.includes('background-color:#22d3ee'))
  })

  it('orders the groups: types, then suits, then axes', () => {
    const { rows } = build(NO_FACET_FILTER)
    assert.deepEqual(
      rows.map((row) => row.props.label),
      [
        'All',
        'Claims',
        'Evidence',
        'Sources',
        'Cases',
        'Concepts',
        'Interpretations',
        'Inferences',
        'Classic',
        'Regional',
        'Tactic',
        'Historical',
      ],
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Tactic')?.props.count,
      2,
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Historical')?.props.count,
      1,
    )
  })
})

describe('deck-navigator selection state', () => {
  it('selects "All" when no type filter is active', () => {
    const { rows } = build(NO_FACET_FILTER)
    assert.equal(rows[0]?.props.label, 'All')
    assert.equal(rows[0]?.props.selected, true)
    assert.equal(
      rows.find((row) => row.props.label === 'Claims')?.props.selected,
      false,
    )
  })

  it('reflects a claim type selection', () => {
    const { rows } = build({ type: 'claim', suit: null, axis: null })
    assert.equal(rows[0]?.props.selected, false)
    assert.equal(
      rows.find((row) => row.props.label === 'Claims')?.props.selected,
      true,
    )
  })

  it('marks a suit and an axis selection independently', () => {
    const { rows } = build({
      type: null,
      suit: 'south-africa',
      axis: 'TACTIC',
    })
    assert.equal(
      rows.find((row) => row.props.label === 'Regional')?.props.selected,
      true,
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Tactic')?.props.selected,
      true,
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Classic')?.props.selected,
      false,
    )
  })

  it('renders an absent ontology type as disabled, with its zero count', () => {
    const { rows } = build(NO_FACET_FILTER, SPARSE_PROJECTION)
    const claims = rows.find((row) => row.props.label === 'Claims')
    assert.ok(claims !== undefined)
    assert.equal(claims.props.disabled, true)
    assert.equal(claims.props.count, 0)
    assert.ok((claims.props.title ?? '').includes('current projection'))
  })

  it('disables every absent type facet in a card-only projection', () => {
    const { rows } = build(NO_FACET_FILTER, SPARSE_PROJECTION)
    const typeRows = rows.slice(1, 8)
    assert.ok(typeRows.length > 0)
    for (const row of typeRows) {
      assert.equal(
        row.props.disabled,
        true,
        `${row.props.label} should be disabled`,
      )
      assert.equal(row.props.count, 0)
    }
    // "All" is never disabled.
    assert.ok(!rows[0]?.props.disabled)
  })
})

describe('deck-navigator toggle wiring', () => {
  it('selecting a type facet sets it and clears it on reselect', () => {
    const first = build(NO_FACET_FILTER)
    first.rows.find((row) => row.props.label === 'Claims')?.props.onClick()
    assert.deepEqual(first.changes, [{ type: 'claim', suit: null, axis: null }])

    const second = build({ type: 'claim', suit: null, axis: null })
    second.rows.find((row) => row.props.label === 'Claims')?.props.onClick()
    assert.deepEqual(second.changes, [{ type: null, suit: null, axis: null }])
  })

  it('selecting "All" clears a type selection', () => {
    const { rows, changes } = build({ type: 'claim', suit: null, axis: null })
    rows[0]?.props.onClick()
    assert.deepEqual(changes, [{ type: null, suit: null, axis: null }])
  })

  it('suit and axis selections compose with an active type (stateful parent)', () => {
    let filter: FacetFilter = { type: 'claim', suit: null, axis: null }

    const afterSuit = build(filter)
    afterSuit.rows
      .find((row) => row.props.label === 'Regional')
      ?.props.onClick()
    filter = afterSuit.changes[afterSuit.changes.length - 1]
    assert.deepEqual(filter, {
      type: 'claim',
      suit: 'south-africa',
      axis: null,
    })

    const afterAxis = build(filter)
    afterAxis.rows.find((row) => row.props.label === 'Tactic')?.props.onClick()
    filter = afterAxis.changes[afterAxis.changes.length - 1]
    assert.deepEqual(filter, {
      type: 'claim',
      suit: 'south-africa',
      axis: 'TACTIC',
    })
  })

  it('a selected suit clears on reselect', () => {
    const { rows, changes } = build({
      type: null,
      suit: 'south-africa',
      axis: null,
    })
    rows.find((row) => row.props.label === 'Regional')?.props.onClick()
    assert.deepEqual(changes, [{ type: null, suit: null, axis: null }])
  })

  it('produces filters that applyFacetFilter honours (end-to-end)', () => {
    const { rows, changes } = build(NO_FACET_FILTER)
    rows.find((row) => row.props.label === 'Claims')?.props.onClick()
    const filtered = applyFacetFilter(CARD_PROJECTION, changes[0])
    assert.equal(filtered.meta.nodeCount, 2)
    assert.equal(filtered.meta.edgeCount, 1)
  })
})
