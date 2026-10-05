# ADR: Graph Layer Architecture

**Status:** Accepted  
**Date:** 2026-09-30  
**Scope:** `trope-cards/` graph integration with the Vite + Express host  
**Decision owners:** Project architecture / ontology maintainers

## 1. Decision

The project will keep **PostgreSQL + Drizzle + the existing `trope_graph` ontology as the canonical knowledge layer**.

Graph computation and graph visualization will be implemented as separate projections:

```
PostgreSQL / Drizzle
        ↓
Domain graph query / projection
        ↓
Graphology (ephemeral computation)
        ↓
API projection
        ↓
Cytoscape.js (interactive visualization)
```

Graphology and Cytoscape.js are implementation technologies for graph analysis and presentation. **Neither defines the domain ontology or becomes a second source of truth.**

## 2. Context

The team has proposed a Graphology + Cytoscape.js hybrid for shortest-path analysis, centrality, connected components, clustering, hierarchical layouts, and interactive graph exploration.

That proposal is useful at the graph-engine layer, but its proposed domain model (`Trope`, `TruthCard`, `trope_edge`) is narrower than the existing knowledge graph.

The existing `trope_graph` subsystem already models:

- Cards
- Claims
- Sources
- Evidence
- Cases
- Concepts
- Interpretations
- Questions
- Relationships
- Inference steps
- Argument chains
- Mechanisms
- Collections / Suits
- Axis classification
- Research and contribution metadata

The graph therefore represents not merely a network of tropes, but the **claims, evidence, inferences, provenance, classifications, and relationships through which the research corpus is constructed**.

Creating a second `trope` / `truth_card` ontology would duplicate semantics and eventually create conflicting sources of truth.

## 3. Canonical layers

### 3.1 Knowledge layer — persistent

PostgreSQL, accessed through Drizzle, is canonical.

The existing `trope_graph` schema remains the domain model.

Important distinctions must remain intact:

```
Card ≠ Claim
Claim ≠ Evidence
Evidence ≠ Source
Claim ≠ Interpretation
Inference ≠ Claim
Classification ≠ Truth
```

A Card is an editorial/research entry point and presentation projection, not the atomic unit of truth.

### 3.2 Computation layer — ephemeral

Graphology may be used to construct an in-memory graph from a deliberately selected Postgres subgraph.

Suitable responsibilities include:

- shortest-path analysis
- breadth/depth traversal
- connected components
- centrality
- clustering/community analysis
- relationship traversal
- argument-chain traversal
- derived graph metrics

Computed metrics are derived data unless a later decision explicitly promotes a particular metric to persisted research metadata.

Graphology objects must not be persisted as the domain model.

Graphology is the **only** place traversal, reachability, components, centrality and other graph
algorithms are implemented. A presentation library must not reimplement them for rendering; it may
consume Graphology-derived values, but only as explicitly derived metadata, never as canonical
facts.

### 3.3 Presentation layer — UI

Cytoscape.js is the initial candidate for interactive graph presentation.

It may provide:

- pan / zoom
- node and edge styling
- hierarchical and force-directed layouts
- filtering
- highlighting
- selection
- parent/compound visual grouping
- interaction between graph nodes and Card/Claim/Source views

Cytoscape element shapes and styling are presentation concerns and must not become ontology semantics.

The boundary, now that both adapters exist, is that each downstream layer consumes exactly one
thing — the domain projection `{nodes, edges, meta}` from `types.ts` — and reads no database:

```
Postgres / Drizzle
   → projection (which nodes and edges a view + focus + depth may see)   ← the only authority
   → Graphology (analysis, optional, ephemeral)
   → Cytoscape (presentation, ephemeral)
```

Neither downstream layer may widen what the projection emitted, infer a relation that was not
authored, collapse two edge vocabularies into one relation word, or persist anything.

**Mutations made in a Cytoscape view are not persisted.** There is no write-back path, by design.
A view renders a depth-bounded, filtered slice, so an edit made there is an edit asserted *in a
projection*, not a statement about the ontology; promoting one would require deciding which view
made the claim and with what authority. Layout, styling and interaction are the presentation
layer's business; persistence is not.

## 4. API boundary

The host application should expose a domain-level graph API through the existing Express application.

The preferred flow is:

```
React / Vite UI
    ↓
typed domain API
    ↓
graph query / projection
    ↓
Drizzle
    ↓
PostgreSQL
```

Where graph analysis is required:

```
PostgreSQL
    ↓
selected domain subgraph
    ↓
Graphology
    ↓
analysis result
    ↓
domain API response
```

The API should return domain concepts and relationships, not Graphology-specific or Cytoscape-specific objects.

A frontend should therefore never need to know whether a backend traversal used Graphology, recursive SQL, or another implementation.

## 5. Relationship semantics

The proposed simple `TruthCard → Trope` relationship model is not canonical.

In particular, relationships such as `DEBUNKS` should not be used to imply that a Card itself establishes a truth judgment.

Where appropriate, the canonical graph should represent:

```
Source
  ↓
Evidence
  ↓
Claim
  ↓
Inference
  ↓
Claim
```

with explicit relations such as:

- SUPPORTS
- CHALLENGES
- QUALIFIES
- CONTRADICTS
- CONTEXTUALISES
- EXEMPLIFIES
- REQUIRES
- GENERALISES
- EQUATES
- ANACHRONISTICALLY_MAPS
- RETROSPECTIVELY_IDENTIFIES

The graph UI may present a simplified view such as “evidence supporting this claim” or “claims challenging this claim”, but those labels must be projections of canonical relationships.

## 6. Graph projections

The same canonical graph should support multiple graph views rather than forcing the entire ontology into one visual network.

Examples:

### Trope / taxonomy view

```
Mechanism / Concept
       ↓
     Claims
       ↓
     Cards
```

### Argument view

```
Premise → Inference → Conclusion
```

### Evidence view

```
Claim → Evidence → Source
```

### Identity-retrojection view

```
Historical subject
       ↓
historical evidence
       ↓
continuity claim
       ↓
modern identity
       ↓
retrospective mapping
```

The graph API should therefore support a projection/focus/depth vocabulary rather than assuming one universal `trope_edge` network.

## 7. Classification remains ontology-level

Suit/Collection, Axis, Mechanism, Locale, and Concept remain separate classification dimensions.

In particular:

- Axis must not be derived from legacy `primaryType`.
- Multi-valued Axis assignments must be preserved.
- Suits are browse/collection dimensions.
- Mechanisms and Concepts are analytical dimensions.
- Locale is intrinsic geographic/social context and is many-to-many (a card may be set in more than one locale).
- **Locale must not be inferred from Suit or Collection.** A Suit is a mutable curation bucket; membership in a `south-africa` collection does not make a card a South Africa card. Locale is read from `card_locales` alone, and a card with no locale rows reports none.
- **`collections` and `locales` may share a slug, and that is intentional.** `south-africa` names both, because a suite curated from a locale should carry the locale's name. Disambiguation is therefore at the boundary, not in the slug: every classification dimension reports slugs *and* ids as parallel pairs, so consumers resolve by id; and any future filter must take a dimension-qualified parameter name (`locale=` never reuses a suit parameter). A slug is for display, not for action.
- Graph libraries may use these values for filtering or styling, but must not redefine them.

This remains governed by the separate Suit/Axis ontology work.

## 8. Technology choices

### Adopt

- PostgreSQL
- Drizzle
- Existing `trope_graph` migrations and schema
- Graphology `0.26.0` for server-side/in-memory graph computation (pinned; added with the §9 step 4 adapter)
- Cytoscape.js `^3.34.3` for the initial interactive graph UI (added with the §9 step 6 adapter; a **devDependency** while the adapter imports only its types — promote it when UI code imports the runtime)
- Existing Vite + Express host during integration

### Do not introduce

- A second Prisma-based graph schema
- A parallel `trope` / `truth_card` ontology
- A graph database solely to support traversal
- A frontend-to-Drizzle direct data path
- Graphology or Cytoscape objects as persistent domain data

A future change of visualization library should not require an ontology or API rewrite.

## 9. Implementation sequence

1. Resolve the existing ontology and integration questions first.
2. Keep Issue #2 focused on Suit/Axis restoration.
3. Expose a read-only domain graph projection from Express.
4. ~~Build a Graphology adapter over that projection.~~ **Done.** `src/graph/graphology-adapter.ts`
   and `src/graph/analysis.ts`. The adapter is the projection's only input and never queries the
   database; the graph is multi-directed because `relationships` permits parallel endpoint pairs;
   `traversal` stays separate from authored direction; and the per-node status `source` tag is
   copied so the union cannot be collapsed into a graph-wide status (Q4).
5. Add graph algorithms behind the API. **Partially done:** bounded traversal/reachability, degree
   and connected components. Centrality, shortest path and clustering are deliberately held back —
   on the seeded ontology they would measure the projection's depth cap rather than the corpus.
6. ~~Add Cytoscape as a lazy-loaded graph view.~~ **Adapter done.** `src/graph/cytoscape-adapter.ts`
   converts a projection to `ElementDefinition[]` plus a `context` bag, deterministically, with no
   database access and no `cytoscape.Core` instantiated. It copies ids, direction, `family`,
   `relation`, `sourceTable`, `traversal` and per-node `status`/`classification`/`metadata`
   unchanged, and derives only stylesheet `classes`. It deliberately does **not** resolve the
   open type-qualified `GraphNode` id question; it refuses id collisions instead, because
   Cytoscape silently merges duplicate ids and silently discards an edge whose id matches a node
   id. The UI itself (layout, stylesheet, lazy-loading) remains.
7. Connect Card, Claim, Source, Evidence, and Argument views to graph selections.
8. Add richer graph projections as the corpus becomes populated.
9. Consider persisted derived metrics only when there is a demonstrated product need.
10. Introduce write/edit graph workflows only after authentication and authorization are in place.

## 10. Non-goals

This decision does **not**:

- migrate the frontend framework;
- replace Preact with React immediately;
- replace Express with another server framework;
- replace Neon;
- redesign the ontology;
- populate the outstanding claim/evidence corpus;
- introduce collaborative editing;
- introduce a graph database.

Those may be separate architecture decisions.

## 11. Consequences

### Positive

- One canonical ontology.
- Graph algorithms can evolve independently of persistence.
- Visualization can be replaced without rewriting domain storage.
- The same research graph can support multiple UI projections.
- The architecture preserves claim/evidence/inference provenance.
- Graph analysis can be added without prematurely adopting a graph database.

### Negative

- The graph API needs explicit projection logic.
- Some apparently simple UI relationships require domain-aware queries.
- The backend must maintain an adapter between relational data and in-memory graph structures.
- More than one graph representation exists at runtime, although only one is canonical.

## 12. Guardrail

**If a proposed graph feature requires adding a new domain entity or relationship solely because Graphology or Cytoscape expects it, stop and review the ontology first.**

The graph engine serves the knowledge model; the knowledge model does not serve the graph engine.
