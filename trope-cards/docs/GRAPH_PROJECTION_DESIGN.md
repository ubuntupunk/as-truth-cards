# Graph Projection Design (v1) — Design Only

**Status:** Design / discovery. No schema, dependency, API, or UI change is included.
**Scope:** Define the first read-only domain graph projection over the canonical `trope_graph` ontology, ahead of any Graphology/Cytoscape work.
**Authority:** `docs/ADR_GRAPH_LAYER.md` (layers & guardrail), `docs/TROPE_GRAPH_SCHEMA.md` (card ontology), Issue #2 (Suit/Axis), Issue #3 (projections).
**Grounded in:** `trope_graph` Drizzle schema (5 modules), migrations `0001`–`0008`, the DB-independent seed corpus, the validators, `verify-seed.ts`, and a live read-only count of the local `trope_cards_dev` graph. Full graph gate passed at authoring time (36/36 tests, `drift:false` over 389 facts, exit 0).

## 0. Scope and non-goals

- **Canonical:** PostgreSQL + Drizzle + the existing `trope_graph` schema. It is the only knowledge model.
- **Forbidden (this document does not):** add a `Trope`/`TruthCard`/`trope_edge` ontology; use a graph database; reintroduce Prisma for the graph; treat a card as the atomic unit of truth; implement the API, Graphology, Cytoscape, or any UI.
- **Suit/Axis (Issue #2) is authoritative.** Axis is never derived from legacy `primaryType`; multi-valued axis is preserved; Suit/Collection, Axis, Mechanism and Concept stay distinct dimensions.

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

- **Classification:** `collections`, `card_collections`, `card_axes`, `mechanisms`, `card_mechanisms`, `concepts`, `card_concepts`.
- **Assertion:** `cards`, `claims`, `sources`, `claim_sources`, `interpretations`, `claim_interpretations`, `interpretation_sources`.
- **Argument:** `inference_steps`, `inference_premises`, `inference_conclusions`, `claim_relations`, `argument_chains`, `argument_chain_steps`, `inference_step_relations`.
- **Evidence/provenance:** `evidence_items`, `evidence_sources`, `evidence_claims`, `evidence_interpretations`, `evidence_inferences`.
- **Events/moderation/version:** `cases`, `case_legal_metadata`, `card_cases`, `questions`, `question_cards`, `question_claims`, `question_sources`, `research_events`, `contributions`, `card_versions`, `relationships`.

### 1.2 What is populated (live)

| Structure | Rows | Notes |
|---|---|---|
| `cards` | 47 | every card has an axis, ≥1 suit, ≥1 mechanism |
| `card_axes` | 56 | 9 multi-axis cards; `ordinal=0` is primary; TACTIC 18 / FACT_REBUTTAL 27 / THEOLOGICAL 10 / HISTORICAL 1 |
| `card_collections` / `card_mechanisms` | 47 / 58 | classification links |
| `claims` | 19 | only **6 of 47** cards carry claims (the identity-retrojection cluster) |
| `inference_steps` (+premises/conclusions) | 4 (9/4) | only **2** cards carry argument structure |
| `argument_chains` (+membership) | 2 (4) | 1 PRIMARY_ARGUMENT, 1 COUNTERARGUMENT |
| `inference_step_relations` | 2 | step↔step CHALLENGES/QUALIFIES |
| `relationships` | 11 | all `CARD→CARD`; RELATED 3, CONTEXTUALISES 4, SIMILAR_MECHANISM 3, CHALLENGES 1 |
| `concepts` | 6 | **0 `card_concepts` links — fully orphaned** |

### 1.3 What is empty (live)

`sources`, all five `evidence_*` tables, `claims`→`sources`, `cases`/`case_legal_metadata`/`card_cases`, `interpretations`/`claim_interpretations`/`interpretation_sources`, `questions` (+3 link tables), `claim_relations`, `claim_sources`, `contributions`, `research_events`, `card_versions`, `card_concepts`. The evidence and case layers are **schema-only**.

### 1.4 Structural facts that shape any projection

- **Two unrelated card models exist.** The graph card (`trope_graph.cards`, `uuid`, `slug`) is the research entry point. The host deck also has a Prisma `public.cards` (`int` id, different fields). They share no key. A projection over `trope_graph` must not conflate them.
- **`primaryType` is legacy, write-only.** Written by the seeder, read by nothing in the graph. It disagrees with axis on real cards — proof they are independent dimensions, not one field under two names. It must never seed axis.
- **Card → claims → inference is the argument backbone.** `inference_premises` (claim→step, with `PRIMARY/CONTEXT/BRIDGE/COUNTERPREMISE` role) and `inference_conclusions` (step→claim) reconstruct `Source→Evidence→Claim(premise)→Inference→Claim(conclusion)` without flattening it.
- **`claim_relations` (11 typed claim↔claim relations: SUPPORTS, QUALIFIES, ANACHRONISTICALLY_MAPS, RETROSPECTIVELY_IDENTIFIES, …) is declared but has 0 rows and no writer.** The claim-relation *vocabulary* exists; the *data* does not. This is central to §8.
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
**Excluded from v1 nodes:** `concept` (orphaned — §8 B1), `source`/`evidence_item` (empty), `case`, `interpretation`, `question`, `argument_chain` (carried as step metadata, see §11 Q6), `relationship` (an edge, not a node).

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

**Axis is deliberately NOT an edge and NOT a node.** It is an ordered attribute on the card node (badge), matching Issue #2. **Concept is reserved but excluded** until `card_concepts` is populated.

---

## 3. Node model

Every node: `{ id, type, label, ...typed metadata, epistemicStatus?, provenance?, classification? }`. `id` is the domain primary key (`uuid`) and is stable; `slug` is carried as human-readable metadata, not as the identity. All IDs are the canonical Postgres `trope_graph` uuids — no new identifiers are minted for the graph.

| Node `type` | `id` | `label` | Key metadata | Epistemic status | Provenance | Classification |
|---|---|---|---|---|---|---|
| `card` | `cards.id` | `title` | `slug`, `summary`, `coreQuestion`, `primaryType` *(flagged legacy)* | `cards.epistemic_status` (enum) | — (entry point) | `suits[]`, `axes[{axis, ordinal, primary?}]`, `mechanisms[]` |
| `claim` | `claims.id` | `statement` | `claimType`, `description`, `cardId` | `claims.epistemic_status` (enum) | reserved (empty today) | — |
| `inference_step` | `inference_steps.id` | `label` | `inferenceType`, `description`, `notes`, `isCanonical`, `chain{membership}`, `premises[{claimId, role, ordinal}]`, `conclusions[{claimId, ordinal}]` | `inference_steps.epistemic_status` (**text** — §8 B4) | reserved (evidence_inferences empty) | — |
| `collection` (Suit) | `collections.id` | `name` | `slug`, `description` | — (browse taxonomy) | — | — |
| `mechanism` | `mechanisms.id` | `name` | `slug`, `description` | — (analytical taxonomy) | — | — |

Invariants: `concept`/`source`/`evidence_item`/`case`/`interpretation`/`question` node types are **defined in the model but produce no nodes in v1** (empty/orphaned sources). Epistemic status is **per-node-type** and never merged into a single graph-wide field.

---

## 4. Edge model

Every edge: `{ id, type, from, to, ...attributes }`. `id` is deterministic: `"{fromId}|{type}|{toId}"`, disambiguated by premise `role`/`ordinal` or step-relation where the same pair repeats. Edges are only emitted when both endpoints are present in the node set (§6, invariant 3).

### 4.1 Relationship-vocabulary map (which relation lives where)

The words SUPPORTS/CHALLENGES/QUALIFIES/CONTEXTUALISES appear in **five** different vocabularies with no cross-mapping. A projection must not treat them as one generic `EDGE`:

| Vocabulary | Home table | Node pair | Class | v1 populated? |
|---|---|---|---|---|
| `SUPPORTS, CHALLENGES, QUALIFIES, CONTRADICTS, CONTEXTUALISES, EXEMPLIFIES, REQUIRES, GENERALISES, EQUATES, ANACHRONISTICALLY_MAPS, RETROSPECTIVELY_IDENTIFIES` | `claim_relations` | claim ↔ claim | **direct domain** | **No — 0 rows, no writer (§8 B2)** |
| `PREDECESSOR, RELATED, SIMILAR_MECHANISM, SUPPORTS, CHALLENGES, COMPETING_INTERPRETATION, CONTEXTUALISES, EXAMPLE_OF, DERIVED_FROM, CONTRADICTS` | `relationships` (polymorphic) | any ↔ any | **direct domain** | Yes for CARD↔CARD (RELATED/CONTEXTUALISES/SIMILAR_MECHANISM/CHALLENGES) |
| `CHALLENGES, QUALIFIES, ALTERNATIVE_TO, DEPENDS_ON, REFINES, CONTEXTUALISES` | `inference_step_relations` | inference ↔ inference | **inference** | Yes (2 rows) |
| `PRIMARY, CONTEXT, BRIDGE, COUNTERPREMISE` | `inference_premises.role` | claim → inference | **inference** (premise role) | Yes (9 rows) |
| `SUPPORTS, CHALLENGES, QUALIFIES, CONTEXTUALISES, ILLUSTRATES, REPORTS, ATTRIBUTES` + `strength` | `evidence_claims.relation` | evidence ↔ claim | **evidence** | No — evidence empty |
| `DERIVED_FROM` / `USED_BY` (defaults) | `evidence_sources` / `evidence_inferences` | evidence ↔ source / inference | **evidence** | No |
| classification (suite/membership) | `card_collections`, `card_mechanisms`, `card_axes` | card ↔ taxonomy | **presentation** | Yes |

**Consequence for the argument view:** the claim↔claim argument edges in v1 come from `inference_premises` / `inference_conclusions` (premise role + step type) and `inference_step_relations` — **not** from `claim_relations`. `ANACHRONISTICALLY_MAPS` and `RETROSPECTIVELY_IDENTIFIES` are currently represented only as `inference_type` values on steps, not as `claim_relations` rows. The projection preserves whatever the schema holds; it does not synthesize the missing claim-relations.

`EXEMPLIFIES` (claim) and `EXAMPLE_OF` (relationship) are distinct values; the projection does not unify them. `IN_SUIT`/`HAS_MECHANISM` are presentation-class edges (browse facets), semantically distinct from argument edges.

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

Relational → normalized domain projection → (future) Graphology. The projection is computed by Drizzle/SQL; Graphology is a later, ephemeral consumer.

```
Postgres / Drizzle  ──(view adjacency rules)──▶  normalized projection {nodes, edges}  ──(later)──▶  Graphology
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
| `taxonomy` | card / mechanism / collection | card, mechanism, collection | HAS_MECHANISM, IN_SUIT, (+Concept when B1 resolved) | `card_*`, `mechanisms`, `collections`, `concepts` | v2; concept blocked by B1 |
| `argument` | card / claim | card, claim, inference_step | PREMISE_OF, CONCLUDES, step-relations, ASSERTS | `claims`, `inference_*` | v2; rich on 2 cards today, scales with claim corpus |
| `evidence` | claim / source | claim, evidence_item, source, inference_step | evidence_claims, evidence_sources, evidence_inferences | `evidence_*`, `sources` | **designed, data-blocked** (0 rows) |
| `identity-retrojection` | claim / card | claim, inference_step (+source/evidence later) | premise→step→conclusion with `RETROSPECTIVE_IDENTITY`/`ANACHRONISTIC_MAPPING` | `inference_steps`, `claims` | v3; 2 cards carry `RETROSPECTIVE_IDENTITY`/`ANACHRONISTIC_MAPPING` today |

All five share the §3 node model and §4 edge model; only the allowed `(node, edge)` transitions differ. No new ontology is introduced by any view.

---

## 8. Blocking schema issues (must be decided before they can block the chosen view)

**Definition:** a blocking issue is one that prevents a **clean** projection of a view the design wants to ship. Each is a decision for the maintainers, not a silent fix here.

- **B1 — `card_concepts` is never populated; all 6 concepts are orphaned.** `card_concepts` exists (2 FKs + PK) and `seed/index.ts` inserts the 6 `concepts` rows, but there is **no `cardConcepts` insert anywhere**, and `CardSeed` has no `concepts` field. *Effect:* a Concept node in any view is isolated; a concept/taxonomy view cannot render. *Decision:* populate `card_concepts` (separate issue) or formally retire Concept from the taxonomy view. **This design excludes Concept from v1.**
- **B2 — `claim_relations` has 0 rows and no code path.** The table, the 11-value `claim_relation_type` enum, indexes, and FKs all exist, but no module imports it, no seeder/validator/test writes it. *Effect:* the claim↔claim relations named in ADR §5 / Issue #3 (SUPPORTS, QUALIFIES, ANACHRONISTICALLY_MAPS, RETROSPECTIVELY_IDENTIFIES, …) have **no representable data**; the only current carrier of retrospective/anachronistic mapping is `inference_steps.inference_type`. *Decision:* is `claim_relations` intended to be populated (making it first-class) or is it duplicative of the inference model and should be retired? **This design does not populate it and routes v1 argument edges through `inference_*`.** This is the single biggest open ontology question (§11 Q1).
- **B3 — `relationships` is polymorphic with no referential integrity.** `from_entity_type`/`to_entity_type` are free text; `from_entity_id`/`to_entity_id` are unconstrained uuids with **no FKs**. A projection cannot verify an endpoint exists or that a `*_entity_type` string is a known type. *Effect:* reading `relationships` as a trusted edge source is unsafe for arbitrary types. *Mitigation (v1):* only project rows where both `*_entity_type == 'CARD'` and both uuids resolve to cards; surface any other row as a `meta.warnings[]` entry rather than dropping it silently. All 11 current rows are CARD→CARD, so v1 is safe today. *Decision:* harden to typed FKs / an entity-type enum, or keep polymorphic + defensive filter (§11 Q5).
- **B4 — Status is modelled inconsistently; a single cross-entity status filter is unsound.** `epistemic_status` is the `enum` on `cards`/`claims` but `text` on `inference_steps`/`argument_chains`; lifecycle uses four unrelated enums plus `inference_steps.is_canonical` (boolean) and `evidence_items.evidence_status` (text, no vocabulary). *Effect:* a projection offering one graph-wide "status" filter/rollup would be wrong. *Mitigation:* expose `epistemicStatus` per node type only (§3); no global status. *Decision (§11 Q4):* unify inference status onto the enum, or keep it deliberately decoupled per `EVIDENCE_LAYER.md`?
- **B5 (evidence view only) — two competing source-attachment paths.** `claim_sources` (claim→source directly, with `quote_or_excerpt`/`page_reference`) bypasses the located-passage model, and a source can be reached four ways (`claim_sources`, `interpretation_sources`, `question_sources`, `evidence_sources`). `EVIDENCE_LAYER.md` says do not use `claim_sources` when the passage is known, but the table remains. *Effect:* the `evidence` view has no unambiguous claim→source path. Not a v1 blocker (0 rows). *Decision:* retire/deprecate `claim_sources` when the evidence corpus is populated.

**Data gaps that are not schema defects but gate the richer views:** the evidence layer, `sources`, `cases`, `interpretations`, and `questions` are schema-only (0 rows); 41 of 47 cards have no claims; only 2 cards have argument chains. These are corpus-population tasks, not blockers of the v1 projection.

---

## 9. Deferred issues (known imperfections — do not block v1)

- `primaryType` is legacy/write-only — documented, excluded from all classification authority (Issue #2).
- `mechanisms`/`concepts` slug collision on `collectivisation` and `racial-essentialism` (two tables, two `UNIQUE(slug)`, near-duplicate definitions). Resolve when `card_concepts` (B1) is addressed.
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

Mirrors ADR §9, grounded in the findings above. **Nothing in this document is implemented.**

0. **Land this design** (docs only).
1. **Decide the blocking issues (B1–B5) as scoped, separate issues** — especially B2 (populate vs retire `claim_relations`) and B1 (populate vs retire Concept). Do not fix them silently.
2. **Build the read-only projection service** (Drizzle, in `trope-cards`) and the `GET /api/graph` endpoint for `view=card-argument-taxonomy` (focus + depth + filters). No Graphology, no UI change, no schema change.
3. **Add projection tests** asserting the §6 invariants, including: endpoints-in-nodes, per-type status, multi-axis preserved with primary marker, `primaryType` never used for axis, and no second ontology.
4. **Build the Graphology adapter** over `{nodes, edges}`; add traversal/metrics (shortest path, connected components, centrality) behind the API, returning domain-level results.
5. **Populate the claim/evidence/case corpus** — unblocks `argument` depth, the `evidence` view, and Source/Evidence nodes.
6. **Add richer views** (`taxonomy`, `argument`, `evidence`, `identity-retrojection`) as their data lands.
7. **Add Cytoscape as a lazy-loaded graph view** consuming `/api/graph`.
8. **Persist derived metrics** only on demonstrated product need; write/edit graph workflows only after auth/authorization.

---

## 11. Open architectural questions (require human decisions)

1. **`claim_relations`: populate or retire?** (B2) Does the 11-value claim-relation vocabulary become first-class data, or is it duplicative of the inference-step model? This decides whether claim↔claim SUPPORTS/QUALIFIES/ANACHRONISTICALLY_MAPS/RETROSPECTIVELY_IDENTIFIES edges exist at all.
2. **Concept: first-class or retired?** (B1) Populate `card_concepts`, or remove Concept from the taxonomy view? Interacts with the mechanism/concept slug collision.
3. **Suit vocabulary reconciliation (Issue #2).** Issue #2 names suits `CLASSIC/ZIONISM_CODED/REGIONAL/REFERENCE/CONTESTED`; the live collections are `classic/zionism-coded/south-africa/fact-rebuttal/foundational` and no `contested` collection exists. Which vocabulary is canonical? (Issue #2's decision; this design uses `collections` as-is.)
4. **Epistemic status: unify or keep decoupled?** (B4) Should `inference_steps`/`argument_chains` migrate to the `epistemic_status` enum, or stay deliberately independent text per `EVIDENCE_LAYER.md` "never collapse these"? Affects node metadata and any status filter.
5. **`relationships` hardening.** (B3) Keep polymorphic with a defensive projection filter, or migrate to typed FKs / an entity-type enum?
6. **Are `argument_chains` first-class graph nodes, or grouping metadata on inference steps?** This design uses metadata; a chain-as-node model would enable chain-level focus/traversal.
7. **Stable public identifiers.** Expose uuid only, or also slugs? `claims` have no slug. Related: should the API resolve a card by its human slug, uuid, or both?
8. **Card identity across the two card models.** How should the graph `card` relate to the separate Prisma `public.cards` deck model (different ids/fields, no shared key) without creating a second ontology? This design does not bridge them.
9. **Depth semantics.** Is `depth` a hop count across all edge families combined, or tracked per family (e.g. taxonomy depth vs argument depth)?
10. **Projection caching/materialisation.** Computed on demand per request for v1; should a cache or materialised projection (e.g. per corpus version) be introduced on demonstrated need?
