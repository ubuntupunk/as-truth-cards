# Trope Graph — Schema Refinement v0.3

## Finding

The claim-extraction pilot tested three materially different cards:

- Dual Loyalty — rhetorical/historical
- Jerusalem Sovereignty — factual/legal/historical
- Replacement Theology — theological/interpretive

All three can use the same `cards → claims → sources` structure, with interpretations and questions layered above it.

## Required refinement

Add a many-to-many table:

```sql
CREATE TABLE claim_interpretations (
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    interpretation_id UUID NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
    PRIMARY KEY (claim_id, interpretation_id)
);
```

### Why

A card can contain several claims, while only one claim may be disputed. Linking an interpretation only to the card makes the graph too coarse.

The intended hierarchy becomes:

```text
CARD
 ├── CLAIM A
 │    ├── SOURCE
 │    ├── INTERPRETATION A
 │    └── QUESTION
 │
 ├── CLAIM B
 │    ├── SOURCE
 │    └── INTERPRETATION B
 │
 └── CLAIM C
      └── SOURCE
```

The card remains the reader-facing hub; the claim becomes the principal epistemic unit.
