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

Status: COMPLETE (2026-10-07). Reader emits `source` edges from `claim_sources`
and `evidence` edges from the three `evidence_*` join tables; new `evidence`
view (`EVIDENCE_VIEW_NAME`) resolves claim/source/evidence_item focuses. UI
adds ViewGapsNote, claim Provenance + Evidence sections with three distinct
empty states, source-focus inspection. Corpus-based `populationWarnings` reuse
the view gap list. Gates green: graph 329/0, server 19/0, ui 147/0, typecheck
clean, build ✓, biome clean on changed files, lint unchanged (17 pre-existing,
none in touched files). Browser smoke verified provenance, source focus,
data-blocked note and refocus both directions. One live find: the Cytoscape
adapter's edge-family whitelist knew 5 families and threw on the two new ones —
extended to 7 and covered by a regression test.

### Slice 4 — Figma-aligned Graph Explorer shell (tracked: `as-truth-cards-4gq`)

New governing brief: `INSTRUCTION.md` (distinct from `Instructions.md`). This slice
realigns the **presentation** of `/graph` to the Figma composition and adds a
token-driven appearance system — it is presentation-only. Every graph semantic
landed in Slices 2–3 (edges, provenance/evidence, empty states, refocus,
warnings) is preserved; no projection, view, or API change.

Target composition (top to bottom):

1. **Global nav** — Decks / Explorer / Graph / Research / Sources, Graph marked
   current (`aria-current` + visual). Header elsewhere is shared; this slice only
   touches the nav links. Explorer / Research / Sources have no app behind them
   yet; default: link Decks→`/`, Graph→`/graph`, and leave the other three inert
   (`.disabled`) until their routes exist. No second, page-local nav system.
2. **Context / breadcrumb bar** — page-level context ("Graph Explorer" filing),
   not a synthetic page title.
3. **Heading block** — eyebrow `RELATIONSHIPS / GRAPH`, title **Graph Explorer**,
   tagline "Trace provenance and reasoning. Keep classification in view."
4. **Research disclaimer** — "This is a research collection, not itself a
   historical conclusion." Always visible above the workspace.
5. **Controls strip** — server-authoritative: view selector built from the views
   catalogue (`assertGraphViewsResponse`) with each descriptor's description,
   focus read as slug/uuid (no discovery endpoint — that stays
   `as-truth-cards-572`), depth shown as server-defined (read-only display),
   **appearance switcher** (Atmospheric / Editorial / Workspace, presentation-only),
   and the facet filters re-homed from the navigator.
6. **Workspace** — `[ Cytoscape graph | Entity Inspector ]` on desktop;
   single-column stack on narrow widths. Left DeckNavigator column is removed.
7. **Status strip** — three projection-derived readouts: **Classification**
   (cards + `classification`-family edges), **Provenance** (`source` family /
   `claim_sources`), **Reasoning** (`claim_relation` + `inference` families).
   Honest per view: family not emitted by the selected view → "not in this view",
   never a fabricated zero.

#### Appearance system (tokens + working switcher)

- `src/graph/appearance.ts` — `type GraphTreatment = 'atmospheric' | 'editorial' | 'workspace'`;
   the three token sets. Each carries the surfaces `INSTRUCTION.md` enumerates:
   page background, surface/panel, graph canvas, inspector surface, borders,
   typography hierarchy, node/edge treatment, accent, status, controls,
   contextual/disclaimer surfaces. Token values are placeholders pending Figma
   pixel values (documented as such) but the *structure* is complete so values
   drop in without code change.
- Chrome (DOM surfaces) via CSS custom properties: extend
   `tailwind.config.ts` colors with `graph-page/surface/canvas/inspector/border/
   accent` reading `hsl(var(--graph-…))`; `index.css` defines
   `[data-treatment="…"]` blocks overriding those vars plus typography. Switch =
   set `data-treatment` on the shell root.
- Canvas treatment: `graph-stylesheet.ts` gains `buildGraphStylesheet(treatment)`
   returning the same selector-order contract with treatment-scoped
   `NODE_TYPE_COLORS`/`EDGE_FAMILY_COLORS`; `GRAPH_STYLESHEET` const is preserved
   as the atmospheric default so existing stylesheet tests and the adapter
   contract are untouched. `cytoscape-graph.tsx` accepts an optional `style`
   prop; the page re-mounts it under a `key` on treatment change (re-paint only;
   projection, selection, URL untouched).
- Switcher persistence via `localStorage('graph-treatment')`, applied at mount.
   Switching never mutates projection, focus, selection, or URL. The switcher
   must work (per user decision), not merely expose tokens.

#### Restructure

- `src/pages/Graph.tsx` — outer layout becomes the shell (heading block,
  disclaimer, controls, workspace grid, status strip). Keeps all orchestration
  unchanged: query keys, `fetchValidated`, view catalogue, focus/refocus
  (`refocusEntity`), selection clearing on filter change, `ViewGapsNote`,
  state order (no-focus → loading → malformed → API-error → empty → rendered).
- `src/graph/graph-shell.tsx` — the presentational shell: heading block,
  disclaimer, controls strip, workspace grid, status strip, treatment wrapper.
  Pure props/callbacks, inline SVG icons, Node-testable.
- `src/graph/graph-controls.tsx` — view selector (catalogue-driven), focus row,
  depth display, appearance switcher, facet popover (Suit / Axis / Ontology-type
  groups re-homed), legend. Legend reads `buildGraphStylesheet`'s maps and only
  the families actually emitted by the current projection.
- `src/graph/graph-status.tsx` — the three readouts, computed from the projection
  + descriptor (family declares vs corpus has).
- **Remove from the page**: `deck-navigator.tsx` (and its test file) — no left
  navigator per the brief. `deck-facets.ts` model + `applyFacetFilter` **stay**
  (the compact controls reuse them); its test stays.
- **Fold, don't delete**: `card-front.tsx` is no longer a page column; its visual
  pill treatment (axis pills, suit badge) ports into the inspector's `CardSections`
  so no authored content is lost. Delete `card-front.tsx` + its test only after
  its pills are covered by `entity-inspector.test.tsx`.
- **Keep**: `entity-inspector.tsx` (classification vs provenance vs reasoning
  already correct — axes from `ordinal===0`, `primaryType` labelled legacy,
  Mechanism ≠ Concept, Collection/Suit ≠ Locale, evidence 4-level honesty),
  `graph-states.tsx`, `query-params.ts`, `use-graph.ts`, `projection-guards.ts`,
  `cytoscape-graph.tsx` mount, 7-family adapter whitelist.

#### Tests (all existing must pass unchanged)

- `graph-appearance.test.tsx` — the three treatments are predefined and complete
  (every token key present); switcher renders each; switching changes
  `data-treatment` and re-mounts with a fresh stylesheet but **never** changes
  projection-derived text (status vocab, edge counts) — pins presentation-only.
- `graph-stylesheet.test.tsx` (extend) — `buildGraphStylesheet(treatment)`
  preserves the selector-once guarantee and the absence rules (no `relation-*`,
  no status-value selectors); only colours vary across treatments.
- `graph-shell.test.tsx` — composition/order of the seven regions; disclaimer
  text present; controllerstrip renders every catalogue view description;
  status strip reports projection truth (provenance present / not-in-this-view /
  corpus-zero via descriptor `blockingGaps`).
- `entity-inspector.test.tsx` (extend) — axis pills retain `ordinal`-derived
  primary marking; suit badge; legacy `primaryType` keeps its "not an axis"
  labelling after the card-front fold.
- New suites count toward `test:ui`; state of the previous gates (graph 329/0,
  server 19/0, ui 147/0) is reported before/after.

#### Verification

`pnpm run test:ui` → `tsc -b` (no new errors beyond baseline) → `pnpm run build`
→ `pnpm run lint` + biome (no new findings on changed files) → `pnpm run trope-graph:check`
(no drift, no regression) → browser smoke (`pnpm run dev:all`): default view,
argument view, evidence view, refocus both directions, appearance switch across
all three treatments with projection unchanged, empty/data-blocked notes intact,
zero console errors.

#### Open questions (resolve before/during implementation)

1. **Catalogue minimum**: controls render whatever `GET /api/graph/views` emits;
   if the taxonomy view exists it appears automatically. No hard-coding either way.
2. **Nav dead links**: Explorer / Research / Sources have no routes; render inert
   until they exist (default) or link to `/` placeholders.
3. **Token values**: placeholder values now, Figma values when available.

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