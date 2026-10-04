## Task: Design the First Domain Graph Projection

We have now established the graph-layer architecture in:

`trope-cards/docs/ADR_GRAPH_LAYER.md`

and created GitHub Issue #3:

**Implement graph analysis and visualization as projections of the canonical ontology**

Your immediate task is **discovery and design only**.

Do **not** begin implementing Graphology, Cytoscape, a new graph schema, or a frontend rewrite yet.

### Architectural constraints

Treat these as non-negotiable:

1. PostgreSQL + Drizzle + the existing `trope_graph` schema are the canonical knowledge model.
2. The existing ontology is authoritative. Do not create a parallel:
   - `Trope`
   - `TruthCard`
   - `trope_edge`
     ontology.

3. Card is a presentation/research entry point, not the atomic unit of truth.
4. Preserve the distinction between:
   - Card
   - Claim
   - Evidence
   - Source
   - Inference
   - Interpretation
   - Case
   - Concept
   - Mechanism
   - Axis
   - Suit/Collection
   - Question
   - Relationship
   - Argument chain

5. Graphology, when introduced later, will be an **ephemeral computational projection**.
6. Cytoscape, when introduced later, will be a **visualization projection**.
7. The API must expose domain-level graph data rather than Graphology- or Cytoscape-specific structures.
8. Do not use a graph database.
9. Do not reintroduce Prisma for the graph subsystem.
10. Do not turn this into a React/Preact, Express, Neon, authentication, or general framework migration.
11. Issue #2 remains separately responsible for first-class Suit/Axis restoration.

### Read these first

Before proposing anything, inspect the current repository and specifically:

- `trope-cards/docs/ADR_GRAPH_LAYER.md`
- `trope-cards/docs/TROPE_GRAPH_SCHEMA.md`
- `trope-cards/docs/CLAIM_DECOMPOSITION_ENGINE.md`
- `trope-cards/docs/ARGUMENT_CHAIN_ENGINE.md`
- `trope-cards/docs/EVIDENCE_LAYER.md`
- `trope-cards/docs/IDENTITY_RETROJECTION_CLUSTER.md`
- current Drizzle schema
- current migrations
- current graph seed data
- current validators
- current seed verification
- existing graph-related code/API routes, if any
- existing host Express/API structure

Also inspect Issue #2 and Issue #3 for current architectural intent.

### Questions to answer

Produce a design report answering these questions.

#### 1. What is the actual current graph?

Describe the entities and relationships that already exist in `trope_graph`.

Do not describe an imagined future graph.

Identify:

- tables
- relevant foreign keys
- enums
- relationship tables
- inference/argument structures
- classification structures
- evidence/source structures
- anything currently missing or incomplete

#### 2. What should the first graph projection contain?

Propose the **smallest useful domain graph projection** that can support an initial graph view.

For example, consider whether the first projection should contain:

```text
Card
Claim
Concept
Mechanism
Source
Evidence
Inference
Relationship
```

But make this decision from the actual schema rather than assuming these all belong in v1.

Explain:

- node types
- edge types
- IDs
- labels
- metadata
- provenance
- epistemic status
- classification metadata

#### 3. What should NOT be projected initially?

Be explicit.

We do not want to throw the entire ontology into one giant graph simply because it can be represented.

Identify entities/relationships that should initially remain outside the first visualization projection, and explain why.

#### 4. What is the correct API boundary?

Design a proposed read-only API contract.

Do not implement it yet.

Address:

- endpoint(s)
- query parameters
- focus node
- depth
- projection/view type
- relationship filtering
- node filtering
- pagination/limits if necessary
- response shape
- stable identifiers
- error cases

The API should be domain-oriented.

For example, conceptually:

```text
GET /api/graph?focus=<id>&depth=2&view=<projection>
```

but do not assume this exact route or parameter scheme.

#### 5. How does the relational model become a graph?

Describe the adapter/projection algorithm:

```text
Postgres / Drizzle
        ↓
domain graph query
        ↓
normalized graph projection
        ↓
Graphology
```

Do not implement Graphology yet.

We need to understand what data Graphology will eventually receive.

#### 6. How should relationships be represented?

Pay particular attention to the existing claim/inference model.

Do not collapse these into generic "edges" without preserving semantics.

Consider existing relations such as:

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

Explain which are:

- direct domain relationships,
- inference relationships,
- evidence relationships,
- presentation-level relationships.

#### 7. What are the likely graph projections?

Recommend an initial projection strategy that can eventually support multiple views, such as:

```text
Taxonomy / trope
Argument
Evidence / provenance
Identity-retrojection
```

Do not build them yet.

Explain how they can all derive from the same canonical ontology.

#### 8. What existing schema defects block this?

Identify anything in the current implementation that would prevent a clean graph projection.

Pay particular attention to issues already identified in the repository audit, including:

- discarded `axis` data
- unpopulated `card_concepts`
- vocabulary collisions
- incomplete claim decomposition
- incomplete argument chains
- missing evidence layer
- phantom references
- inconsistent status modeling
- legacy `primaryType`
- any relationship-table ambiguity

Distinguish:

**blocking problem**

from

**known imperfection that can be deferred**.

### Important principle

Do not "fix" ontology problems silently while doing this analysis.

If the current schema cannot cleanly express something, report that as a finding.

Do not invent a new entity or relationship merely to make the graph projection convenient.

### Deliverable

Create a concise architecture/design document:

`trope-cards/docs/GRAPH_PROJECTION_DESIGN.md`

The document should contain:

1. Current graph inventory
2. Proposed first projection
3. Node model
4. Edge model
5. API boundary
6. Projection/adapter design
7. Future projection types
8. Blocking schema issues
9. Deferred issues
10. Implementation sequence
11. Open architectural questions

Do **not** modify the database schema.

Do **not** add dependencies.

Do **not** install Graphology or Cytoscape.

Do **not** implement the API yet.

Do **not** modify the existing UI.

### Validation

Before finishing:

- verify that the design matches the current Drizzle schema;
- verify that it does not introduce a second ontology;
- verify that it preserves claim/evidence/inference semantics;
- verify that Suit/Axis remains consistent with Issue #2;
- run whatever existing schema/seed validation is appropriate;
- report any existing failures separately from anything caused by your work.

### Final response

Report:

1. files inspected;
2. current graph findings;
3. proposed first projection;
4. important schema blockers;
5. the proposed API boundary;
6. files changed;
7. validation performed;
8. open questions requiring human architectural decisions.

Stop after the design document.

Do not proceed into implementation without a separate instruction.
