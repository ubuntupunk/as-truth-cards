# Trope Deck Roadmap

## Purpose

This roadmap is the implementation plan for completing the Trope Deck product shell and integrating the remaining designed surfaces with the canonical ontology, research workflow, provenance model, and account/participation layer.

The roadmap is subordinate to `SPEC.md` for product and semantic requirements and to the Figma file for visual direction.

## Current Position

The project has established:

- A canonical ontology/graph in the `trope_graph` schema.
- Application identity and participation data in the `public` schema.
- A canonical graph projection/API that must remain server-authoritative.
- Figma designs for the core graph/deck surfaces and the account layer.
- Account flows covering sign-in, onboarding, profile, activity, and settings.

The remaining work is primarily implementation and integration of the outstanding product surfaces.

---

## Critical Housekeeping: Existing Deck

The current front-page Deck is the older flat card-shuffle implementation. It is transitional and must not remain the canonical product surface once the newer Deck design is implemented.

### Required migration

1. Implement the newer Deck design as the canonical `/` route.
2. Move the existing flat Deck implementation to `/legacy/deck`, unless the repository already has an established legacy-route convention that should be used instead.
3. Clearly label the legacy route as legacy/reference.
4. Remove the legacy Deck from primary navigation.
5. Do not add new product functionality to the legacy implementation.
6. Retain it temporarily as a visual/behavioral reference until the replacement has been verified.
7. Update route, navigation, and UI tests accordingly.
8. Do not simply delete the old implementation before the replacement is verified.

---

## Phase A — Decks

### Objective

Implement the newer Deck experience as the canonical home surface.

### References

- Figma: Deck / Shuffle
- Figma nodes: `7:4434`, `12:1446`, `12:1644`, `12:1841`
- Card navigation/detail references: `7:4518`, `7:4528`, `7:4558`, `7:4617`

### Requirements

- Establish the new Deck as `/`.
- Preserve the distinction between Deck presentation and the underlying ontology.
- Cards must be sourced from the canonical graph/projection layer.
- Support the designed card states, navigation, shuffle/discovery interactions, and responsive layouts.
- Ensure card detail can transition into graph exploration and research without inventing a second data model.
- Move the old flat implementation to the legacy route.

### Acceptance

- `/` renders the new Deck.
- The old flat Deck is reachable only through the legacy/reference route.
- No primary navigation points to the legacy route.
- Deck content comes from authoritative server-side data.
- Loading, empty, error, and unavailable-data states are honest and designed.

---

## Phase B — Explore / Browse

### Objective

Implement the designed discovery and browsing surface.

### References

- Figma: Explore / Browse
- Node: `7:4787`

### Requirements

- Provide browse/discovery over the canonical graph corpus.
- Preserve the distinction between discovery UI and ontology semantics.
- Support filtering, search, sorting, and/or categorisation only where supported by the existing API/data contract.
- Allow a discovered card/entity to enter card detail, graph exploration, or research.
- Reuse canonical card, graph, and metadata components.

### Acceptance

- `/explore` is functional.
- Discovery is backed by real canonical data.
- No duplicate ontology is introduced in the UI.
- Empty/loading/error states are implemented.

---

## Phase C — Compose / Decompose

### Objective

Implement the designed composition and decomposition workflow.

### Reference

- Figma: Compose / Decompose
- Node: `7:5057`

### Requirements

- Treat composition/decomposition as an analytical/research operation, not as an alternate ontology.
- Preserve distinctions between Claim, Inference, Argument Chain, Source, Evidence, and Classification.
- Clearly distinguish user-generated analytical work from canonical graph facts.
- Persist only through the appropriate server/API boundary.
- Support returning from composition into the research workspace and relevant graph/card context.

### Acceptance

- Compose/decompose workflow is functional.
- User-generated analysis cannot silently become canonical ontology.
- Provenance and status are visible where applicable.
- Unsaved, saved, empty, error, and permission states are handled.

---

## Phase D — Research Workspace

### Objective

Implement the research workspace as the primary environment for sustained exploration and analysis.

### Reference

- Figma: Research Workspace
- Node: `7:5265`

### Requirements

The research workspace should support the designed combination of:

- graph context,
- selected/focused entities,
- filters,
- exploration depth,
- analytical state,
- evidence/provenance,
- notes or structured research activity where specified.

### Critical distinction

A research session is **not** a Better Auth user session.

- Research session = current exploration/research state.
- User session = authentication/security state.
- User activity = durable record of interaction.

Authentication must preserve research context when an account is required.

### Acceptance

- `/research` is functional.
- Research state is distinct from authentication state.
- Graph data remains server-authoritative.
- Account-bound persistence is explicit.
- Anonymous exploration remains possible where permitted.

---

## Phase E — Sources

### Objective

Implement a provenance-first Sources surface and connect it to cards, graph entities, evidence, and research.

### Design checkpoint

If the Figma file does not contain a dedicated final Sources design, resolve the visual design before declaring Sources implementation visually complete. Do not invent a final visual system independently of the established Figma direction.

### Requirements

Maintain the semantic distinction between:

- Source
- Evidence
- Claim
- Inference
- Argument Chain
- Classification

A Source is not automatically Evidence, and Evidence is not automatically a Claim.

### Acceptance

- `/sources` is functional.
- Source metadata and provenance are visible.
- Source/evidence relationships are explicit.
- No unsupported evidence is fabricated.
- Sources can be reached from relevant cards, graph context, and research context where appropriate.
- Loading, empty, error, and unavailable-data states are handled.

---

## Phase F — Account & Participation Integration

The account-layer designs are already established, but implementation must be integrated with the product surfaces.

### Identity architecture

Keep application identity/participation in `public`:

- `User`
- Better Auth `Session`
- `Account`
- `Verification`
- `UserInteraction`

Keep ontology/graph semantics in `trope_graph`.

### User states

Support the established progression:

```
Anonymous
  ↓
account-required action
  ↓
Sign in / Create account
  ↓
Verify email
  ↓
Onboarding
  ↓
Authenticated user
```

Anonymous interactions must not be silently reassigned to a newly created account.

### Integration requirements

- Save/account-bound actions require an authenticated user.
- Authentication should preserve research context.
- Profile/activity/settings surfaces must remain distinct from the research workspace.
- User activity must be represented as participation data, not ontology data.
- Role-gated academic/research/moderation actions must respect the established role ladder.

---

## Recommended Implementation Sequence

1. Decks
2. Explore / Browse
3. Compose / Decompose
4. Research Workspace
5. Sources
6. Account/participation integration
7. Responsive, accessibility, route, and navigation cleanup
8. Full verification

This ordering deliberately establishes the core content/navigation surfaces before deeper research and participation integration.

---

## Target Route Shell

| Surface | Target route | Status |
|---|---|---|
| Decks | `/` | Replace transitional Deck |
| Legacy Deck | `/legacy/deck` | Reference only |
| Explore | `/explore` | Outstanding |
| Graph | `/graph` | Canonical graph |
| Research | `/research` | Outstanding |
| Compose / Decompose | `/research/compose` or existing router convention | Outstanding |
| Sources | `/sources` | Outstanding |
| Account | Existing auth/account route family | Designed; integration outstanding |

If the existing application already uses a different but coherent route convention, preserve that convention rather than introducing gratuitous route churn.

---

## Cross-Surface Invariants

Every implementation agent must preserve these invariants:

1. `trope_graph` is the semantic authority for ontology and graph data.
2. Server-side graph projections/API responses are authoritative.
3. UI state must not become a second ontology.
4. Reuse domain/projection components instead of duplicating graph semantics.
5. Keep Source, Evidence, Claim, Inference, and Argument Chain distinct.
6. Keep Axis, Suit, Mechanism, Concept, and Locale distinct.
7. Do not fabricate evidence, provenance, or classification.
8. Research session state is distinct from Better Auth user session state.
9. Application identity and participation remain in `public`.
10. Anonymous, authenticated, verified, academic/researcher, moderator, and admin capabilities must remain explicit.
11. Figma is the visual authority; `SPEC.md` is the product/semantic authority.

---

## Agent Work Protocol

Before changing implementation:

1. Read `SPEC.md`.
2. Read this `ROADMAP.md`.
3. Inspect the existing route structure and identify current implementations.
4. Inspect the relevant Figma frames.
5. Inspect existing API/domain/projection components before creating new ones.
6. Identify the authoritative data contract for the surface.
7. Implement the smallest coherent vertical slice.
8. Add/update tests for routes, behavior, and semantic/API contracts.
9. Verify responsive and accessible behavior.
10. Report any required semantic/API/schema change separately rather than silently changing ontology semantics.

### Verification

Run the repository's applicable checks, including:

```text
pnpm run trope-graph:check
pnpm test
pnpm run test:ui
pnpm run typecheck
pnpm run build
```

Also run existing lint/format checks where configured.

Separate pre-existing failures from regressions introduced by the implementation.

---

## Definition of Roadmap Completion

The roadmap is complete when:

- The new Deck is canonical at `/`.
- The old flat Deck exists only as a legacy/reference route.
- Explore/Browse is functional.
- Graph remains canonical and server-authoritative.
- Compose/Decompose is functional without contaminating canonical ontology.
- Research Workspace is functional and distinct from authentication state.
- Sources is functional and provenance-first.
- Account participation integrates without contaminating `trope_graph`.
- Shared visual/navigation patterns are used consistently.
- Responsive and accessibility requirements are addressed.
- Repository verification is green, or any remaining failures are explicitly documented as pre-existing/unrelated.
