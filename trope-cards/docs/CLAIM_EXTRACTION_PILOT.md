# Trope Graph — Claim Extraction Pilot v0.3

This pilot extracts discrete claims from three cards in the current Draft.md without adding external facts. It tests whether the current ontology can represent materially different card types.

## Source rule

All claim wording below is derived from the current Draft.md. No external source has been added merely to make the records appear complete. `sourceRequirement` therefore records what evidence the production record still needs.

## 1. Dual Loyalty

**Card type:** TACTIC  
**Status:** CONTEXT_DEPENDENT  
**Mechanisms:** collectivisation, essentialisation

### Claims

| ID | Claim | Type | Status | Evidence requirement |
|---|---|---|---|---|
| DL-1 | The dual-loyalty trope can treat Jewish identity or a connection to Israel as evidence that a person cannot be a fully loyal citizen. | RHETORICAL | CONTEXT_DEPENDENT | Primary examples of the accusation; historical scholarship on the trope. |
| DL-2 | The rhetorical move changes an individual's political preference or religious connection into evidence of collective disloyalty. | INTERPRETIVE | CONTEXT_DEPENDENT | Examples showing the inferential move; scholarly analysis. |
| DL-3 | Criticism of an individual's actual conflict of interest is analytically distinct from a blanket presumption that Jewish identity creates divided citizenship. | INTERPRETIVE | ESTABLISHED | Comparative examples and definitional sources. |

### Research questions

- What constitutes evidence of an actual conflict of interest rather than an identity-based presumption?
- Which historical uses of dual-loyalty accusations are directly comparable to contemporary examples?
- What evidence would falsify the classification of a particular statement as collectivising?

### Graph edges to test

- `Dual Loyalty --SIMILAR_MECHANISM--> Collectivisation`
- `Dual Loyalty --SIMILAR_MECHANISM--> Essentialisation`
- `Dual Loyalty --CONTEXTUALISES--> relevant historical cases`

---

## 2. Jerusalem Sovereignty

**Card type:** FACT  
**Status:** CONTESTED  
**Mechanism:** context-stripping

### Claims

| ID | Claim | Type | Status | Evidence requirement |
|---|---|---|---|---|
| JS-1 | Claims about Jerusalem should distinguish historical administration, present control, sovereignty claims, and international legal status. | LEGAL | ESTABLISHED | Primary legal/institutional documents and historical records. |
| JS-2 | Jordan controlled East Jerusalem from 1948 until 1967. | HISTORICAL | ESTABLISHED | Contemporary and authoritative historical records. |
| JS-3 | Israel has exercised control over East Jerusalem since 1967. | HISTORICAL | ESTABLISHED | Primary/authoritative historical and legal records. |
| JS-4 | Historical administration or present control should not automatically be treated as equivalent to a conclusion about present sovereignty. | LEGAL | CONTEXT_DEPENDENT | Relevant legal instruments and competing legal positions. |

### Research questions

- What legal status is being claimed when a source uses the word “sovereignty”?
- Which historical events are being described as administration, control, annexation, or sovereignty?
- Which legal positions are attributed to which institutions or states?

### Graph edges to test

- `Jerusalem Sovereignty --CONTEXTUALISES--> Chronology`
- `Jerusalem Sovereignty --RELATED--> Balfour / Colonial Origins`
- `Jerusalem Sovereignty --CHALLENGES--> unsupported categorical sovereignty claims`

---

## 3. Replacement Theology

**Card type:** THEOLOGY  
**Status:** CONTESTED

### Claims

| ID | Claim | Type | Status | Evidence requirement |
|---|---|---|---|---|
| RT-1 | Replacement theology, or supersessionism, refers to theological positions in which the Church is understood to supersede or fulfil Israel's covenantal role. | THEOLOGICAL | ESTABLISHED | Primary theological texts plus academic theological scholarship. |
| RT-2 | Different Christian traditions formulate replacement/supersessionist positions differently. | THEOLOGICAL | ESTABLISHED | Comparative theological scholarship and primary doctrinal sources. |
| RT-3 | Applying a replacement-theology framework to Jewish claims about land, identity, or covenant can have political consequences. | INTERPRETIVE | CONTESTED | Specific examples and scholarship connecting doctrine to political claims. |
| RT-4 | A theological disagreement is analytically distinct from an antisemitic claim about Jews. | INTERPRETIVE | ESTABLISHED | Comparative examples and explicit definitions of antisemitism. |
| RT-5 | The draft does not support treating “Islamic replacement” as a single established doctrine. | THEOLOGICAL | OPEN | Comparative Islamic theological sources are required before making a stronger proposition. |

### Research questions

- Which Christian traditions use supersessionist formulations, and how do they differ?
- Which Islamic theological positions are actually being referred to when “Islamic replacement” is asserted?
- When does a theological proposition become a political claim about a contemporary population?
- What evidence distinguishes theological criticism from group-based hostility?

### Graph edges to test

- `Replacement Theology --RELATED--> Goy`
- `Replacement Theology --CONTEXTUALISES--> Quran / Land Claim`
- `Replacement Theology --COMPETING_INTERPRETATION--> alternative Christian theological positions`

---

# Ontology result

The three cards fit the same underlying model without requiring separate databases or separate claim systems.

| Dimension | Dual Loyalty | Jerusalem Sovereignty | Replacement Theology |
|---|---|---|---|
| Primary object | rhetorical pattern | factual/legal reference | theological proposition |
| Claim types | rhetorical, interpretive | historical, legal | theological, interpretive |
| Main evidence problem | identifying the inferential move | distinguishing legal categories | distinguishing doctrine from political inference |
| Interpretation needed | yes | yes | yes |
| Questions needed | yes | yes | yes |
| Cases useful | yes | yes | yes |

## Schema conclusion

The existing `cards` + `claims` + `sources` + `interpretations` + `questions` model survives this pilot.

One refinement is warranted before full migration: **interpretations should be linkable to a claim as well as a card**. A disputed interpretation often concerns one particular proposition within a card, not the entire card. The next schema revision should therefore add:

```text
claim_interpretations
    claim_id
    interpretation_id
```

This keeps the card as the presentation hub while allowing the epistemic graph to operate at claim level.
