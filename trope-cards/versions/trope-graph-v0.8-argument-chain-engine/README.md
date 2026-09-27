# Trope Graph v0.8 — Argument Chain Engine

Incremental extension of v0.7.

v0.8 adds named argument chains, counter/alternative inference steps, and typed relationships between inference steps.

## Key model

```text
Source → Claim
            ↓
       Inference Step
            ↓
          Claim
            ↓
       Inference Step
            ↓
       Conclusion

Counter/alternative inference steps can challenge or qualify any step.
```

## Files

- `docs/ARGUMENT_CHAIN_ENGINE.md` — model and rendering contract
- `docs/V0.8_MIGRATION.md` — migration notes
- `src/db/schema/argumentChains.ts` — Drizzle schema
- `src/db/seed/argumentChains.ts` — example chains
- `drizzle/0003_argument_chains.sql` — PostgreSQL migration
- `scripts/validate-argument-chains.mjs` — structural validation

## Research principle

The engine records arguments and their inferential structure. It does not assign a winner, truth score, or preferred political interpretation.
