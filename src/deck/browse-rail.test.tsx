/**
 * Tests for `browse-rail.tsx` (SPEC §4.8): the deck's working category filters
 * and an honest pointer to the rest of the graph categories.
 *
 * The rail must render **no placeholder buttons**: user-created deck features
 * have no schema yet, and mechanism/concept/collection are facets of the Graph
 * Explorer, not fields on the deck listing row. The two categories the listing
 * can filter by are **Axis** and **Locale**, and their buttons must toggle
 * selection (never invent an axis or a locale the cards do not carry) while the
 * graph pointer stays a plain link so the server-rendered page works before
 * hydration.
 *
 * Locale selection reports a `card_locales` slug unchanged — it is never
 * derived from a suit or collection of the same name.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'

import type { CardAxisValue } from '../../trope-cards/src/graph/types.ts'
import { BrowseRail, type BrowseRailProps } from './browse-rail'
import { buttons, walk } from './test-fixtures'

/** The axes the rail fixture offers, in canonical order. */
const AXES: readonly CardAxisValue[] = ['HISTORICAL', 'THEOLOGICAL']

/** The locale slugs the rail fixture offers, in slug order. */
const LOCALES: readonly string[] = ['south-africa']

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

/** The locale-filter `<button>` vnodes, keyed by their `data-locale`. */
function localeButtons(
  root: unknown,
): Map<string, ReturnType<typeof buttons>[number]> {
  const found = walk(
    root,
    (vnode) => vnode.props?.['data-locale'] !== undefined,
  )
  return new Map(
    found.map((vnode) => [
      String(vnode.props?.['data-locale']),
      vnode as ReturnType<typeof buttons>[number],
    ]),
  )
}

/** The props the page hands the rail, with inert handlers. */
function browseRailProps(
  overrides: Partial<BrowseRailProps> = {},
): BrowseRailProps {
  return {
    axes: AXES,
    activeAxis: null,
    onChange: () => undefined,
    locales: LOCALES,
    activeLocale: null,
    onLocaleChange: () => undefined,
    graphHref: '/graph?axis=HISTORICAL',
    ...overrides,
  }
}

/** Render the rail once with the given selection. */
function renderRail(
  activeAxis: CardAxisValue | null,
  onChange?: (axis: CardAxisValue | null) => void,
  overrides: Partial<BrowseRailProps> = {},
) {
  return BrowseRail({
    ...browseRailProps(),
    activeAxis,
    onChange: onChange ?? (() => undefined),
    ...overrides,
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

  it('lists All locales plus exactly the locales the cards carry', () => {
    const root = walk(renderRail(null), () => true)
    const present = localeButtons(root)
    assert.deepEqual([...present.keys()], ['__all__', ...LOCALES])
  })

  it('marks the active locale with aria-pressed and clears it on re-press', () => {
    const changes: (string | null)[] = []
    const root = walk(
      renderRail(null, undefined, {
        activeLocale: 'south-africa',
        onLocaleChange: (locale) => changes.push(locale),
      }),
      () => true,
    )
    const present = localeButtons(root)
    assert.equal(present.get('__all__')?.props?.['aria-pressed'], false)
    assert.equal(present.get('south-africa')?.props?.['aria-pressed'], true)

    const sa = present.get('south-africa')
    if (sa === undefined) assert.fail('expected the locale button to render')
    ;(sa.props as unknown as { onClick: () => void }).onClick()
    assert.deepEqual(changes, [null])
  })

  it('shows the humanised locale label, never the raw slug', () => {
    const html = render(<BrowseRail {...browseRailProps()} />)
    assert.ok(html.includes('South Africa'))
    assert.ok(!html.includes('>south-africa<'))
  })
})
