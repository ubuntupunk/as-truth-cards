# Graph Explorer — Implement the Current Figma UI

## Context

`b66f2d2` successfully extends the canonical graph layer and the functional Graph UI with:

- Claim → Source attribution
- Claim → Evidence paths
- Source / Evidence focus
- Argument refocusing
- Evidence view
- corpus-derived data-blocked states
- richer Entity Inspector semantics
- expanded graph edge-family support

**Do not undo or weaken that work.**

The remaining task is to reconcile the **presentation of the Graph Explorer** with the current Figma designs.

The authoritative visual reference is the current Figma file:

https://www.figma.com/design/qmVMnfR9DpQFyYtaiSizYD

The file now contains three Graph Explorer treatments:

- Graph Explorer — Atmospheric
- Graph Explorer — Editorial
- Graph Explorer — Workspace

It also contains the broader Deck / Card Detail / Browse / Compose / Research Workspace designs. Use those designs as product context, but this issue is specifically about the Graph Explorer.

---

# 1. Goal

Implement the Graph Explorer UI represented by the current Figma designs while preserving the existing canonical graph architecture and all semantic functionality already implemented.

The target is **not another graph-engineering phase**.

The target is:

> **Canonical graph data → existing projection → existing Cytoscape presentation → Figma-aligned Graph Explorer UI**

The three Graph Explorer designs should be treated as **three visual treatments of one information architecture**, not three independently implemented screens.

---

# 2. Current Graph Explorer information architecture

The Figma designs establish this structure:

```text
Global navigation
    ↓
Context / breadcrumb bar
    ↓
Graph Explorer heading
    ↓
Research/disclaimer context
    ↓
Graph controls
    ↓
┌───────────────────────────────┬──────────────────────┐
│                               │                      │
│       Focused graph           │   Entity Inspector   │
│                               │                      │
│                               │                      │
└───────────────────────────────┴──────────────────────┘
    ↓
Classification / provenance / reasoning status
```

The central semantic distinction shown by the design is:

> **Classification describes an entity. Provenance documents its origin. Reasoning connects claims.**

Do not collapse these concepts in the implementation.

---

# 3. Do NOT carry forward the current Graph page composition unchanged

The current `src/pages/Graph.tsx` has accumulated useful functionality from the earlier implementation, including:

- `DeckNavigator`
- facet filtering
- `CardFront`
- graph canvas
- Entity Inspector
- controls
- dynamic legends
- projection notices

Those pieces should be evaluated against the Figma composition rather than treated as immutable layout.

In particular, the current layout's:

```text
DeckNavigator | Graph | CardFront / Inspector
```

composition is **not the target Graph Explorer composition**.

The Figma target is substantially simpler:

```text
controls
    ↓
graph canvas | inspector
```

Do not preserve a left-side Deck Navigator merely because it already exists.

If facet filtering is still useful, expose it through the appropriate Graph Explorer control surface without allowing it to distort the primary graph/inspector composition.

Likewise, do not retain `CardFront` as a separate permanent column if its information belongs in the inspector or surrounding card context in the Figma design.

---

# 4. Graph Explorer shell

Implement the following hierarchy.

## Global navigation

Preserve the existing application header/navigation, but align it with the Figma product hierarchy:

- Decks
- Explorer
- Graph
- Research
- Sources

Graph should be visibly the current section.

Do not create a second navigation system specifically for Graph.

## Context bar

Add the Graph Explorer context/breadcrumb treatment represented in Figma.

It should establish that this is a research/graph workspace rather than an isolated graph visualization.

## Page heading

The Graph page should have the equivalent of:

```text
RELATIONSHIPS / GRAPH

Graph Explorer

Trace provenance and reasoning. Keep classification in view.
```

Use the exact wording from Figma where practical rather than inventing alternate marketing copy.

## Research disclaimer

Include the research-status/disclaimer treatment represented in the design.

It should make clear that the displayed research collection does not itself establish historical conclusions.

Do not invent stronger epistemic claims than the graph data supports.

---

# 5. Graph control strip

The Figma design establishes a compact control area containing:

### View

Supported current views should remain driven by the server's view descriptors.

At minimum:

- Card / default graph view
- Argument
- Taxonomy

Evidence remains a real server view and must continue to work, even if it is presented as a secondary research mode rather than a primary visual option.

Do not duplicate `views.ts` semantics in the client.

### Focus

Preserve:

- slug focus
- UUID focus
- current canonical identity behaviour

Do not add a card discovery/search endpoint in this issue.

Manual/URL focus remains acceptable.

### Depth

Preserve server-defined depth limits and current depth behaviour.

### Legend

The legend should reflect the entities/edge families actually emitted by the selected view.

Do not hard-code a legend that claims the current graph contains entity types it does not contain.

---

# 6. Main graph workspace

The graph and inspector should be presented as the central workspace.

Target relationship:

```text
┌──────────────────────────────────────────────┬─────────────────────┐
│                                              │                     │
│              FOCUSED RELATIONSHIPS           │  ENTITY INSPECTOR   │
│                                              │                     │
│                 Cytoscape                    │                     │
│                                              │                     │
└──────────────────────────────────────────────┴─────────────────────┘
```

The graph should remain Cytoscape-backed.

Do not replace Cytoscape.

Do not introduce a second graph rendering system.

Do not move semantic interpretation into Cytoscape.

---

# 7. Entity Inspector

The Entity Inspector is a major part of the Figma design and should remain a semantic component, not a Cytoscape-properties dump.

It must continue to resolve entities against the **domain `GraphProjection`**, not Cytoscape internals.

For a Card, the inspector should expose the equivalent of:

### Identity

- title/name
- node type
- epistemic status
- status vocabulary/source

### Axes

Show ordered Axis assignments.

Preserve the rule:

```text
ordinal 0 = primary Axis
```

Do not derive Axis from `primaryType`.

### Classification

Keep these distinct:

- Mechanism
- Concept
- Locale
- Collection/Suit
- legacy `primaryType`, explicitly labelled legacy

Do not infer one dimension from another.

In particular:

```text
Mechanism ≠ Concept
Collection/Suit ≠ Locale
Axis ≠ primaryType
```

### Research links

Expose available:

- Claims
- Sources
- Evidence
- Argument Chains

Counts should come from the projection, not hard-coded fixtures.

### Navigation

Preserve:

- Open card
- Refocus to appropriate graph view for Claim / Argument Chain
- Refocus to Evidence view for Source / Evidence where supported

Do not introduce new focus semantics merely for visual convenience.

---

# 8. Provenance and reasoning must remain visibly distinct

The Figma designs and `b66f2d2` now align around this structure:

```text
Card
  └── Claim
        ├── Source
        ├── Evidence
        └── Inference
               └── Argument Chain
```

This is not equivalent to:

```text
Card
  └── "related things"
```

The UI must preserve the distinctions.

In particular:

- `claim_sources` / `ATTRIBUTED_TO` is attribution/provenance.
- `EvidenceItem` is evidence.
- `claim_relation` is a direct claim relationship.
- `inference` represents reasoning structure.
- `argument_chain` represents the authored argument grouping.

Do not visually collapse all of these into one generic “relationship” category.

---

# 9. Classification must remain independent

The Graph Explorer should make it possible to understand a card through:

```text
Classification
    Axis
    Mechanism
    Concept
    Locale
    Collection
```

and separately:

```text
Research structure
    Claims
    Sources
    Evidence
    Inference
    Argument Chains
```

Do not turn classification facets into graph semantics.

Do not derive graph edges from visual grouping.

Do not turn Collections/Suits into an ontology category.

---

# 10. Atmospheric / Editorial / Workspace

The three Figma Graph Explorer variants should share one component structure.

Do not implement three copies of Graph Explorer.

Instead establish presentation tokens/classes sufficient to support the three visual treatments.

At minimum the implementation should make the following independently styleable:

- page background
- surface/panel treatment
- graph canvas
- inspector
- borders
- typography hierarchy
- node/edge visual treatment
- accent treatment
- status treatment
- controls
- contextual/disclaimer surfaces

If an appearance selector is implemented, it must be **presentation-only**.

It must never alter:

- graph semantics
- projection rules
- node types
- edge families
- focus semantics
- epistemic status
- ontology data

The Figma designs are visual variants of the same Graph Explorer.

---

# 11. Responsive behaviour

The Figma target is desktop-first, but the implementation must remain usable below desktop width.

Use a sensible collapse:

```text
desktop:
    graph | inspector

narrow:
    graph
    inspector
```

Do not create a second mobile information architecture.

The inspector can move below the graph or become a collapsible panel.

---

# 12. Preserve all current graph states

The new visual shell must continue supporting:

- no focus
- loading
- API error
- malformed projection
- empty projection
- data-blocked view
- sparse projection
- warnings
- depth notices
- truncation notices
- filtered-empty state if filtering remains exposed

These states should receive the same visual language as the new Figma shell.

Do not remove honest empty/data-blocked messaging simply to make the screen look complete.

---

# 13. Evidence state is especially important

The corpus currently has evidence schema support but sparse/empty evidence data.

The UI must therefore distinguish:

1. Evidence infrastructure exists.
2. The selected view supports evidence.
3. The current corpus has no evidence rows.
4. A particular claim has no attached evidence.

Do not manufacture evidence merely to make the graph visually richer.

The current `b66f2d2` `data_blocked` handling should be preserved.

---

# 14. Reuse the existing semantic components

Before creating new components, inspect and reuse:

- `EntityInspector`
- `CytoscapeGraph`
- graph stylesheet
- projection guards
- graph states
- query-param handling
- graph hooks
- view descriptors
- Cytoscape adapter

Refactor them where necessary to match the Figma composition.

Do not duplicate graph semantics in new UI components.

---

# 15. Figma is the visual specification

Use the connected Figma file as the visual reference:

https://www.figma.com/design/qmVMnfR9DpQFyYtaiSizYD

Inspect the relevant Graph Explorer frames directly.

Do not reconstruct the design from this issue text alone when Figma contains more precise information about:

- spacing
- typography
- hierarchy
- panel proportions
- controls
- node presentation
- inspector structure
- appearance variants

The three Graph Explorer frames should be compared before implementation so that shared structure is identified rather than copied three times.

---

# 16. Testing

Extend the existing UI tests rather than introducing a browser test framework solely for this task.

Continue using:

- `node:test`
- `tsx`
- `preact-render-to-string`

Add tests for:

### Layout/component composition

Verify that the Graph page renders:

- context/header
- Graph Explorer heading
- disclaimer
- controls
- graph workspace
- inspector

### Semantic inspector behaviour

Verify that:

- Axis remains distinct from legacy `primaryType`
- Mechanism remains distinct from Concept
- Collection remains distinct from Locale
- Source remains distinct from Evidence
- Claim relations remain distinct from inference edges
- status source/vocabulary remains visible

### Research paths

Verify:

```text
Card → Claim
Claim → Source
Claim → Evidence
Claim → Inference
Inference → Argument Chain
```

where fixtures support those paths.

### Empty/data-blocked states

Verify the Figma-aligned UI does not fabricate evidence or research entities when the corpus is empty.

### Appearance variants

If appearance switching is implemented, verify it changes presentation only.

---

# 17. Verification

Run:

```text
pnpm run trope-graph:check
pnpm test
pnpm run test:ui
pnpm run typecheck
pnpm run build
```

Also run the existing lint/format checks.

Do not treat pre-existing baseline failures as introduced failures.

Report:

- new failures
- pre-existing failures
- graph count changes
- schema drift
- any changed projection semantics

---

# 18. Non-goals

Do **not**:

- redesign the ontology
- redesign the graph projection model
- replace Cytoscape
- replace Graphology
- add automatic inference
- fabricate evidence
- add generic graph-query language
- add type-qualified IDs
- implement card discovery
- revive `public.cards` as canonical
- add unrelated deployment work
- create separate implementations for Atmospheric / Editorial / Workspace
- add Mechanism/Collection focus semantics unless already supported by the server
- make the client a second implementation of `views.ts`

`as-truth-cards-572` remains the card-discovery task.

`as-truth-cards-2bq` remains the type-qualified graph-ID task.

---

# 19. Definition of Done

This issue is complete when:

1. The Graph Explorer visually follows the current Figma composition.
2. The three Figma treatments share one semantic/component architecture.
3. The current graph functionality from `b66f2d2` remains intact.
4. The central workspace is graph + Entity Inspector rather than the previous multi-column composition.
5. The inspector exposes classification separately from provenance/reasoning.
6. Card → Claim → Source/Evidence → Inference/Argument navigation works.
7. Evidence/data-blocked states remain honest.
8. View/depth/focus remain server-driven.
9. Cytoscape remains a thin presentation layer.
10. No ontology or graph semantics are duplicated in UI code.
11. UI tests cover the important semantic and state boundaries.
12. Full verification passes apart from documented pre-existing failures.

**Important:** Do not close the broader graph work merely because this UI issue is complete. At this point the substantive question is whether the Graph Explorer exposes the canonical research graph correctly and usefully; further graph capabilities should be driven by actual research workflows rather than by adding more visualization infrastructure.