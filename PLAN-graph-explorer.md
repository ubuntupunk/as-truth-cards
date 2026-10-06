# Plan — Complete the Graph/Explorer UI against the approved mockup, then expose Claim provenance

Governing brief: `Instructions.md`. Mockup proxy: `trope_deck_axis_suit_ui.html`
(FigJam/Figma `qmVMnfR9DpQFyYtaiSizYD` is not machine-readable; the HTML captures
the navigator sidebar and card front that matter for this issue) and
`trope-deck-axis-memo.md` §4.

## Slices

Work is cut into vertical slices so each lands with the existing gates green.

### Slice 1 — Mockup-aligned Graph UI shell (tracked: `as-truth-cards-xcq`)

Restructure `/graph` into the mockup's layout: **navigator sidebar + card front +
graph + inspector**. Presentation-only — URL params, React Query keys and the
projection contract are untouched.

- `src/graph/deck-facets.ts` — pure facet model. Derives, from any valid
  `GraphProjection`:
  - ontology-type facets (All / Claims / Evidence / Sources / Cases / Concepts /
    Interpretations / Inferences), each with a live count and a *present* flag so
    an empty layer ("evidence has 0 rows in the corpus") renders disabled, never
    as a broken filter;
  - Suit facets from the union of `card.classification.suits` across the
    projection;
  - Axis facets from the union of `card.classification.axes`, in authored ordinal
    order.
  
  Plus `applyFacetFilter(projection, filter)` — pure `nodes`/`edges` pruning with
  recomputed meta counts, and `nodeMatchesFacets`. Tests use the real
  `CARD_PROJECTION` fixture.

- `src/graph/deck-navigator.tsx` — the sidebar. Three groups:
  - **Ontology type** — All + the type facets;
  - **Suit — new** — coloured-dot items;
  - **Axis — new** — inline-icon items.
  
  Pure presentational (props + callbacks), inline-SVG icons only, so it stays
  Node-testable with `preact-render-to-string`.

- `src/graph/card-front.tsx` — the mockup's card detail panel, derived only from
  the projection's focus card node: title, suit badge, **Axis pills** (fixed
  vocabulary, visually distinct — the axis-memo §4 requirement), summary, and
  **Mechanisms & concepts** as pills but *separately sourced* (`mechanismSlugs`
  vs `HAS_CONCEPT` edges), never merged semantically.

- `src/pages/Graph.tsx` — outer layout becomes
  `lg:grid-cols-[220px_minmax(0,1fr)]`; sidebar left, controls + card front +
  notices + graph + inspector right. Facet filters are session state; the graph
  canvas and inspector read the *filtered* projection, notices still read the
  original (warnings/truncation are corpus facts). Selection is cleared when the
  selected id leaves the filtered projection.

No new API params, no view changes, no ontology semantics in the client.

### Slice 2 — Claims lead the graph (tracked: `as-truth-cards-ouc`)

The `argument` view advertises `focusTypes: ['card','claim','argument_chain']`
but `projectGraph` only resolves cards today (`reader.findCardByRef`). Make the
authored focus path real so a researcher can move **Card → Claim** by refocusing:

- reader: resolve a uuid to a claim (or argument chain) when the view permits it;
- `projectGraph`: start expansion from a non-card `NodeRef` per
  `view.focusTypes`; a step frontier also discovers the claims it premises and
  concludes, so a chain focus shows the argument's claims instead of dead-ending
  at its steps (Priority 4's CLAIM → STEP → CLAIM walk has to work from the
  chain entry point too);
- implement the `argument` view (status `designed` → `implemented`), promoting
  chains to nodes while the general view keeps them as step metadata;
- UI: an inspector "Focus claim / Focus argument" action navigating to
  `view=argument&focus=<uuid>`.

### Slice 3 — Source attribution vs Evidence (tracked: `as-truth-cards-qov`)

The projection types carry `SourceNode`/`EvidenceItemNode` but *no* edges from a
claim to either — `claim_sources` and the `evidence_*` tables are not projected
at all. Add the edge families the ontology implies, wire reader + view nodeTypes,
and make the UI distinguish source-attribution / evidence / unsupported claim /
missing evidence honestly (schema-empty layers stay disabled with a "0 rows in
the corpus" signal, never fabricated).

## Encodings kept

- Status is per node type; no rollups.
- `HAS_CONCEPT` ≠ `HAS_MECHANISM`; Locale ≠ Suit; `claim_relation` ≠ inference.
- Direct claim relations preserved; no inference from proximity.
- Server authoritative for views and defaults; the navigator never sets a view.
- Critical node-test surfaces (`deck-facets`, `deck-navigator`, `card-front`,
  `graph-states`) stay free of `react`-coupled icon libraries.

## Verification per slice

`pnpm run test:ui` (new suites) → `tsc -b` (no new errors beyond the 10 baseline)
→ `pnpm run build` → `pnpm run lint` + biome (no new findings on changed files) →
`pnpm run trope-graph:check` (no drift, no regression).