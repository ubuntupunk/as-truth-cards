/**
 * Tests for `route-error-fallback.tsx` — the screen a crashed route shows
 * instead of a blank page.
 *
 * The component is pure (props → string), so `preact-render-to-string` covers
 * the markup under Node, and the retry control is exercised by calling it as a
 * function and firing its handler, matching the deck suite's convention.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import { buttonByText, walk } from '@/deck/test-fixtures'
import { RouteErrorFallback } from './route-error-fallback'

describe('RouteErrorFallback', () => {
  it('names the failure and prints the message, never a blank screen', () => {
    const html = render(
      <RouteErrorFallback
        error={new Error('boom in render')}
        onRetry={() => {}}
      />,
    )
    assert.ok(html.includes('Something went wrong'))
    assert.ok(html.includes('boom in render'))
  })

  it('announces itself as an alert region', () => {
    const html = render(
      <RouteErrorFallback error={new Error('x')} onRetry={() => {}} />,
    )
    assert.ok(html.includes('role="alert"'))
    assert.ok(html.includes('data-testid="route-error-fallback"'))
  })

  it('names the route it replaced when given a label', () => {
    const html = render(
      <RouteErrorFallback
        error={new Error('x')}
        onRetry={() => {}}
        label="/explore"
      />,
    )
    assert.ok(html.includes('The “/explore” view crashed'))
  })

  it('states that nothing was saved, so retrying is safe', () => {
    const html = render(
      <RouteErrorFallback error={new Error('x')} onRetry={() => {}} />,
    )
    assert.ok(html.includes('Nothing you did was sent or saved'))
  })

  it('fires the retry handler exactly once per click', () => {
    let retried = 0
    const tree = RouteErrorFallback({
      error: new Error('x'),
      onRetry: () => {
        retried += 1
      },
    })
    const retry = buttonByText(tree, 'Try again')
    assert.ok(retry !== undefined)
    ;(retry?.props?.onClick as () => void)()
    assert.equal(retried, 1)
  })

  it('always offers a way back to the deck', () => {
    const tree = RouteErrorFallback({
      error: new Error('x'),
      onRetry: () => {},
    })
    const home = walk(tree, (vnode) => vnode.type === 'a').find(
      (anchor) => anchor.props?.href === '/',
    )
    assert.ok(home !== undefined, 'expected a link home to the deck')
  })
})
