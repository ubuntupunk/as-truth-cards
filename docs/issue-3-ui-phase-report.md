# Issue #3 — Graph presentation/UI phase completion report

Status: **implemented; Issue #3 intentionally left open** (per `INSTRUCTION.md` §Verification).

## 1. Exact files changed

**New (client graph subsystem):**
- `src/graph/query-params.ts` — URL ↔ `GraphParams` (`focus`/`view`/`depth`) parse/serialize, depth clamp, `depthOptions`.
- `src/graph/projection-guards.ts` — structured validation (`assertGraphProjection`, `assertGraphViewsResponse`, `ProjectionShapeError`, `GraphViewDescriptor`, `GraphViewsResponse`).
- `src/graph/graph-stylesheet.ts` — `GRAPH_STYLESHEET`, `NODE_TYPE_COLORS` (12), `EDGE_FAMILY_COLORS` (5), `STATUS_BORDER_STYLES` (5).
- `src/graph/use-graph.ts` — `fetchValidated`, `GraphApiError`, `graphProjectionQueryOptions` (extracted so the enabled-gating rule is unit-testable), `graphProjectionQueryKey`, `useGraphViews`, `useGraphProjection`.
- `src/graph/graph-states.tsx` — every screen state (`NoFocusState`, `LoadingState`, `ApiErrorState`, `MalformedState`, `EmptyProjectionState`), `ProjectionNotices` + `WarningsBanner`/`TruncatedBanner`/`DepthBoundedBanner`/`SparseNotice`, `ViewsStatus`, inline SVG status icons (no lucide import, so the Node test runner never sees real React).
- `src/graph/entity-inspector.tsx` — semantic side panel: node/edge details with status-vocabulary tags, ordered axes, incident relationships, Open-card navigation.
- `src/graph/cytoscape-graph.tsx` — thin Cytoscape mount: `layoutOptionsFor`, `applySelectionState`, `CytoscapeGraph` (tap node/edge/background; selection via refs so the canvas never rebuilds on selection change; destroy on cleanup).
- `src/graph/test-fixtures.ts` — wire-shaped validation fixtures: all 12 node types, `south-africa` kept split between Suit and Locale by id, both `SUPPORTS` families distinct, truncation/empty/sparse/view-catalogue variants.

**New tests:** `src/graph/{query-params, projection-guards, graph-stylesheet, use-graph, entity-inspector, graph-states, cytoscape-graph}.test.tsx` (7 suites).

**New page:** `src/pages/Graph.tsx`.

**Edited:**
- `src/App.tsx` — `/graph` route.
- `src/components/Header.tsx` — Graph nav entry.
- `package.json` / `pnpm-lock.yaml` — `cytoscape@^3.34.3`, `preact-render-to-string@^6.8.0`, `test:ui` script.
- `INSTRUCTION.md` — superseded by the UI-phase brief (prior session).
- `trope-cards/src/graph/views.ts` — corrected `taxonomy.focusTypes` (was `card_axes`, is `card`).
- `trope-cards/test/graph-query.test.ts` — pins `taxonomy.focusTypes`.
- `trope-cards/docs/GRAPH_PROJECTION_DESIGN.md` — doctrine row for the correction.

## 2. UI/view architecture

Three layers, one-way data flow:

```
URL            rules                presentation
─────────────  ───────────────────  ─────────────────────────────
query-params   projection-guards    graph-states (screens + banners)
               use-graph (TanStack) entity-inspector (semantic panel)
                                   cytoscape-graph (thin mount, only consumer
                                     of CytoscapePresentation)
```

`Graph.tsx` is orchestration only — it computes no graph semantics itself. Selection is **presentation state** and never enters the projection. The inspector resolves selection by canonical id against the domain `GraphProjection` (guard-tested `findNodeById`/`findEdgeById`), never against Cytoscape internals.

## 3. Exact data flow projection → UI

`useSearchParams` → `parseGraphParams` → `fetchValidated('/api/graph', assertGraphProjection)` → validated `GraphProjection` → `toCytoscapePresentation` (adapter, unchanged) → `CytoscapeGraph`. A canvas tap yields `{kind, id}` → `findNodeById`/`findEdgeById` → `EntityInspector` renders the domain node/edge verbatim (family, relation word, attributes, status + its `source` vocabulary tag). Malformed-for-Cytoscape output lands in `MalformedState` with the adapter error's message, not a crash.

## 4. Graph contracts consumed

- `GraphProjection` (`trope-cards/src/graph/types.ts`) — passed through unchanged.
- `toCytoscapePresentation` / `CytoscapeAdapterError` / `CytoscapePresentation` (`cytoscape-adapter.ts`).
- `views.ts`: `DEFAULT_VIEW_NAME`, `DEFAULT_DEPTH`, `HARD_MAX_DEPTH`, `GRAPH_VIEWS` descriptors (the client only uses these for defaults and legend filtering — the server owns all defaults).
- `parseGraphQuery`/`describeViews` reply shapes and `GRAPH_PROJECTION_DESIGN.md` §5.3 status codes (400/404/413 → `ApiErrorState`; 200 empty → `EmptyProjectionState`).
- Edge vocabulary comes from `family` + `type.value` + `attributes` in the projection; the server's `buildEdgeId` format is assumed by the inspector's lookup keys.

The single hard client-side semantic rule — axis `primary` is `ordinal 0` — is read from the projection's own metadata. The legacy `type` field renders as a legacy field ("not an axis"), never as semantics. **No UI-specific semantic field was invented.**

## 5. Tests added and total counts

- New UI suites: 7 (93 tests) under `src/graph/*.test.tsx`, Node test runner + `tsx` + `preact-render-to-string`. Includes JSON round-trip vacuous guards over every fixture (these caught a real product bug: `assertGraphProjection` ran `asString` on the focus *object*, which would have rejected every projection).
- Totals: **UI 93 · server 19 · graph 350 (66 suites)**.

## 6. Verification results

| Gate | Result |
| --- | --- |
| `pnpm run trope-graph:check` | **350 pass / 0 fail**, schema drift **false** (402 facts compared) |
| `pnpm run test:server` | 19 pass / 0 fail |
| `pnpm run test:ui` | 93 pass / 0 fail |
| `tsc -b` | New code clean; only the 10 pre-existing `src/components/` baseline errors remain (tracked `as-truth-cards-g66`) |
| `pnpm run build` | Passes |
| `pnpm run lint` | 17 err / 5 warn, all pre-existing baseline; **0 in new files** |
| biome check new files | Clean |
| Manual browser smoke (12 cases) | No focus state; slug focus; uuid focus; depth 0/1/3 (render matches API counts); depth-select interaction; view catalogue w/ status suffixes; `view=evidence` → 404 state; invalid focus → 404; `depth=10` → 413 state; card→card focus via uuid (Open-card path); `view=taxonomy` smaller projection; focus form fill+submit syncs URL |

No ontology counts changed unexpectedly; no semantic edges/entities fabricated (drift + graph suite confirm).

## 7. Genuine projection/API contract gaps

None required inventing UI semantics. Two honest observations (not blockers):

1. Neighbor `card` nodes inside a projection carry no `slug`, so Open-card navigates by **uuid** — the route resolves uuids, verified live.
2. With the current 47-card corpus no projection exceeds `maxNodes = 200` (deepest observed: 33 nodes), so the **truncated** banner is verified by fixture (`TRUNCATED_PROJECTION`), not by live data.

## 8. Remaining limitations

- Canvas node-click selection is not automatable in the smoke run (the Cytoscape instance is not exposed); the tap surface and inspector copy are covered by the `preact-render-to-string` suites instead.
- `CytoscapeGraph` mount + `applySelectionState` remain untested under Node by design (thin mount; the plan treats the canvas as untestable here).
- Truncation/warnings/empty UI states are exercised through fixtures; live truncation is not reachable in the current corpus (see §7.2).
- The 10 pre-existing `src/components/` type errors are tracked separately (`as-truth-cards-g66`) and untouched.
- Deferred (already filed): card discovery landing page (`as-truth-cards-572`), type-qualified focus ids (`as-truth-cards-2bq`), `include`/relationship controls, mechanism/Collection focus mode.