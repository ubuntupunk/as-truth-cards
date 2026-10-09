/**
 * Tests for `graph-controls.tsx` — the control strip.
 *
 * The strip is presentational: server catalogue → view options, descriptor →
 * depth bounds, projection → facet groups, treatment → appearance buttons.
 * Behaviour is exercised the same way the deleted `DeckNavigator` suite did —
 * a pure component is just a function, so its returned vnode tree is walked
 * directly and each row's `onClick` (or an appearance button's) is invoked
 * without any DOM. The strip must never compute a semantic itself; these tests
 * read the `onChange` payloads to pin the single-select facet wiring, the
 * AND-across-groups composition, and the disabled-empty facet honesty.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { VNode } from 'preact'
import { render } from 'preact-render-to-string'
import type { GraphTreatment } from './appearance'
import { GRAPH_TREATMENT_TOKENS } from './appearance'
import { deriveFacets, type FacetFilter, NO_FACET_FILTER } from './deck-facets'
import { GraphControls } from './graph-controls'
import type { GraphViewDescriptor } from './projection-guards'
import {
  CARD_PROJECTION,
  DESCRIPTOR,
  SPARSE_PROJECTION,
  VIEWS_RESPONSE,
} from './test-fixtures'

type FacetRowVNode = VNode<{
  label: string
  count?: number
  selected?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}>

/** Walk a vnode tree like Preact does, collecting nodes matching a predicate. */
function walk(
  root: unknown,
  matches: (vnode: VNode & { props?: Record<string, unknown> }) => boolean,
): (VNode & { props?: Record<string, unknown> })[] {
  const out: (VNode & { props?: Record<string, unknown> })[] = []
  const descend = (value: unknown): void => {
    if (value === null || value === undefined || typeof value !== 'object')
      return
    if (Array.isArray(value)) {
      for (const item of value) descend(item)
      return
    }
    const vnode = value as VNode & { props?: Record<string, unknown> }
    if (matches(vnode)) {
      out.push(vnode)
      return
    }
    if (typeof vnode.type === 'function') {
      descend((vnode.type as (props: unknown) => unknown)(vnode.props))
      return
    }
    descend(vnode.props?.children)
  }
  descend(root)
  return out
}

/** Collect every facet row vnode in a control strip tree, in render order. */
function rowsOf(root: VNode): FacetRowVNode[] {
  return walk(
    root,
    (vnode) =>
      typeof vnode.props?.label === 'string' &&
      typeof vnode.props?.onClick === 'function',
  ) as FacetRowVNode[]
}

/** Build a control strip tree with the given facet wiring. */
function build(
  filter: FacetFilter,
  projection = CARD_PROJECTION,
  extra: {
    onClearFacets?: () => void
    onTreatmentChange?: (next: GraphTreatment) => void
  } = {},
) {
  const changes: FacetFilter[] = []
  const clears: unknown[] = []
  const treatmentChanges: GraphTreatment[] = []
  const tree = GraphControls({
    focusInput: 'jesus-was-a-zionist',
    onFocusInput: () => {},
    onSubmitFocus: () => {},
    views: VIEWS_RESPONSE,
    viewsError: null,
    view: 'card-argument-taxonomy',
    onViewChange: () => {},
    maxDepth: 3,
    depth: 2,
    onDepthChange: () => {},
    descriptor: DESCRIPTOR,
    facets: deriveFacets(projection),
    filter,
    onFacetChange: (next) => changes.push(next),
    onClearFacets: () => clears.push(null),
    treatment: 'atmospheric',
    onTreatmentChange: (next) => treatmentChanges.push(next),
    nodeColors: GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors,
    edgeColors: GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors,
  })
  return {
    rows: rowsOf(tree),
    changes,
    clears,
    treatmentChanges,
    tree,
  }
}

describe('graph-controls markup', () => {
  it('renders the focus reader, view, depth, appearance and facet controls', () => {
    const html = render(
      <GraphControls
        focusInput="jesus-was-a-zionist"
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    assert.ok(html.includes('data-testid="graph-controls"'))
    assert.ok(html.includes('>Focus<'))
    assert.ok(html.includes('placeholder="card slug or uuid"'))
    assert.ok(html.includes('value="jesus-was-a-zionist"'))
    assert.ok(html.includes('>View<'))
    assert.ok(html.includes('>Depth<'))
    assert.ok(html.includes('>Appearance<'))
    assert.ok(html.includes('data-testid="facet-popover"'))
  })

  it('builds the view options from the server catalogue, with status badges', () => {
    const html = render(
      <GraphControls
        focusInput=""
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    assert.ok(html.includes('>card-argument-taxonomy<'))
    assert.ok(html.includes('>taxonomy (not-implemented)<'))
  })

  it('offers the descriptor-bounded depth hops', () => {
    assert.ok(build(NO_FACET_FILTER).tree !== null)
    const html = render(
      <GraphControls
        focusInput=""
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    // depthOptions(3) → [0,1,2,3]; DEFAULT_DEPTH (1) is labelled default.
    assert.ok(html.includes('>0 hops<'))
    assert.ok(html.includes('>1 hop (default)<'))
    assert.ok(html.includes('>2 hops<'))
    assert.ok(html.includes('>3 hops<'))
  })

  it('renders the blocking-gaps note when the view is data-blocked', () => {
    const blocked: GraphViewDescriptor = {
      ...DESCRIPTOR,
      blockingGaps: ['evidence_item: trope_graph.evidence_items has 0 rows'],
    }
    const html = render(
      <GraphControls
        focusInput=""
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={blocked}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    assert.ok(html.includes('evidence_items has 0 rows'))
    assert.ok(html.includes('This view is data-blocked'))
    assert.ok(html.includes('— evidence_item:'))
    assert.ok(html.includes('an empty backing table, not a failed load'))
    assert.ok(
      html.includes('Depth and per-claim gaps are reported in the inspector'),
    )
  })
})

describe('graph-controls facade groups', () => {
  it('lists ontology types, suits and axes in the shared order', () => {
    const { rows } = build(NO_FACET_FILTER)
    assert.deepEqual(
      rows.map((row) => row.props.label),
      [
        'All',
        'Claims',
        'Evidence',
        'Sources',
        'Cases',
        'Concepts',
        'Interpretations',
        'Inferences',
        'Classic',
        'South Africa',
        'Tactic',
        'Historical',
      ],
    )
    assert.equal(
      rows.find((row) => row.props.label === 'Claims')?.props.count,
      2,
    )
    assert.equal(
      rows.find((row) => row.props.label === 'South Africa')?.props.count,
      1,
    )
  })

  it('renders suit rows with the mockup dot colours', () => {
    const html = render(
      <GraphControls
        focusInput=""
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    assert.ok(html.includes('background-color:#ef4444'))
    assert.ok(html.includes('background-color:#22d3ee'))
  })

  it('disables a schema-only ontology type as a visible, honest facet', () => {
    const { rows } = build(NO_FACET_FILTER, SPARSE_PROJECTION)
    const claims = rows.find((row) => row.props.label === 'Claims')
    assert.ok(claims !== undefined)
    assert.equal(claims.props.disabled, true)
    assert.equal(claims.props.count, 0)
    assert.ok((claims.props.title ?? '').includes('current projection'))
    assert.ok(!rows[0]?.props.disabled)
  })
})

describe('graph-controls facet wiring', () => {
  it('selects a type, clears it on reselect, and restores All', () => {
    const first = build(NO_FACET_FILTER)
    first.rows.find((row) => row.props.label === 'Claims')?.props.onClick()
    assert.deepEqual(first.changes, [{ type: 'claim', suit: null, axis: null }])

    const second = build({ type: 'claim', suit: null, axis: null })
    second.rows.find((row) => row.props.label === 'Claims')?.props.onClick()
    assert.deepEqual(second.changes, [{ type: null, suit: null, axis: null }])

    const third = build({ type: 'claim', suit: null, axis: null })
    third.rows.find((row) => row.props.label === 'All')?.props.onClick()
    assert.deepEqual(third.changes, [{ type: null, suit: null, axis: null }])
  })

  it('composes suit and axis selections AND-wise with an active type', () => {
    let filter: FacetFilter = { type: 'claim', suit: null, axis: null }

    const afterSuit = build(filter)
    afterSuit.rows
      .find((row) => row.props.label === 'South Africa')
      ?.props.onClick()
    filter = afterSuit.changes[afterSuit.changes.length - 1]
    assert.deepEqual(filter, {
      type: 'claim',
      suit: 'south-africa',
      axis: null,
    })

    const afterAxis = build(filter)
    afterAxis.rows.find((row) => row.props.label === 'Tactic')?.props.onClick()
    filter = afterAxis.changes[afterAxis.changes.length - 1]
    assert.deepEqual(filter, {
      type: 'claim',
      suit: 'south-africa',
      axis: 'TACTIC',
    })
  })

  it('a selected suit clears on reselect', () => {
    const { rows, changes } = build({
      type: null,
      suit: 'south-africa',
      axis: null,
    })
    rows.find((row) => row.props.label === 'South Africa')?.props.onClick()
    assert.deepEqual(changes, [{ type: null, suit: null, axis: null }])
  })

  it('shows the active-count badge and a clear-all button only when filtered', () => {
    const clean = build(NO_FACET_FILTER)
    const cleanHtml = render(clean.tree)
    assert.ok(!cleanHtml.includes('data-filter-count'))

    const active = build({ type: 'claim', suit: null, axis: null })
    const activeHtml = render(active.tree)
    assert.ok(activeHtml.includes('data-filter-count'))
    assert.ok(activeHtml.includes('data-testid="clear-facets"'))
    assert.equal(active.clears.length, 0)
    const clearButton = walk(
      active.tree,
      (vnode) =>
        typeof vnode.type === 'string' &&
        (vnode.props ?? {})['data-testid'] === 'clear-facets',
    )[0]
    assert.ok(clearButton)
    ;(clearButton.props?.onClick as () => void)()
    assert.equal(active.clears.length, 1)
  })
})

describe('graph-controls appearance switcher', () => {
  it('renders every treatment with the active one pressed', () => {
    const { tree } = build(NO_FACET_FILTER)
    const html = render(tree)
    for (const treatment of ['atmospheric', 'editorial', 'workspace']) {
      assert.ok(html.includes(`data-appearance="${treatment}"`))
    }
    assert.ok(
      html.includes('data-appearance="atmospheric" aria-pressed="true"'),
    )
    assert.ok(html.includes('data-appearance="editorial" aria-pressed="false"'))
  })

  it('reports a treatment switch without touching any semantic value', () => {
    const { tree, treatmentChanges } = build(NO_FACET_FILTER)
    const editorial = walk(
      tree,
      (vnode) =>
        typeof vnode.type === 'string' &&
        (vnode.props ?? {})['data-appearance'] === 'editorial',
    )[0]
    assert.ok(editorial)
    ;(editorial.props?.onClick as () => void)()
    assert.deepEqual(treatmentChanges, ['editorial'])
    assert.deepEqual(tree, tree)
  })
})

describe('graph-controls focus typeahead', () => {
  const results = [
    {
      id: 'c1',
      slug: 'blood-libel',
      title: 'Blood Libel',
      summary: null,
      type: 'card',
      rank: 1.5,
    },
    {
      id: 'c2',
      slug: 'elders-of-zion',
      title: 'Elders of Zion',
      summary: null,
      type: 'card',
      rank: 0.5,
    },
  ]

  function renderControls(
    over: {
      searchOpen?: boolean
      searchPending?: boolean
      searchResults?: typeof results
    } = {},
  ) {
    return render(
      <GraphControls
        focusInput="blo"
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
        searchOpen={over.searchOpen ?? false}
        searchPending={over.searchPending ?? false}
        searchResults={over.searchResults ?? []}
      />,
    )
  }

  it('renders no suggestions when closed', () => {
    const html = renderControls({ searchOpen: false, searchResults: results })
    assert.ok(!html.includes('data-testid="focus-suggestions"'))
  })

  it('lists matching cards with title and slug when open', () => {
    const html = renderControls({ searchOpen: true, searchResults: results })
    assert.ok(html.includes('data-testid="focus-suggestions"'))
    assert.ok(html.includes('>Blood Libel<'))
    assert.ok(html.includes('data-slug="blood-libel"'))
    assert.ok(html.includes('>Elders of Zion<'))
  })

  it('exposes the combobox and listbox ARIA contract when open', () => {
    const html = renderControls({ searchOpen: true, searchResults: results })
    assert.ok(html.includes('role="combobox"'))
    assert.ok(html.includes('aria-expanded="true"'))
    assert.ok(html.includes('aria-haspopup="listbox"'))
    assert.ok(html.includes('aria-controls="focus-suggestions-list"'))
    assert.ok(html.includes('id="focus-suggestions-list"'))
    assert.ok(html.includes('role="listbox"'))
    assert.ok(html.includes('role="option"'))
  })

  it('reports the combobox as collapsed when closed', () => {
    const html = renderControls({ searchOpen: false, searchResults: results })
    assert.ok(html.includes('role="combobox"'))
    assert.ok(html.includes('aria-expanded="false"'))
  })

  it('shows a searching state when a request is in flight', () => {
    const html = renderControls({ searchOpen: true, searchPending: true })
    assert.ok(html.includes('Searching…'))
  })

  it('shows an empty state when open with no matches', () => {
    const html = renderControls({ searchOpen: true, searchResults: [] })
    assert.ok(html.includes('No matching cards'))
  })

  it('reports the chosen card slug through onSelectCard', () => {
    const picked: string[] = []
    const tree = GraphControls({
      focusInput: 'blo',
      onFocusInput: () => {},
      onSubmitFocus: () => {},
      views: VIEWS_RESPONSE,
      viewsError: null,
      view: 'card-argument-taxonomy',
      onViewChange: () => {},
      maxDepth: 3,
      depth: 2,
      onDepthChange: () => {},
      descriptor: DESCRIPTOR,
      facets: deriveFacets(CARD_PROJECTION),
      filter: NO_FACET_FILTER,
      onFacetChange: () => {},
      onClearFacets: () => {},
      treatment: 'atmospheric',
      onTreatmentChange: () => {},
      nodeColors: GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors,
      edgeColors: GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors,
      searchOpen: true,
      searchPending: false,
      searchResults: results,
      onSelectCard: (slug) => picked.push(slug),
    })
    const button = walk(
      tree,
      (vnode) =>
        typeof vnode.type === 'string' &&
        (vnode.props ?? {})['data-slug'] === 'blood-libel',
    )[0]
    assert.ok(button)
    ;(button.props?.onClick as () => void)()
    assert.deepEqual(picked, ['blood-libel'])
  })
})

describe('graph-controls legend', () => {
  it('shows only the node types and edge families the descriptor emits', () => {
    const html = render(
      <GraphControls
        focusInput=""
        onFocusInput={() => {}}
        onSubmitFocus={() => {}}
        views={VIEWS_RESPONSE}
        viewsError={null}
        view="card-argument-taxonomy"
        onViewChange={() => {}}
        maxDepth={3}
        depth={2}
        onDepthChange={() => {}}
        descriptor={DESCRIPTOR}
        facets={deriveFacets(CARD_PROJECTION)}
        filter={NO_FACET_FILTER}
        onFacetChange={() => {}}
        onClearFacets={() => {}}
        treatment="atmospheric"
        onTreatmentChange={() => {}}
        nodeColors={GRAPH_TREATMENT_TOKENS.atmospheric.nodeColors}
        edgeColors={GRAPH_TREATMENT_TOKENS.atmospheric.edgeColors}
      />,
    )
    // DESCRIPTOR's families, humanized with captions; the absent
    // `source`/`evidence` families stay out.
    assert.ok(html.includes('data-testid="color-legend"'))
    assert.ok(html.includes('>Nodes<'))
    assert.ok(html.includes('>Edges<'))
    assert.ok(html.includes('data-node-type="inference_step"'))
    assert.ok(html.includes('>Inference step<'))
    assert.ok(html.includes('data-edge-family="domain"'))
    assert.ok(html.includes('>Domain<'))
    assert.ok(html.includes('data-edge-family="claim_relation"'))
    assert.ok(html.includes('>Claim relation<'))
    assert.ok(!html.includes('data-edge-family="evidence"'))
  })
})
