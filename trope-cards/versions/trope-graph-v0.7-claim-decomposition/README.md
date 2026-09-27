# Trope Graph v0.7 — Claim Decomposition Engine

v0.7 adds an argument/inference layer to the Trope Graph.

The purpose is to represent a card not merely as a collection of claims, but as an inspectable chain:

`claim → evidence → inference → conclusion`

The system records the inferential relationship without deciding whether a contested conclusion is true.

## Contents

- `docs/CLAIM_DECOMPOSITION_ENGINE.md` — model and editorial rules
- `docs/V0.7_MIGRATION.md` — migration notes
- `src/db/schema/claimDecomposition.ts` — Drizzle schema additions
- `src/db/seed/claimDecomposition.ts` — seed examples
- `scripts/validate-claim-decomposition.mjs` — structural validation
- `drizzle/0002_claim_decomposition.sql` — PostgreSQL migration

## Design principle

A source may support a claim. A claim may be used as a premise. An inference is the explicit bridge by which one or more premises are offered as support for another claim. These are deliberately separate relationships.
