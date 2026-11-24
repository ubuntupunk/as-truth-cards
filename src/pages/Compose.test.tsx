/**
 * Page-level render-order regression for the Compose hierarchy.
 *
 * The honesty contract is DOM order: choose a card, read the recorded material, then author
 * a private draft. The assertion is made against the page's JSX source because the router's
 * SSR interop with the Preact test renderer cannot mount `MemoryRouter` here; the semantics
 * of each surface are covered by their own component suites.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/** The Compose page source under test. */
const SOURCE = readFileSync(new URL('./Compose.tsx', import.meta.url), 'utf8')

/** The workspace body, where the read panel precedes the draft surface. */
const WORKSPACE = SOURCE.slice(
  SOURCE.indexOf('function ComposeWorkspace'),
  SOURCE.indexOf('const Compose ='),
)

/** The page body, where the picker precedes the workspace. */
const PAGE = SOURCE.slice(SOURCE.indexOf('const Compose ='))

/**
 * Find a stable marker in a source slice.
 *
 * @param source The source slice to search.
 * @param marker The exact fragment to locate.
 * @returns The zero-based offset within the slice.
 */
function offsetOf(source: string, marker: string): number {
  const offset = source.indexOf(marker)
  assert.ok(offset >= 0, `missing Compose marker: ${marker}`)
  return offset
}

describe('Compose page hierarchy', () => {
  it('renders picker, recorded panel, then the distinct draft workspace', () => {
    const picker = offsetOf(PAGE, '{picker}')
    const editor = offsetOf(PAGE, '{renderEditor()}')
    const recorded = offsetOf(WORKSPACE, '<CanonicalDecomposition')
    const draft = offsetOf(WORKSPACE, 'data-testid="compose-draft-workspace"')
    const draftHeading = offsetOf(WORKSPACE, 'id="compose-draft-heading"')
    const notCanonical = offsetOf(WORKSPACE, 'NOT CANONICAL')
    const saveBar = offsetOf(WORKSPACE, '<SaveBar')
    const gate = offsetOf(WORKSPACE, '<PermissionGate')

    assert.ok(editor > picker)
    assert.ok(draft > recorded)
    assert.ok(draftHeading > draft)
    assert.ok(notCanonical > draftHeading)
    assert.ok(saveBar > notCanonical)
    assert.ok(gate > saveBar)
  })

  it('keeps the page heading ahead of both surfaces', () => {
    const heading = offsetOf(PAGE, '<PageHeading')
    const picker = offsetOf(PAGE, '{picker}')

    assert.ok(picker > heading)
    assert.ok(WORKSPACE.includes('NOT CANONICAL'))
    assert.ok(SOURCE.includes("Study a card's recorded reasoning"))
  })
})
