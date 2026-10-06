/**
 * Tests for `graph-states.tsx` — every screen state of the Graph page.
 *
 * The suite pins the copy that differentiates the states, because the states
 * are the page's error-language: "server refused" (`ApiErrorState`) must read
 * differently from "server sent nonsense" (`MalformedState`), and an empty
 * projection must render as a fact, not as an error. All components are pure
 * (`props → string`), so `preact-render-to-string` covers them without a DOM.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { render } from 'preact-render-to-string'
import {
  ApiErrorState,
  DepthBoundedBanner,
  EmptyProjectionState,
  LoadingState,
  MalformedState,
  NoFocusState,
  ProjectionNotices,
  SparseNotice,
  TruncatedBanner,
  ViewsStatus,
  WarningsBanner,
} from './graph-states'
import { ProjectionShapeError } from './projection-guards'
import {
  CARD_PROJECTION,
  EMPTY_PROJECTION,
  SPARSE_PROJECTION,
  TRUNCATED_PROJECTION,
  VIEWS_RESPONSE,
} from './test-fixtures'
import { GraphApiError } from './use-graph'

describe('NoFocusState', () => {
  it('invites a slug or a uuid, literally', () => {
    const html = render(<NoFocusState />)
    assert.ok(html.includes('Pick a card to expand'))
    assert.ok(html.includes('jesus-was-a-zionist'))
    assert.ok(html.includes('card uuid'))
  })
})

describe('LoadingState', () => {
  it('defaults and custom labels', () => {
    assert.ok(render(<LoadingState />).includes('Loading projection…'))
    assert.ok(
      render(<LoadingState labelled="Expanding the neighbourhood…" />).includes(
        'Expanding the neighbourhood…',
      ),
    )
  })
})

describe('ApiErrorState', () => {
  it('shows the status, the server message and the technical detail', () => {
    const html = render(
      <ApiErrorState
        error={
          new GraphApiError(
            400,
            'focus must be a card uuid or slug',
            'parseGraphQuery failed',
          )
        }
      />,
    )
    assert.ok(html.includes('The API replied 400'))
    assert.ok(html.includes('focus must be a card uuid or slug'))
    assert.ok(html.includes('parseGraphQuery failed'))
  })

  it('names a network failure for status 0', () => {
    const html = render(
      <ApiErrorState
        error={new GraphApiError(0, 'Network error: unreachable', null)}
      />,
    )
    assert.ok(html.includes('Network error'))
  })

  it('still renders an unexpected thrown Error without crashing', () => {
    const html = render(<ApiErrorState error={new Error('plain boom')} />)
    assert.ok(html.includes('plain boom'))
  })
})

describe('MalformedState', () => {
  it('names the failing path for a projection shape error', () => {
    const html = render(
      <MalformedState
        error={new ProjectionShapeError('nodes[3].status.value', 'missing key')}
      />,
    )
    assert.ok(html.includes('Malformed graph response'))
    assert.ok(html.includes('nodes[3].status.value'))
  })

  it('renders any other thrown value defensively', () => {
    const html = render(<MalformedState error={new Error('json broke')} />)
    assert.ok(html.includes('json broke'))
  })
})

describe('EmptyProjectionState', () => {
  it('renders an unpopulated view as a fact with its warning', () => {
    const html = render(<EmptyProjectionState projection={EMPTY_PROJECTION} />)
    assert.ok(html.includes('Nothing to show for view'))
    assert.ok(html.includes('taxonomy'))
    assert.ok(html.includes('No card_axes rows found for this focus'))
  })
})

describe('banners', () => {
  it('WarningsBanner lists every warning stably', () => {
    const html = render(<WarningsBanner warnings={['a', 'b']} />)
    assert.ok(html.includes('a'))
    assert.ok(html.includes('b'))
  })

  it('TruncatedBanner names the cap', () => {
    const html = render(<TruncatedBanner maxNodes={3} />)
    assert.ok(html.includes('3-node cap'))
  })

  it('DepthBoundedBanner reports both depths', () => {
    const html = render(
      <DepthBoundedBanner requestedDepth={3} reachedDepth={2} />,
    )
    assert.ok(html.includes('runs out at depth 2'))
    assert.ok(html.includes('requested 3'))
  })

  it('SparseNotice reports counts precisely', () => {
    const html = render(<SparseNotice nodeCount={1} edgeCount={0} />)
    assert.ok(html.includes('Sparse projection: 1 node and 0 edges'))
  })
})

describe('ProjectionNotices', () => {
  it('emits nothing for a clean projection', () => {
    const html = render(
      <ProjectionNotices projection={CARD_PROJECTION} requestedDepth={3} />,
    )
    assert.ok(!html.includes('Non-fatal warnings'))
    assert.ok(!html.includes('cap'))
    assert.ok(!html.includes('Sparse projection'))
    assert.ok(!html.includes('runs out at depth'))
  })

  it('composes truncation and depth-bounded banners', () => {
    const html = render(
      <ProjectionNotices
        projection={TRUNCATED_PROJECTION}
        requestedDepth={3}
      />,
    )
    assert.ok(html.includes('truncated'))
    assert.ok(html.includes('runs out at depth 2'))
  })

  it('shows the sparse notice when nodes exist without edges', () => {
    const html = render(
      <ProjectionNotices projection={SPARSE_PROJECTION} requestedDepth={0} />,
    )
    assert.ok(html.includes('Sparse projection: 1 node and 0 edges'))
  })

  it('keeps warnings above the graph, not replacing it', () => {
    const withWarnings = {
      ...CARD_PROJECTION,
      meta: { ...CARD_PROJECTION.meta, warnings: ['one', 'two'] },
    }
    const html = render(
      <ProjectionNotices projection={withWarnings} requestedDepth={3} />,
    )
    assert.ok(html.includes('one'))
    assert.ok(html.includes('two'))
    assert.ok(!html.includes('Sparse projection'))
  })
})

describe('ViewsStatus', () => {
  it('reports a failing catalogue lookup', () => {
    const html = render(
      <ViewsStatus
        error={new GraphApiError(500, 'boom', null)}
        views={undefined}
      />,
    )
    assert.ok(html.includes('View catalogue unavailable: boom'))
  })

  it('falls back for an unknown error shape', () => {
    const html = render(
      <ViewsStatus error={new Error('weird')} views={undefined} />,
    )
    assert.ok(html.includes('weird'))
  })

  it('says nothing when the catalogue loaded', () => {
    assert.equal(
      render(<ViewsStatus error={null} views={VIEWS_RESPONSE} />),
      '',
    )
  })

  it('notes the loading state between query start and data arrival', () => {
    const html = render(<ViewsStatus error={null} views={undefined} />)
    assert.ok(html.includes('Loading views…'))
  })
})
