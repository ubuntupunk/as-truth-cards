# Trope Graph Project — Architecture & Data Specification

## 1. Purpose

The Trope Graph is a structured research and learning system derived from the current Antisemitism & Anti-Zionism Trope Card Deck draft.

The card is an entry point, not the atomic unit of truth. A card can lead to claims, sources, cases, concepts, interpretations, questions, and related cards. The system must allow a proposition to be tested independently of the rhetorical classification attached to it.

The architecture therefore separates:

- **Card** — editorial entry point.
- **Claim** — proposition that can be supported, disputed, qualified, or contextualised.
- **Source** — documentary or scholarly evidence.
- **Case** — concrete historical, institutional, legal, or contemporary event.
- **Concept** — reusable analytical or theological concept.
- **Interpretation** — an attributed reading of evidence where disagreement is legitimate.
- **Question** — unresolved research problem.
- **Relationship** — typed graph edge between entities.
- **Research event** — what a user explored or contributed, never a truth score.
- **Contribution** — proposed community material awaiting editorial treatment.

## 2. Design principles

### 2.1 PostgreSQL is the system of record

Use PostgreSQL/Supabase with Drizzle ORM. A separate graph database is not required for the first release. Typed relationships can be stored in PostgreSQL and traversed with indexed queries.

### 2.2 Evidence attaches to claims

Sources should normally support or challenge a specific claim rather than merely being attached to an entire card.

### 2.3 Classification is not truth

A card's `primary_type`, mechanism, collection, and epistemic status describe the editorial treatment of the material. They do not establish whether a proposition is true.

### 2.4 Evidence and epistemic status remain separate

A primary source can support a contested interpretation. A claim can have substantial evidence while the interpretation of that evidence remains disputed.

### 2.5 Community activity is not a popularity contest

User views, bookmarks, questions, source submissions, and proposed relationships should be measurable. They must not become votes on factual truth.

### 2.6 Editorial content and community submissions are separate

Canonical content is reviewed and versioned. Community material enters through contributions and is not silently promoted into canonical content.

## 3. Mapping the current draft

The current draft explicitly distinguishes four working collections:

1. Classic Tropes
2. Zionism-coded Tropes
3. South Africa / Regional Cases
4. Fact-Rebuttal Reference Cards

The current draft also uses three axes:

- Tactic-Naming
- Fact-Rebuttal
- Theological-Dispute

and a fourth editorial condition:

- Contested / legitimate-debate

The database models these independently. This prevents the existing draft's `Suit` and `Axis` fields from becoming a rigid ontology.

## 4. Card ontology

### Card types

- `TACTIC` — identifies a rhetorical mechanism or recurring argumentative structure.
- `FACT` — factual/reference material intended to test a proposition.
- `THEOLOGY` — material substantially involving scripture, doctrine, covenant, religious terminology, or theological interpretation.
- `CASE` — a concrete historical, institutional, legal, or contemporary case study.
- `REFERENCE` — foundational definitions, timelines, terminology, or other supporting material.

A card may have one primary type but can link to objects of every other type.

### Epistemic status

- `ESTABLISHED` — well-supported in the project's current evidence base.
- `CONTESTED` — credible disagreement exists over the proposition or interpretation.
- `OPEN` — an unresolved research question remains central.
- `CONTEXT_DEPENDENT` — meaning depends materially on wording, speaker, audience, or circumstances.
- `UNSUPPORTED` — adequate evidence has not yet been attached; this does **not** mean false.
- `LIVE` — active litigation, current institutional process, or another situation requiring updates.

## 5. Mechanism taxonomy

Initial reusable mechanisms from the current conceptual model:

| Slug | Name | Meaning |
|---|---|---|
| inversion | Inversion | Reverses roles, meanings, or historical relationships. |
| conspiracy | Conspiracy | Attributes coordinated hidden control to a collective actor without adequate evidence. |
| substitution | Substitution | Replaces one group/person with another while preserving a stereotype or accusation. |
| collectivisation | Collectivisation | Moves from an individual, institution, or government to a whole group. |
| exclusion | Exclusion | Treats identity or affiliation as grounds for exclusion from participation. |
| equivalence | Equivalence | Treats materially different actors, events, or categories as interchangeable. |
| double-standard | Double standard | Applies materially different evidentiary or moral standards to comparable cases. |
| essentialisation | Essentialisation | Treats a diverse population as possessing one fixed essence. |
| context-stripping | Context stripping | Removes a quotation, event, map, document, or historical episode from material context. |
| demonisation | Demonisation | Attributes inherent evil, contamination, or dehumanising characteristics to a collective. |
| guilt-by-association | Guilt by association | Treats association or affiliation as sufficient evidence of culpability. |
| racial-essentialism | Racial essentialism | Compresses a diverse population into a predetermined racial category. |

These are taxonomy records, not verdicts. A mechanism can occur in a proposition that is factually correct or incorrect.

## 6. Collections

Collections are editorial groupings and can overlap. The initial slugs are:

- `classic`
- `zionism-coded`
- `south-africa`
- `fact-rebuttal`

A future `foundational` collection should be available for cards such as Jewish / Israeli / Zionist Identity and Antisemitism vs Anti-Zionism.

## 7. Claims

A claim is a discrete proposition associated with a card.

Examples:

- “Jewish identity is being treated as evidence of divided citizenship.”
- “The *Protocols of the Elders of Zion* is a forgery.”
- “Arab citizens of Israel participate in Israeli national elections.”
- “A slogan has multiple documented interpretations depending on context.”

Claims should be small enough that individual sources can support, qualify, or challenge them.

## 8. Sources

Sources are first-class records with provenance metadata. Source types should include:

- PRIMARY_DOCUMENT
- JUDGMENT
- PLEADING
- LEGISLATION
- INSTITUTIONAL
- ACADEMIC
- BOOK
- JOURNALISM
- ARCHIVE
- OTHER

Where possible, store an archive URL in addition to the live URL.

## 9. Cases

Cases separate concrete events from abstract claims. A case can be linked to multiple cards and claims.

Legal cases should use optional `case_legal_metadata`, including court, case number, judgment date, procedural posture, and current status.

This is particularly important for the South Africa cards in the current draft, which explicitly call for case name, court, case number, date, procedural posture, and current status.

## 10. Interpretations

Interpretations represent attributed readings where the underlying evidence does not justify silently choosing one interpretation.

Each interpretation should identify its author/creator and can be linked to sources. The system should make competing interpretations visible without treating them as equally evidenced by default.

## 11. Questions

Questions are first-class research objects. Examples:

- What evidence supports the proposition?
- What evidence contradicts it?
- Does a historical analogy preserve the relevant structural features?
- What did the cited document actually say?
- What remains unresolved after reviewing primary sources?

Questions can be attached to cards, claims, sources, and cases.

## 12. Graph relationships

Use a single typed relationship table for cross-entity graph edges.

Initial relationship types:

- `PREDECESSOR`
- `RELATED`
- `SIMILAR_MECHANISM`
- `SUPPORTS`
- `CHALLENGES`
- `COMPETING_INTERPRETATION`
- `CONTEXTUALISES`
- `EXAMPLE_OF`
- `DERIVED_FROM`
- `CONTRADICTS`

Relationships themselves can have status and provenance. A community-proposed relationship must not silently become canonical.

## 13. User research trail

Record research activity as events such as:

- CARD_VIEWED
- CLAIM_OPENED
- SOURCE_OPENED
- CASE_OPENED
- QUESTION_VIEWED
- BRANCH_FOLLOWED
- SOURCE_SUBMITTED
- CASE_SUBMITTED
- QUESTION_SUBMITTED
- RELATIONSHIP_PROPOSED
- CORRECTION_SUBMITTED
- NOTE_ADDED

Do not derive a “knowledge score” from these events. The useful product is a personal research map showing what a user has explored and where questions remain.

## 14. Community contributions

Contribution types:

- SOURCE
- CASE
- QUESTION
- RELATIONSHIP
- CORRECTION
- INTERPRETATION
- NOTE

Contribution statuses:

- PENDING
- ACCEPTED
- REJECTED
- SUPERSEDED

The original contribution should remain auditable after acceptance or rejection.

## 15. Versioning

Substantive card changes should create a version record. Do not silently overwrite historical editorial content.

At minimum, `card_versions` should retain:

- version number
- content snapshot
- editor
- reason for change
- timestamp

## 16. Draft migration rule

Do not assume every row in the current Draft.md inventory should become a permanent `cards` row with identical ontology.

Examples:

- Dual Loyalty → TACTIC card.
- Jerusalem Sovereignty → FACT card.
- Replacement Theology → THEOLOGY card.
- Cape Union Mart → CASE card linked to factual claims.
- Mendelsohn → CASE card / case hub.
- IHRA Isn’t Valid → rename/reframe as `IHRA vs Jerusalem Declaration`, a REFERENCE card about a documented definitional/institutional dispute.
- Collectivisation → MECHANISM concept, not a card merely because it is named in the analytical framework.

The first migration is therefore an editorial seed dataset, not a final publication taxonomy.

## 17. Search

Initial search should use PostgreSQL full-text search or trigram indexes across:

- card title and summary
- claim statements
- source title and author
- case title and description
- concept name and definition
- question text

Semantic/vector search can be added later without changing the canonical relational model.

## 18. First release

The minimum viable graph should provide:

1. card browsing;
2. card detail pages;
3. claim/source evidence panels;
4. case pages;
5. related-card graph traversal;
6. source citations;
7. questions;
8. user research trail;
9. contribution submission;
10. editorial review;
11. version history.

## 19. Migration workflow

```text
Draft.md
   ↓
Normalized YAML seed
   ↓
Schema validation
   ↓
Taxonomy normalization
   ↓
PostgreSQL seed/import
   ↓
Editorial review
   ↓
Canonical graph
```

The YAML layer is intentional. It gives the editorial team a human-readable source corpus that can be reviewed in Git before database insertion.

## 20. Immediate implementation order

1. Create enums and taxonomy tables.
2. Create cards, collections and mechanisms.
3. Create claims and sources.
4. Create cases and legal metadata.
5. Create concepts, interpretations and questions.
6. Create generic graph relationships.
7. Create research events and contributions.
8. Create card versioning.
9. Seed the current draft.
10. Run an ontology validation report showing entries that do not map cleanly.

The validation report is part of the migration, not an optional cleanup step.
