/**
 * Tests for `research-workspace-panel.tsx` — the research-session roster.
 *
 * The panel is the one surface that distinguishes the Research Workspace from
 * the Graph Explorer, so the contracts under test are the honest empty state,
 * the add/refresh affordance keyed to membership (never a dead button), the
 * per-entry Open/Remove controls, and the explicit statement that the session is
 * browser-local and not account-bound (ROADMAP §150–166).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import type { ResearchEntry } from './research-session'
import { ResearchWorkspacePanel } from './research-workspace-panel'

/** A deterministic entry. */
function entry(id: string, label: string): ResearchEntry {
  return {
    id,
    type: 'source',
    label,
    view: 'card-argument-taxonomy',
    depth: 2,
    addedAt: 0,
  }
}

/** Render the panel with spies that count calls. */
function renderPanel(options: {
  entries?: readonly ResearchEntry[]
  focus?: { id: string; label: string } | null
  onAddFocus?: () => void
}) {
  const calls = { open: 0, remove: 0, clear: 0 }
  const html = render(
    <ResearchWorkspacePanel
      entries={options.entries ?? []}
      focus={options.focus ?? null}
      onAddFocus={options.onAddFocus}
      onOpen={() => {
        calls.open += 1
      }}
      onRemove={() => {
        calls.remove += 1
      }}
      onClear={() => {
        calls.clear += 1
      }}
    />,
  )
  return { html, calls }
}

describe('research-workspace-panel empty session', () => {
  it('states the empty roster and the research-vs-account boundary', () => {
    const { html } = renderPanel({})
    assert.ok(html.includes('data-testid="research-session-empty"'))
    assert.ok(
      html.includes(
        'A research session is separate from your account — signing in never moves or clears it.',
      ),
    )
    assert.ok(html.includes('Account-bound saving is not enabled yet.'))
    assert.ok(html.includes('0 focused'))
  })

  it('omits the add affordance and the clear button when there is nothing to do', () => {
    const { html } = renderPanel({})
    assert.ok(html.includes('data-testid="research-session-add-hint"'))
    assert.ok(!html.includes('data-testid="research-session-add"'))
    assert.ok(!html.includes('data-testid="research-session-clear"'))
  })
})

describe('research-workspace-panel add affordance', () => {
  it('offers to add the current focus when it is not in the session', () => {
    const { html } = renderPanel({
      focus: { id: 'a', label: 'Card One' },
      onAddFocus: () => {},
    })
    assert.ok(html.includes('data-testid="research-session-add"'))
    assert.ok(html.includes('Add “Card One”'))
    assert.ok(!html.includes('>In session<'))
  })

  it('marks the focus as already in the session and disables the button', () => {
    const { html } = renderPanel({
      entries: [entry('a', 'Card One')],
      focus: { id: 'a', label: 'Card One' },
      onAddFocus: () => {},
    })
    assert.ok(html.includes('>In session<'))
    assert.ok(html.includes('disabled'))
  })

  it('falls back to the hint when no add handler is supplied', () => {
    const { html } = renderPanel({ focus: { id: 'a', label: 'Card One' } })
    assert.ok(html.includes('data-testid="research-session-add-hint"'))
    assert.ok(!html.includes('data-testid="research-session-add"'))
  })
})

describe('research-workspace-panel roster', () => {
  it('renders one row per entry with its type and projection', () => {
    const { html } = renderPanel({
      entries: [entry('a', 'First'), entry('b', 'Second')],
    })
    assert.ok(html.includes('data-testid="research-session-list"'))
    assert.ok(html.includes('data-entry-id="a"'))
    assert.ok(html.includes('data-entry-id="b"'))
    assert.ok(html.includes('First'))
    assert.ok(html.includes('Second'))
    assert.ok(html.includes('card-argument-taxonomy · depth 2'))
    assert.ok(html.includes('2 focused'))
  })

  it('exposes Open and Remove for every entry, plus Clear', () => {
    const { html } = renderPanel({ entries: [entry('a', 'First')] })
    const atom = 'data-testid="research-session-open"'
    const remove = 'data-testid="research-session-remove"'
    assert.ok(html.includes(atom))
    assert.ok(html.includes(remove))
    assert.ok(html.includes('data-entry-id="a"'))
    assert.ok(html.includes('data-testid="research-session-clear"'))
  })

  it('describes an entry with nulls as the server defaults', () => {
    const { html } = renderPanel({
      entries: [
        {
          id: 'a',
          type: 'card',
          label: 'Defaulted',
          view: null,
          depth: null,
          addedAt: 0,
        },
      ],
    })
    assert.ok(html.includes('default view · default depth'))
  })
})
