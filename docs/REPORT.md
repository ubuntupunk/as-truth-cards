# Architecture Audit — `ubuntupunk/as-truth-cards`

**Date:** 2026-09-27 · **Commit:** `dc47579` (branch `main`) · **Mode:** inspection-only
**Purpose:** prepare a second, tightly scoped implementation mission for the *Trope Deck with Ontologies* target architecture.

**Confidence legend**
- **HIGH** — directly established by code/config
- **MEDIUM** — strong inference from implementation
- **LOW** — plausible, requires confirmation

> This report is documentation only. No repository code, schema, data, or configuration was modified during the audit. The single file created is this report.

---

## 1. Current architecture

The repository contains **two independent stacks with no bridge between them.** They share a repository and a Postgres instance; they share no schema, no API, no data flow, and no vocabulary.

### Stack A — Host application (repository root)

The only runnable application. A Vite SPA using Preact aliased through `preact/compat` (React 18 API surface), Tailwind, and shadcn-style primitives, backed by Express + Prisma against Neon Postgres.

| Concern | Implementation | Role today |
|---|---|---|
| ORM / DB | `prisma/schema.prisma` → `public.cards`, `UserProfile`, `interactions` | Sole content store |
| Migrations | **none** — no `prisma/migrations/` | Schema file only; DB state not reproducible from repo *(HIGH)* |
| Seed | `server/seed.ts` | Loads flat card rows |
| API | `server/api/cards.ts`, `server/api/interactions.ts` | Full card CRUD; behavior capture. No request-schema validation, no auth on card routes *(HIGH)* |
| Deck UI | `src/components/CardDeck.tsx` | Fetches `/api/cards`, shuffles client-side, filters, flips |
| Card UI | `src/components/Card.tsx` | Flip interaction, submits to `interactions` |
| Admin | `src/components/admin/CardEditor.tsx`, `CardList.tsx` | Flat authoring surface |
| Access control | `src/hooks/useAdminCheck.ts` | Hardcoded env allowlist + call to a non-existent endpoint. **Not a security control** *(HIGH)* |
| Navigation / chrome | `Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx` | Static, model-agnostic |
| Search | **none** | No search index, no query endpoint *(HIGH)* |
| Tests | **none** | No test files, no configured runner *(HIGH)* |
| Deploy | `render.yaml` vs. README Vercel instructions | **Contradictory** *(MEDIUM)* |

`dist/` contains **zero** references to `trope_graph` — the graph is in no bundle *(HIGH)*.

### Stack B — `trope-cards/` (subdirectory)

A **database and documentation subproject, not an application.** It has no `package.json`, no React, no Vite, no routes, no server, and no client. It carries its own `tsconfig.json` and `drizzle.config.ts` and was registered into host tooling by commit `2f31a99`.

| Concern | Implementation | Role today |
|---|---|---|
| Schema | `trope-cards/src/db/schema/` — **36 tables, 17 enums** | Canonical research model, unconnected |
| Migrations | `trope-cards/drizzle/0001…0007_*.sql` (hand-written) | Canonical record of what was actually built |
| Seed | `seed/taxonomy.ts` → `draftCards.ts` (45) + `identityRetrospection.ts` (2) | 47 cards, 19 claims, 11 relationships, 4 inference steps, 2 argument chains |
| Claims corpus | `trope-cards/data/claims.json` | 152 records, **0 seeded** |
| Validation | static validators + `verify-seed.ts` (double-seed idempotency) | `validation-report.json` green, with warnings |
| Docs | `trope-cards/docs/` (14 documents) | Architectural reference — **not** proof of implementation |
| History | `trope-cards/versions/` (v0.1–v0.9 trees) | Preserved design history |

**Confirmed integration absence:** no `.ts`/`.tsx` file outside `trope-cards/` references `trope_graph`. There is no graph API, route, or client import *(HIGH)*.

### The naming collision at the heart of the problem

The word **"card" denotes two incompatible things**:

- **Stack A:** a shuffleable deck entry — an atomic research object and a complete unit of truth.
- **Stack B:** an *entry point* into a claim graph — presentation over independently representable claims, evidence, sources, cases, interpretations, and inferences.

Every migration decision in §9 reduces to resolving which of these the product is.

---

## 2. What is reusable

### Retain as-is *(HIGH unless noted)*

- **`CardDeck.tsx` + `Card.tsx` interaction design.** Shuffle, filter, flip, and interaction capture are orthogonal to the data model. The best engineering in the host, and it survives any backend change. Directly satisfies the architectural direction that the shuffle-deck frontend be preserved where practical.
- **shadcn `ui/` primitives, Tailwind theme, dark mode, `Header`/`Footer`.** Model-agnostic.
- **The entire `trope-cards` seed architecture.** Taxonomy-first, slug-keyed lookup maps, and — importantly — referential integrity that **throws** rather than silently dropping a classification (`seed/index.ts:186-200`), whose comment states the intent explicitly: *"Skipping would leave a card that silently lost a classification, which is the kind of quiet data loss this graph is meant to make impossible."* This is the best-engineered code in the repository. (See §4 for the one place it violates its own principle.)
- **The 7 hand-written migrations** as the canonical record of what exists.
- **`versions/` v0.1–v0.9.** Genuine design history; cheap to retain. (Note: three divergent `draftCards.ts` copies create a live grep hazard — MEDIUM.)
- **Type derivation discipline in `seed/types.ts`.** Seed vocabularies are derived from the Drizzle `pgEnum` declarations rather than restated, so an enum change is a compile error instead of a mid-transaction runtime failure. The header comment documents that hand-written unions *"had already drifted once during the v0.1-v0.9 consolidation."*

### Retain with adaptation

- **Host `Card` model → deck projection.** Keep the UX; drop the columns that duplicate graph concerns. Specifically `sources Json?` must be **dropped, not migrated** — the graph owns sourcing and does it properly *(HIGH)*.
- **`server/api/interactions.ts`.** The correct/wrong/helpful lifecycle works unchanged against a graph card id, since both are UUIDs. This is the **only behavioral data in the repository** and the graph models no equivalent — retaining it is a hard requirement, not a nicety *(MEDIUM)*.
- **`trope_graph` schema as the target model** *(HIGH)*.
- **Static validators + `verify-seed.ts`.** The double-seed idempotency check is the right idea; it needs its coverage widened (§4).

### Potentially obsolete

- **`public.cards.sources Json?` and `tags Json?`** — duplicate or conflict with graph claims, sources, and status *(MEDIUM)*.
- **The two booleans on `public.cards`** — no defined meaning anywhere in the ontology and no consumer found *(MEDIUM)*.
- **`src/data/cards.ts`** — orphaned legacy corpus, apparently imported by nothing *(MEDIUM — needs a final import check)*.
- **`useAdminCheck.ts`** — broken by design and misleadingly named *(HIGH)*.
- **Flat authoring UI** (`CardEditor.tsx`) — writing to a table that will not be canonical *(HIGH)*.

### Unclear — requires editorial/architectural decision

- **`primaryType` / `card_type`** (TACTIC, FACT, THEOLOGY, CASE, REFERENCE). It *is* persisted as `cards.primary_type`, but the ontology has no concept explaining whether a card's *type* is intrinsic, editorial, or a `collection`/`concept` relationship. All 47 cards carry one; nothing consumes it *(MEDIUM)*.
- **`collections` (5).** Membership is well-populated via `card_collections`, but the boundary between "collection" (browse grouping) and "concept" (analytical construct) is never stated in the documents *(MEDIUM)*.
- **The 152-record `data/claims.json`.** Extraction corpus, methodology documented, but never seeded or reconciled against the 19 seeded claims *(HIGH that it is unreconciled; LOW on intent)*.

---

## 3. Flat-card assumptions / architectural debt

The host encodes what should be an ontology as columns on a single row. Each item gives the location and why it conflicts with the target architecture.

| # | Assumption | Location | Why it conflicts | Conf. |
|---|---|---|---|---|
| 1 | **Card = atomic research object / unit of truth** | `prisma/schema.prisma` `Card`; `backDescription` | Directly violates the documents' central rule: *"The graph must not collapse these seven questions into one claim"* (`docs/IDENTITY_RETROJECTION_CLUSTER.md:28`). No claim entity exists; argument lives as prose. | HIGH |
| 2 | **Evidence attached to cards, not claims** | `Card.sources Json?` | Target direction requires evidence to attach to *claims/evidentiary propositions*. Host has untyped JSON — no locator, no evidence type, no per-claim granularity. The graph's 5 evidence tables are the replacement and are **empty**. | HIGH |
| 3 | **No epistemic status anywhere** | `prisma/schema.prisma` | The graph keeps **four deliberately separate** status enums (`epistemic_status` on cards/claims/interpretations, `inference_status`, `chain_status`, `evidence_status`). The host cannot represent the corpus's real distribution — 19 CONTESTED, 15 CONTEXT_DEPENDENT, 8 ESTABLISHED, 3 LIVE — at all. | HIGH |
| 4 | **Mechanisms/categories as intrinsic properties** | `Card.tags Json?` | Should be graph relationships. Graph has 3 link tables (`card_collections`, `card_mechanisms`, `card_concepts`) and 6 concepts. A flat string bag erases the distinction. | HIGH |
| 5 | **Arguments collapsed into card text** | `Card.frontDescription` / `backDescription` | The graph has first-class `inference_steps` + `inference_premises` + `inference_conclusions` and `argument_chains` + `argument_chain_steps` + `inference_step_relations`. 4 inference steps and 2 chains exist with **no host analogue at all**. | HIGH |
| 6 | **Sources as metadata** | `Card.sources Json?` | Target direction requires sources as **first-class objects**. Graph has `sources` + `claim_sources`, both empty. | HIGH |
| 7 | **Epistemic status at the wrong level** | whole host model | Status is absent, so the only implicit status is "the card is true" — the exact conflation the four-enum design exists to prevent. | HIGH |
| 8 | **Cases as mere examples** | no `cases` table | Target requires `cases`, `case_legal_metadata`, `card_cases`. All empty. 4 cards carry `primaryType: 'CASE'` with no case entity behind them. | HIGH |
| 9 | **Relationships encoded only via card IDs** | `server/api/cards.ts` returns flat rows | The API response shape *forces* the old model — 11 relationships, 2 argument chains, and all inference structure are invisible to the client. | HIGH |
| 4b | **Validation assuming one-card/one-truth** | `useAdminCheck.ts`; absence of claim-level validation | Nothing validates truth claims; nothing can, because there are no claims. | HIGH |
| 10 | **Two unreconcilable sources of truth** | `public.cards` vs `trope_graph.cards` | Nothing prevents divergence. Highest-risk item in the system. | HIGH |
| 11 | **Implied "falsehood card" framing** | host titles/layout | `IDENTITY_RETROJECTION_CLUSTER.md:57` explicitly prohibits reducing a documented claim to a *"falsehood card"* and requires disputes to be resolved in `interpretations` / `claim_interpretations`. The host has neither. | HIGH |
| 12 | **Two booleans of unknown provenance** | `prisma/schema.prisma` | No definition, no consumer, no graph equivalent. | MEDIUM |

---

## 4. Graph architecture coverage

### 4.1 Per-concept classification

Classification per the audit brief: *no implementation* / *partial* / *adaptable* / *obsolete model*. **A similarly-named existing type was not assumed equivalent.**

| Concept | Host equivalent | Graph status | Classification | Conf. |
|---|---|---|---|---|
| **Card** | `public.cards` (flat) | `trope_graph.cards`, 47 rows | **Adaptable** — real table, but still carries card-as-unit-of-truth fields; serves as presentation entry point as intended | HIGH |
| **Claim** | *none* — prose in `backDescription` | `claims`, 19 rows | **Partial** — table exists, 12% of the 152-claim corpus seeded, no source/evidence linkage | HIGH |
| **Source** | `Card.sources Json?` | `sources`, `claim_sources` — 0 rows | **No implementation** (schema only) | HIGH |
| **Evidence** | *none* | 5 evidence tables — 0 rows | **No implementation** (schema only) | HIGH |
| **Case** | *none* | `cases`, `case_legal_metadata`, `card_cases` — 0 rows | **No implementation** (schema only) | HIGH |
| **Concept** | *none* | `concepts` 6 rows; `card_concepts` **never inserted** | **Partial / effectively no implementation** — see §4.2 | HIGH |
| **Interpretation** | *none* | `interpretations`, `interpretation_sources`, `claim_interpretations` — 0 rows | **No implementation** (schema only). Required by the "competing interpretations" directive. | HIGH |
| **Question** | *none* | `questions`, `question_cards`, `question_claims`, `question_sources` — 0 rows | **No implementation.** Speculative — scope unclear (see §10) | MEDIUM |
| **Argument** | *none* | `argument_chains` 2, `argument_chain_steps` 4 | **Partial** — 2 chains against 47 cards | HIGH |
| **Inference** | *none* | `inference_steps` 4, premises 9, conclusions 4, step relations 2 | **Partial** — and does not satisfy the documents' own spec (see §4.2) | HIGH |
| **Relationships** | *none* | `relationships` 11 + 2 link tables | **Partial** | HIGH |
| **Research events** | *none* | `research_events` — 0 rows | **No implementation** | HIGH |
| **Contributions** | *none* | `contributions` — 0 rows | **No implementation** | HIGH |
| **Versioning** | *none* | `card_versions` — 0 rows | **No implementation.** `versions/` holds *source trees*, not row-level data versions — not equivalent. | MEDIUM |
| **Epistemic status** | *none* | 4 separate enums, populated on cards + claims | **Partial** — the design is correct and is the graph's strongest feature; coverage is thin and `verify-seed.ts` does not count it | HIGH |

### 4.2 Realized and validated

Collections, mechanisms, cards, claims, relationships, `card_collections`, `card_mechanisms`, and the full inference/argument-chain machinery are seeded, counted, and validated. **The epistemic separation is real and carefully documented** — see the `seed/types.ts` header: *"chain and step `epistemicStatus` are plain `string`, not the `epistemic_status` enum. That is deliberate."* This is the correct architectural instinct and should be preserved verbatim through any migration.

### 4.3 Concrete gaps and defects

1. **`axis` is authored on all 47 cards and silently discarded.** `axis: string[]` is declared in `CardSeed` (`seed/types.ts:121`) and populated on every card in `draftCards.ts` and `identityRetrospection.ts`, but the seeder **never reads `seed.axis`** — it reads only `slug`, `title`, `summary`, `coreQuestion`, `primaryType`, `status`, `editorialNotes`, `collection`, `mechanisms`. Every seed run throws `axis` away.
   This is notable because the seeder's own comment (`index.ts:186-200`) says silently dropping a classification is *"the kind of quiet data loss this graph is meant to make impossible."* `axis` is exactly that, and the integrity check covers `collection` and `mechanisms` but not `axis`. **HIGH**
2. **`card_concepts` is never populated.** No insert exists in `seed/index.ts`; the seeder inserts only `cardCollections` and `cardMechanisms`. All 6 `concepts` rows are orphaned and the table is dead weight. **HIGH**
3. **Slug collision between two tables.** `collectivisation` and `racial-essentialism` appear in **both** `mechanismsSeed` (`taxonomy.ts:48`, `taxonomy.ts:88`) and `conceptsSeed` (`taxonomy.ts:121`, `taxonomy.ts:126`) — same slug, same name, near-duplicate definitions, no cross-link. Any "cards using concept X" query is ambiguous by construction. **HIGH**
4. **Four card columns are permanently NULL.** `trope_graph.cards` declares `trigger`, `mechanismSummary`, `counterTest`, and `coreQuestion`. Across all 47 cards: `trigger`, `mechanismSummary`, `counterTest` are authored **nowhere** (0/47); `coreQuestion` is populated on only the 2 retrojection cards (2/47); `editorialNotes` on only 8/47. **HIGH**
5. **The seven-question retrojection decomposition is representable nowhere.** The document mandates decomposing *every* retrospective-identity claim into Subject, Historical period, Claimed identity, Contemporary meaning, Modern meaning, Continuity bridge, Inference — and states *"The graph must not collapse these seven questions into one claim"* (`:28`). There is no validator, no column, and no seed structure for this. Nothing can hold "Contemporary meaning" / "Modern meaning" / "Continuity bridge" distinctly; `claims.description` carries only `Evidence required: …`. **This is the single largest doc-vs-code gap.** **HIGH**
6. **The 5-arrow chain is not realized.** The document specifies a 5-arrow form where *"Each arrow is independently researchable"* (`:53`). The seeded `jesus-was-a-zionist` inference is 3 premises → 1 conclusion = **2 arrows**. **HIGH**
7. **Vocabulary fragmentation across three enums.** `RETROSPECTIVE_IDENTITY` is both the mechanism `retrospective-identity` and an `inference_type` value; `ANACHRONISM` / `ANACHRONISTIC_MAPPING` likewise. Three names, two enums, one table, no reconciling document. **HIGH**
8. **`ESSENTIALISM` is not seeded as its own row** — folded into `essentialisation` per `identityRetrospection.ts:12-17`. A *documented deliberate deviation*, but no document records the merge, and the mechanism arithmetic reconciles as 12+2, not 12+3. **HIGH**
9. **`verify-seed.ts` counts only 12 of 36 tables.** `EXPECTED` omits the 24 unseeded tables entirely, so the idempotency check is blind to them by construction. **HIGH**
10. **Phantom `claim_interpretations` references.** `IDENTITY_RETROJECTION_CLUSTER.md` (v0.6), `V0.7_MIGRATION.md`, and `V0.8_MIGRATION.md` all cite it as pre-existing; it was only created in migration `0005`. **MEDIUM**
11. **Status asymmetry.** `interpretations.status` is `epistemic_status`, but `claim_interpretations` has no status column — in a design otherwise careful not to collapse status. **MEDIUM**
12. **`validation-report.json` is green with warnings** — `double-standard` is defined but unused by any card, and the evidence layer is empty with controlled vocabularies still plain text. **HIGH**

---

## 5. Corpus / data-model observations

### 5.1 Composition

- **47 cards** = 45 (`draftCards.ts`) + 2 (`identityRetrospection.ts`), matching `verify-seed.ts` `EXPECTED` exactly *(HIGH)*.
- **Status:** CONTESTED 19 · CONTEXT_DEPENDENT 15 · ESTABLISHED 8 · LIVE 3. Contested is the plurality — **the corpus is genuinely uncertain, which is exactly what flat "truth cards" cannot express** *(HIGH)*.
- **primaryType:** TACTIC 13 · FACT 13 · THEOLOGY 8 · REFERENCE 7 · CASE 4 *(HIGH)*.
- **The claim layer is the bottleneck:** 47 cards → 19 claims → 11 relationships. Roughly **90% of the corpus has no claim decomposition** *(HIGH)*.

### 5.2 Which fields hold what

A card seed entry has 9 possible fields. Their actual content role:

| Field | Populated | Contains | Target-architecture assessment |
|---|---|---|---|
| `summary` | 47/47 | Mix of **atomic proposition** and **editorial framing**. *"Tests the proposition that Qur'anic references… establish that Muhammad held the modern political ideology of Zionism."* — proposition, but inseparable from its testing frame. | Needs splitting into claim + framing. **MEDIUM** |
| `editorialNotes` | 8/47 | **Editorial policy as data.** *"Do not collapse Jesus-as-Muslim into Jesus-as-Palestinian."* *"Do not treat recognition of a Jewish connection to the land as evidence by itself."* | This is **review guidance stored in a content column**. Genuinely valuable; has no home in the ontology. **HIGH** |
| `mechanisms` | 37/45 | **Relationships** (card→mechanism). | Correctly modeled already. **HIGH** |
| `collection` | 47/47 | **Relationships** (card→collection). | Correctly modeled. **HIGH** |
| `primaryType` | 47/47 | **Editorial framing** — a classification, not a claim. | Persisted, but ontology has no account of it. See §10. **MEDIUM** |
| `status` → `epistemicStatus` | 47/47 | **Epistemic status** at card level. | Card-level status is legitimate; the host's *absence* of it is the debt. **HIGH** |
| `coreQuestion` | 2/47 | Question framing. | Schema supports it; barely used. **HIGH** |
| `axis` | 47/47 authored | Classification across THEOLOGICAL / FACT-REBUTTAL / HISTORICAL. | **Authored and discarded — never persisted.** See §4.3. **HIGH** |
| `trigger`, `mechanismSummary`, `counterTest` | 0/47 | Columns exist in schema; authored nowhere. | Schema ahead of corpus. **HIGH** |

**Fields containing argumentation:** none on the card. Argumentation exists only for the 4 seeded inference steps and 2 chains — the rest is prose inside `summary` *(HIGH)*.
**Fields containing evidence:** none. No card or claim carries a source, locator, or citation. All evidence is prospective *(HIGH)*.
**Fields containing interpretation:** `summary` and `editorialNotes` mix interpretation with proposition; the graph's `interpretations` tables are empty *(HIGH)*.

### 5.3 Entries that stress the ontology

- **Identity-retrojection cluster** (`jesus-is-a-muslim`, `jesus-was-a-palestinian`, `muhammad-was-a-zionist`) — the documented exemplars of the seven-question rule. Three of the seven dimensions are now unrepresentable (§4.3 #5). `muhammad-was-a-zionist` is the corpus's clearest *contested* case: it tests a proposition rather than asserting it, and `status: CONTESTED` is the only thing preventing a reader from treating it as a verdict. **HIGH**
- **`land-of-the-children-of-israel`** — a *source/reference* card, not a claim card. `IDENTITY_RETROJECTION_CLUSTER.md:36-37` classifies it as a "contextual source/reference node" and explicitly says it *"should not itself infer modern territorial sovereignty or Zionist ideology."* Yet later documents (V0.7) rank it **5th** as a decomposition target, and `newIdentityClaims.ts` attaches 2 claims to it. **A documented classification is contradicted by later implementation intent.** **HIGH**
- **`theology`-typed vs `fact`-typed cards** — `jesus-is-a-muslim` (THEOLOGY, CONTESTED) and `jesus-was-a-palestinian` (FACT, CONTESTED) are near-identical in form but differ only by a `primaryType` label that no consumer reads. The distinction the editor intended is carried by a column nothing uses. **MEDIUM**
- **`chronology`** and **`cape-union-mart`** — require case/legal-reasoning structure (`cases`, `case_legal_metadata`) that does not exist. **MEDIUM**

### 5.4 The unseeded claims corpus

`trope-cards/data/claims.json`: **152 records**, a bare array of five string fields, with **no source, evidence, or claim-to-claim relationship fields**, and **0 of 152 seeded** against 19 claims in the database — 8× the seeded set, unreconciled with it *(HIGH)*. The extraction method is documented in `CLAIM_EXTRACTION.md` and trialled in `CLAIM_EXTRACTION_PILOT.md`; the output was never loaded.

Note a **document-level tension** worth flagging rather than resolving: `IDENTITY_RETROJECTION_CLUSTER.md:57` forbids reducing a documented claim to a "falsehood card," while `CLAIM_EXTRACTION.md`'s method assigns `ESTABLISHED`/`CONTESTED`/`CONTEXT_DEPENDENT` as the draft's own framing. The documents are three versions apart and never address each other. **Editorial decision — see §10.6.**

---

## 6. Git-history findings

- **6 commits touch `trope-cards/`; 27 touch `src/`, `server/`, `prisma/`.** The graph is *newer* but *less* integrated *(HIGH)*.
- **The entire graph arrived in 4 commits**, in one burst, never followed by integration work:
  `3313109` preserve v0.1–v0.9 → `2ed55a1` consolidated schema, migrations, seed → `7c0c166` architect report → `dc47579` report correction *(HIGH)*.
- **The host app has been frozen since `40eb422` "prisma", 2026-03-27** — the UI stood still while the graph was built beside it *(HIGH)*.
- **`dc47579` is titled** *"correct report; add branch history and **card-UI verdict**"* — the repository **already knows** the graph is not connected to a card UI *(HIGH)*.
- **`821ba44` filed beads issue `g66`** for `typecheck:all` host UI breakage. Host typecheck is a known-broken starting point *(HIGH)*.
- **Two eras roughly a year apart.** Repo scaffolding dates to 2025-03-18 (`gpt_engineer` init: `00b8235`, `ef41295`, `a3f1a51`); graph work is 2026-03+. The flat-card app is the legacy experiment; the graph is the deliberate recent work *(HIGH)*.
- **No commit ever added a `trope_graph` API, route, or client import** *(HIGH)*.
- **Nothing worth recovering from earlier branches.** Branches `main`, `dev`, `debug` plus origin/codeberg remotes exist; the graph's own history is preserved better in `versions/` than in any branch. Divergence not audited *(MEDIUM)*.
- **`trope-cards/docs/ARCHITECT_REPORT.md` is a briefing, not evidence.** It correctly describes the graph as disconnected, but per the audit constraints it was not treated as proof of anything.

---

## 7. Key risks and dependencies

| # | Risk | Impact | Conf. |
|---|---|---|---|
| 1 | **Two unreconcilable sources of truth.** Nothing prevents `public.cards` and `trope_graph.cards` diverging silently. | Highest risk in the system. | HIGH |
| 2 | **Bridging is an unsolved design problem, not a port.** Whether the host `Card` row survives, becomes a read-model, or is deleted must be decided *before* code. | Blocks the whole mission. | HIGH |
| 3 | **The evidence layer is the deepest hole.** 5 tables described, 0 rows, **no source-ingestion path defined anywhere**. | Any claim promoted to "sourced" is currently unsupportable. | HIGH |
| 4 | **Claim decomposition ~12% complete** (19/152) and unvalidated against the documents' own rules. | The graph's central promise is largely unbuilt. | HIGH |
| 5 | **Taxonomy collisions** (`collectivisation`/`racial-essentialism` in two tables; 3 enums for 2 concepts). | Will silently corrupt any facet query. | HIGH |
| 6 | **No tests in either system.** `verify-seed.ts` covers seed idempotency and nothing else. | No safety net for any refactor. | HIGH |
| 7 | **Unauthenticated card CRUD** with unvalidated input and untyped JSON. | Widens as the deck is published. | HIGH |
| 8 | **Host typecheck already fails** (`g66`). | Cannot verify work until fixed. | HIGH |
| 9 | **No host Prisma migrations.** | Host DB state not reproducible from the repo. | HIGH |
| 10 | **Editorial harm risk.** 40% of the corpus is CONTESTED. Flat "truth card" framing risks publishing contested claims as settled — precisely what the documents forbid. | **This is a harm risk, not merely technical.** | HIGH |
| 11 | **Live Neon database.** `assertLocalHostFromEnv` guards it, but any migration step touches production data. | Data-loss risk. | HIGH |
| 12 | **Deploy docs contradict** (Vercel in README vs `render.yaml`/Render). | Operational confusion. | MEDIUM |
| 13 | **`axis` silent data loss** on every seed run. | Editorial classification authored and thrown away. | HIGH |
| 14 | **`land-of-the-children-of-israel` classification conflict** between its defining document and later decomposition intent. | Could produce a source node decomposed as if it were a claim. | HIGH |

---

## 8. Recommended target architecture

**Principle: the graph becomes the single source of truth; the host becomes a read-only presentation layer over a graph-derived card projection. Flat columns are not ported into the graph.**

```
trope_graph  (Drizzle / Postgres)              ← canonical research model
  cards · claims · relationships
  inference_steps · premises · conclusions
  argument_chains · steps · step_relations
  sources · cases · interpretations · questions · evidence_*
        │
        │   NEW: read-model projection  (card → deck entry)
        ▼
graph read API  (Express, server/graph)        ← validation · auth · shaping
        │
        ▼
host React/Preact UI                           ← interaction design preserved
  CardDeck · Card                              (shuffle / filter / flip unchanged)
  + graph-only surfaces:
      claims panel · inference chain · competing interpretations
```

This satisfies every stated architectural direction: the graph is canonical, a card becomes an access layer, the shuffle deck is preserved as one view, claims/evidence/sources/cases/interpretations/questions/arguments/relationships are independently representable, evidence attaches to claims, the four status dimensions stay distinct, and competing interpretations are representable without forcing an editorial winner.

### Architectural seams — where to refactor

The cleanest transition boundaries. **These are identified, not performed.**

| Seam | Location | Cleanliness | Notes |
|---|---|---|---|
| **Database** | `prisma/schema.prisma` vs `trope-cards/src/db/schema/` | **Clean** — two fully separate schemas, no FKs, no shared tables | The single best boundary in the repo. Nothing to unwind. |
| **Seed / corpus** | `server/seed.ts` vs `trope-cards/src/db/seed/` | **Clean** — independent pipelines | Retire the host seeder last; the graph seeder is the keeper. |
| **API** | `server/api/cards.ts` | **Good** — one file, one shape, one consumer | Replace the projection behind it; add validation + auth. |
| **Frontend data access** | `CardDeck.tsx` fetch of `/api/cards` | **Very good** — a single fetch call is the entire coupling | Change one URL; the deck logic survives. |
| **Card rendering** | `Card.tsx` | **Clean** — presentational, model-agnostic | Retain as-is; *extend* rather than replace. |
| **Validation** | host: none · graph: static validators + `verify-seed.ts` | **Poor** — nothing validates the host, and `verify-seed.ts` covers 12/36 tables | Must be built, not moved. |
| **Editorial guidance** | `Card.editorialNotes` | **No home** — review policy stored as content | Needs a destination in the target model (§10.2). |

**Retention directives:**
- **Keep `interactions`.** Only behavioral data in the repo; the graph models none. Add a card *slug* alongside the UUID for stability across re-seeds.
- **Retire `public.cards` as an authoring surface.** Either delete it or make it a generated cache. Prefer deletion unless offline performance demands otherwise.
- **Populate `card_concepts`** as part of the graph's own work, not deferred again.
- **Resolve the `mechanisms`/`concepts` collision** before any read-model exposes a concepts facet.
- **Evidence ingestion must precede** labeling any claim ESTABLISHED in the UI.
- **Preserve the four-enum epistemic separation verbatim.** It is the graph's strongest design decision.

---

## 9. Proposed migration sequence

Sequenced so each step is independently verifiable. **No step writes to production without a verified backup and restore.**

**Step 0 — Land the enablers first. (BLOCKING)**
Fix `g66` typecheck. Add a test runner. Add request validation and real authentication to `/api/cards`.
*Rationale: everything after this is unverifiable. Do not skip.*

**Step 1 — Decide the bridge. (BLOCKING, editorial/architectural)**
One written decision: does `public.cards` survive as a cache, or is it deleted? Resolve §10.1 before writing any code.

**Step 2 — Make the graph queryable.**
A read-only projection emitting a card with its claims, mechanisms, collections, and epistemic status. No UI yet.

**Step 3 — Fix graph-internal correctness, before the projection depends on it.**
Decide `axis` (persist or delete). Populate `card_concepts`. Resolve the `collectivisation`/`racial-essentialism` collision. Decide `primaryType`'s home. Reconcile the retrojection vocabulary across three enums. Widen `verify-seed.ts` `EXPECTED` to all 36 tables.

**Step 4 — Stand up a side-by-side deck** on a route that reads only the projection. Do not touch `/api/cards` yet.

**Step 5 — Add the graph-only surfaces:** claim decomposition, inference chain, competing interpretations. *These are the features the flat model cannot express, and the actual reason to migrate.*

**Step 6 — Seed sources and evidence for the 8 ESTABLISHED cards first.** A small, defensible slice, and the first real test of the evidence model. The 19 CONTESTED cards come last, if at all.

**Step 7 — Switch the deck** to the projection behind a feature flag, keeping `public.cards` as fallback.

**Step 8 — Retire the flat authoring UI** once the deck has run on the projection.

**Step 9 — Only then** consider dropping `public.cards`, as its own reviewed DB migration.

> **Steps 3 and 6 will be underestimated.** Step 3 is graph-internal correctness that blocks the projection; Step 6 requires building an evidence-ingestion path that does not currently exist anywhere. Budget for both explicitly rather than treating them as cleanup.

---

## 10. Open architectural / editorial decisions

*Flagged for human review, not resolved.*

1. **Does `public.cards` survive as a cache, or is it deleted?** (blocking — Step 1)
2. **Where does editorial guidance live?** `editorialNotes` holds real review policy ("Do not collapse Jesus-as-Muslim into Jesus-as-Palestinian") in a content column, on only 8/47 cards. Needs a real home — and a decision on why it is so unevenly applied.
3. **Is `primaryType` / `card_type` intrinsic, editorial, or a `collection`/`concept` relationship?** It is persisted and unconsumed; the ontology has no account of it.
4. **`collectivisation` / `racial-essentialism` — mechanism or concept?** Both tables currently claim both.
5. **Is the 152-claim corpus to be seeded, curated down, or archived?** 8× the current 19, with no source/evidence/relationship fields.
6. **Should epistemic status appear on the card front?** 40% of the corpus is CONTESTED. This is an editorial and ethical decision, not a UI detail — and it interacts with the `IDENTITY_RETROJECTION` "falsehood card" prohibition (§5.4).
7. **Does the seven-question retrojection decomposition become schema** (7 columns or a dedicated table) **or a seed-time template?** It is representable nowhere today, and it is the documents' most operationally precise rule.
8. **What is the minimum evidence bar before a claim may be shown as ESTABLISHED?** No ingestion path exists.
9. **Is `axis` persisted, migrated to a concept, or deleted?** Currently authored on 47 cards and discarded on every seed.
10. **Are `questions` / `question_cards` in scope, or speculative?** Four empty tables and no seed.
11. **Is `ESSENTIALISM` permanently folded into `essentialisation`, or restored as its own row?**
12. **Which retrojection vocabulary is canonical** — the mechanism, `inference_type`, or the claim-relation name? Three names, two enums, one table.
13. **Should `land-of-the-children-of-israel` be decomposed as a claim**, given its defining document calls it a contextual source/reference node that should not itself infer political conclusions?
14. **Is `claim_interpretations` lacking a status column intentional**, given `interpretations` has one?
15. **Should `interactions` key on UUID (breaks on re-seed) or slug (stable)?** Recommend slug.

---

## 11. Files that should be inspected next

All read-only, ordered by decision value.

**Priority 1 — resolves the blocking bridge decision**
- `prisma/schema.prisma` — exactly what `public.cards` must yield, and what can be dropped
- `trope-cards/src/db/schema/tropeGraph.ts` — the `cards` / `claims` projection surface and all 17 enums
- `server/api/cards.ts` — the exact response shape `CardDeck` depends on
- `trope-cards/docs/TROPE_GRAPH_MIGRATION.md` — the project's own intended migration gates

**Priority 2 — graph correctness (Step 3 blockers)**
- `trope-cards/src/db/seed/taxonomy.ts` — the `mechanisms`/`concepts` slug collision
- `trope-cards/src/db/seed/index.ts:132-210` — the card insert, the missing `axis`, and the referential-integrity checks
- `trope-cards/src/db/seed/types.ts` — `CardSeed`, and the documented epistemic-separation rationale
- `trope-cards/src/db/verify-seed.ts` — widen `EXPECTED` beyond 12 tables

**Priority 3 — doc-vs-code reconciliation**
- `trope-cards/docs/IDENTITY_RETROJECTION_CLUSTER.md:16-28` — the seven-question rule and its prohibition
- `trope-cards/docs/CLAIM_DECOMPOSITION_ENGINE.md` — premise/conclusion model and epistemic separation
- `trope-cards/docs/EVIDENCE_LAYER.md` — the 5 evidence tables and the missing ingestion path
- `trope-cards/docs/CLAIM_EXTRACTION.md` + `CLAIM_EXTRACTION_PILOT.md` — the 152-claim method
- `trope-cards/data/claims.json` — the corpus itself
- `trope-cards/docs/ARGUMENT_CHAIN_ENGINE.md` — competing/counter-inference requirements

**Priority 4 — host health**
- `src/hooks/useAdminCheck.ts` — confirm it is not a security control
- beads issue `g66` — the known typecheck break (Step 0)
- `trope-cards/validation-report.json` — current green-with-warnings state
- `trope-cards/versions/` — v0.1–v0.9 for any discarded-but-valuable implementation
- `src/data/cards.ts` — final orphan check

---

**Audit complete.** Understanding first; change later. The next mission should be scoped to **Step 0 (enablers) + Step 1 (bridge decision)**, which are blocking and require no schema change.

## Manual follow-up: Vercel disconnect
The Vercel GitHub App (vercel[bot]) is still connected to this repo and posts failing `Vercel` statuses on every push. There are no in-repo files (`vercel.json`, `.vercel/`, `.github/`) controlling it, and the current `gh` token lacks permission to remove the installation.

Required manual action (once):
1. Go to Vercel → Project `ubuntupunks-projects/truth-cards` → Settings → Git
2. Disconnect the GitHub repository ("Disconnect from GitHub" / "Remove Git Repository")
3. This will stop future deployments and status checks. Historical failed statuses cannot be removed via this token.

Context:
- Latest failing status: commit 45efb14 (Deployment dpl_GKe79yb3MMcpEs1tGKC6jXSvqYGF)
- Latest deployments: all created by vercel[bot] on Production
