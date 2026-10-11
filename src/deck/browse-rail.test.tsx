/**
 * Tests for `browse-rail.tsx` (SPEC §4.8): the deck's only working category
 * filter and an honest pointer to the rest of the graph categories.
 *
 * The rail must render **no placeholder buttons**: user-created deck features
 * have no schema yet, and mechanism/concept/locale/collection are facets of the
 * Graph Explorer, not the deck listing API. The one category the listing can
 * filter by is Axis, and its buttons must toggle selection (never invent an
 * axis the cards do not carry) while the graph pointer stays a plain link so
 * the server-rendered page works before hydration.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { CardAxisValue } from '../../trope-cards/src/graph/types.ts'
import { BrowseRail } from './browse-rail'
import { buttons, walk } from './test-fixtures'

/** The axes the rail fixture offers, in canonical order. */
const AXES: readonly CardAxisValue[] = ['HISTORICAL', 'THEOLOGICAL']

/** The axis-filter `<button>` vnodes, keyed by their `data-axis`. */
function axisButtons(
  root: unknown,
): Map<string, ReturnType<typeof buttons>[number]> {
  const found = walk(root, (vnode) => vnode.props?.['data-axis'] !== undefined)
  return new Map(
    found.map((vnode) => [
      String(vnode.props?.['data-axis']),
      vnode as ReturnType<typeof buttons>[number],
    ]),
  )
}

/** Render the rail once with the given selection. */
function renderRail(
  activeAxis: CardAxisValue | null,
  onChange?: (axis: CardAxisValue | null) => void,
) {
  return BrowseRail({
    axes: AXES,
    activeAxis,
    onChange: onChange ?? (() => undefined),
    graphHref: '/graph?axis=HISTORICAL',
  })
}

describe('BrowseRail', () => {
  it('renders no placeholder category buttons — only filters and a link', () => {
    const root = walk(renderRail(null), () => true)
    const navButtons = buttons(root).filter((button) =>
      String(button.props?.className ?? '').includes('open-graph'),
    )
    const anchors = walk(
      root,
      (vnode) => vnode.type === 'a' && typeof vnode.props?.href === 'string',
    )
    assert.equal(navButtons.length, 0)
    assert.ok(anchors.length >= 1)
  })

  it('lists All axes plus exactly the axes the cards carry', () => {
    const root = walk(renderRail(null), () => true)
    const present = axisButtons(root)
    assert.deepEqual([...present.keys()], ['__all__', ...AXES])
  })

  it('marks the active axis and clears back to All on a second press', () => {
    const changes: (CardAxisValue | null)[] = []
    const root = walk(
      renderRail('HISTORICAL', (axis) => changes.push(axis)),
      () => true,
    )
    const present = axisButtons(root)
    assert.equal(present.get('__all__')?.props?.['aria-pressed'], false)
    assert.equal(present.get('HISTORICAL')?.props?.['aria-pressed'], true)
    const invoke = (vnode: ReturnType<typeof buttons>[number]) =>
      (vnode.props as unknown as { onClick: () => void }).onClick()
    const theological = present.get('THEOLOGICAL')
    const historical = present.get('HISTORICAL')
    if (theological === undefined || historical === undefined) {
      assert.fail('expected the axis buttons to render')
    }
    invoke(theological)
    invoke(historical)
    assert.deepEqual(changes, ['THEOLOGICAL', null])
  })

  it('makes the Graph Explorer pointer a real link, not a dead control', () => {
    const root = walk(renderRail(null), () => true)
    const anchors = walk(
      root,
      (vnode) => vnode.type === 'a' && typeof vnode.props?.href === 'string',
    ) as { props: { href?: string } }[]
    assert.ok(
      anchors.some((anchor) => anchor.props.href === '/graph?axis=HISTORICAL'),
    )
  })
})
