## Objective

Restore the lost **Suit** and **Axis** dimensions from the original deck as first-class graph ontology relationships, before the read-model projection is built.

### Source of truth

See the project memo: **Preserving Axis and Suit Classification in the Graph Migration**.

The key distinction is:

- **Suit** = deck/browse family: Classic, Zionism-coded, Regional, Reference, Contested.
- **Axis** = rhetorical/argumentative classification: Tactic, Fact-Rebuttal, Theological.
- **Mechanisms** = how rhetoric operates.
- **Concepts** = cross-cutting analytical topics.

Do not collapse these dimensions.

## Required implementation

### 1. Persist Axis

Create a proper many-to-many card_axes relation, analogous to card_mechanisms / card_collections.

Axis vocabulary for this pass:

- TACTIC
- FACT_REBUTTAL
- THEOLOGICAL

Preserve the authored multi-valued axis seed data; do not reduce it to a single column.

If a primary axis is needed for ordering/display, model it explicitly as editorial metadata or a designated relation. Do not silently derive a new source of truth from the legacy primaryType.

### 2. Preserve Suit

Ensure the five deck suites remain represented through collections / card_collections:

- CLASSIC
- ZIONISM_CODED
- REGIONAL
- REFERENCE
- CONTESTED

Use the repository's existing naming conventions where these values already exist; do not duplicate collections merely because the UI terminology says Suit.

Document explicitly that collections are browse suits, while concepts are analytical topics.

### 3. Resolve primaryType

Do not treat the existing primaryType enum (TACTIC, FACT, THEOLOGY, CASE, REFERENCE) as an equivalent ontology to Axis.

Investigate current usage first.

The implementation should leave us with one clear documented relationship:
Card → Axis (many-to-many)

and separately:
Card → Suit/Collection (many-to-many)

If primaryType is retained for compatibility/projection, document whether it is legacy, a presentation field, or something else. Do not create competing authored sources of truth.

### 4. Seed/migration integrity

- Migrate the existing authored axis values for all applicable cards.
- Add card_axes to seed verification / expected counts.
- Ensure re-running the seed is idempotent.
- Do not silently discard axis values.
- Preserve existing suit/collection assignments.
- Add validation that catches an authored Axis/Suit classification that is not persisted.

### 5. UI/read-model contract — prepare, don't prematurely redesign

The eventual card projection should expose:

- suits
- axes
- mechanisms
- concepts

The intended visual distinction is:

**Axis:** compact capsule/badge immediately beneath the title, with fixed-vocabulary iconography:

- Tactic → theatre mask
- Fact-Rebuttal → scales
- Theological → appropriate theological/religious icon

**Mechanisms/concepts:** existing flatter tag treatment near the bottom; these are topic/analytical labels, not rhetorical classification.

The Explore sidebar must eventually expose **Suit** and **Axis** as first-class filter groups alongside ontology-type facets.

Do not implement the full graph UI in this task unless the existing architecture makes a small contract change necessary. This issue is primarily graph-internal correctness.

### 6. Compose/Decompose contract

The future compose/decompose workflow must require at least one Axis before a card can be saved.

For this task, establish the schema/validation contract if practical; do not build the complete compose UI.

## Constraints

- Work from the current trope_graph architecture; do not revive the old flat public.cards model as canonical.
- Do not introduce a second source of truth.
- Do not infer epistemic status from Suit or Axis.
- Do not conflate Suit, Axis, mechanism, concept, or ontology type.
- Keep the graph canonical and the eventual deck UI as a projection/view.
- Preserve borderline/multi-axis cards.
- Add/update tests for schema, seed, referential integrity, and classification preservation.
- Update relevant ontology/schema documentation.

## Deliverable

Open a PR with:

1. schema/migration changes
2. seed changes
3. validation/verify-seed changes
4. tests
5. documentation
6. a concise migration note showing old axis data is no longer silently discarded

Before coding, inspect the current schema and seed implementation and report any conflict with the above contract. Do not make unrelated refactors.
