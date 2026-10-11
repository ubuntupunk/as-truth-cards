/**
 * Tests for `research-tray.tsx` (SPEC §4.4): the browser-local session sidebar.
 *
 * The tray is explicitly a working-memory scratchpad, never an account: the
 * count reflects the browser storage, the empty state names where the card
 * currently on screen can be parked, adding is disabled when the card is
 * already in the tray, and the copy keeps the account-bound Save action visibly
 * separate — a veteran reader must never mistake a tray item for a saved card.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'

import {
  hasResearchEntry,
  type ResearchEntry,
} from '../research/research-session'
import { ResearchTray } from './research-tray'
import { childText, walk } from './test-fixtures'

/** An entry-shaped fixture the tests can hold in "storage". */
const ENTRY: ResearchEntry = {
  id: 'bf000000-0000-0000-0000-00000000f001',
  type: 'card',
  label: 'An open question about troop levels',
  view: null,
  depth: 1,
  addedAt: 1_700_000_000_000,
}

/** Render the tray with a given session and focus, capturing the handlers. */
function renderTray(
  entries: readonly ResearchEntry[],
  focus: { id: string; label: string } | null,
) {
  const calls: Record<string, unknown[]> = {
    add: [],
    open: [],
    remove: [],
    clear: [],
  }
  const root = walk(
    ResearchTray({
      entries,
      focus,
      onAdd: () => calls.add.push(null),
      onOpen: (entry) => calls.open.push(entry),
      onRemove: (id) => calls.remove.push(id),
      onClear: () => calls.clear.push(null),
    }),
    () => true,
  )
  return { root, calls }
}

/** The `<button>` vnode tagged `research-tray-<name>`, when present. */
function trayButton(
  root: unknown,
  name: string,
): ReturnType<typeof walk> extends (infer V)[] ? V : never {
  const found = walk(
    root,
    (vnode) => vnode.props?.['data-testid'] === `research-tray-${name}`,
  )
  return (found[0] ?? null) as never
}

describe('ResearchTray', () => {
  it('reports the session count', () => {
    const { root } = renderTray([ENTRY], null)
    const count = walk(
      root,
      (vnode) => vnode.props?.['data-testid'] === 'research-tray-count',
    )[0] as { props?: { children?: number | string } }
    assert.equal(count.props?.children, 1)
  })

  it('names the add affordance for the card on screen and enables it', () => {
    const { root, calls } = renderTray([], { id: ENTRY.id, label: ENTRY.label })
    const add = trayButton(root, 'add') as {
      props?: { onClick?: () => void; disabled?: boolean; children?: unknown }
    }
    assert.equal(add.props?.disabled, false)
    assert.match(childText(add as never), /Add “/)
    ;(add.props?.onClick ?? (() => undefined))()
    assert.equal(calls.add.length, 1)
  })

  it('disables adding when the card is already in the tray, without an action', () => {
    const { root, calls } = renderTray([ENTRY], {
      id: ENTRY.id,
      label: ENTRY.label,
    })
    const add = trayButton(root, 'add') as { props?: { disabled?: boolean } }
    assert.equal(add.props?.disabled, true)
    assert.match(String(add.props?.disabled), /^true$/)
    assert.equal(calls.add.length, 0)
  })

  it('disables adding when no card is on screen', () => {
    const { root } = renderTray([], null)
    const add = trayButton(root, 'add') as { props?: { disabled?: boolean } }
    assert.equal(add.props?.disabled, true)
  })

  it('opens, removes and clears through the handlers', () => {
    const { root, calls } = renderTray([ENTRY], null)
    const invoke = (button: unknown) =>
      (button as { props?: { onClick?: () => void } }).props?.onClick?.()
    invoke(trayButton(root, 'open'))
    invoke(trayButton(root, 'remove'))
    invoke(trayButton(root, 'clear'))
    assert.equal(calls.open[0], ENTRY)
    assert.equal(calls.remove[0], ENTRY.id)
    assert.equal(calls.clear.length, 1)
  })

  it('shows the browser-local scope and keeps Save card separate', () => {
    const { root } = renderTray([ENTRY], null)
    const scope = walk(
      root,
      (vnode) => vnode.props?.['data-testid'] === 'research-tray-scope',
    )[0] as { props?: { children?: string } }
    const account = walk(
      root,
      (vnode) => vnode.props?.['data-testid'] === 'research-tray-account',
    )[0] as { props?: { children?: string } }
    assert.match(String(scope.props?.children), /this browser/)
    assert.match(String(scope.props?.children), /never sent/)
    assert.match(
      String(account.props?.children),
      /Save card action is not this tray/,
    )
  })

  it('supports a session check on a focus id', () => {
    assert.equal(hasResearchEntry([ENTRY], ENTRY.id), true)
    assert.equal(hasResearchEntry([], ENTRY.id), false)
  })

  it('renders without a router or storage under server rendering', () => {
    const html = render(
      ResearchTray({
        entries: [],
        focus: null,
        onAdd: () => undefined,
        onOpen: () => undefined,
        onRemove: () => undefined,
        onClear: () => undefined,
      }),
    )
    assert.match(html, /data-testid="research-tray"/)
    assert.match(html, /research-tray-empty/)
  })
})
