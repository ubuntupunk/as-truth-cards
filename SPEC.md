# Technical Specification — Trope Deck

## 0. Purpose and design authority

Trope Deck is a research-oriented card and graph explorer for examining claims, evidence, provenance, classifications, arguments, and recurring tropes. The product must distinguish **research state** from **historical conclusion** and must never present an unverified claim as established fact.

This specification supersedes the former "Truth Cards" UI contract. The current visual authority is the Figma file:

- **Figma:** https://www.figma.com/design/qmVMnfR9DpQFyYtaiSizYD/Trope-Deck-UI
- **Implementation mockup:** node `1:2`, "Graph Explorer — Implementation Mockup"
- **Card discovery:** node `7:4518`, "Card discovery"
- **Atmospheric graph explorer:** node `38:3`
- **Editorial graph explorer:** node `38:168`

The implementation must preserve the ontology and graph semantics already established in the repository. Figma governs composition, hierarchy, interaction affordances, visual treatment, and responsive layout; it does **not** redefine the data model.

## 1. Product principles

1. **Research, not verdict.** The UI explicitly identifies the collection as research and separates hypotheses, open questions, verified evidence, and conclusions.
2. **Provenance is first-class.** Claims, sources, evidence, inferences, and argument chains remain distinct entities and relationships.
3. **Classification is not provenance.** Axis, suit, mechanism, concept, locale, and collection metadata must not be conflated with evidentiary status or reasoning.
4. **Server-authoritative semantics.** Views, focus resolution, depth, projection contents, and graph relationships come from the graph API/projection contract.
5. **Honest absence.** A schema-empty layer is rendered as unavailable/empty rather than fabricated as zero evidence for a claim.
6. **Presentation is replaceable.** Appearance treatments can change without changing URL state, projection, selection, or ontology semantics.
7. **Cards are research interfaces.** A card is no longer a physical 3D flip metaphor; it is an editorial research object with front/back reading actions.

## 2. Technology baseline

The application is a Vite + React/Preact-compatible TypeScript application using:

- React 18 / Preact compatibility
- React Router
- TanStack React Query
- Tailwind CSS
- Cytoscape for graph presentation
- Graphology for graph data structures
- Prisma and PostgreSQL for existing application persistence
- Drizzle/PostgreSQL infrastructure in the trope graph package
- Zod for runtime validation
- Biome for formatting/linting

Do not introduce a second styling system solely to reproduce Figma. Extend the existing Tailwind/CSS-token approach.

## 3. Information architecture

### 3.1 Global navigation

The primary navigation is:

**Decks · Explorer · Graph · Research · Sources**

Requirements:

- `Graph` is marked current on graph pages.
- `Decks` resolves to `/`.
- `Graph` resolves to `/graph`.
- `Explorer`, `Research`, and `Sources` remain visibly present but inert until their routes exist.
- Do not add a second page-local navigation system.
- Header height is approximately 64px on desktop.

### 3.2 Graph Explorer page

Desktop composition:

1. Global navigation
2. Context/breadcrumb bar
3. Heading block
4. Research disclaimer
5. Controls strip
6. Workspace: graph canvas + entity inspector
7. Status strip

The old left-side deck navigator is not part of the final graph composition.

### 3.3 Deck/card discovery

The card-discovery composition is:

1. Deck scope/filter badges
2. Featured research card
3. Previous / position / Shuffle next controls
4. Discovery prompt

The card is an editorial panel rather than a 2:3 physical playing card.

## 4. Visual system

### 4.1 Core palette

The Figma implementation mockup establishes the following baseline tokens:

| Token | Value |
|---|---|
| Page background | `#0e0e11` |
| Header / panel | `#17171b` |
| Secondary surface | `#1f1f24` |
| Border / divider | `#303038` |
| Primary text | `#ededf2` |
| Secondary text | `#9496a1` |
| Blue accent | `#6b9ef2` |
| Blue soft text | `#a8c6fa` |
| Amber status | `#ebad52` |
| Amber surface | `#28231a` |
| Blue contextual surface | `#1c293f` |
| Canvas | `#0b0b0d` |

These values are design references. They should be represented as CSS/Tailwind design tokens, not scattered literals.

### 4.2 Typography

- Font family: Inter.
- Navigation/body: regular, approximately 12–14px.
- Section labels: semibold, uppercase, approximately 10–11px, muted.
- Card title: semibold, approximately 34px on the featured desktop card, line-height ~1.15.
- Card summary: regular, approximately 15px, line-height ~1.5.
- Inspector entity title: semibold, approximately 20px.
- Graph node labels: compact semibold treatment.
- Do not use the previous emoji-centric visual language.

### 4.3 Surfaces and geometry

- Primary panels: 8–10px radius.
- Controls/actions: 6px radius.
- Small badges: 4px radius.
- Standard control height: 32–38px.
- Featured card padding: 28px desktop.
- Featured card internal vertical rhythm: approximately 14–22px.
- Desktop graph workspace is split into graph canvas and inspector.
- Responsive layouts collapse to a single column on narrow screens.

## 5. Graph Explorer UI contract

### 5.1 Heading

The heading block uses:

- Eyebrow: `RELATIONSHIPS / GRAPH`
- Title: `Graph Explorer`
- Tagline: `Trace provenance and reasoning. Keep classification in view.`

### 5.2 Research disclaimer

Always render above the workspace:

> This is a research collection, not itself a historical conclusion.

The disclaimer is not optional and must remain visible across appearance treatments.

### 5.3 Controls strip

The controls strip contains:

- **View** — catalogue-driven graph view selector.
- **Focus** — current card/claim/argument-chain focus.
- **Depth** — server-defined depth display; presentation is read-only.
- **Appearance** — Atmospheric / Editorial / Workspace.
- Facet filtering — ontology type, suit, and axis where available.
- Entity legend — only types/families actually emitted by the current projection.

Rules:

- View options come from `GET /api/graph/views`.
- Do not invent views in the client.
- Focus values are slug/UUID references; no client-side discovery endpoint is required.
- Changing appearance must not mutate view, focus, depth, URL, projection, or selection.
- Facet filtering may be session-local presentation state, but cannot redefine graph semantics.

### 5.4 Graph workspace

Desktop target is approximately:

- Graph canvas: 1040px at the 1440px reference viewport.
- Inspector: 400px.
- Workspace begins below the 128px header/control region in the implementation mockup.

The graph canvas is the primary exploration surface.

The graph must preserve authored direction and relationship family semantics. Proximity must never be treated as an implicit relationship.

### 5.5 Entity inspector

The inspector contains:

1. **ENTITY**
   - entity title
   - type / status
2. **AXES**
   - authored axis tags/pills
3. **CLASSIFICATION**
   - mechanism
   - concept
   - locale where applicable
   - collection
4. **RESEARCH LINKS**
   - claims
   - sources
   - evidence
   - argument chains
5. **Open card** action when the selected entity has a card representation

The inspector must keep these semantic domains separate:

- `HAS_CONCEPT` is not `HAS_MECHANISM`.
- Locale is not Suit.
- `claim_relation` is not inference.
- Evidence is not merely a source.
- A legacy `primaryType` must not be presented as an axis unless the projection explicitly supplies it as one.

### 5.6 Graph node vocabulary

The Figma reference demonstrates:

- Card
- Claim
- Source
- Evidence
- Inference
- Argument Chain
- Historical Analogy
- Anachronism / Mechanism

The final node set is projection-driven. The UI must not fabricate entities that are absent from the current projection.

### 5.7 Graph status strip

Render three projection-derived status groups:

- **Classification** — cards + classification-family edges.
- **Provenance** — source family / `claim_sources`.
- **Reasoning** — `claim_relation` + inference families.

A family not emitted by the selected view must say **"not in this view"**, not "0".

## 6. Card discovery contract

### 6.1 Scope controls

The discovery header supports:

- card count
- axis filter
- research-status filter, e.g. Open questions
- repeat policy, e.g. Without repeats

Badges are compact, muted, and interactive where the corresponding filter exists.

### 6.2 Featured card

The featured card contains:

- `Card / ID-XX` metadata
- evidence/research status badge, e.g. `OPEN · UNVERIFIED`
- title
- research-oriented summary
- classification tags
- provenance/reasoning preview
- evidence state
- `Read front & back`
- `Save card`

The card must be able to represent hypotheses and open questions without visually implying verification.

### 6.3 Card navigation

- Previous
- Position indicator
- Shuffle next

The position indicator is a visual progress marker plus `n / total`.

### 6.4 Discovery prompt

A secondary prompt may suggest a different analytical lens, e.g.:

- language
- place
- collective memory
- concepts

The prompt should encourage a question-first exploration and must not manufacture a conclusion.

## 7. Card reading model

The former specification required a 700ms 3D flip and a physical 2:3 card. This is **removed**.

The new interaction is:

1. Featured card presents the research-facing front.
2. `Read front & back` opens or reveals the complete card reading experience.
3. Front/back content is editorial and scroll-safe.
4. Source and evidence links remain distinct.
5. Save is an independent user action.
6. No emoji is required for card identity.

If a flip animation is later introduced, it is an implementation detail and must not dictate the data model or layout.

## 8. Ontology and provenance requirements

### 8.1 Core entity separation

At minimum the UI must distinguish:

- Card
- Claim
- Source
- Evidence item
- Inference
- Argument chain
- Argument-chain step
- Concept
- Mechanism
- Historical analogy
- Anachronism
- Classification axes
- Suit
- Collection

### 8.2 Provenance

A claim may have:

- source attribution
- located evidence
- no evidence
- missing evidence
- conflicting or unresolved evidence

These states must be visually distinct.

A source attached to a claim is not equivalent to verified evidence supporting the claim.

### 8.3 Reasoning

Argument chains and inference steps must remain explicit.

Do not infer:

- an argument merely from graph proximity;
- an inference merely because two claims are connected;
- a source-to-evidence relationship where the schema does not provide one.

## 9. State and interaction contract

### 9.1 Graph page state order

Preserve the established state ordering:

1. no focus
2. loading
3. malformed response
4. API error
5. empty projection
6. rendered workspace

Warnings and corpus-gap notices read the original projection even when the visible graph is facet-filtered.

### 9.2 Selection

- Selection belongs to the current projected graph.
- If a filter removes the selected entity, clear selection.
- Refocusing must preserve authored semantics and navigate to the supported focus type.
- Graph selection must not mutate the underlying projection.

### 9.3 Appearance

Supported treatments:

- `atmospheric`
- `editorial`
- `workspace`

Requirements:

- Token-complete definitions.
- CSS custom properties for DOM surfaces.
- Treatment-aware Cytoscape stylesheet.
- Appearance persisted in `localStorage('graph-treatment')`.
- Switching treatments must remount/repaint presentation only.
- Projection, URL, focus, selection, and graph semantics remain unchanged.

## 10. Accessibility and responsive behavior

- Minimum interactive target: 44px where practical; compact visual controls may use 32–38px but require adequate surrounding hit area.
- Current navigation uses `aria-current`.
- Disabled/inert navigation must expose disabled state appropriately.
- Status labels must not rely on color alone.
- Amber "unverified/open" state must have textual status.
- Keyboard navigation must reach controls, card actions, inspector actions, and graph selection affordances.
- On narrow viewports, graph and inspector stack vertically.
- Card discovery content becomes a single-column flow.
- Long titles and evidence descriptions must wrap without clipping.
- No fixed desktop dimensions may prevent mobile use.

## 11. Data/API boundaries

The existing API and projection contracts remain authoritative.

Relevant graph interactions include:

- graph view catalogue
- projection/focus resolution
- source attribution
- evidence relationships
- claim relationships
- inference relationships
- argument chains

Do not add UI-specific semantic fields to the ontology merely to satisfy Figma.

Existing card interaction behavior may remain where it has a valid contract, but the obsolete rating-centric card UI is not a design requirement.

## 12. Component architecture

Target presentation components include:

```
App
├── GlobalNavigation
├── Routes
│   ├── Decks
│   │   ├── DeckScope
│   │   ├── CardDiscovery
│   │   │   ├── FeaturedCard
│   │   │   ├── CardMetadata
│   │   │   ├── ClassificationTags
│   │   │   ├── ProvenancePreview
│   │   │   └── CardActions
│   │   └── DiscoveryPrompt
│   └── Graph
│       ├── GraphShell
│       │   ├── Breadcrumb
│       │   ├── GraphHeading
│       │   ├── ResearchDisclaimer
│       │   ├── GraphControls
│       │   ├── GraphWorkspace
│       │   │   ├── CytoscapeGraph
│       │   │   └── EntityInspector
│       │   └── GraphStatus
│       └── GraphStates
```

Existing graph orchestration components/contracts remain in place unless a change is explicitly presentation-only.

## 13. File-level expectations

Relevant existing areas include:

```
src/
├── graph/
│   ├── graph-shell.tsx
│   ├── graph-controls.tsx
│   ├── graph-status.tsx
│   ├── entity-inspector.tsx
│   ├── graph-stylesheet.ts
│   ├── appearance.ts
│   ├── cytoscape-graph.tsx
│   ├── deck-facets.ts
│   ├── graph-states.tsx
│   ├── query-params.ts
│   └── use-graph.ts
├── pages/
│   └── Graph.tsx
└── ...
```

The final implementation may add dedicated deck/card components, but must reuse existing graph semantics and validation helpers rather than duplicating them.

## 14. Deprecated requirements

The following requirements from the former SPEC are no longer governing:

- fixed glass-effect "Truth Cards" header
- Home / About / Admin navigation as the primary information architecture
- 2:3 physical card dimensions
- emoji-centered card identity
- mandatory 700ms 3D card flip
- thumbs-up/thumbs-down rating as the primary card interaction
- Israel/Palestine toggle as the core discovery interaction
- admin-first card CRUD as the principal UI
- card-level `sources` JSON as the canonical provenance model

Administrative tooling may continue to exist, but it is not the Figma-defined product shell.

## 15. Acceptance criteria

### Graph Explorer

- [ ] Global navigation matches Decks / Explorer / Graph / Research / Sources.
- [ ] Graph is visibly current.
- [ ] Context/breadcrumb bar is present.
- [ ] Heading reads "Graph Explorer" with the research-oriented tagline.
- [ ] Research disclaimer is always visible.
- [ ] Controls are catalogue-driven and expose view, focus, depth, appearance, facets, and relevant legend.
- [ ] Desktop workspace is graph + inspector with no permanent left navigator.
- [ ] Inspector separates axes, classification, provenance, and reasoning.
- [ ] Source and evidence are distinct.
- [ ] Empty/data-blocked states are explicit and honest.
- [ ] Status strip distinguishes classification, provenance, and reasoning.
- [ ] Appearance switching changes presentation only.
- [ ] Graph selection/refocus preserves projection semantics.

### Card discovery

- [ ] Scope/filter badges render above the featured card.
- [ ] Featured card uses editorial research-object styling.
- [ ] Card status visibly distinguishes open/unverified material.
- [ ] Title, summary, classification, provenance, and evidence are separate regions.
- [ ] Read front & back action exists.
- [ ] Save card action exists.
- [ ] Previous / position / Shuffle next navigation exists.
- [ ] Discovery prompt encourages question-first exploration.
- [ ] No physical-card flip is required.

### Responsive/accessibility

- [ ] Graph and inspector stack on narrow screens.
- [ ] Card discovery becomes single-column.
- [ ] Interactive controls have usable hit areas.
- [ ] Status is communicated textually as well as visually.
- [ ] No content is clipped at supported responsive widths.
- [ ] Keyboard focus order is deterministic.

### Verification

Before a design-aligned UI change is considered complete:

```
pnpm run test:ui
pnpm run typecheck:all
pnpm run build
pnpm run lint
pnpm run trope-graph:check
```

Then perform browser smoke verification for:

- default graph view
- argument view
- evidence view
- card/claim refocus in both directions
- facet filtering
- appearance switching across all three treatments
- empty/data-blocked notices
- responsive graph/inspector stacking
- card discovery navigation

No new semantic, projection, or API contract may be introduced solely to reproduce the visual design.

## 16. Design traceability

The following Figma nodes are the visual references for implementation:

| Figma node | Purpose |
|---|---|
| `1:2` | Graph Explorer implementation mockup |
| `38:3` | Atmospheric graph explorer |
| `38:168` | Editorial graph explorer |
| `7:4518` | Card discovery |
| `7:4528` | Featured card |
| `7:4558` | Card navigation |
| `7:4571` | Discovery prompt |

When Figma changes, update this section and the affected UI contract before implementation. Do not silently diverge between the design and this specification.
