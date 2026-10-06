Next Phase Instructions

Accept `3e9300f` / `4ac66d9` as the completed Cytoscape presentation-adapter phase. Do not reopen that implementation unless verification exposes a concrete regression.

Proceed with the next phase of Issue #3: **graph presentation/UI integration and richer entity views**, while preserving the canonical ontology and projection boundaries.

### Objective

Build the first useful presentation layer on top of the now-stable graph stack:

`Postgres/Drizzle → domain projection → optional Graphology analysis → Cytoscape presentation → UI`

The UI must consume the existing domain graph contracts and Cytoscape adapter. It must not become another source of graph semantics.

### Canonical invariants

1. **Postgres/Drizzle remains canonical.**
2. The domain graph projection `{nodes, edges, meta}` remains the semantic contract.
3. Graphology remains an ephemeral analysis layer.
4. Cytoscape remains a presentation layer.
5. `Card` is a projection/access mode, not the ontology's atomic truth.
6. Claims remain distinct semantic units; evidence attaches to claims.
7. Preserve:
   - direct claim relations
   - inference steps
   - argument chains
   - their directional semantics

8. Never flatten inference/argument structure into ordinary Card→Card relationships.
9. Axis remains the four-value many-to-many classification:
   - `TACTIC`
   - `FACT_REBUTTAL`
   - `THEOLOGICAL`
   - `HISTORICAL`

10. Collection/Suit remains mutable convenience curation, not ontology.
11. Locale remains first-class, many-to-many, and independent of Collection.
12. Mechanism and Concept remain independent dimensions.
13. Epistemic status remains independent and must not be rolled up across nodes.
14. `primaryType` remains legacy/content-shape metadata, never an Axis.
15. Do not infer semantic relationships from shared slugs, labels, Collections, Mechanisms, Axis, Locale, or presentation state.
16. Do not solve the type-qualified `GraphNode.id` question in the UI. That remains the open graph-contract follow-up `as-truth-cards-2bq`.

### Scope

Build the minimum useful UI needed to expose the existing graph projections.

At minimum:

1. **Graph view**
   - Consume the existing Cytoscape presentation adapter.
   - Render nodes and directed edges.
   - Use the supplied presentation classes only as styling hooks.
   - Do not duplicate ontology logic in the component.
   - Preserve focus, view, depth, warnings, and projection metadata.

2. **Node/entity inspection**
   - Selecting a node should expose its domain identity and relevant metadata.
   - A Card should expose its classification, Axis assignments, Collection/Suit associations, Locale associations, Mechanisms, Concepts, status, and relevant graph relationships where those already exist in the projection.
   - Claims should remain visibly distinct from Cards.
   - Sources/Evidence, inference steps, and argument-chain elements should remain distinguishable by node type.
   - Do not invent fields merely to make the UI symmetrical.

3. **Projection/view controls**
   - Support the existing `card-argument-taxonomy` and `taxonomy` projections.
   - Expose depth/focus where the current API supports them.
   - Do not hard-code ontology semantics into UI controls.
   - If a projection does not contain a node type, the UI should represent that absence rather than fabricate one.

4. **Graph states**
   - Empty projection.
   - Sparse projection.
   - Projection containing warnings.
   - Focused neighbourhood.
   - Bounded/depth-capped projection.
   - Unsupported/malformed API response should fail visibly and cleanly.

5. **Determinism**
   - Identical domain projection input must result in stable presentation.
   - Avoid client-side mutation of canonical semantic data.
   - Cytoscape interaction may alter presentation state, but must not imply persistence.

### Entity-view boundary

Do not attempt to build a full graph editor.

The initial interaction model should be:

`select node → inspect entity → navigate/expand existing projection`

not:

`select node → edit ontology → persist graph`

No write-back, drag-to-connect, relationship creation, deletion, or ontology editing in this phase.

If navigation to an existing Card/detail surface is useful, reuse the canonical card identity/slug rather than creating a second Card model.

### API/data boundary

Prefer the existing graph API and projection contracts.

Do not introduce a parallel API response format merely because the UI would find it convenient.

If the current projection contract is genuinely insufficient for a required presentation, stop and report the contract gap rather than inventing a UI-specific semantic field.

Presentation-only state may exist in the UI layer, including:

- selected node
- zoom/pan
- collapsed/expanded visual state
- active stylesheet/view mode
- transient interaction state

None of these become ontology state.

### Testing

Add focused UI/presentation tests for:

- projection → rendered graph
- node selection
- correct display of node types
- Card classification
- multi-valued Axis
- multi-valued Locale
- Collection/Suit versus Locale distinction
- Concept versus Mechanism distinction
- epistemic-status source preservation
- directed edges
- inference/argument edges remaining distinct from claim relations
- projection warnings
- empty/sparse graphs
- focus/depth controls
- navigation using canonical identity
- no accidental ontology mutation
- deterministic rendering/state for identical projection input

Do not weaken existing graph, Graphology, or Cytoscape adapter tests.

### Important test-quality requirement

Watch for vacuous tests.

Fixtures must actually contain the relevant node/edge types before asserting their rendering or interaction semantics. In particular, do not repeat the earlier pattern where a default projection depth produced no inference edges and therefore allowed reasoning tests to pass against an empty reasoning layer.

### Styling

Keep styling minimal and semantic:

- node type
- status
- focus
- edge family/relation

Use the classes already supplied by the adapter.

Do not encode ontology semantics into arbitrary visual conventions without documenting the mapping.

No design-system overhaul is required.

### Explicit non-goals

Do NOT:

- redesign the ontology
- add schema/migrations unless a concrete existing-contract defect makes one unavoidable
- add new Claims, Concepts, Sources, Evidence, Cases, Interpretations, or Questions merely to make the UI richer
- infer Concepts or claim relations
- create geopolitical hierarchies
- change Axis values
- change Locale semantics
- turn Collections into ontology
- revive `public.cards` or Prisma as canonical
- add graph persistence
- add graph editing/write-back
- modify deployment/auth
- solve type-qualified GraphNode IDs in the presentation layer
- introduce Graphology logic into React/UI components
- replace the domain projection with Cytoscape-specific semantic structures

### Verification

Before reporting completion:

- run `pnpm run trope-graph:check`
- run graph projection tests
- run Graphology tests
- run Cytoscape adapter tests
- run all new UI/presentation tests
- run root typecheck
- run build
- verify seed/idempotence remains clean
- confirm no ontology counts changed unexpectedly
- confirm no new semantic edges/entities were fabricated

Report:

1. exact files changed
2. UI/view architecture
3. exact data flow from projection to UI
4. which existing graph contracts were consumed
5. tests added and total test counts
6. verification results
7. any genuine projection/API contract gaps
8. any remaining limitations

**Do not close Issue #3 yet.**

If the current domain projection/API cannot support a requested UI feature without inventing semantics, stop at that boundary and report the precise contract decision required instead of solving it implicitly in the UI.
