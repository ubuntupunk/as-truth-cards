# Plan — Issue #3 Next Phase: Graph Presentation/UI Layer

**Status:** awaiting Architect review
**Repo:** `ubuntupunk/as-truth-cards`, `main` @ `3e9300f` (working tree clean apart from this plan and the pending adapter report)
**Governing spec:** `INSTRUCTION.md` (210 lines, updated for this phase)
**Prior phase accepted:** Cytoscape presentation adapter `4ac66d9` / `3e9300f` — not reopened

---

## 1. Objective

Build the first useful presentation layer over the stable graph stack, without letting the UI become a second source of graph semantics:

```
Postgres/Drizzle → domain projection → (Graphology, optional) → Cytoscape presentation → UI
```

Scope from `INSTRUCTION.md`: graph view, node/entity inspection, projection/view controls, graph states, determinism. Interaction model is **select node → inspect entity → navigate/expand existing projection**. No write-back, no editing, no ontology changes. **Issue #3 stays open.**

---

## 2. Research findings (all verified empirically this session)

### 2.1 Verified working baseline

| Check | Result |
|---|---|
| `trope-graph:check` vs local `trope_cards_dev` | **349 tests / 66 suites / 0 fail**, `check-drift → drift:false, comparedFacts:402`, seed verify clean |
| Server tests (`test:server`) | 19 pass |
| Graph suite (`trope-graph:test`) | 15 test files, pass |
| `card-argument-taxonomy` focus=card depth=1 | 10 nodes / 9 edges (types: card, claim, collection, mechanism; families: classification, domain, card_relationship) |
| `card-argument-taxonomy` focus=card depth=3 | 33 nodes / 48 edges (adds inference_step; families add inference, claim_relation) — **inference layer is non-empty at depth 3** |
| `taxonomy` focus=card depth=1 | 5 nodes / 4 edges (card, collection, mechanism, concept; family: classification only) |
| depth=0 | 1 node, 0 edges (focus only) |
| `maxNodes=3` | `truncated: true` — bounded-projection state is producible |
| Card nodes carry `metadata.slug` | yes → in-projection card→card navigation via canonical identity works |

### 2.2 Runtime/API facts

- **Endpoints:** `GET /api/graph?focus&view&depth&maxNodes[&include&relationship]` and `GET /api/graph/views`, mounted at `/api/graph` (`server/index.ts:47`). Vite dev proxies `/api` → `:3001`.
- **Status policy:** `400`/`413` → `{error}` (`GraphQueryError`); `404` → `{error, detail}` (`GraphFocusNotFoundError`); `500` → `{error, detail}`; valid-but-empty projection → `200` with `nodes: []` + `meta.warnings`.
- **View descriptors** (`/api/graph/views`) give: `name`, `status` (`implemented` | `designed` | `data_blocked`), `focusTypes`, `nodeTypes`, `edgeFamilies`, `maxDepth`, `populated`, `blockingGaps`. This is the correct source for building controls without hard-coding ontology semantics.
- **Legacy `/api/cards` is dead here:** `public.cards` does not exist in the local DB; Prisma `public.cards` and `trope_graph.cards` (47 rows) are unrelated tables with no join. Non-goal says do not revive it.

### 2.3 Frontend architecture

- **Preact 10.29** under React-compat: `vite.config.ts` aliases `react`/`react-dom`/`react/jsx-runtime` → `preact/compat` / `preact/jsx-runtime`; `tsconfig.app.json` has `jsx: react-jsx`, `jsxImportSource: preact`, `include: ["src"]`, `strict: false`.
- Routes in `src/App.tsx`: `/`, `/about`, `/admin`, `*`. Nav lives in `src/components/Header.tsx`.
- Data fetching convention: TanStack Query (`src/pages/Admin.tsx` uses `useQuery` + `fetch`).
- `cytoscape` is currently a **devDependency** (`^3.34.3`); the adapter only does `import type` from it, so nothing runtime-imports it yet. The UI will — must be promoted to `dependencies`.
- **No Graphology or cytoscape import exists anywhere in `src/` today.** Good starting boundary.

### 2.4 Test infrastructure (does not exist — decision made)

- There is no vitest/playwright/testing-library config anywhere in the repo.
- **Decision (user-approved): node:test + tsx + `preact-render-to-string`**, reusing the repo's existing runner.
- **Critical empirical finding:** JSX under `node --import tsx` needs `TSX_TSCONFIG_PATH=./tsconfig.app.json`. The root `tsconfig.json` is solution-style (`files: []`, no `jsx`), so without the env var the probe failed with `React is not defined`; with the env var, both JSX compilation **and** the `@/` path alias resolved (probe: 1/1 pass).
- `preact-render-to-string@6.8.0` is available on npm (not yet installed).
- Known repo gap (out of scope, separate commit if ever): `biome.json` `files.includes` covers `trope-cards/src/**` but **not** `trope-cards/test/**` — why the adapter test shipped without a trailing newline.
- Known repo gap: `pnpm run typecheck` (`tsc --noEmit`) is effectively a no-op (0 files); the real gate is `tsc -b` (`typecheck:all`) which has ~10 pre-existing errors tracked in `as-truth-cards-g66`.

---

## 3. Contract gaps — report, do not solve in the UI

Both are pre-existing API/projection gaps. Per `INSTRUCTION.md`: *"stop and report the contract gap rather than inventing a UI-specific semantic field."*

### Gap 1 — No first-focus discovery (tracked: `as-truth-cards-572`)

- `focus` is **required** (400 without it), addressed by `trope_graph` card slug or uuid.
- **No endpoint lists any `trope_graph` card slug.** `/api/cards` serves an unrelated, locally non-existent table. The reader port has no list method.
- **Consequence:** the UI cannot bootstrap a graph without the user already knowing a slug.
- **Decision (user-approved): manual + URL focus.** Focus comes from `?focus=<slug>` URL param and a free-text input. Once one projection is loaded, card→card navigation reuses `metadata.slug` from card nodes already in the projection (canonical identity, per Q7). The missing listing endpoint is **reported as a contract gap**, not built here.

### Gap 2 — `taxonomy` view descriptor over-promises focus types

- Descriptor says `focusTypes: ['card','mechanism','collection']`, but `projection.ts` always calls `findCardByRef`, so mechanism/collection focus is unreachable: verified `focus=delegitimization` and `focus=classic` both 404 (`no card matches this slug`).
- **Consequence:** the UI must not offer focus-type options derived from `focusTypes`.
- **Decision:** focus input is **free-text** (slug or uuid); API error `detail` is surfaced verbatim. Gap reported.

### Explicitly deferred (not this phase)

- Type-qualified `GraphNode.id` → `as-truth-cards-2bq`.
- Card listing endpoint → `as-truth-cards-572`.

---

## 4. Proposed architecture

### 4.1 Data flow

```
URL ?focus=&view=&depth=
   │  query-params.ts (pure parse/serialize, clamp depth to descriptor maxDepth)
   ▼
TanStack Query ── GET /api/graph/views  (view descriptors → controls, legend)
             └─── GET /api/graph        (GraphProjection — unchanged contract)
   ▼
projection-guards.ts   shape check only (presence of focus/nodes/edges/meta)
   ▼                                    — invents no fields; malformed → visible error
toCytoscapePresentation(projection)     (existing adapter — unchanged, not reopened)
   ▼
cytoscape core  (presentation state ONLY: select / zoom / pan / classes as styling hooks)
   ▼
entity-inspector reads projection.nodes/edges by selectedId — NOT from cytoscape
```

Key boundary: **the inspector derives from the projection, not from Cytoscape.** Cytoscape holds no data the UI treats as semantic truth; selection is presentation state keyed by canonical node id.

### 4.2 Files (all new except the two marked)

| File | Purpose |
|---|---|
| `src/graph/query-params.ts` | Pure URL ⇄ `{focus, view, depth}`; clamps to descriptor `maxDepth` |
| `src/graph/projection-guards.ts` | Runtime shape check of API response; malformed/unsupported → clean visible failure |
| `src/graph/use-graph.ts` | TanStack Query hooks for `/api/graph` + `/api/graph/views` (mirrors `Admin.tsx` fetch style) |
| `src/graph/entity-inspector.tsx` | Discriminated on `node.type`: card (classification, axes w/ `ordinal===0` primary, suits vs locales via `suitIds`/`localeIds`, mechanisms, concepts, status), claim distinct from card, inference_step / argument_chain distinguishable, edge detail (`family` + `relation` + `sourceTable` + authored direction). `legacyPrimaryType` shown **labelled legacy, never as Axis** |
| `src/graph/graph-stylesheet.ts` | Adapter classes → cytoscape stylesheet; **mapping table documented in docstring** (satisfies "document the mapping") |
| `src/graph/graph-states.tsx` | empty / sparse / warnings banner (`meta.warnings`) / truncated + `reachedDepth` / no-focus prompt / malformed-response error |
| `src/graph/cytoscape-graph.tsx` | Mounts core into ref; `tap` → sets `selectedId`; rebuild on presentation change; destroy on unmount. No Graphology, no semantic writes |
| `src/pages/Graph.tsx` | Page: controls (view select from descriptor, depth, free-text focus), legend from `nodeTypes`, graph, inspector |
| `src/App.tsx` *(edit)* | Add `/graph` route above catch-all |
| `src/components/Header.tsx` *(edit)* | Add `Graph` nav link |
| `src/graph/*.test.tsx` | New tests (§5) |

### 4.3 Controls (no hard-coded ontology)

- **View select:** options + labels + status badges come from `/api/graph/views` descriptors (name, `status`, `populated`, `blockingGaps`).
- **Depth:** 0..`maxDepth` from the selected descriptor; clamped in `query-params.ts`.
- **Focus:** free-text (slug/uuid) + `?focus=` URL param. Because of Gaps 1–2, no focus-type picker and no hardcoded default slug.
- `include` / `relationship` filters: **not built** — scope requires only depth/focus, and `relationship` values aren't derivable from descriptors (families aren't valid API values without a relation word). Building them would force hard-coded semantics.

### 4.4 Styling

Minimal and semantic only: node type, status, focus, edge family/relation — exactly the classes the adapter supplies (`type-*`, `status-*`, `is-focus`, `family-*`, `relation-*`, `traversal-*`). Mapping documented in `graph-stylesheet.ts`. No design-system overhaul.

---

## 5. Tests

Runner: `node --import tsx --test` with `TSX_TSCONFIG_PATH=./tsconfig.app.json`.

New script (wired into `pnpm test`):

```json
"test:ui": "TSX_TSCONFIG_PATH=./tsconfig.app.json node --import tsx --test \"src/**/*.test.tsx\""
```

Deps: `preact-render-to-string` (dev), `cytoscape` promoted to `dependencies`. No test framework migration.

Fixtures: one helper building hand-authored `GraphProjection` objects.

**Vacuous-test guard (explicit `INSTRUCTION.md` requirement):** the fixture helper *asserts its own contents* before any test runs — e.g. `assert(fix.edges.some(e => e.family === 'inference'))` on the depth-3 fixture, `assert(fix.axes.length >= 2)`, `assert(suit south-africa ∖ locale south-africa present)` — so no reasoning/classification test can pass against an empty layer.

Coverage mapped to the INSTRUCTION test list:

| Requirement | Test |
|---|---|
| projection → rendered graph | fixture → adapter → elements; stylesheet built from returned classes |
| node selection | pure `selectedId` derivation + inspector output for card / claim / inference_step |
| node types rendered | every fixture node type appears; legend covers them |
| claims visibly distinct from cards | different inspector rendering + `type-claim` vs `type-card` classes |
| Card classification | axes + suits + locales + mechanisms + concepts sections |
| multi-valued Axis | fixture with ≥2 axes; primary = `ordinal===0`, asserted |
| multi-valued Locale | fixture with ≥2 locales |
| Suit ≠ Locale | shared `south-africa` slug in **both** lists, asserted via `suitIds` vs `localeIds` |
| Concept ≠ Mechanism | separate sections, non-interchangeable |
| epistemic status source preservation | `epistemic_status` vs `inference_independent_status` vs `none` shown with source tag, never rolled up |
| directed edges | `source`/`target` from `data`, arrow style keyed on classes |
| inference vs claim_relation distinct | `family-inference` vs `family-claim_relation` → distinct style rules, asserted |
| warnings / empty / sparse / depth-cap | state components driven by `meta` (`truncated`, `warnings`, `nodeCount`) |
| focus/depth controls | parse/serialize/clamp + control rendering from mock descriptor |
| navigation via canonical identity | card-node action emits `?focus=<metadata.slug>` |
| no accidental ontology mutation | projection deep-frozen (or clone-before/after deep-equal) through render |
| deterministic rendering | two renders byte-identical; adapter output deep-equal twice |

Not testable in Node without a DOM shim: the cytoscape mount component itself. Mitigation: all logic around it (guards, params, stylesheet derivation, inspector, states) is extracted pure and covered; the mount component stays thin.

**Existing tests are not weakened.**

---

## 6. Verification (before any completion report)

```bash
TROPE_GRAPH_DATABASE_URL="postgresql://ubuntupunk@localhost/trope_cards_dev" pnpm run trope-graph:check
#   → baseline 349 tests, drift:false, verify-seed clean  (covers seed/idempotence + ontology counts)

pnpm run test:server        # baseline 19
pnpm run test:ui            # new, 0 → N
pnpm run typecheck          # root gate as-is
tsc -b                      # capture pre-existing error baseline first (bead as-truth-cards-g66)
pnpm run build              # confirm cytoscape now present in dist bundle (was absent before)
pnpm run lint                # baseline 17 errors / 5 warnings, untouched files only
```

Manual smoke (dev): `/graph` with no focus (prompt), with a known slug (renders), depth 0/1/3, view switch to `taxonomy`, `maxNodes` bound (truncated banner), malformed query (clean visible error).

---

## 7. Explicit non-goals (from INSTRUCTION.md)

No ontology redesign · no schema/migrations · no new Claims/Concepts/Sources/Evidence/Cases/Interpretations/Questions · no Concept or claim-relation inference · no geopolitical hierarchy · no Axis/Locale/Collection semantic change · no `public.cards`/Prisma revival · no persistence/editing/write-back · no deployment/auth changes · no type-qualified `GraphNode.id` (stays `as-truth-cards-2bq`) · no Graphology in React components · no Cytoscape-specific semantic structures replacing the domain projection.

---

## 8. Deliverable report (end of phase, 8 items per INSTRUCTION.md)

1. Exact files changed
2. UI/view architecture
3. Exact projection → UI data flow
4. Existing graph contracts consumed (`GraphProjection`, `GraphProjectionMeta`, `CytoscapePresentation`, `/api/graph`, `/api/graph/views`)
5. Tests added + total counts (baseline 349 + 19, UI 0 → N)
6. Verification results
7. **Genuine contract gaps** (§3: focus discovery; taxonomy focusTypes over-promise)
8. Remaining limitations (no focus discovery; cytoscape mount untested in Node; selection tested as pure state)

**Do not close Issue #3.**

---

## 9. Decisions requested from the Architect

1. **Accept manual/URL focus** (§3 Gap 1) as the phase's answer to focus bootstrap, deferring a card-listing endpoint to `as-truth-cards-572` — or require the listing endpoint in-phase?
2. **Accept free-text focus** (§3 Gap 2) rather than deriving focus-type options from the (incorrect) descriptor — or fix the descriptor's `focusTypes` first as a small API correction?
3. **Accept the test approach** (node:test + tsx + `preact-render-to-string`, `TSX_TSCONFIG_PATH`) over introducing vitest/@testing-library?
4. **Confirm scope of controls**: view + depth + focus only, deferring `include`/`relationship` filters (not derivable from descriptors without hard-coding)?
5. **Confirm `cytoscape` promotion** from `devDependencies` → `dependencies` is acceptable for the bundle.
