/**
 * Render tests for the My activity panels.
 *
 * The contract under test is the one the page rewrite decided: activity points
 * at the Saved cards surface instead of keeping a second raw-slug list, and the
 * participation section says plainly that the capability does not exist yet
 * rather than rendering an empty list that reads as "you have done nothing".
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { ActivityPanels } from './activity-panels'

const noop = () => undefined

/**
 * Find a vnode by `data-testid`, descending into function components by
 * invoking them — the same walk `account-panels.test.tsx` uses.
 */
function findByTestId(
  tree: unknown,
  testId: string,
): (VNode & { props?: Record<string, unknown> }) | undefined {
  if (tree === null || tree === undefined || typeof tree !== 'object') {
    return undefined
  }
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findByTestId(item, testId)
      if (found) return found
    }
    return undefined
  }
  const vnode = tree as VNode & { props?: Record<string, unknown> }
  if (typeof vnode.type === 'function') {
    return findByTestId(
      (vnode.type as (props: unknown) => unknown)(vnode.props),
      testId,
    )
  }
  if (vnode.props?.['data-testid'] === testId) return vnode
  return findByTestId(vnode.props?.children ?? null, testId)
}

describe('ActivityPanels', () => {
  it('names the page and frames activity as account-side, not session-side', () => {
    const html = render(<ActivityPanels onOpenSaved={noop} />)
    assert.ok(html.includes('Account / My activity'))
    assert.ok(html.includes('What you have kept and done.'))
    assert.ok(html.includes('kept separate from the research session'))
  })

  it('points at the Saved cards surface instead of listing saved slugs', () => {
    const html = render(<ActivityPanels onOpenSaved={noop} />)
    assert.ok(html.includes('data-testid="activity-open-saved"'))
    assert.ok(html.includes('Open saved cards'))
    assert.equal(
      html.includes('href="/graph/'),
      false,
      'no raw-slug links into the graph',
    )
  })

  it('routes the saved-cards action to the page-owned navigation', () => {
    let opened = 0
    const panel = findByTestId(
      ActivityPanels({ onOpenSaved: () => opened++ }),
      'activity-open-saved',
    )
    assert.ok(panel, 'saved-cards action rendered')
    ;(panel?.props?.onClick as () => void)()
    assert.equal(opened, 1)
  })

  it('labels saving as a reading-list action, not a judgement of support', () => {
    const html = render(<ActivityPanels onOpenSaved={noop} />)
    assert.ok(html.includes('reading-list action'))
    assert.ok(html.includes('not a judgement'))
  })

  it('says participation is not enabled instead of showing an empty history', () => {
    const html = render(<ActivityPanels onOpenSaved={noop} />)
    assert.ok(html.includes('Participation'))
    assert.ok(html.includes('not enabled yet'))
    assert.ok(html.includes('will not invent a history it cannot show'))
  })
})
