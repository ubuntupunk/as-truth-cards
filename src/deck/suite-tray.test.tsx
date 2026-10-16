/**
 * Tests for `suite-tray.tsx` (g2f): the curator's draft-suite sidebar.
 *
 * The tray is a hand-assembly scratchpad and a hand-off, never a write: the
 * count reflects the browser-local roster, adding is disabled for the card
 * already in it, the export button reports what the browser actually did rather
 * than claiming success, and the copy keeps three things visible — this is
 * browser-local, nothing is written to a `collections` row, and a suite is not
 * a classification of the cards it holds.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'

import type { SuiteEntry } from './suite-session'
import { SuiteTray, type SuiteTrayProps } from './suite-tray'
import { childText, walk } from './test-fixtures'

/** An entry-shaped fixture the tests can hold in "storage". */
const ENTRY: SuiteEntry = {
  id: 'bf000000-0000-0000-0000-00000000f001',
  slug: 'an-open-question',
  title: 'An open question about troop levels',
  addedAt: 1_700_000_000_000,
}

/** Render the tray with a given roster and focus, capturing the handlers. */
function renderTray(
  entries: readonly SuiteEntry[],
  focus: { id: string; label: string } | null,
  overrides: Partial<SuiteTrayProps> = {},
) {
  const calls: Record<string, unknown[]> = {
    add: [],
    remove: [],
    clear: [],
    export: [],
  }
  const root = walk(
    SuiteTray({
      entries,
      focus,
      onAdd: () => calls.add.push(null),
      onRemove: (id) => calls.remove.push(id),
      onClear: () => calls.clear.push(null),
      onExport: () => calls.export.push(null),
      ...overrides,
    }),
    () => true,
  )
  return { root, calls }
}

/** The vnode tagged `suite-tray-<name>`, or `null`. */
function trayNode(
  root: unknown,
  name: string,
): { props?: Record<string, unknown> } | null {
  const found = walk(
    root,
    (vnode) => vnode.props?.['data-testid'] === `suite-tray-${name}`,
  )
  return (found[0] ?? null) as { props?: Record<string, unknown> } | null
}

/** Fire the vnode's `onClick`, when it has one. */
function invoke(node: { props?: Record<string, unknown> } | null): void {
  ;(node?.props?.onClick as (() => void) | undefined)?.()
}

describe('SuiteTray', () => {
  it('reports the draft-suite count', () => {
    const { root } = renderTray([ENTRY], null)
    assert.equal(trayNode(root, 'count')?.props?.children, 1)
  })

  it('names the add affordance for the card on screen and enables it', () => {
    const { root, calls } = renderTray([], { id: ENTRY.id, label: ENTRY.title })
    const add = trayNode(root, 'add')
    assert.equal(add?.props?.disabled, false)
    assert.match(childText(add as never), /Add “/)
    invoke(add)
    assert.equal(calls.add.length, 1)
  })

  it('disables adding when the card is already in the roster', () => {
    const { root, calls } = renderTray([ENTRY], {
      id: ENTRY.id,
      label: ENTRY.title,
    })
    const add = trayNode(root, 'add')
    assert.equal(add?.props?.disabled, true)
    assert.equal(childText(add as never), 'In suite')
    assert.equal(calls.add.length, 0)
  })

  it('disables adding when no card is on screen', () => {
    const { root } = renderTray([], null)
    assert.equal(trayNode(root, 'add')?.props?.disabled, true)
  })

  it('drops a card and clears the roster through the handlers', () => {
    const { root, calls } = renderTray([ENTRY], null)
    invoke(trayNode(root, 'remove'))
    invoke(trayNode(root, 'clear'))
    assert.deepEqual(calls.remove, [ENTRY.id])
    assert.equal(calls.clear.length, 1)
  })

  it('shows each card with its slug, the key the hand-off carries', () => {
    const { root } = renderTray([ENTRY], null)
    const list = trayNode(root, 'list')
    assert.equal(list?.props?.children === undefined, false)
    const text = JSON.stringify(walk(root, () => true))
    assert.match(text, /an-open-question/)
  })

  it('hands off through the export handler, labelled as a copy', () => {
    const { root, calls } = renderTray([ENTRY], null)
    const exportButton = trayNode(root, 'export')
    assert.equal(childText(exportButton as never), 'Copy card slugs')
    invoke(exportButton)
    assert.equal(calls.export.length, 1)
  })

  it('reports a copied or failed hand-off rather than claiming success', () => {
    const copied = renderTray([ENTRY], null, { exportStatus: 'copied' })
    assert.equal(childText(trayNode(copied.root, 'export') as never), 'Copied')
    const failed = renderTray([ENTRY], null, { exportStatus: 'failed' })
    assert.equal(
      childText(trayNode(failed.root, 'export') as never),
      'Copy failed',
    )
  })

  it('offers no export or clear while the roster is empty', () => {
    const { root } = renderTray([], null)
    assert.equal(trayNode(root, 'empty') === null, false)
    assert.equal(trayNode(root, 'export'), null)
    assert.equal(trayNode(root, 'clear'), null)
  })

  it('keeps the browser-local, write-free scope visible', () => {
    const { root } = renderTray([ENTRY], null)
    const scope = String(trayNode(root, 'scope')?.props?.children)
    assert.match(scope, /this browser/)
    assert.match(scope, /never writes/)
  })

  it('says a suite is not a classification and is not Save card', () => {
    const { root } = renderTray([ENTRY], null)
    const invariant = String(trayNode(root, 'invariant')?.props?.children)
    assert.match(invariant, /not a classification/)
    assert.match(invariant, /Save card/)
  })

  it('renders without a router or storage under server rendering', () => {
    const html = render(
      SuiteTray({
        entries: [],
        focus: null,
        onAdd: () => undefined,
        onRemove: () => undefined,
        onClear: () => undefined,
        onExport: () => undefined,
      }),
    )
    assert.match(html, /data-testid="suite-tray"/)
    assert.match(html, /suite-tray-empty/)
  })
})
