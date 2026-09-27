# Claim Decomposition Engine

## 1. Purpose

The Claim Decomposition Engine converts a card from an editorial assertion into an inspectable argument structure.

The canonical pattern is:

```text
SOURCE
  ↓ supports
CLAIM / PREMISE
  ↓ used-by
INFERENCE
  ↓ derives / supports
CLAIM / CONCLUSION
```

This distinction matters because evidence, premises, inferences and conclusions are not interchangeable. In informal argument analysis, premises are propositions offered as reasons for a conclusion; an inference is the reasoning movement from premises toward a conclusion. An argument can therefore be reconstructed without treating every resulting conclusion as established fact.

## 2. Core objects

### Claim

A proposition that can be independently assessed.

Examples:

- `Jesus was Jewish.`
- `Modern political Zionism emerged in the nineteenth century.`
- `Jesus was therefore a Zionist.`

The third proposition is not encoded as a fact merely because the first two are established.

### Claim Relation

A typed relation between claims that expresses their logical/editorial role.

Supported relation types:

- `SUPPORTS` — source or claim supplies support for another claim
- `CHALLENGES` — claim supplies counter-evidence or objection
- `QUALIFIES` — narrows the scope or conditions of a claim
- `CONTRADICTS` — directly conflicts with a claim
- `CONTEXTUALISES` — supplies historical/conceptual context without directly supporting truth
- `EXEMPLIFIES` — gives an example of a general claim
- `REQUIRES` — conclusion depends on the premise being accepted
- `GENERALISES` — moves from a narrower proposition to a broader one
- `EQUATES` — treats two categories/propositions as equivalent
- `ANACHRONISTICALLY_MAPS` — applies a later category to an earlier subject
- `RETROSPECTIVELY_IDENTIFIES` — maps a later identity/category onto an earlier subject

`ANACHRONISTICALLY_MAPS` and `RETROSPECTIVELY_IDENTIFIES` are descriptive analytical labels, not judgments that a claim is false.

## 3. Inference step

An `inference_step` is the explicit bridge between premises and a conclusion.

Fields:

- `id`
- `card_id`
- `label`
- `description`
- `inference_type`
- `epistemic_status`
- `notes`

Inference types:

- `DEDUCTIVE`
- `INDUCTIVE`
- `ABDUCTIVE`
- `ANALOGICAL`
- `HISTORICAL_CONTINUITY`
- `RETROSPECTIVE_IDENTITY`
- `ANACHRONISTIC_MAPPING`
- `GENERALISATION`
- `EQUIVALENCE`
- `CAUSAL`
- `NORMATIVE`
- `UNSPECIFIED`

The final type is allowed because many real-world rhetorical arguments do not make their inferential rule explicit. The UI should invite the researcher to identify it rather than silently invent one.

## 4. Inference premises

`inference_premises` joins one or more claims to an inference step.

Each premise has a role:

- `PRIMARY` — principal premise
- `CONTEXT` — contextual premise
- `BRIDGE` — premise supplying a needed conceptual connection
- `COUNTERPREMISE` — premise used to challenge an alternative inference

This allows linked premises to be represented explicitly instead of flattening them into independent support edges.

## 5. Inference conclusion

`inference_conclusions` identifies the claim produced or supported by the inference.

A step may have more than one conclusion where an argument explicitly derives multiple propositions, but the default should be one conclusion.

## 6. Evidence versus inference

Do not encode this:

```text
Gospel passage → Jesus was a Zionist
```

unless the source itself explicitly makes that proposition and the project is recording that source's claim.

Prefer:

```text
Gospel passage
    ↓ supports
Jesus was Jewish
    ↓ supports/contextualises
Jesus's teaching engages Israel/Jerusalem/Jewish scripture
    ↓ RETROSPECTIVE_IDENTITY
Jesus was a Zionist
```

The final step is an inference and can therefore be marked `CONTESTED` independently of the premises.

## 7. Argument chain representation

API/UI representation:

```json
{
  "card": "jesus-was-a-zionist",
  "chains": [
    {
      "inference": {
        "type": "RETROSPECTIVE_IDENTITY",
        "status": "CONTESTED"
      },
      "premises": [
        { "claim": "jesus-was-jewish", "role": "PRIMARY" },
        { "claim": "jesus-engaged-israel-jewish-scripture", "role": "PRIMARY" },
        { "claim": "modern-zionism-is-a-later-political-category", "role": "CONTEXT" }
      ],
      "conclusion": "jesus-was-a-zionist"
    }
  ]
}
```

## 8. Epistemic safeguards

### Rule A — status does not propagate automatically

`ESTABLISHED` premises do not automatically make a `CONTESTED` conclusion established.

### Rule B — evidence is not inference

A source-to-claim relationship cannot substitute for a claim-to-claim inference.

### Rule C — interpretation remains separate

Competing interpretations should be represented through the existing `interpretations` and `claim_interpretations` structures.

### Rule D — category mapping is explicit

Whenever a later identity/category is applied to an earlier subject, the inference should be explicitly marked as `RETROSPECTIVE_IDENTITY` or `ANACHRONISTIC_MAPPING` where applicable.

### Rule E — missing bridge detection

If a conclusion has premises but no inference step, validation should report a warning:

`CLAIM_CHAIN_MISSING_INFERENCE`

This is not a data error; it means the researcher has not yet exposed the reasoning bridge.

### Rule F — unsupported conclusion detection

If a conclusion is marked `ESTABLISHED` but has no supporting source, supporting claim, or accepted editorial basis, validation should report:

`ESTABLISHED_CLAIM_NO_SUPPORT`

The validator should not automatically downgrade it.

## 9. UI rendering

The primary card view should expose three levels:

1. **What is being claimed?**
2. **What supports it?**
3. **What inference connects the support to the conclusion?**

A compact visual form:

```text
[Evidence]
     │
     ▼
[Premise] ─────┐
[Premise] ─────┼──► [Inference] ───► [Conclusion]
[Context] ─────┘       CONTESTED
```

The user should be able to expand every node into its sources, competing interpretations and related cases.

## 10. Research actions

The decomposition layer adds these actions:

- Identify missing premise
- Identify inference bridge
- Challenge premise
- Challenge inference
- Find source for premise
- Find counterexample
- Propose competing inference
- Mark inference as anachronistic mapping
- Mark inference as retrospective identity

## 11. Why this belongs in the graph

The graph is no longer merely:

`card → related card`

It becomes:

`card → claim → evidence → inference → conclusion → interpretation → question`

That is the basis for a self-directed research system rather than a static card catalogue.
