# Graph Projection Design (v1)

> **Status.** §§1–11 are the original design-only artifact, written before implementation and left
> unedited so the reasoning can be audited. §§12–13 record the decisions taken afterwards and what
> was then built. Where §11 lists an open question, §12 holds its answer.

**Original scope:** Design / discovery. §§1–11 changed no schema, dependency, API, or UI; §13 implements the read-only projection and its endpoint, and still adds no dependency, schema change, or UI change.
**Scope:** Define the first read-only domain graph projection over the canonical `trope_graph` ontology, ahead of any Graphology/Cytoscape work.
**Authority:** `docs/ADR_GRAPH_LAYER.md` (layers & guardrail), `docs/TROPE_GRAPH_SCHEMA.md` (card ontology), Issue #2 (Suit/Axis), Issue #3 (projections).
**Grounded in:** `trope_graph` Drizzle schema (5 modules), migrations `0001`–`0008`, the DB-independent seed corpus, the validators, `verify-seed.ts`, and a live read-only count of the local `trope_cards_dev` graph. Full graph gate passed at authoring time (36/36 tests, `drift:false` over 389 facts, exit 0).

## 0. Scope and non-goals

- **Canonical:** PostgreSQL + Drizzle + the existing `trope_graph` schema. It is the only knowledge model.
- **Forbidden (this document does not):** add a `Trope`/`TruthCard`/`trope_edge` ontology; use a graph database; reintroduce Prisma for the graph; treat a card as the atomic unit of truth; implement the API, Graphology, Cytoscape, or any UI.
- **Suit/Axis (Issue #2) is authoritative.** Axis is never derived from legacy `primaryType`; multi-valued axis is preserved; Suit/Collection, Axis, Mechanism, Locale and Concept stay distinct dimensions.
- **Locale is authored, never inferred (Issue #6).** A card's geographic/social setting comes from `card_locales` only. Locale is many-to-many and is *not* derivable from Suit: a card curated into the `south-africa` collection is not thereby a South Africa card. Neither `collections` nor `primaryType` may fill in a missing locale, and a card with no locale rows reports an empty list rather than a default.

---

## 1. Current graph inventory (what actually exists)

### 1.1 Shape

`trope_graph` is a single PostgreSQL schema declared across five Drizzle modules:

| Module | Enums | Tables |
|---|---|---|
| `schema/tropeGraph.ts` | 11 | 25 (cards, claims, sources, cases, concepts, mechanisms, collections, axes, interpretations, questions, relationships, research/contribution/version) |
| `schema/claimDecomposition.ts` | 3 | 4 (inference steps, premises, conclusions, claim relations) |
| `schema/argumentChains.ts` | 3 | 3 (chains, chain membership, step relations) |
| `schema/evidenceLayer.ts` | 0 | 5 (evidence items + 4 attachment tables) |
| `schema/namespace.ts` | — | (`pgSchema("trope_graph")`) |

Live counts (local DB): **37 domain tables + `schema_migrations`**, **18 enums**, **46 foreign keys**. The 37 tables group into:

- **Classification:** `collections`, `card_collections`, `card_axes`, `mechanisms`, `card_mechanisms`, `concepts`, `card_concepts`, `locales`, `card_locales`.
- **Assertion:** `cards`, `claims`, `sources`, `claim_sources`, `interpretations`, `claim_interpretations`, `interpretation_sources`.
- **Argument:** `inference_steps`, `inference_premises`, `inference_conclusions`, `claim_relations`, `argument_chains`, `argument_chain_steps`, `inference_step_relations`.
- **Evidence/provenance:** `evidence_items`, `evidence_sources`, `evidence_claims`, `evidence_interpretations`, `evidence_inferences`.
- **Events/moderation/version:** `cases`, `case_legal_metadata`, `card_cases`, `questions`, `question_cards`, `question_claims`, `question_sources`, `research_events`, `contributions`, `card_versions`, `relationships`.

### 1.2 What is populated (live)

| Structure | Rows | Notes |
|---|---|---|
| `cards` | 47 | every card has an axis, ≥1 suit, ≥1 mechanism |
| `card_axes` | 56 | 9 multi-axis cards; `ordinal=0` is primary; TACTIC 18 / FACT_REBUTTAL 27 / THEOLOGICAL 10 / HISTORICAL 1 |
| `card_collections` / `card_mechanisms` / `card_locales` | 47 / 58 / 7 | classification links |
| `claims` | 19 | only **6 of 47** cards carry claims (the identity-retrojection cluster) |
| `inference_steps` (+premises/conclusions) | 4 (9/4) | only **2** cards carry argument structure |
| `argument_chains` (+membership) | 2 (4) | 1 PRIMARY_ARGUMENT, 1 COUNTERARGUMENT |
| `inference_step_relations` | 2 | step↔step CHALLENGES/QUALIFIES |
| `relationships` | 11 | all `CARD→CARD`; RELATED 3, CONTEXTUALISES 4, SIMILAR_MECHANISM 3, CHALLENGES 1 |
| `concepts` | 4 | **12 `card_concepts` links across 11 cards**; `anti-zionism` is a recorded orphan |
| `card_concepts` | 12 | every row carries the card sentence that justifies it |

### 1.3 What is empty (live)

`sources`, all five `evidence_*` tables, `claims`→`sources`, `cases`/`case_legal_metadata`/`card_cases`, `interpretations`/`claim_interpretations`/`interpretation_sources`, `questions` (+3 link tables), `claim_relations`, `claim_sources`, `contributions`, `research_events`, `card_versions`. The evidence and case layers are **schema-only**.

### 1.4 Structural facts that shape any projection

- **Two unrelated card models exist.** The graph card (`trope_graph.cards`, `uuid`, `slug`) is the research entry point. The host deck also has a Prisma `public.cards` (`int` id, different fields). They share no key. A projection over `trope_graph` must not conflate them.
- **`primaryType` is legacy, write-only.** Written by the seeder, read by nothing in the graph. It disagrees with axis on real cards — proof they are independent dimensions, not one field under two names. It must never seed axis.
- **Card → claims → inference is the argument backbone.** `inference_premises` (claim→step, with `PRIMARY/CONTEXT/BRIDGE/COUNTERPREMISE` role) and `inference_conclusions` (step→claim) reconstruct `Source→Evidence→Claim(premise)→Inference→Claim(conclusion)` without flattening it.
- **`claim_relations` carries 5 authored rows** (v0.11), read exactly as authored per Q1. The claim-relation *vocabulary* and the *data* both exist now. Was the single biggest open ontology question (§8 B2, §11 Q1); resolved in favour of populating it.
- **`relationships` is polymorphic** (`from_entity_type`/`from_entity_id` → `to_entity_type`/`to_entity_id`, both free-text discriminators, both plain uuids, no FKs). All 11 rows happen to be CARD→CARD.
- **Inference status is deliberately decoupled.** `cards`/`claims` use the `epistemic_status` enum; `inference_steps`/`argument_chains` use a same-named **text** column; `evidence_items.evidence_status` is text with no vocabulary; lifecycle uses four more enums (`case_status`, `question_status`, `relationship_status`, `contribution_status`) plus a boolean `inference_steps.is_canonical`. "Never collapse these" is an explicit documented rule.

---

## 2. Proposed first projection

**Decision — the first projection is card-centred and corpus-wide: `card-argument-taxonomy`.**

Focus on a `card`; emit the card, its Suit(s), its Mechanism(s), its axis as an ordered attribute, its Claims, the inference steps bridging those claims (premise/conclusion/role), and its card↔card `relationships`. This is chosen from the data, not from a wish list:

- It is the **only** projection that is fully populated for **all 47 cards** (every card has suits, mechanisms, axes).
- It **deepens** into real argument structure on the 6 cards that have claims and the 2 that have chains.
- It is the smallest thing that already renders as a genuine graph today.

**Node types in v1:** `card`, `collection` (Suit), `mechanism`, `claim`, `inference_step`.
**Excluded from v1 nodes:** `concept` (12 authored rows exist, but v1 excludes the type by scope — §12 Q2), `source`/`evidence_item` (empty), `case`, `interpretation`, `question`, `argument_chain` (carried as step metadata, see §11 Q6), `relationship` (an edge, not a node).

**Edge families in v1:**

| Edge | Source table | Class |
|---|---|---|
| card → claim (`ASSERTS`) | `claims.card_id` | domain |
| claim → inference_step (`PREMISE_OF`, edge `role`) | `inference_premises` | inference/argument |
| inference_step → claim (`CONCLUDES`) | `inference_conclusions` | inference/argument |
| inference_step → inference_step (`CHALLENGES`/`QUALIFIES`/`ALTERNATIVE_TO`/`DEPENDS_ON`/`REFINES`/`CONTEXTUALISES`) | `inference_step_relations` | inference/argument |
| card → card (`RELATED`/`CONTEXTUALISES`/`SIMILAR_MECHANISM`/`CHALLENGES`/…) | `relationships` (guarded) | domain/presentation |
| card → collection (`IN_SUIT`) | `card_collections` | classification/presentation |
| card → mechanism (`HAS_MECHANISM`) | `card_mechanisms` | classification/presentation |

**Axis is deliberately NOT an edge and NOT a node.** It is an ordered attribute on the card node (badge), matching Issue #2. **Concept is a node in `taxonomy` only**, projected from 12 authored `card_concepts` rows; v1 excludes it by scope (§12 Q2).

---

## 3. Node model

Every node: `{ id, type, label, ...typed metadata, epistemicStatus?, provenance?, classification? }`. `id` is the domain primary key (`uuid`) and is stable; `slug` is carried as human-readable metadata, not as the identity. All IDs are the canonical Postgres `trope_graph` uuids — no new identifiers are minted for the graph.

| Node `type` | `id` | `label` | Key metadata | Epistemic status | Provenance | Classification |
|---|---|---|---|---|---|---|
| `card` | `cards.id` | `title` | `slug`, `summary`, `coreQuestion`, `primaryType` *(flagged legacy)* | `cards.epistemic_status` (enum) | — (entry point) | `suits[]`, `axes[{axis, ordinal, primary?}]`, `mechanisms[]`, `locales[]` |
| `claim` | `claims.id` | `statement` | `claimType`, `description`, `cardId` | `claims.epistemic_status` (enum) | reserved (empty today) | — |
| `inference_step` | `inference_steps.id` | `label` | `inferenceType`, `description`, `notes`, `isCanonical`, `chain{membership}`, `premises[{claimId, role, ordinal}]`, `conclusions[{claimId, ordinal}]` | `inference_steps.epistemic_status` (**text** — §8 B4) | reserved (evidence_inferences empty) | — |
| `collection` (Suit) | `collections.id` | `name` | `slug`, `description` | — (browse taxonomy) | — | — |
| `mechanism` | `mechanisms.id` | `name` | `slug`, `description` | — (analytical taxonomy) | — | — |

Invariants: `concept`/`source`/`evidence_item`/`case`/`interpretation`/`question` node types are **defined in the model but produce no nodes in v1** — for `concept`, by scope rather than for want of data. Epistemic status is **per-node-type** and never merged into a single graph-wide field.

---

## 4. Edge model

Every edge: `{ id, type, from, to, ...attributes }`. `id` is deterministic: `"{fromId}|{type}|{toId}"`, disambiguated by premise `role`/`ordinal` or step-relation where the same pair repeats. Edges are only emitted when both endpoints are present in the node set (§6, invariant 3).

### 4.1 Relationship-vocabulary map (which relation lives where)

The words SUPPORTS/CHALLENGES/QUALIFIES/CONTEXTUALISES appear in **five** different vocabularies with no cross-mapping. A projection must not treat them as one generic `EDGE`:

| Vocabulary | Home table | Node pair | Class | v1 populated? |
|---|---|---|---|---|
| `SUPPORTS, CHALLENGES, QUALIFIES, CONTRADICTS, CONTEXTUALISES, EXEMPLIFIES, REQUIRES, GENERALISES, EQUATES, ANACHRONISTICALLY_MAPS, RETROSPECTIVELY_IDENTIFIES` | `claim_relations` | claim ↔ claim | **direct domain** | **Yes — 5 authored rows, read as authored (Q1)** |
| `PREDECESSOR, RELATED, SIMILAR_MECHANISM, SUPPORTS, CHALLENGES, COMPETING_INTERPRETATION, CONTEXTUALISES, EXAMPLE_OF, DERIVED_FROM, CONTRADICTS` | `relationships` (polymorphic) | any ↔ any | **direct domain** | Yes for CARD↔CARD (RELATED/CONTEXTUALISES/SIMILAR_MECHANISM/CHALLENGES) |
| `CHALLENGES, QUALIFIES, ALTERNATIVE_TO, DEPENDS_ON, REFINES, CONTEXTUALISES` | `inference_step_relations` | inference ↔ inference | **inference** | Yes (2 rows) |
| `PRIMARY, CONTEXT, BRIDGE, COUNTERPREMISE` | `inference_premises.role` | claim → inference | **inference** (premise role) | Yes (9 rows) |
| `SUPPORTS, CHALLENGES, QUALIFIES, CONTEXTUALISES, ILLUSTRATES, REPORTS, ATTRIBUTES` + `strength` | `evidence_claims.relation` | evidence ↔ claim | **evidence** | No — evidence empty |
| `DERIVED_FROM` / `USED_BY` (defaults) | `evidence_sources` / `evidence_inferences` | evidence ↔ source / inference | **evidence** | No |
| classification (suite/membership) | `card_collections`, `card_mechanisms`, `card_axes`, `card_locales` | card ↔ taxonomy | **presentation** | Yes |

**Consequence for the argument view:** the claim↔claim argument edges in v1 come from `inference_premises` / `inference_conclusions` (premise role + step type) and `inference_step_relations` — **not** from `claim_relations`. `ANACHRONISTICALLY_MAPS` and `RETROSPECTIVELY_IDENTIFIES` are currently represented only as `inference_type` values on steps, not as `claim_relations` rows. The projection preserves whatever the schema holds; it does not synthesize the missing claim-relations.

`EXEMPLIFIES` (claim) and `EXAMPLE_OF` (relationship) are distinct values; the projection does not unify them. `IN_SUIT`/`HAS_MECHANISM` are presentation-class edges (browse facets), semantically distinct from argument edges.

**The shared `south-africa` slug.** Locale is authored with slug `south-africa`, which is also
a `collections` slug. Four cards satisfy both at once, and three more are South Africa cards
curated under `zionism-coded` or `fact-rebuttal`, which is what proves the dimensions are not
the same list. The collision is deliberate rather than accidental: a suite curated from a locale
should carry the locale's name.

The disambiguation happens **at the boundary, not in the slug**. Two rules carry it:

1. **Slugs are display-only; act on ids.** `CardClassification` reports `suits`/`suitIds`,
   `mechanismSlugs`/`mechanismIds` and `localeSlugs`/`localeIds` as parallel pairs. So a client
   never has to ask "which `south-africa` was meant?" — it resolves by id. `suitIds` was added for
   exactly this reason: locales and mechanisms already reported ids, suits were the odd one out,
   and the asymmetry left a consumer with no way to tell the two lists apart.
2. **Parameters are dimension-qualified.** A future locale filter takes `locale=`, never a
   reused suit parameter, and no bare `slug=` may resolve across taxonomies.

`graph-locale.integration.test.ts` asserts rule 1 against a real database: the shared slug
resolves to two different rows. A client that ignored ids and matched on slug alone would still
get this wrong, which is why the pairing is enforced rather than documented.

Curating a suite *from* a locale — listing a locale's cards so a curator can pick candidates —
needs a listing path this design does not have: every view here is focus-anchored on one card.
Tracked as `as-truth-cards-572`, deliberately outside `/api/graph` so the read-only guarantee
above stays true.

**Locale has no edge in v1.** `card_locales` rides on card metadata (`classification.localeSlugs[]`) like `card_axes` does, and is deliberately *not* projected as a `collection`-shaped node or an `IN_SUIT` edge: locale is intrinsic context rather than a curation bucket, so modelling it as membership would invite exactly the suit→locale inference Issue #6 forbids. It becomes a node type only if a future view needs to traverse locale→cards as edges rather than filter on them.

---

## 5. API boundary (design only — not implemented)

Read-only, domain-level. Exposed by the existing Express host as `trope-cards`/Drizzle behind a route; the React/Vite UI calls only this; it never imports Drizzle or touches the DB. **No Graphology- or Cytoscape-shaped objects leave the server** (ADR §4).

### 5.1 Endpoints (proposed)

```
GET /api/graph?focus=<slug|uuid>&view=<name>&depth=<0..3>&[include=<nodeType,..>]&[relationship=<edgeType,..>]&[maxNodes=<n>]
GET /api/graph/views                       # list views + which are currently populated
```

- `focus` — required; a card slug or uuid (server resolves slug→uuid).
- `view` — required or defaulted to `card-argument-taxonomy`. One of: `card-argument-taxonomy`, `taxonomy`, `argument`, `evidence`, `identity-retrojection`.
- `depth` — 0 = focus only, 1 = immediate neighbourhood, 2–3 = second/third hop. Default 1, max 3.
- `include` / `relationship` — optional node-type and edge-type filters (subset allow-lists, never expands beyond the view's declared node/edge set).
- `maxNodes` — soft cap (default 200, hard 500) with truncation signalled in `meta`.

### 5.2 Response shape (domain-level, not a graph library)

```jsonc
{
  "focus": { "id": "uuid", "type": "card", "slug": "jesus-was-a-zionist" },
  "view": "card-argument-taxonomy",
  "depth": 2,
  "nodes": [
    { "id": "uuid", "type": "claim", "label": "…", "claimType": "HISTORICAL",
      "epistemicStatus": "ESTABLISHED", "metadata": { "description": "…" } },
    { "id": "uuid", "type": "card", "label": "…", "epistemicStatus": "CONTESTED",
      "classification": { "suits": ["zionism-coded"],
                          "axes": [{ "axis": "TACTIC", "ordinal": 0, "primary": true }] } }
  ],
  "edges": [
    { "id": "uuid|PREMISE_OF|uuid", "type": "PREMISE_OF", "from": "uuid", "to": "uuid",
      "attributes": { "role": "PRIMARY", "ordinal": 0 } }
  ],
  "meta": { "nodeCount": 12, "edgeCount": 15, "truncated": false, "warnings": [] }
}
```

Node `type` values are the domain types from §3; edge `type` values are the domain relation names from §4. `epistemicStatus` is present only on node types that have one and is never aggregated across types.

### 5.3 Error cases

- `400` — malformed `focus`/`view`/`depth`, unparseable uuid/slug, unknown node/edge filter name.
- `404` — `focus` not found, or `focus` type not permitted by the requested `view` (e.g. an `evidence` focus in `taxonomy`).
- `413` — `depth` exceeds max.
- `200` (empty) — a structurally valid view whose data is not yet populated (e.g. `view=evidence` today) returns `nodes: []` with a `meta.warnings[]` note, **not** an error. This is the expected response for the empty evidence/case/question layers.

### 5.4 Stable identifiers

Node `id` = canonical `trope_graph` uuid (stable). Edge `id` = deterministic composite (§4). Slugs are returned as labels/metadata only. `claims` have no slug, so claims are addressable by uuid only (an open question, §11 Q7).

---

## 6. Projection / adapter design

Relational → normalized domain projection → Graphology (optional analysis) → Cytoscape (presentation). The projection is computed by Drizzle/SQL. Graphology and Cytoscape are later, ephemeral consumers: neither is a source of truth, neither may re-query the database, and nothing either computes is persisted.

```
Postgres / Drizzle  ──(view adjacency rules)──▶  normalized projection {nodes, edges, meta}
                                                        │
                    ┌───────────────────────────────┴───────────────────────────────┐
                    ▼                                                               ▼
        Graphology (analysis, optional)                              Cytoscape (presentation)
        toGraphology() — MultiDirectedGraph                          toCytoscapePresentation()
        traversal, degree, components                                 ElementDefinition[] + context
```

**Algorithm (per request):**
1. Resolve `focus` (slug|uuid) to a `(id, type)` pair.
2. Select the view's adjacency rules (allowed node types, edge families, traversal direction) and apply `include`/`relationship` filters as a subset.
3. Breadth-first expansion from `focus` to `depth`, following only allowed `(node, edge)` transitions, up to `maxNodes`.
4. Deduplicate nodes by `id`; collect edges; **drop any edge whose endpoint is not in the emitted node set.**
5. Attach typed metadata per node (classification, epistemic status, provenance) via targeted queries.
6. Return the normalized projection. Graphology (later) is built **on demand** from `{nodes, edges}`: `new Graph({type:'directed'})`, one `addNode(id)` per node with metadata as attributes, one `addEdge(edge.id, from, to)` per edge. Graphology objects are never persisted and never the API shape; traversal/centrality/community results return as domain data.

**Normalization invariants (must be tested):**
1. Every edge endpoint id is present in `nodes`.
2. Node and edge ids are unique and deterministic.
3. No edge references an excluded (filtered) node.
4. Epistemic status is carried per node type; no cross-type status rollup.
5. Multi-valued axis is preserved with `ordinal` and a `primary` marker; axis is never derived from `primaryType` (Issue #2).
6. The projection introduces no entity/edge not present in `trope_graph` (no `Trope`/`TruthCard`/`trope_edge`).

**Layering (ADR §4):** UI → `/api/graph` (Express) → projection service (Drizzle) → Postgres. No frontend-to-Drizzle path; no graph database.

---

## 7. Future projection types (all from one ontology)

Each view is a different **adjacency rule set** over the same canonical tables — not a separate model:

| View | Focus | Node types | Edge families | Source tables | Status |
|---|---|---|---|---|---|
| `card-argument-taxonomy` | card | card, collection, mechanism, claim, inference_step | classification, ASSERTS, PREMISE_OF, CONCLUDES, step-relations, card↔card | `cards`, `card_*`, `claims`, `inference_*`, `relationships` | **v1 — populated now** |
| `taxonomy` | card | card, mechanism, collection, **concept** | HAS_MECHANISM, HAS_CONCEPT, IN_SUIT | `card_*`, `mechanisms`, `collections`, `concepts` | v2; Concept now projected |
| `argument` | card / claim | card, claim, inference_step | PREMISE_OF, CONCLUDES, step-relations, ASSERTS | `claims`, `inference_*` | v2; rich on 2 cards today, scales with claim corpus |
| `evidence` | claim / source | claim, evidence_item, source, inference_step | evidence_claims, evidence_sources, evidence_inferences | `evidence_*`, `sources` | **designed, data-blocked** (0 rows) |
| `identity-retrojection` | claim / card | claim, inference_step (+source/evidence later) | premise→step→conclusion with `RETROSPECTIVE_IDENTITY`/`ANACHRONISTIC_MAPPING` | `inference_steps`, `claims` | v3; 2 cards carry `RETROSPECTIVE_IDENTITY`/`ANACHRONISTIC_MAPPING` today |

All five share the §3 node model and §4 edge model; only the allowed `(node, edge)` transitions differ. No new ontology is introduced by any view.

---

## 8. Blocking schema issues (must be decided before they can block the chosen view)

**Definition:** a blocking issue is one that prevents a **clean** projection of a view the design wants to ship. Each is a decision for the maintainers, not a silent fix here.

- **B1 — RESOLVED, corpus and projection.** Was: `card_concepts` never populated, all 6 concepts orphaned, no `cardConcepts` insert anywhere. *Now:* Q2's corpus task is done. `card_concepts` has 12 rows across 8 cards, each link citing the card sentence that supports it, and the mechanism/concept slug collision is resolved (concepts 6→4; `collectivisation` and `racial-essentialism` were **removed from the concept vocabulary**, not renamed, because each restated an existing mechanism and a renamed duplicate would still be indistinguishable by slug). `anti-zionism` remains a deliberate orphan — no card discusses it, and inventing a link is what Q2 forbids — so the verifier names it as a recorded gap and still fails on any *new* orphan. 12 links reach 11 cards (`zionist-as-slur` carries two). *Projection side, now done:* `DrizzleGraphReader` loads `card_concepts` joined to `concepts`, carrying `definition` and the authored `relationship`; `taxonomy` emits one `ConceptNode` and one `HAS_CONCEPT` edge per row; v1 excludes the type by scope. **B1 is closed.**
- **B2 — RESOLVED by the v0.11 corpus increment.** Was: 0 rows and no code path. The 5 authored rows now exist, written by `seed/claimRelations.ts` and read by the projection through `claimRelationCandidate`. *Resolved as:* `claim_relations` is **first-class, not duplicative**. It records that one claim stands in a stated relation to another; `inference_*` records that a conclusion follows from premises by a named inferential form. The two are different propositions, so a pair may legitimately appear in one and not the other — and `seed/claimRelations.ts` enforces that a pair already wired as an inference binding is never also written as a claim relation. No projection change was needed, which is what Q1 predicted.
- **B3 — `relationships` is polymorphic with no referential integrity.** `from_entity_type`/`to_entity_type` are free text; `from_entity_id`/`to_entity_id` are unconstrained uuids with **no FKs**. A projection cannot verify an endpoint exists or that a `*_entity_type` string is a known type. *Effect:* reading `relationships` as a trusted edge source is unsafe for arbitrary types. *Mitigation (v1):* only project rows where both `*_entity_type == 'CARD'` and both uuids resolve to cards; surface any other row as a `meta.warnings[]` entry rather than dropping it silently. All 11 current rows are CARD→CARD, so v1 is safe today. *Decision:* harden to typed FKs / an entity-type enum, or keep polymorphic + defensive filter (§11 Q5).
- **B4 — Status is modelled inconsistently; a single cross-entity status filter is unsound.** `epistemic_status` is the `enum` on `cards`/`claims` but `text` on `inference_steps`/`argument_chains`; lifecycle uses four unrelated enums plus `inference_steps.is_canonical` (boolean) and `evidence_items.evidence_status` (text, no vocabulary). *Effect:* a projection offering one graph-wide "status" filter/rollup would be wrong. *Mitigation:* expose `epistemicStatus` per node type only (§3); no global status. *Decision (§11 Q4):* unify inference status onto the enum, or keep it deliberately decoupled per `EVIDENCE_LAYER.md`?
- **B5 (evidence view only) — two competing source-attachment paths.** `claim_sources` (claim→source directly, with `quote_or_excerpt`/`page_reference`) bypasses the located-passage model, and a source can be reached four ways (`claim_sources`, `interpretation_sources`, `question_sources`, `evidence_sources`). `EVIDENCE_LAYER.md` says do not use `claim_sources` when the passage is known, but the table remains. *Effect:* the `evidence` view has no unambiguous claim→source path. Not a v1 blocker (0 rows). *Decision:* retire/deprecate `claim_sources` when the evidence corpus is populated. **Still open:** v0.11 added 6 `claim_sources` rows and 0 `evidence_items`, so the deprecation trigger has *not* fired. Those rows are bibliographic only — `relationship = ATTRIBUTED_TO` with `quote_or_excerpt` and `page_reference` null — which is the one use `EVIDENCE_LAYER.md` permits while the passage is unknown. Both the verifier and an integration test assert the quotes stay null, so the table cannot drift into impersonating the located-passage model.

**Data gaps that are not schema defects but gate the richer views:** the evidence layer, `cases`, `interpretations`, and `questions` are schema-only (0 rows); only 2 cards have argument chains. `sources` and `claim_relations` are no longer gaps — v0.11 populated 3 and 5 respectively. Cards without claims fell from 41 to 34 with that increment; the remainder are tactic cards whose summaries describe an operation rather than assert a proposition, plus the deferred v0.4 corpus. These are corpus-population tasks, not blockers of the v1 projection.

---

## 9. Deferred issues (known imperfections — do not block v1)

- `primaryType` is legacy/write-only — documented, excluded from all classification authority (Issue #2).
- ~~`mechanisms`/`concepts` slug collision on `collectivisation` and `racial-essentialism`~~ **resolved** — both concepts removed rather than renamed, so concepts 6→4 and no slug now appears in both tables.
- Four `cards` columns are permanently NULL (`trigger`, `mechanism_summary`, `counter_test`, `published_at` = 0/47); the seeder writes only 7 fields.
- `card_axes.ordinal` has no `CHECK (ordinal >= 0)`; the seeder temporarily writes negative ordinals to avoid the unique-index collision during reorder (internal to the seeder).
- Ordinal base is inconsistent across tables: `card_axes` 0-based, `argument_chain_steps` seeded 1-based, `inference_premises` 0-based.
- `inference_steps` has no unique key (seeder matches on `(card_id, label)`); `claims` has no slug (matched on `(card_id, statement)`); `sources`/`cases` have only non-unique title indexes. Idempotency relies on `0007` unique indexes + application logic, not natural keys.
- `inference_steps.argument_chain_id` (SET NULL) and `argument_chain_steps` (CASCADE) are two step↔chain attachment paths that can disagree.
- `card_versions` has no writer; `updated_at` has no trigger (audit trail is manual/unused).
- Polymorphic-discriminator inconsistency: `contributions.entity_type`/`entity_id` are nullable; `relationships`/`research_events` require both — three policies for one pattern.
- Evidence layer vocabularies (`evidence_items.type`, `.locator_type`, `.evidence_status`, `evidence_claims.relation`, `.strength`) are plain `text`, unenforced; `evidence_sources.relation`, `evidence_interpretations.relation`, `evidence_inferences.relation` have **no documented vocabulary**; `evidence_status` has none at all. This is the only part of the ontology where controlled vocabularies are not enums.
- Eight "how are these related" columns (`claim_sources.relationship` NOT NULL, `interpretation_sources.relationship`/`card_concepts.relationship` nullable, plus four evidence `relation` columns) have differing nullability/defaults and no shared vocabulary.
- `verify-seed.ts` `EXPECTED` covers 13 of 37 tables; the other 24 are invisible to the idempotency check by construction.
- Unused enum values: `claim_relation_type` 0/11; `relationship_type` 6/10 unused; `epistemic_status` `UNSUPPORTED`/`OPEN` 0; `argument_chain_kind` 1/4; `inference_type` 3/12; etc.
- `drizzle.config.ts` points `migrations.table` at `trope_graph.__drizzle_migrations`, a table that never exists (canonical history is `drizzle/*.sql` + `schema_migrations`) — a latent second-ledger risk if `drizzle-kit migrate` is ever run.
- Migration `0008_card_axes.sql` omits the `IF NOT EXISTS` / `duplicate_object` guards every other migration uses (latent re-run hazard).
- `cards.core_question` is absent from `0001` and added by `0006`; the Drizzle module and `0001` alone are inconsistent.
- Documentation drift: `REPORT.md` (now-false claims about status enums, axis, table counts), `TROPE_GRAPH_SCHEMA.md` (§3.1 vs §3.2 on CONTESTED; 12 vs 14 mechanisms; "future foundational collection" that already exists), `V0.10_MIGRATION.md` (claims a `contested` collection that does not exist; `card_axis` "adds HISTORICAL" when 0008 created the enum from scratch). Housekeeping, out of scope here.

---

## 10. Implementation sequence

Mirrors ADR §9, grounded in the findings above. Status as of the implementation in §13.

0. **Land this design** (docs only). — done
1. **Decide the blocking issues (B1–B5) as scoped, separate issues** — especially B2 (populate vs retire `claim_relations`) and B1 (populate vs retire Concept). Do not fix them silently. — done; verdicts in §12, each carried by a follow-up issue
2. **Build the read-only projection service** (Drizzle, in `trope-cards`) and the `GET /api/graph` endpoint for `view=card-argument-taxonomy` (focus + depth + filters). No Graphology, no UI change, no schema change. — done
3. **Add projection tests** asserting the §6 invariants, including: endpoints-in-nodes, per-type status, multi-axis preserved with primary marker, `primaryType` never used for axis, and no second ontology. — done, plus a live-SQL suite
4. **Build the Graphology adapter** over `{nodes, edges}`; add traversal/metrics (shortest path, connected components, centrality) behind the API, returning domain-level results.
5. **Populate the claim/evidence/case corpus** — unblocks `argument` depth, the `evidence` view, and Source/Evidence nodes.
6. **Add richer views** (`taxonomy`, `argument`, `evidence`, `identity-retrojection`) as their data lands.
7. **Add Cytoscape as a lazy-loaded graph view** consuming `/api/graph`.
8. **Persist derived metrics** only on demonstrated product need; write/edit graph workflows only after auth/authorization.

---

## 11. Open architectural questions (require human decisions)

1. **`claim_relations`: populate or retire?** (B2) Does the 11-value claim-relation vocabulary become first-class data, or is it duplicative of the inference-step model? This decides whether claim↔claim SUPPORTS/QUALIFIES/ANACHRONISTICALLY_MAPS/RETROSPECTIVELY_IDENTIFIES edges exist at all.
2. ~~**Concept: first-class or retired?**~~ **settled** — first-class, populated (12 rows), projected in `taxonomy`; the mechanism/concept slug collision is resolved.
3. **Suit vocabulary reconciliation (Issue #2).** Issue #2 names suits `CLASSIC/ZIONISM_CODED/REGIONAL/REFERENCE/CONTESTED`; the live collections are `classic/zionism-coded/south-africa/fact-rebuttal/foundational` and no `contested` collection exists. Which vocabulary is canonical? (Issue #2's decision; this design uses `collections` as-is.)
4. **Epistemic status: unify or keep decoupled?** (B4) Should `inference_steps`/`argument_chains` migrate to the `epistemic_status` enum, or stay deliberately independent text per `EVIDENCE_LAYER.md` "never collapse these"? Affects node metadata and any status filter.
5. **`relationships` hardening.** (B3) Keep polymorphic with a defensive projection filter, or migrate to typed FKs / an entity-type enum?
6. **Are `argument_chains` first-class graph nodes, or grouping metadata on inference steps?** This design uses metadata; a chain-as-node model would enable chain-level focus/traversal.
7. **Stable public identifiers.** Expose uuid only, or also slugs? `claims` have no slug. Related: should the API resolve a card by its human slug, uuid, or both?
8. **Card identity across the two card models.** How should the graph `card` relate to the separate Prisma `public.cards` deck model (different ids/fields, no shared key) without creating a second ontology? This design does not bridge them.
9. **Depth semantics.** Is `depth` a hop count across all edge families combined, or tracked per family (e.g. taxonomy depth vs argument depth)?
10. **Projection caching/materialisation.** Computed on demand per request for v1; should a cache or materialised projection (e.g. per corpus version) be introduced on demonstrated need?

---

## 12. Decisions on the open questions (Q1–Q10)

Answered by the maintainer after §11 was written, and implemented. Each decision below closes the
corresponding §11 question and states the consequence for v1. Where a decision defers work rather
than settling an ontology question, it names the follow-up issue that carries it.

### Q1 — `claim_relations`: read only what is authored; never infer

**Decision.** The projection reads `claim_relations` exactly as authored. It does **not** derive a
claim↔claim edge from inference structure, and it does not infer claim relations from card
relationships or taxonomy.

**Why.** Inference structure (`inference_premises`/`inference_conclusions`) encodes *how a
conclusion was reached*, which is a different proposition from *one claim standing in relation to
another*. Collapsing them would invent authorial intent. The 11-value `claim_relation_type`
vocabulary exists and is authoritative when rows exist. As of the v0.11 corpus increment there
are 5 rows, and they project with no code change — which is what this decision predicted.

**Consequence.** Argument edges in v1 come only from `inference_*`. `claim_relations` becomes live
the moment it is populated, with no projection change. Follow-up: B2 — **now closed**; v0.11
populated 5 rows and the projection picked them up unchanged.

**Now exercised.** With rows present, the rule is testable where it was not before:
`graph-projection.integration.test.ts` asserts every `claim_relation` edge has
`sourceTable === 'claim_relations'`, so a projection that derived one from inference structure
would fail. `seed-corpus.test.ts` separately asserts no seeded relation restates an inference
premise→conclusion pair.

### Q2 — Concept: excluded from v1, not retired

**Decision.** Concept is first-class and **is projected**: `DrizzleGraphReader` loads
`card_concepts` joined to `concepts`, and `taxonomy` emits one `ConceptNode` per authored row plus
one `Card --HAS_CONCEPT--> Concept` edge per row. v1 (`card-argument-taxonomy`) still emits **no
Concept node**, on scope rather than for want of data.

**Why.** The `card_concepts` row *is* the ontology. There is one edge per row, no fallback that
reconstructs membership from a Mechanism name, an Axis, a Suit, a Locale, claim text or the card
slug, so a card with no authored row emits no Concept edge and no Concept node. That is what makes
the projection safe to trust: it cannot invent the association it would need in order to show a
Concept. `anti-zionism` demonstrates it — 4 concepts exist, only 3 are linked by any card, and the
fourth never appears in any projection.

**Relationship text is preserved.** `card_concepts.relationship` is nullable free text with no
vocabulary, and it is the only record of *why* a card is associated with a concept. It rides on
`GraphEdge.attributes.relationship` verbatim, including `null`. Contrast `card_mechanisms`, which
has no such column, so `HAS_MECHANISM` carries only `slug` and `name`.

**Edge vocabulary.** `HAS_CONCEPT` is a third `classification` value, not a reuse of
`HAS_MECHANISM`. The two tables have independent `UNIQUE(slug)` columns and no cross-mapping, so
sharing a relation word would leave a consumer unable to tell a Concept edge from a Mechanism edge.
Edge ids are namespaced by family and relation word, so a Suit and a Concept sharing a slug stay
two distinct edges.

**Why v1 still excludes it.** v1 was chosen because it is the projection fully populated for all
47 cards. Concept reaches 11 of them. Admitting it there would report an association for a minority
of cards and silence for the rest — the exact asymmetry the view choice exists to avoid. The
`taxonomy` view's own description already read "Mechanism / Concept / Suit structure" and its
`nodeTypes` already listed `concept`, so it needed no contract change; no new view was invented.
Admitting Concept to v1 later is a one-line `nodeTypes` change with no reader or ontology work
outstanding.

**Consequence.** `taxonomy` renders Concept from the 11 linked cards. 36 cards project with no
Concept node, which is valid and asserted rather than treated as a gap.

### Q3 — Suit vocabulary: use the live collections verbatim

**Decision.** Suit metadata comes from `collections` as they exist (`classic`, `zionism-coded`,
`south-africa`, `fact-rebuttal`, `foundational`). The projection performs **no** vocabulary
mapping and never places an epistemic value (`CONTESTED`) into a suit field.

**Why.** Issue #2 owns Suit/Axis restoration. Until it decides, translating would create a second,
conflicting vocabulary inside the projection — precisely the failure mode the ADR forbids.

**Consequence.** Suit labels are whatever the corpus says. An integration test asserts `contested`
never appears as a suit.

### Q4 — Status: keep every lifecycle deliberately decoupled

**Decision.** Each node type exposes only its own status field (`epistemicStatus`,
`lifecycleStatus`, …). There is no graph-wide `status` rollup and no cross-entity status filter.

**Why.** `EVIDENCE_LAYER.md`'s "never collapse these" is an explicit rule, and B4 shows the columns
genuinely differ (enum vs text vs boolean).

**Consequence.** Status is typed per node type; invariant 4 in the test suite enforces that a node
never carries a status field belonging to another type.

### Q5 — `relationships`: project defensively, warn, never trust

**Decision.** A `relationships` row becomes an edge **only** when both discriminators are exactly
`CARD` and both uuids resolve to cards. Any other row is dropped and recorded in `meta.warnings[]`.
Edges are additionally re-checked against the emitted node set after traversal, so a relationship to
a card beyond the traversal frontier cannot produce a dangling edge.

**Why.** The table has no FKs and free-text discriminators (B3). All 11 live rows are CARD→CARD, so
this is safe today and *safe-by-construction* if tomorrow's rows are not.

**Consequence.** A malformed row is visible, not silent. Follow-up: B3.

### Q6 — Argument chains are step metadata; chain-as-node is future work

**Decision.** `argument_chain_id` rides on the inference step as metadata. v1 emits **no**
`argument_chain` node. Chain membership is read through **both** attachment paths
(`argument_chain_steps` and `inference_steps.argument_chain_id`) so a chain is not lost if one path
is the only one populated.

**Why.** A chain-as-node model changes traversal semantics and belongs with the `argument` view,
which cannot ship until the claim corpus grows.

**Consequence.** The `argument_chain` node type is reserved and unused in v1.

### Q7 — Identity: uuid canonical, slug an accepted alias for cards

**Decision.** Node ids are always uuids. Cards additionally resolve from their human slug; claims,
steps, and chains have no slug and are reachable by uuid only. A uuid-shaped string is never
retried as a slug.

**Why.** Clients hold slugs; the database must key on uuid. Retrying a failed uuid lookup as a slug
would turn a 404 into a wrong-but-valid answer.

**Consequence.** `?focus=` accepts either for cards.

### Q8 — No bridge to the Prisma deck

**Decision.** The projection reads `trope_graph` only. It does not join, mirror, or reconcile
`public.cards`.

**Why.** The two card models share no key and have different fields. Bridging would fabricate an
identity the ontology does not assert.

**Consequence.** `legacyPrimaryType` is surfaced as metadata and is never used for axis derivation.

### Q9 — Depth is a hop count under the active view

**Decision.** `depth=N` returns nodes at most N hops from the focus, where a hop is an edge of a
family the view allows. `depth=0` returns the focus alone.

**Why.** Depth has to mean something checkable. Per-family counters were considered and rejected as
more machinery than v1 can validate.

**Consequence.** Relationship filters narrow traversal as well as output, which the API contract
documents.

### Q10 — Compute per request; no cache, no graph database, no materialisation

**Decision.** Each request builds its projection from live relational queries. No cache, no
materialised projection, no graph store.

**Why.** The corpus is small (47 cards) and changes with editorial review; a cache would need
invalidation the domain has no vocabulary for yet.

**Consequence.** Response is deterministic for identical input (asserted by test), and the
projection cost is bounded by `maxNodes`.

### Decision → blocking-issue map

| Question | Decision | Blocking issue | Disposition |
|---|---|---|---|
| Q1 | read authored only | B2 `claim_relations` | **closed** — 5 rows, live, no projection change |
| Q2 | first-class Concept, read from authored rows only | B1 `card_concepts` | **closed** — 12 rows, projected in `taxonomy`, v1 excludes by scope |
| Q3 | use live suits | Issue #2 owns Suit/Axis | not this issue's to settle |
| Q4 | keep statuses decoupled | B4 inconsistent status modelling | deferred, documentation issue |
| Q5 | defensive projection filter | B3 unconstrained `relationships` | deferred, hardening issue |
| Q6 | chains as metadata | — | revisit with the `argument` view |
| Q7 | uuid canonical, slug alias | — | settled |
| Q8 | no Prisma bridge | — | settled |
| Q9 | depth = hops | — | settled |
| Q10 | on-demand only | — | settled until demonstrated need |

---

## 13. Implementation record

Implemented after §11 was answered. Still no schema change and no UI change. Graphology and
Cytoscape were added afterwards as separate consumers of the projection, each in its own adapter.

### What exists

| Piece | Location | Role |
|---|---|---|
| Node/edge contract | `trope-cards/src/graph/types.ts` | Node/Edge unions, per-type status, metadata shapes |
| View rules | `trope-cards/src/graph/views.ts` | Five views, edge families, exclusions, caps |
| Read port | `trope-cards/src/graph/reader.ts` | Database-independent interface the projection depends on |
| Drizzle adapter | `trope-cards/src/graph/drizzle-reader.ts` | Breadth-first expansion, hydration, population counts |
| Projection | `trope-cards/src/graph/projection.ts` | BFS, filtering, node/edge emission, warnings, truncation |
| Request contract | `trope-cards/src/graph/query.ts` | Validation, filter normalisation, error taxonomy |
| HTTP boundary | `server/api/graph.ts` | `GET /api/graph`, `GET /api/graph/views` |
| Graphology adapter | `trope-cards/src/graph/graphology-adapter.ts` | Projection → `MultiDirectedGraph` (analysis) |
| Analysis | `trope-cards/src/graph/analysis.ts` | Bounded traversal, degree, components |
| Cytoscape adapter | `trope-cards/src/graph/cytoscape-adapter.ts` | Projection → `ElementDefinition[]` + `context` (presentation) |

The projection depends only on the read port, which is why the invariant suite runs against an
in-memory fake and the same suite can run against live SQL.

### API boundary as built

```
GET /api/graph?focus=<uuid|slug>&view=card-argument-taxonomy&depth=1
                 &include=<type,…>&relationship=<TYPE|FAMILY:TYPE,…>&maxNodes=200
GET /api/graph/views
```

`focus` required; `view` defaults to `card-argument-taxonomy`; `depth` defaults to 1 and is capped
at 3; `maxNodes` defaults to 200 and is hard-capped at 500. Filters narrow both emission and
traversal and are matched case-insensitively against uppercase edge keys. Errors: `400` malformed,
`404` unknown or view-incompatible focus, `413` cap exceeded. A **valid empty** projection is `200`
with `meta.warnings[]`, never a 404 — a card with no claims is a fact, not a failure.

### Verification

| Suite | Count | Runs without a database |
|---|---|---|
| Unit (fake reader): projection, views, query | 142 | yes |
| Locale unit: schema shape, seed corpus | 23 | yes |
| Graphology adapter + analysis unit (Issue #3 step 4) | 41 | yes |
| Cytoscape adapter unit (Issue #3 step 6) | 55 | yes |

Totals: 292 unit tests across the suites above, all passing without a database.
| Integration (live SQL): projection over all 47 seeded cards | 18 | no — skips unless `TROPE_GRAPH_DATABASE_URL` is set |
| Axis integration (pre-existing) | 7 | no — unchanged |
| Locale integration (Issue #6) | 8 | no — skips unless `TROPE_GRAPH_DATABASE_URL` is set |
| Graphology adapter integration (Issue #3 step 4) | 8 | no — skips unless `TROPE_GRAPH_DATABASE_URL` is set |

292 unit tests pass with no database configured. The five integration suites
(`graph-projection`, `graphology-adapter`, `graph-locale`, `graph-axis`, `seed-corpus`) report 0 and
skip unless `TROPE_GRAPH_DATABASE_URL` is set; they add 51 more when one is. The locale integration suite
closes the gap flagged when Issue #6 was written: it asserts each card kept the locale it was
authored with, that an untagged card stays untagged, that no locale is dead, that the shared
`south-africa` slug resolves to two different rows, and that a card survives a projection through
the **real** Drizzle reader rather than the fake.

The Graphology integration suite closes the same gap for the adapter: the unit suite proves the
adapter's logic over hand-built projections, while the live suite proves it survives the shapes the
seeded ontology actually produces — a `relationships` pair with two rows, cards sharing the
`south-africa` slug across Suit and Locale, axis ordinals, and inference steps whose status
vocabulary differs from a claim's.

The Cytoscape adapter unit suite has no integration counterpart, deliberately. It already proves
the thing a live database would be asked to prove — that the adapter preserves whatever
`projectGraph` emits — by running against the real projection over the fake reader, and its
remaining risk is Cytoscape's own behaviour rather than the seeded corpus's. So instead of a
database it uses a real headless `cytoscape()` core, asserting that the library accepts the output,
preserves direction, applies the derived classes and counts what the projection declared. Seven of
its cases were derived by mutation testing: breaking the adapter in one specific way each and
confirming a named test fails. Two survivors from that pass were fixed rather than left —
a dropped node `metadata` bag and a repeated-id guard — and the mapping is now pinned field by
field, including through a core, since Cytoscape drops `undefined` from `data()` and reads
`classes` only at element level.

The integration suite exists because a fake cannot catch a wrong column list or a missed join: it
hands back exactly the shape the port declares. It projects **every** seeded card, not a sample,
and separately re-checks each of the six §6 invariants against real rows.

### Graphology computation layer

§10 step 4 is built: `src/graph/graphology-adapter.ts` and `src/graph/analysis.ts`.

The adapter takes this projection and nothing else. It never queries the database, so a
projection remains the single place where the ontology decides what a client may see, and no
analysis call can widen it.

```ts
const graph = toGraphology(projection)          // projection -> Graphology
const reach = reachableFrom(graph, focusId, { maxDepth: 2, maxNodes: 200 })
const degrees = degreeReport(graph)
const components = connectedComponents(graph)
```

Three details are load-bearing:

- **The graph is multi-directed.** `relationships` has no uniqueness on its endpoint pair, so two
  rows may share a `(from, to, type)` triple and differ only by `status`. Graphology's simple
  `Graph` class rejects that with "duplicate edge", so the adapter uses `MultiDirectedGraph`.
- **`traversal` is metadata, not direction.** An edge keeps its authored `from`/`to` even when it
  is walked both ways. Every v1 family hardcodes `traversal: 'bidirectional'` — a neighbourhood
  that hid one direction would lie — so the directed branch is covered by a hand-built projection
  and will need a real producer before it carries data.
- **Status stays per node.** `epistemic_status`, `independent_inference_status` and
  `evidence_status` are three different columns. The adapter copies the `source` tag so a consumer
  must narrow, and `degreeReport`/`connectedComponents` have no operation that yields a graph-wide
  status. That is Q4 enforced by the type, not by a convention.

Traversal is bounded by both `maxDepth` and `maxNodes`, iterates neighbours in sorted order, and
reports `truncated` only when the node cap actually cut the walk short — a depth limit is a
deliberate request, not a truncation. Results are sorted, so the same projection yields the same
ids every time.

### Traversal and connectivity are different questions

`reachableFrom` and `connectedComponents` are both BFS with the same determinism guarantees, and
they deliberately disagree about adjacency:

| | honours `traversal`? | question it answers |
|---|---|---|
| `reachableFrom` | yes | "what can this node see within N hops?" |
| `connectedComponents` | **no** | "what is structurally attached to this node?" |

A `directed` edge yields only its target to `reachableFrom`, so `claims.card_id` reads one way. It
yields *both* endpoints to `connectedComponents`. "These two are connected" is a structural fact
the edge asserts; "this card may see that relationship" is the projection's editorial decision, and
the two are not the same claim.

This matters even though no v1 edge is directed today. Building components on the traversal-aware
walk would be correct for the seeded corpus and wrong the moment a `directed` family existed: one
one-way edge would split a single component in two and understate connectivity, with nothing in
the test suite failing to say so. `connectedComponents` walks weak adjacency of its own, and a
hand-built directed projection pins the disagreement — `reachableFrom(B)` returns `[]` while
`connectedComponents` returns `[[A, B]]` on the same graph.

`degreeReport.total` is Graphology's `degree`, i.e. `in + out`, so **a self-loop counts two**, not
one. That is Graphology's own multigraph semantics rather than the "each incident edge once"
reading some libraries use, and it is pinned by a test rather than left to a comment.

### Cytoscape presentation layer

§10 step 5 is built: `src/graph/cytoscape-adapter.ts`. The layer boundary is the point of it, so
it is worth stating in one place:

| Layer | Owns | Never does |
|---|---|---|
| canonical ontology / `trope_graph` | identity, relations, provenance | presentation, styling, traversal |
| domain projection (`projection.ts`) | what a given view + focus + depth may see | touch Cytoscape or Graphology |
| Graphology (`graphology-adapter.ts`, `analysis.ts`) | traversal, degree, components | decide what is visible; persist anything |
| Cytoscape (`cytoscape-adapter.ts`) | element shape for a renderer | re-query, infer, mutate the ontology, own semantics |

`toCytoscapePresentation(projection)` returns `{ elements, context }`. `elements` is the flat
`ElementDefinition[]` that `cytoscape({ elements })` consumes, and `context` carries `focus`,
`view`, `depth` and `meta` — which have no home in an element, because Cytoscape has no
graph-level attribute bag the way Graphology does. Without `context` a renderer could not tell a
small graph from a capped one, nor surface the warnings that make an unpopulated layer
distinguishable from a broken request.

No `cytoscape.Core` is instantiated. The conversion is pure, so it needs no `container` and no
`headless`, and the same array can be rendered into as many cores as a page wants. The tests
build real headless cores anyway, to prove the output is accepted by the library and not merely
structurally plausible.

**Domain → Cytoscape mapping.** Everything below is a copy; nothing is derived.

| Domain | Cytoscape | Notes |
|---|---|---|
| `GraphNode.id` | `data.id` | canonical uuid, never rewritten |
| `GraphNode.type` / `label` | `data.type` / `data.label` | verbatim; no truncation |
| `GraphNode.depth` / `isFocus` / `degree` | same names | the projection's own numbers, not recomputed |
| `GraphNode.status` | `data.status` | incl. the `source` tag, so Q4's decoupling survives |
| `CardNode.classification` | `data.classification` | **card only**; the key is absent elsewhere |
| `GraphNode.metadata` | `data.metadata` | type-specific bag, verbatim |
| `GraphEdge.id` | `data.id` | the deterministic `buildEdgeId` composite |
| `GraphEdge.from` / `to` | `data.source` / `data.target` | authored direction, never swapped |
| `GraphEdge.family` | `data.family` | kept separate from `relation` on purpose |
| `GraphEdge.type.value` | `data.relation` | meaningless without `family`, which is why both ship |
| `GraphEdge.type.vocabulary` | `data.vocabulary` | present only for `inference_step_relations` |
| `GraphEdge.sourceTable` | `data.sourceTable` | which vocabulary the relation word came from |
| `GraphEdge.traversal` | `data.traversal` | a walk rule; it never becomes `target` |
| `GraphEdge.attributes` | `data.projectionAttributes` | `role`, `ordinal`, `description`, … |
| — | element `classes` | presentation only: `type-*`, `status-*`, `is-focus`, `family-*`, `relation-*`, `traversal-*` |

**Cytoscape mutations are not persisted.** A renderer may move nodes, add classes, restyle or
delete elements, and none of it reaches `trope_graph`. There is no write-back path, and one should
not be added casually: an edit made in a view is an edit made in *a projection*, which is a
depth-bounded, filtered slice — so a mutation cannot be promoted to canonical without a decision
about which view asserted it and with what authority. Issue #3 lists graph editing as a non-goal
for this reason, not merely as scope.

**The id question was deliberately left open.** Issue #3 asks whether `GraphNode.id` should
become type-qualified. This layer does not answer it, because the adapter does not need to: node
ids are `trope_graph` uuids and edge ids are `family|from|TYPE|to[|discriminator]`, so a uuid
cannot contain the `|` delimiter and the two id spaces cannot collide. That is now pinned by a
test rather than asserted here, and it is tracked as a graph-contract hardening item
(`as-truth-cards-2bq`) rather than left to a future reader. What makes it non-optional is
Cytoscape's silence about ids —
measured against 3.34.3, two nodes sharing an id merge into one node, two edges sharing an id
merge into one edge, and an edge whose id equals a node id is **discarded with no error**, so a
projection bug would render a quietly smaller graph with nothing failing. The adapter therefore
refuses all three (`CytoscapeAdapterError`) rather than disambiguating. If a type-qualified id
scheme ever produces a real collision, the correct response is to stop and take it to Issue #3,
not to prefix ids inside a presentation layer.

### Deliberately not built

Cytoscape layout, styling and interaction (the adapter produces elements and no CSS), persisted
metrics, write paths, write-back, auth. §10 steps 6–8 remain.

The analysis surface is deliberately narrower than §3.2's list. Centrality, shortest path,
clustering and community detection are **not** implemented, because on the seeded ontology each
would measure the seed's arbitrary traversal bounds rather than the corpus — `depth: 2` plus the
v1 families yields mostly isolated cards, so a betweenness score would be an artefact of the
projection cap wearing a number. They stay unbuilt until the corpus supports a question they can
honestly answer. See Issue #3's open questions on that boundary.

Two ontology gaps surfaced while writing the tests, both left unfixed rather than papered over:

- **`evidence_item` and `source` nodes have zero seeded rows.** The `evidence_*` layer is
  schema-only, so no projection can currently produce them. The adapter handles them and the test
  builds one by hand, so the handling is pinned before the first evidence row exists.
- **No v1 family emits `traversal: 'directed'`.** The adapter supports it defensively; nothing
  produces it.
