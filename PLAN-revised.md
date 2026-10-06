# Plan — Issue #3 Next Phase: Graph Presentation/UI Layer

**Status:** approved with revisions  
**Repo:** `ubuntupunk/as-truth-cards`, `main` @ `3e9300f`  
**Prior phase accepted:** Cytoscape presentation adapter `4ac66d9` / `3e9300f` — do not reopen

## 1. Objective

Build the first useful presentation layer over the stable graph stack without allowing the UI to become a second source of graph semantics:

```text
Postgres/Drizzle → domain projection → (Graphology, optional) → Cytoscape presentation → UI
```

Scope:

- graph view
- node/entity inspection
- projection/view controls
- graph states
- deterministic presentation
- select node → inspect entity → navigate/expand existing projection

No graph editing, write-back, ontology changes, or semantic inference.

**Issue #3 remains open after this phase.**

---

## 2. Verified Baseline

Retain the agent's verified baseline:

- `trope-graph:check`: 349 tests / 66 suites / 0 failures
- `check-drift`: `drift:false`, `comparedFacts:402`
- seed verification clean
- server tests: 19 pass
- `card-argument-taxonomy`:
  - depth 1: 10 nodes / 9 edges
  - depth 3: 33 nodes / 48 edges, including inference and claim-relation layers
- `taxonomy`:
  - depth 1: 5 nodes / 4 edges, including Concept
- depth 0: focus node only
- `maxNodes=3`: produces `truncated:true`
- Card nodes expose `metadata.slug` for canonical Card navigation

These findings establish that the required presentation states and semantic layers are actually populated and testable.

---

## 3. Contract Gaps

### 3.1 Card discovery remains deferred

The graph API requires `focus`, and there is currently no canonical endpoint listing `trope_graph` Card slugs. `/api/cards` is not a valid substitute because it refers to the unrelated legacy table.

**Decision:** do not build Card discovery in this phase.

Use:

- `?focus=<slug|uuid>` URL deep links
- free-text focus input
- Card→Card navigation from already-loaded projection nodes via canonical `metadata.slug`

Track the missing discovery endpoint separately as:

`as-truth-cards-572`

The UI must provide a clear no-focus state explaining that a Card focus is required.

Do not invent a default Card or derive one from Collections.

---

### 3.2 Correct the inaccurate `taxonomy` view descriptor

The current `taxonomy` descriptor advertises:

```text
focusTypes: ['card', 'mechanism', 'collection']
```

but the projection implementation currently resolves focus only through Card identity.

This is a graph API contract defect, not merely a UI limitation.

**Decision:** make the smallest possible correction to the `taxonomy` descriptor so that its `focusTypes` accurately describe the implementation that exists today.

Do **not** implement mechanism or Collection focus in this phase.

After correction, the UI may legitimately use `focusTypes` from `/api/graph/views` as authoritative metadata.

The correction must not alter taxonomy semantics, projection structure, or node/edge behavior.

---

### 3.3 Explicitly deferred

- Type-qualified `GraphNode.id` → `as-truth-cards-2bq`
- Card discovery/listing endpoint → `as-truth-cards-572`
- Mechanism/Collection focus support
- `include` / `relationship` UI controls

---

## 4. Architecture

### 4.1 Data flow

```text
URL ?focus=&view=&depth=
        │
        ▼
query-params.ts
pure URL parsing / serialization
        │
        ▼
TanStack Query
 ├── GET /api/graph/views
 └── GET /api/graph
        │
        ▼
projection-guards.ts
runtime shape validation only
        │
        ▼
toCytoscapePresentation(projection)
existing adapter — unchanged
        │
        ▼
Cytoscape core
presentation state only
        │
        └── selection / zoom / pan / classes
        │
        ▼
entity-inspector
reads domain projection by selected canonical node id
```

**Critical boundary:** the inspector reads from the domain projection, never from Cytoscape's internal graph representation.

Cytoscape selection is presentation state keyed by canonical node ID.

No semantic data should exist only inside Cytoscape.

---

## 5. Files

### New

| File | Purpose |
|---|---|
| `src/graph/query-params.ts` | Pure URL ⇄ `{focus, view, depth}` parsing/serialization; clamp depth to selected descriptor's `maxDepth` |
| `src/graph/projection-guards.ts` | Runtime API-response shape validation; malformed/unsupported responses become visible errors |
| `src/graph/use-graph.ts` | TanStack Query hooks for `/api/graph` and `/api/graph/views` |
| `src/graph/entity-inspector.tsx` | Type-discriminated entity inspection |
| `src/graph/graph-stylesheet.ts` | Maps adapter presentation classes to Cytoscape styles |
| `src/graph/graph-states.tsx` | Empty, sparse, warning, truncated, no-focus, and malformed-response states |
| `src/graph/cytoscape-graph.tsx` | Thin Cytoscape mount/selection component |
| `src/pages/Graph.tsx` | Graph page, controls, legend, graph, inspector |
| `src/graph/*.test.tsx` | UI/presentation tests |

### Modified

- `src/App.tsx` — add `/graph`
- `src/components/Header.tsx` — add Graph navigation
- Graph API/view descriptor implementation — **minimal correction to inaccurate `taxonomy.focusTypes` only**
- `package.json` / lockfile — promote Cytoscape to runtime dependency; add `preact-render-to-string` as dev dependency
- test scripts as required

No other graph architecture changes.

---

## 6. Entity Inspector

The inspector must discriminate on `node.type`.

### Card

Expose only information already present in the projection:

- classification
- Axis assignments
- primary Axis identified by `ordinal === 0`
- Collection/Suit associations
- Locale associations
- Mechanisms
- Concepts
- epistemic status and source
- relevant projected relationships
- canonical Card slug for navigation

Suit and Locale must remain visibly separate even where their slugs coincide.

### Other nodes

Keep types distinct:

- Claim
- Source
- Evidence Item
- Inference Step
- Argument Chain
- Case
- Interpretation
- Question
- Collection
- Mechanism
- Concept

Do not manufacture fields to make node types visually symmetrical.

`primaryType` must be displayed, if exposed, as explicitly **legacy/content-shape metadata**, never as Axis.

### Edges

Expose:

- authored direction
- `family`
- `relation`
- `sourceTable` where present
- relevant projection attributes

Do not collapse different edge families merely because their relation values share vocabulary.

---

## 7. Controls

### View

Populate from `/api/graph/views`.

Use descriptor metadata for:

- view name
- status
- populated state
- blocking gaps
- focus types
- node types
- edge families
- maximum depth

Do not hard-code ontology vocabulary.

### Focus

Free-text slug/UUID input.

Do not provide a focus-type picker beyond what the corrected descriptor actually supports.

For the current `taxonomy` view, the corrected descriptor will accurately indicate Card focus only.

### Depth

Expose:

```text
0 ... selectedView.maxDepth
```

Clamp through `query-params.ts`.

### Deferred controls

Do not build `include` or `relationship` filters.

Their semantics are not currently represented sufficiently by the view descriptors, and implementing them in the UI would require hard-coded graph vocabulary.

---

## 8. Graph States

Support:

1. no focus
2. loading
3. malformed API response
4. API error
5. valid empty projection
6. sparse projection
7. normal projection
8. truncated/max-node projection
9. depth-bounded projection
10. projection containing warnings

Warnings from `meta.warnings` must remain distinguishable from transport/API errors.

A valid empty projection must not be treated as a broken request.

---

## 9. Styling

Keep styling minimal and semantic.

Use the classes already supplied by the Cytoscape adapter:

- `type-*`
- `status-*`
- `is-focus`
- `family-*`
- `relation-*`
- `traversal-*`

Document the class → style mapping in `graph-stylesheet.ts`.

No design-system overhaul.

No visual convention may introduce new ontology semantics.

---

## 10. Testing

Use:

```text
node:test + tsx + preact-render-to-string
```

with:

```text
TSX_TSCONFIG_PATH=./tsconfig.app.json
```

Do not introduce Vitest, Playwright, Testing Library, or another test framework in this phase.

### Required coverage

- projection → Cytoscape elements
- node selection
- every supported node type
- Card classification
- multi-valued Axis
- primary Axis via `ordinal === 0`
- multi-valued Locale
- Suit vs Locale distinction
- Concept vs Mechanism distinction
- epistemic-status source preservation
- directed edges
- inference vs claim-relation distinction
- warnings
- empty projection
- sparse projection
- depth cap
- truncation
- focus/depth URL controls
- canonical Card navigation
- malformed responses
- no accidental ontology mutation
- deterministic rendering

### Vacuous-test guard

Fixtures must explicitly assert that they contain the semantic structures they are intended to test.

For example:

- inference fixture contains inference edges
- Axis fixture contains ≥2 Axis assignments
- Suit/Locale fixture contains the shared `south-africa` slug in both independent dimensions
- Concept/Mechanism fixture contains both
- claim-relation fixture contains actual claim-relation edges

No test may pass merely because the relevant graph layer is absent.

### Cytoscape mount testing

The actual DOM-mounted Cytoscape component may remain untested under Node if no DOM shim exists.

Keep that component thin.

All meaningful transformation, state, selection, inspector, styling, and contract logic must remain extracted and directly tested.

---

## 11. Dependency

Promote:

```text
cytoscape
```

from `devDependencies` to `dependencies`, because production UI code will now import the Cytoscape runtime.

Keep `preact-render-to-string` as a development/test dependency.

Bundle output may be inspected as a build verification detail, but bundle size or exact bundling strategy is not an architectural success criterion.

---

## 12. Verification

Before completion:

```bash
TROPE_GRAPH_DATABASE_URL="postgresql://ubuntupunk@localhost/trope_cards_dev" pnpm run trope-graph:check
pnpm run test:server
pnpm run test:ui
pnpm run typecheck
tsc -b
pnpm run build
pnpm run lint
```

Confirm:

- graph tests remain green
- Graphology tests remain green
- Cytoscape adapter tests remain green
- seed verification remains clean
- seed idempotence remains clean
- ontology counts do not unexpectedly change
- no semantic graph rows are fabricated
- build succeeds with Cytoscape as runtime dependency
- existing lint/typecheck baseline is documented rather than silently “fixed”

### Manual smoke test

Verify `/graph` with:

1. no focus
2. known Card slug
3. UUID focus
4. depth 0
5. depth 1
6. depth 3
7. `taxonomy`
8. `card-argument-taxonomy`
9. bounded/truncated projection
10. warnings
11. malformed/invalid focus
12. Card→Card navigation

---

## 13. Explicit Non-Goals

Do not:

- redesign ontology
- add schema/migrations unless a concrete graph-contract defect requires them
- add Claims, Concepts, Sources, Evidence, Cases, Interpretations, or Questions merely for UI richness
- infer Concept or claim relations
- create geopolitical hierarchies
- alter Axis semantics or vocabulary
- alter Locale semantics
- turn Collections into ontology
- revive `public.cards` / Prisma as canonical
- persist graph presentation state as ontology
- implement graph editing
- implement write-back
- modify deployment/auth
- solve type-qualified GraphNode IDs
- implement mechanism/Collection focus
- build Card discovery/listing
- add Graphology logic to React components
- replace the domain projection with Cytoscape-specific semantic structures

---

## 14. Deliverable Report

At completion report:

1. exact files changed
2. UI/view architecture
3. exact projection → UI data flow
4. existing graph contracts consumed
5. tests added and total counts
6. verification results
7. the corrected `taxonomy.focusTypes` contract
8. remaining contract gaps
9. remaining limitations

Explicitly distinguish:

- the corrected taxonomy descriptor
- the deferred Card discovery endpoint
- the deferred type-qualified-ID decision

**Do not close Issue #3.**
