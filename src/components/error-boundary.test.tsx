/**
 * Tests for `error-boundary.tsx`.
 *
 * A Preact boundary catches only during a live render, which the DOM-less
 * `preact-render-to-string` harness cannot perform — so, exactly as
 * `drawer-a11y.ts` splits its DOM behaviour from its pure decision, the
 * boundary's two testable halves are pinned here: the pure state derivation
 * (`getDerivedStateFromError`), the render it produces in each state, the retry
 * wiring, and the failure log. The end-to-end catch stays browser-verified.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { buttonByText } from '@/deck/test-fixtures'
import { ErrorBoundary, type ErrorBoundaryState } from './error-boundary'

/** Force a fresh boundary into its captured-error state. */
function withError(label?: string): ErrorBoundary {
  const instance = new ErrorBoundary({ label })
  Object.assign(
    instance.state,
    ErrorBoundary.getDerivedStateFromError(new Error('boom')),
  )
  return instance
}

describe('ErrorBoundary.getDerivedStateFromError', () => {
  it('captures an Error as-is', () => {
    const state = ErrorBoundary.getDerivedStateFromError(new Error('boom'))
    assert.equal(state.error?.message, 'boom')
  })

  it('normalises a non-Error throw so the fallback still has a message', () => {
    const state = ErrorBoundary.getDerivedStateFromError('a broken string')
    assert.equal(state.error?.message, 'a broken string')
  })
})

describe('ErrorBoundary.render', () => {
  it('renders the children unchanged while healthy', () => {
    const instance = new ErrorBoundary({ children: 'safe' })
    assert.equal(instance.render(), 'safe')
    assert.equal(instance.state.error, null)
  })

  it('renders the fallback with the label once an error is captured', () => {
    const html = render(withError('/explore').render() as VNode)
    assert.ok(html.includes('Something went wrong'))
    assert.ok(html.includes('The “/explore” view crashed'))
  })

  it('honours a custom fallback render-prop', () => {
    const instance = new ErrorBoundary({
      fallback: (error) => `caught: ${error.message}`,
    })
    Object.assign(instance.state, {
      error: new Error('boom'),
    } as ErrorBoundaryState)
    assert.equal(instance.render(), 'caught: boom')
  })

  it('retry clears the captured error', () => {
    const instance = withError('/sources')
    let update: unknown = null
    ;(instance as unknown as { setState: (value: unknown) => void }).setState =
      (value) => {
        update = value
      }
    const retry = buttonByText(instance.render(), 'Try again')
    assert.ok(retry !== undefined)
    ;(retry?.props?.onClick as () => void)()
    assert.deepEqual(update, { error: null })
  })
})

describe('ErrorBoundary.componentDidCatch', () => {
  it('logs the failure once, naming its route', () => {
    const logged: unknown[][] = []
    const original = console.error
    console.error = (...args: unknown[]) => {
      logged.push(args)
    }
    try {
      const instance = new ErrorBoundary({ label: '/sources' })
      instance.componentDidCatch(new Error('boom'), { componentStack: 'stack' })
    } finally {
      console.error = original
    }
    assert.equal(logged.length, 1)
    assert.ok(String(logged[0][0]).includes('/sources'))
  })
})
