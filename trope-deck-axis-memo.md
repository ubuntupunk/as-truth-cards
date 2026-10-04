# Memo: Preserving Axis and Suit Classification in the Graph Migration

**To:** Dev team, `ubuntupunk/as-truth-cards`
**From:** David Lewis
**Re:** Architecture audit follow-up — axis field and card-suite classification
**Date:** 2026-09-27
**Status:** Blocking guidance for Step 3 (graph-internal correctness), ahead of Step 4 (read-model projection)

---

## 1. Summary

The architecture audit (`dc47579`) confirms two concerns about the migration to the `trope_graph` ontology:

1. **The `axis` field is being silently discarded.** It is authored on all 47 cards in the seed files but never read by the seeder — thrown away on every run. This is the exact "quiet data loss" failure mode the seeder's own referential-integrity check exists to prevent, but `axis` is not covered by that check.
2. **Card suites are intact but undocumented.** Suites map to the schema's `collections` (5, well-populated via `card_collections`). The data is not at risk, but the boundary between "collection" (browse suit) and "concept" (analytical topic) is stated nowhere, which will produce classification errors as the corpus grows.

A third, related finding: there are **two competing axis-like fields** — the discarded `axis: string[]` (multi-valued) and the persisted `primaryType` (single-valued: TACTIC / FACT / THEOLOGY / CASE / REFERENCE). Only the multi-valued field can represent a genuinely borderline card (e.g. a card that is both a rhetorical tactic and a theological dispute). Restoring `axis` without reconciling it against `primaryType` recreates the "two unreconcilable sources of truth" pattern the audit already flags as the system's highest overall risk.

## 2. Required actions (Step 3, before the read-model projection is built)

1. **Persist `axis` as a proper multi-valued relation** — a `card_axes` join table, structured like the existing `card_mechanisms` / `card_collections` tables. Do not reintroduce it as a column that gets read once at seed time and left unmaintained.
2. **Reconcile `primaryType` against `axis`.** Recommended approach: derive `primaryType` as a computed "dominant axis" from the `card_axes` set (first-listed or editorially flagged primary), rather than maintaining it as an independently authored field. If the team prefers to keep it independently authored, that must be an explicit, documented decision — not a default.
3. **Document the collection/concept boundary** in the schema itself: collections are browse suits (Classic Tropes, Zionism-Coded Tropes, Regional Cases, Fact-Rebuttal Reference, and the newly proposed Contested/Substantiated suit — see §3); concepts are cross-cutting analytical topics (e.g. "Zionism," "Colonialism") that can span multiple suits.
4. **Widen `verify-seed.ts`'s `EXPECTED`** to include `card_axes`, so a future refactor cannot silently drop this field again without the idempotency check failing. Currently only 12 of 36 tables are covered.

## 3. New editorial category to schematize

Cards like the proposed **Depo-Provera card** don't cleanly fit any existing suit — they document a real, partly-substantiated controversy rather than a wholly fabricated trope. Recommend a fifth collection: **Contested/Substantiated Claims**, for cards where part of the underlying allegation is documented and admitted, and part is not established. This should carry its own editorial-notes requirement (see §4) given the higher care these cards need.

## 4. UI requirements (Step 5, graph-only surfaces)

The current mockup's filters (Claims / Evidence / Sources / Cases / Concepts / Interpretations / Inferences) are all ontology-type facets. None expose suit or axis — the two dimensions the deck concept is actually organized around. Requirements for the Explore and Graph views:

- **Card front:** axis shown as a small, fixed-vocabulary badge (icon or colored dot), visually distinct from the freeform mechanism/concept tag pills. A reader should be able to tell at a glance whether a label is "this card's rhetorical function" versus "a topic it touches."
- **Explore sidebar:** add **Suit** and **Axis** as filter groups alongside the existing ontology-type filters.
- **Graph view:** retain node color for ontology type; add a secondary encoding (ring color or border style) for axis so both dimensions are visible without an extra click.
- **Compose/Decompose:** require at least one axis selection before a card can be saved — a guardrail matching the "throws rather than silently drops" principle already applied to collection and mechanism classification, extended to the field currently exempt from it.

## 5. Sequencing

These items belong in **Step 3** (graph-internal correctness), before Step 4 (read-model projection) and Step 5 (graph-only UI surfaces) are built on top of them. Building the projection or the UI before `axis` is properly persisted means re-doing both once the schema changes.

## 6. Open decision for editorial sign-off

Per audit item §10.3, whether `primaryType`/axis is intrinsic to a card, editorial judgment, or a relationship needs one explicit answer before Step 3 closes. Recommendation: **relationship** (many-to-many via `card_axes`), for the borderline-card reasons above — but this is a product call, not just an engineering one, and should be signed off before implementation starts.

---

**Next step:** Step 0 (enablers — fix `g66` typecheck, add test runner, add auth/validation to `/api/cards`) still blocks everything above and should land first per the original audit.
