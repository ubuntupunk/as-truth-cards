/**
 * Tests for `route-boundary.tsx` — the wiring that gives every route its own
 * error boundary.
 *
 * Pure vnode construction (no DOM), so the harness asserts the shape directly:
 * each route element comes back guarded by an {@link ErrorBoundary} labelled
 * with that route's path.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ErrorBoundary } from './error-boundary'
import { withRouteBoundary } from './route-boundary'

describe('withRouteBoundary', () => {
  it('guards the route element with a boundary named for its path', () => {
    const element = <p>the view</p>
    const guarded = withRouteBoundary({ path: '/explore', element })
    assert.equal(guarded.type, ErrorBoundary)
    assert.equal(guarded.props.label, '/explore')
    assert.equal(guarded.props.children, element)
  })

  it('labels each route with its own path', () => {
    const root = withRouteBoundary({ path: '/', element: <p /> })
    const admin = withRouteBoundary({ path: '/admin', element: <p /> })
    assert.equal(root.props.label, '/')
    assert.equal(admin.props.label, '/admin')
  })
})
