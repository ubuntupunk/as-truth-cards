# Issue: Complete the Graph UI against the approved mockup and expose the next substantive graph layer

## Objective

Complete the Graph/Explorer UI so that it implements the previously approved mockup rather than stopping at the current functional Cytoscape viewer.

At the same time, extend the canonical graph projection only where necessary to expose the **next substantive ontology layer**:

> **Claim provenance and argument structure.**

The graph should increasingly let a researcher move from:

**Card → Claim → Source/Evidence → Inference → Premise/Conclusion → Argument Chain**

while preserving the existing distinction between classification, evidence, and reasoning.

Do **not** treat this as another graph-visualisation infrastructure task. The Graphology and Cytoscape foundations are already sufficient.

---

# 1. Current architectural baseline

Treat the existing architecture as canonical:

```text
Postgres / Drizzle
        ↓
canonical trope graph
        ↓
domain GraphProjection
        ↓
optional Graphology analysis
        ↓
Cytoscape presentation
        ↓
Graph / Explorer UI
```

The graph projection remains the semantic authority.

The UI must not invent ontology semantics that are absent from the domain projection.

Cytoscape remains a presentation layer only.

Do not revive or depend on `public.cards` / Prisma as a semantic source.

Do not create a second ontology in the UI.

---

# 2. First task: implement the actual UI represented by the earlier mockup

The current `/graph` implementation is a functional graph viewer and inspector. That is the foundation, not the finished product UI.

Before adding new UI concepts:

1. Inspect the existing mockup/design already supplied for the project.
2. Compare it directly against the current `/graph` implementation.
3. Implement the missing visual hierarchy, layout, navigation, panels, controls, and interaction patterns from that mockup.
4. Preserve the current semantic architecture.

The resulting UI should feel like the intended **Trope Deck research/explorer interface**, not like a generic Cytoscape demo.

Do not redesign the mockup from scratch unless an existing requirement is technically incompatible with the canonical graph architecture.

---

# 3. Graph question to answer: what should the graph expose next?

The next graph expansion is **not**:

- more node colours;
- more Cytoscape controls;
- more layout algorithms;
- automatic semantic inference;
- more arbitrary taxonomy dimensions;
- a generic “everything is connected” graph.

The next meaningful layer is **research provenance and argument structure**.

## Priority order

### Priority 1 — Claims

Claims should become the principal research-level unit beneath Cards.

The graph should make it possible to navigate:

```text
Card
  ↓
Claim
```

while retaining:

- claim status;
- claim text;
- authored provenance;
- direct claim relations;
- associated sources;
- associated evidence where it exists;
- inference/argument membership where it exists.

Do not derive claim status from Card status.

Do not infer claims from mechanisms, axes, collections, concepts, or card titles.

---

### Priority 2 — Sources

Expose Source nodes where an authored `claim_sources` relationship exists.

The distinction already established in the ontology must remain explicit:

```text
Claim ── ATTRIBUTED_TO ── Source
```

is **bibliographic/source attribution**, not automatically evidentiary support.

Do not render a Source→Claim edge as “supports” merely because a source is attached to a claim.

The graph must preserve the existing epistemic distinction.

---

### Priority 3 — Evidence

Evidence is the next important missing semantic layer.

Where an actual `EvidenceItem` exists, expose:

```text
Claim → EvidenceItem → Source
```

or the canonical relationship structure already defined by the ontology.

Evidence must contain inspectable content and/or a meaningful locator.

Do **not** fabricate evidence from:

- source titles;
- bibliographic metadata;
- URLs;
- card summaries;
- claim text;
- model knowledge.

If the current corpus does not yet contain sufficient evidence items, build the graph/UI support for them but do not manufacture corpus data merely to populate the graph.

The UI should distinguish:

- Source attribution
- Evidence
- Unsupported claim
- Missing evidence

rather than collapsing these into one generic “source” concept.

---

### Priority 4 — Argument chains and inference

The existing argument-chain model should become navigable in the graph.

The intended structure is:

```text
SOURCE
   ↓
CLAIM / PREMISE
   ↓
INFERENCE STEP
   ↓
CLAIM / CONCLUSION
```

and, where applicable:

```text
Argument Chain
 ├── Step 1
 ├── Step 2
 ├── Step 3
 └── ...
```

The graph must preserve the distinction between:

1. **direct semantic claim relations**, and
2. **reasoning structure through inference steps**.

Do not collapse both into generic `RELATED_TO` edges.

Do not infer argument chains merely because two claims are connected.

Use the authored argument-chain/inference data already present in the ontology.

---

# 4. Concepts, Mechanisms, Axis and Locale remain classification layers

The existing taxonomy dimensions remain important:

- Axis
- Mechanism
- Concept
- Locale
- Collection/Suit
- primaryType as legacy metadata

They should remain independently queryable/projectable.

In particular:

```text
HAS_CONCEPT
```

must remain distinct from:

```text
HAS_MECHANISM
```

and Locale must remain sourced from `card_locales`, never inferred from a Collection/Suit slug.

Do not use these dimensions as substitutes for evidence or argument structure.

---

# 5. Recommended graph views

Do not build an unrestricted “show everything” graph.

Extend the view model around meaningful research questions.

At minimum, preserve the existing taxonomy view and introduce/prepare a research-oriented projection conceptually equivalent to:

### Card / Taxonomy view

```text
Card
 ├── Axis
 ├── Mechanism
 ├── Concept
 ├── Locale
 └── Collection
```

### Argument / Research view

```text
Card
 ↓
Claim
 ├── Claim relation → Claim
 ├── Source
 ├── Evidence
 └── Inference / Argument Chain
       ├── Premise
       └── Conclusion
```

The exact API/view names should follow the existing `views.ts` conventions rather than inventing a parallel view system.

The server remains authoritative for view definitions and defaults.

---

# 6. UI behaviour

The completed UI should allow a researcher to move naturally between levels.

For example:

```text
Card
  ↓
select Claim
  ↓
inspect claim
  ↓
open Source / Evidence
  ↓
inspect argument or inference
  ↓
navigate to related Claim
  ↓
return to Card
```

The inspector should therefore become progressively more useful for:

- Card
- Claim
- Source
- Evidence
- Inference step
- Argument chain
- Concept
- Mechanism
- Axis
- Locale
- Collection

Do not create bespoke semantic rules for each entity in the client when the information can come directly from the domain projection.

---

# 7. Preserve canonical identity

Continue using canonical graph IDs.

Do not solve type-qualified IDs in this issue unless required by an actual collision encountered during implementation.

The previously accepted UUID-based Card navigation remains acceptable.

Do not add slug propagation to neighbour nodes merely for convenience.

The existing future work item for type-qualified IDs remains separate.

---

# 8. Graph projection requirements

Any new projection data must:

- originate from the canonical graph;
- be read-only;
- preserve authored relationships;
- preserve direction;
- preserve relationship family/type;
- preserve node-specific epistemic status;
- preserve Axis ordinal/primary semantics;
- preserve Locale independently from Collection;
- preserve legacy `primaryType` as legacy metadata;
- distinguish direct claim relations from inference structure;
- distinguish Source attribution from Evidence.

Do not create semantic rollups such as:

> “This card is ESTABLISHED because all its claims are ESTABLISHED.”

That remains prohibited.

---

# 9. Data discipline

The corpus must not be inflated merely to demonstrate UI features.

Follow the existing corpus rules:

- authored proposition → Claim only when explicit and entailed;
- no claim inference from descriptive prose;
- no fabricated evidence;
- no invented citations;
- no fabricated Cases/Interpretations/Questions;
- no automatic Concept/Mechanism/Axis inference;
- no semantic relationship inferred merely from graph proximity.

If a graph feature has no real corpus data yet, test it with fixtures and clearly leave the production corpus sparse.

---

# 10. UI states

The finished interface should continue to handle:

- no focus;
- loading;
- API failure;
- malformed projection;
- empty projection;
- sparse projection;
- truncation;
- depth-bounded projection;
- warnings;
- unknown/invalid focus;
- nodes without optional metadata;
- cards without claims;
- claims without evidence;
- claims with sources but no evidence;
- claims participating in argument chains.

The UI should make the difference between **“no evidence exists in the corpus”** and **“the graph failed to load”** unmistakable.

---

# 11. Controls

Implement controls required by the mockup first.

Do not prematurely expose every API parameter.

In particular, `include` and `relationship` controls remain optional unless the mockup specifically requires them.

Likewise, do not implement Mechanism/Collection focus mode merely because the underlying projection could support it.

The UI should expose meaningful research actions rather than API internals.

---

# 12. Testing

Continue the existing testing approach:

- `node:test`
- `tsx`
- `preact-render-to-string`
- projection fixtures
- Cytoscape presentation fixtures

Add tests for:

### UI
- mockup-critical rendering;
- navigation;
- inspector states;
- Claim inspection;
- Source inspection;
- Evidence inspection;
- argument/inference inspection;
- empty/missing evidence;
- Card→Claim→Source navigation.

### Graph
- Claim nodes;
- Source attribution;
- Evidence nodes where present;
- inference structure;
- argument-chain membership;
- preservation of direct claim relations;
- preservation of relationship families;
- no accidental semantic inference.

Use real semantic fixtures rather than vacuous objects that merely satisfy TypeScript.

---

# 13. Verification

Before completion:

```text
pnpm run trope-graph:check
pnpm test
pnpm run test:ui
tsc -b
pnpm build
```

Also verify:

- seed remains idempotent;
- graph counts do not drift unexpectedly;
- no `public.cards` dependency has been introduced;
- no ontology semantics have moved into the UI;
- no new semantic relationships are inferred;
- existing Graphology behaviour remains unchanged;
- Cytoscape remains presentation-only.

Existing baseline TypeScript/lint errors remain separate unless this work directly introduces a regression.

---

# 14. Explicit non-goals

Do NOT use this issue to:

- redesign the ontology;
- replace Graphology;
- replace Cytoscape;
- introduce a new graph database;
- build automatic semantic inference;
- create a generic graph query language;
- implement type-qualified graph IDs;
- implement arbitrary card discovery;
- implement every possible `include`/`relationship` API control;
- fabricate evidence or expand the corpus merely for visual completeness;
- revive `public.cards`;
- close unrelated deployment or infrastructure issues.

---

# 15. Definition of done

This issue is complete when:

1. The current Graph UI has been brought into substantive alignment with the approved mockup.
2. The graph remains a projection of the canonical ontology.
3. Cards can lead to Claims as first-class research objects.
4. Claims can expose their authored Source relationships.
5. Evidence can be represented distinctly from Source attribution when actual EvidenceItems exist.
6. Argument/inference structure can be navigated without collapsing it into generic claim relationships.
7. Classification dimensions remain independent from evidence and reasoning.
8. The inspector presents these distinctions clearly.
9. The UI handles sparse and incomplete research data honestly.
10. Tests cover the new semantic paths.
11. Full graph/schema/build verification passes.
12. No unrelated ontology or infrastructure work is introduced.

## Architectural conclusion

The graph is now past the point where additional visualisation machinery is the priority.

The next value comes from making the graph answer:

> **What is this card claiming, where does that claim come from, what evidence is actually attached to it, and how does the claim participate in an argument?**

That is the next substantive graph layer.