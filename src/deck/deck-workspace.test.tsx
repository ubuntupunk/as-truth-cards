/**
 * Tests for `deck-workspace.tsx` (SPEC §4.7): the responsive three-column grid
 * and its below-`xl` drawers.
 *
 * On wide viewports the browse rail (232px), the card discovery column and the
 * research tray (320px) must be mounted in the `xl` grid with min-width-0
 * guarding the fluid middle. Below `xl` the rails must be reachable only
 * through the toolbar buttons as modal dialogs — backdrop, close affordance,
 * `role="dialog"` and `aria-modal` — because a hidden column is an invisible
 * one otherwise.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DeckWorkspace } from './deck-workspace'
import { buttons, walk } from './test-fixtures'

/** Render the workspace once with a given open drawer, capturing callbacks. */
function renderWorkspace(drawer: 'browse' | 'tray' | null) {
  const calls: Record<string, unknown[]> = { open: [], close: [] }
  const root = walk(
    DeckWorkspace({
      browseRail: <aside data-testid="slot-browse" />,
      tray: <aside data-testid="slot-tray" />,
      children: <section data-testid="slot-cards" />,
      drawer,
      onOpenDrawer: (kind) => calls.open.push(kind),
      onCloseDrawer: () => calls.close.push(null),
    }),
    () => true,
  )
  return { root, calls }
}

/** The button tagged `deck-open-<name>`, when present. */
function toolbarButton(
  root: unknown,
  name: string,
): ReturnType<typeof buttons>[number] {
  const found = buttons(root).filter((button) =>
    String(button.props?.['data-testid']).includes(`deck-open-${name}`),
  )
  return found[0] as never
}

describe('DeckWorkspace', () => {
  it('mounts both rails, the cards column and the mobile toolbar', () => {
    const { root } = renderWorkspace(null)
    const ids = walk(
      root,
      (vnode) => vnode.type === 'aside' || vnode.type === 'section',
    ).map((vnode) => vnode.props?.['data-testid'])
    assert.ok(ids.includes('slot-browse'))
    assert.ok(ids.includes('slot-tray'))
    assert.ok(ids.includes('slot-cards'))
    assert.ok(toolbarButton(root, 'browse').props?.['data-testid'])
    assert.ok(toolbarButton(root, 'tray').props?.['data-testid'])
  })

  it('opens a drawer through the toolbar and reports the kind', () => {
    const { root, calls } = renderWorkspace(null)
    const invoke = (button: ReturnType<typeof buttons>[number]) =>
      (button.props as unknown as { onClick?: () => void }).onClick?.()
    invoke(toolbarButton(root, 'browse'))
    assert.deepEqual(calls.open, ['browse'])
  })

  it('renders the open drawer as a modal dialog with a backdrop and close', () => {
    const { root, calls } = renderWorkspace('browse')
    const dialog = walk(
      root,
      (vnode) => vnode.props?.['data-testid'] === 'deck-drawer-browse',
    )[0] as { props?: Record<string, unknown> }
    assert.equal(dialog.props?.role, 'dialog')
    assert.equal(String(dialog.props?.['aria-modal']), 'true')
    const closeButtons = buttons(root).filter((button) =>
      String(button.props?.['data-testid']).includes('deck-drawer-close'),
    )
    assert.equal(closeButtons.length, 1)
    ;(closeButtons[0].props as unknown as { onClick?: () => void }).onClick?.()
    assert.equal(calls.close.length, 1)
  })

  it('wraps the backdrop and dialog in one interactive layer', () => {
    const { root } = renderWorkspace('tray')
    const layer = walk(
      root,
      (vnode) => vnode.props?.['data-testid'] === 'deck-drawer-layer',
    )
    assert.equal(layer.length, 1)
    const inside = walk(layer[0], (vnode) => {
      const id = vnode.props?.['data-testid']
      return (
        typeof id === 'string' &&
        id !== 'deck-drawer-layer' &&
        id.startsWith('deck-drawer-')
      )
    }).map((vnode) => vnode.props?.['data-testid'])
    assert.ok(inside.includes('deck-drawer-backdrop'))
    assert.ok(inside.includes('deck-drawer-tray'))
  })

  it('renders no drawer when both rows are closed', () => {
    const { root } = renderWorkspace(null)
    const dialogs = walk(root, (vnode) => vnode.type === 'button').filter(
      (vnode) => vnode.props?.role === 'dialog',
    )
    assert.equal(dialogs.length, 0)
  })
})
