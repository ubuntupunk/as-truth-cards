# v0.8 — Argument Chain Engine

## Purpose

v0.7 decomposes a card into claims and explicit inference steps. v0.8 adds a second graph layer: **relationships between inference steps** and named **argument chains**.

The result is a structure that can represent:

```text
premise claims
    ↓
Inference A
    ↓
intermediate/conclusion claim
    ↓
Inference B
    ↓
conclusion
```

and, critically:

```text
Inference A ─────────────→ conclusion
      ↑
      │ CHALLENGES / QUALIFIES
Inference B
      ↑
premise / counter-premise
```

This reflects a basic distinction in argument analysis: premises are offered as reasons for conclusions, while an inference is the reasoning relationship between them. Multi-step arguments can therefore be reconstructed rather than flattened into a single `SUPPORTS` edge. See IEP's discussion of premises, conclusions, linked premises and step-by-step derivations.

## Design principles

1. **Do not collapse evidence into inference.** A source establishes or documents a claim; it does not itself become an inference step.
2. **Do not collapse inference into conclusion.** A contested inference remains visible even where its premises are established.
3. **Counter-inferences are first-class.** They are not merely comments attached to a card.
4. **No winner field.** The graph records relationships and epistemic status, not an editorial score or preferred interpretation.
5. **Argument reconstruction must be labelled.** `EDITORIAL_RECONSTRUCTION` means the project is reconstructing an argument from available material; it does not assert that the original speaker formulated it in exactly this form.
6. **A counterargument may challenge a step without disproving its premises.** `CHALLENGES` and `QUALIFIES` therefore operate at the inference level.

## Chain kinds

- `PRIMARY_ARGUMENT` — the principal argument being reconstructed.
- `COUNTERARGUMENT` — a distinct opposing argument.
- `ALTERNATIVE_INTERPRETATION` — a different interpretive route through substantially related material.
- `EDITORIAL_RECONSTRUCTION` — a graph editor's reconstruction for research purposes.

## Inference-step roles

- `MAIN` — part of the principal chain.
- `COUNTER` — a counter-inference.
- `ALTERNATIVE` — an alternative route.
- `CONTEXT` — contextual reasoning that should not be mistaken for the main inferential route.

## Inference-step relations

- `CHALLENGES` — attacks or puts pressure on the target inference.
- `QUALIFIES` — narrows the scope or force of the target inference.
- `ALTERNATIVE_TO` — provides a different inferential route.
- `DEPENDS_ON` — identifies a prerequisite reasoning step.
- `REFINES` — makes an inference more precise.
- `CONTEXTUALISES` — supplies relevant context without directly supporting or defeating the target.

## Example: Jesus Was a Zionist

The graph should not render this as:

> Jesus was Jewish → Jesus was a Zionist.

Instead:

```text
[Jesus was Jewish]
        +
[Jesus engaged Israel/Jerusalem/Jewish Scripture]
        +
[Modern Zionism is a later political category]
        │
        ↓
[Retrospective mapping of Zionist identity]
        │
        ↓
[Jesus was a Zionist]   ← CONTESTED
        ↑
        │ CHALLENGES
        │
[Historical-category distinction]
        │
        ↓
[The modern category cannot simply be assumed to describe
 a first-century political identity]
```

The graph therefore exposes the **inference under dispute**, rather than encoding the conclusion as either fact or falsehood.

## Example: Canaanite Card

```text
[Canaanite populations inhabited the region]
        +
[Israelite ethnogenesis occurred within a Canaanite context]
        +
[Ancient Levantine ancestry persists in multiple modern populations]
        │
        ↓
[Ancient Canaanite continuity to modern Palestinian identity]
        │
        ↓
[Modern Palestinian Canaanite ancestry claim]
        ↑
        │ QUALIFIES
        │
[Continuity does not establish exclusive modern descent]
```

This allows the graph to distinguish a documented ancestry narrative from the further inference that such ancestry establishes exclusive indigeneity or displaces other historical relationships.

## Rendering contract

A graph renderer should be able to return:

```json
{
  "card": "canaanite-card",
  "chains": [
    {
      "kind": "EDITORIAL_RECONSTRUCTION",
      "steps": [
        {
          "role": "MAIN",
          "inference": "...",
          "premises": ["..."],
          "conclusions": ["..."]
        },
        {
          "role": "COUNTER",
          "inference": "...",
          "premises": ["..."],
          "conclusions": ["..."]
        }
      ],
      "relations": [
        { "type": "QUALIFIES", "from": "counter", "to": "main" }
      ]
    }
  ]
}
```

The renderer must preserve epistemic status on claims and inference steps. It must never infer `ESTABLISHED` for a conclusion merely because all premises are `ESTABLISHED`.
