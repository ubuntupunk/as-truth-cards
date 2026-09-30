# Trope Graph — Migration & Validation Plan

## Baseline

The current `Draft.md` contains **41 actual inventory entries**. The earlier figure of 42 counted the TypeScript `DraftCardSeed` type declaration as though it were a card.

Validation currently passes with:

- 13 TACTIC
- 12 FACT
- 6 THEOLOGY
- 6 REFERENCE
- 4 CASE

Status distribution:

- 8 ESTABLISHED
- 15 CONTEXT_DEPENDENT
- 15 CONTESTED
- 3 LIVE

The corpus is therefore deliberately heterogeneous.

## Migration principle

The first migration stores only what the draft itself supports cleanly:

`Draft entry → Card presentation object`

It does **not** automatically convert prose into authoritative claims or attach sources that have not been explicitly identified.

The next layers are:

`Card → Claim → Evidence → Interpretation → Question`

and, where applicable:

`Card → Case → Legal metadata`

## Validation gates

### Gate 1 — Structural

- unique slug
- known card type
- known epistemic status
- known collection
- known mechanism
- known axis, from the `card_axis` enum, non-empty and not repeated on a card

"valid type/axis combinations" is deliberately **not** a gate. `primaryType` is legacy
content-shape metadata and axis is rhetorical function; the corpus contains cards whose
`primaryType` and axis disagree, and constraining the pair would force one dimension to
follow the other. See §3.2 and §3.4 of `TROPE_GRAPH_SCHEMA.md`.

### Gate 2 — Editorial

Every card should eventually have:

- Trigger
- Mechanism
- Counter-test
- At least one explicit claim
- Evidence status
- Editorial note where the proposition is contested

### Gate 3 — Evidence

For factual, historical, legal and contemporary case material:

- identify primary sources where available;
- attach sources to claims rather than only cards;
- distinguish source description from editorial interpretation;
- record page/section references for documents;
- preserve competing interpretations where material is genuinely disputed.

### Gate 4 — Publication

A card should not be treated as publication-ready merely because it has a summary. Publication readiness requires its claims and sources to be reviewable independently.

## What the validator is for

`scripts/validate-draft.mjs` is intentionally dependency-free. It checks the migration seed before database insertion.

Run:

```bash
node scripts/validate-draft.mjs
```

The result is written to `validation-report.json` when invoked by the migration workflow.

## Next extraction pass

The next editorial pass should extract, card by card:

1. one-sentence trigger;
2. one or more atomic claims;
3. claim type;
4. evidence required;
5. known sources;
6. competing interpretations;
7. open questions;
8. relationships to other cards.

This is the point at which the graph becomes a research instrument rather than a digital reproduction of the card deck.
