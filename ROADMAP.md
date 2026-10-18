# Trope Deck Roadmap

## Purpose and authority

This roadmap sequences implementation of Trope Deck's product surfaces, research workflows, account/participation layer, and release-readiness work.

- `SPEC.md` is authoritative for product behaviour and semantic constraints.
- The [Trope Deck UI Figma file](https://www.figma.com/design/qmVMnfR9DpQFyYtaiSizYD/Trope-Deck-UI) is the visual direction; visual differences are not automatically defects.
- The `trope_graph` schema and server-side graph projection/API remain authoritative for ontology and graph semantics.
- Account identity and participation remain in `public`.

This document is a plan and status framework, not a claim that every listed check has already passed. Statuses must be supported by linked commits, issues, test reports, or explicit manual verification.

## Current position — reviewed 2026-10-12

### Established foundation

- Canonical ontology/graph data in `trope_graph`, with a server-authoritative projection/API.
- Application identity and participation model in `public`, including Better Auth and `UserInteraction`.
- Graph Explorer and its graph presentation/projection boundary.
- Decks' canonical card semantics: one canonical card with a designed Cover front and Claim/Analysis reading faces on the reverse. Flipping is presentation-only and must not alter identity, filters, graph projection, or epistemic status.
- Responsive/accessibility verification tooling in `tools/bidi-firefox/`.
- Product-shell tracking in [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) and a separate security review in [Issue #10](https://github.com/ubuntupunk/as-truth-cards/issues/10).

### Known open work / acceptance caveats

- Issue #9 remains open. Do not treat all product-shell surfaces as complete merely because routes exist or selected checks pass.
- The global mobile navigation and drawer interaction work must be accepted against the tracked criteria, not inferred from Deck screenshots alone.
- Explore, Compose, Research, and Sources still require surface-by-surface acceptance of their complete data, interaction, state, accessibility, and navigation contracts.
- Account onboarding/participation integration needs a concrete first vertical slice and audit of existing implementation before broad changes begin.
- The CORS, trusted-proxy/IP, and cookie-policy review is tracked separately in Issue #10.
- `pnpm run trope-graph:check` has previously been reported blocked by database/environment or migration conditions. Re-run and document the current outcome; do not call verification fully green while a required gate is blocked.
- Previously reported lint/typecheck failures must be checked against the current baseline and separated from regressions.

For every milestone, report each criterion as **implemented**, **verified**, **partially implemented**, **blocked**, or **deferred**. “Implemented” is not synonymous with “verified.”

---

## Milestone 1 — Canonical Decks and card interaction

**Goal:** make the current designed Deck the canonical home surface without changing graph semantics.

### Requirements

- `/` renders the new Deck; the former flat Deck remains only at `/legacy/deck` (or the repository's established equivalent), labelled as legacy/reference and absent from primary navigation.
- Deck cards come from the canonical graph/projection layer.
- The two-faced card remains one canonical object:
  - **Front:** Cover, using suitable rights-cleared imagery when available or a deliberate designed fallback.
  - **Reverse:** Claim and Analysis, preserving their semantic distinction.
- The flip affordance is discoverable and keyboard-operable; reduced-motion and no-3D fallbacks remain functional.
- Image attribution/alt text and fallback behaviour remain honest. Imagery is not evidence.
- Preserve honest loading, empty, error, and unavailable-data states.

### Acceptance

- Route/navigation tests prove canonical and legacy routing.
- UI tests cover card faces, state transitions, accessible inactive-face handling, fallback cover, and Save action gating.
- Responsive and keyboard checks are recorded with their actual method.
- Visual artifacts are retained as regression evidence without claiming pixel parity unless actually assessed.

**Status:** substantial implementation landed, including commit [`9b71931`](https://github.com/ubuntupunk/as-truth-cards/commit/9b71931c7a6ef5bfb0f9d15a5b81b29a0469064a). Continue to preserve its regression coverage; overall shell acceptance remains open.

---

## Milestone 2 — Cross-surface navigation, responsive behaviour, and accessibility

**Goal:** ensure users can actually reach and operate every supported surface.

### Requirements

- Separate **route integrity** (route mounts and access control is correct) from **navigation usability** (users can find and operate the route from the actual viewport).
- Verify primary navigation at 320, 375, 768, 1024, and 1280px using real viewport/browser interaction, not only iframe measurements.
- Verify Browse categories and Research tray drawers: accessible name, dialog semantics, focus placement, focus trapping, inert background, Escape/backdrop/Close dismissal, and focus restoration.
- Keep desktop navigation and the narrow-screen menu behaviour consistent and predictable.
- Preserve the committed Firefox/real-keyboard harness and report its browser, viewport, inputs, results, and limitations.
- Run keyboard/screen-reader checks appropriate to changed components; label automated assertions separately from human-exercised checks.

### Acceptance

- All primary destinations and drawer triggers are reachable at supported widths.
- No clipping, hidden-but-unreachable controls, or horizontal overflow prevents use.
- Drawer focus and dismissal behaviours pass repeatable tests.
- Report identifies any manual checks still outstanding.

**Status:** meaningful implementation and test-harness work is reported in [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9), including commits `ccd30eb`, `fe747bc`, and `666f1e6`. Do not mark this milestone accepted until the remaining issue criteria have been reviewed and signed off.

---

## Milestone 3 — Explore / Browse

**Goal:** enable discovery over real canonical graph content.

**Figma reference:** Explore / Browse, node `7:4787`.

### Requirements

- Implement the Explore route using canonical cards/entities and existing graph/domain contracts.
- Support search, filters, sorting, or categorisation only where the data/API contract supports them.
- Reuse shared card and metadata components rather than duplicating ontology semantics.
- Provide meaningful paths from a result to card detail, graph exploration, and research.
- Implement honest loading, empty, error, and unavailable-data states.
- Coordinate with the shared discovery/search design in [Issue #8](https://github.com/ubuntupunk/as-truth-cards/issues/8). Decide the search contract before implementing a page-specific search that other surfaces would need to replace.

### Acceptance

- Real canonical data drives results.
- Search/filter semantics and limits are documented and tested.
- Navigation into and back out of a result preserves appropriate context.
- Responsive and accessibility checks pass.

**Status:** outstanding surface acceptance.

---

## Milestone 4 — Compose / Decompose

**Goal:** provide a coherent analytical workflow without creating an alternate ontology.

**Figma reference:** Compose / Decompose, node `7:5057`.  
**Target route:** `/research/compose` or the existing coherent router convention.

### Requirements

- Distinguish user-authored analysis from canonical graph facts.
- Keep Claim, Inference, Argument Chain, Source, Evidence, and Classification distinct.
- Use the appropriate server/API persistence boundary; drafts must not silently write to `trope_graph`.
- Provide explicit unsaved, saved, empty, error, and permission states.
- Allow return to the research workspace and relevant card/graph context.
- Define what anonymous users may compose and which actions require an account.

### Acceptance

- A user can complete the intended composition/decomposition path and understand where work is stored.
- Persistence and permission rules are tested.
- No path silently promotes a draft or inference to canonical ontology.
- Research context is preserved appropriately across navigation and any account gate.

**Status:** partial foundation has been reported; full workflow acceptance remains outstanding.

---

## Milestone 5 — Research Workspace

**Goal:** support sustained exploration and analysis across graph, card, source, and composition contexts.

**Figma reference:** Research Workspace, node `7:5265`.

### Requirements

- Support graph context, selected/focused entities, filters, exploration depth, analytical state, provenance, and notes/structured activity where specified.
- Keep graph content server-authoritative.
- Keep the three concepts separate:
  - **Research session:** current exploration state.
  - **Authentication session:** identity/security state.
  - **Durable activity:** account-associated participation records.
- Anonymous exploration remains possible where permitted.
- Account-bound persistence is explicit; signing in must not silently migrate anonymous interactions into account history.
- Provide honest loading, empty, error, and unavailable states.

### Acceptance

- Users can follow a coherent research workflow across the relevant surfaces.
- Research state survives supported transitions without being confused with authentication state.
- Persistence, URL/context, and authorization behaviours are tested.

**Status:** partial foundation has been reported; full workflow acceptance remains outstanding.

---

## Milestone 6 — Sources and provenance

**Goal:** make source discovery and provenance useful across the product.

**Design checkpoint:** if there is no dedicated final Sources frame in Figma, resolve the design direction before claiming visual completion.

### Requirements

- Keep Source, Evidence, Claim, Inference, Argument Chain, and Classification semantically distinct.
- Show available source metadata and provenance without implying that a source automatically proves a claim.
- Expose source/evidence relationships only when supported by canonical data.
- Connect Sources to relevant card, graph, and research contexts.
- Do not fabricate citations, evidence, provenance, or completeness.
- Handle loading, empty, error, and data-unavailable states honestly.

### Acceptance

- Users can inspect a source and understand its known relationship to claims/evidence.
- All displayed relationships are supported by the API/data contract.
- Design, responsive behaviour, and accessibility are reviewed.

**Status:** a Sources surface exists, but complete workflow and design acceptance remain outstanding.

**Foundation (2026-10-12, issue #12):** migration `0012_research_sources.sql` ships the
provider-neutral storage this milestone needs: `source_identifiers` (persistent
identifiers, one identifier → one source), `discovery_candidates` (a human review queue —
not a source and not evidence), `source_metrics` (transparent attention/use observations,
each with a required definition), and provenance/verification columns on `sources`.
Migration `0013_discovery_review_events.sql` adds `discovery_candidate_events`, the
append-only history of review decisions and promotions; `0014_discovery_candidate_revision.sql`
adds the `revision` optimistic-concurrency token the review queue needs to keep competing
decisions mutually exclusive; `0015_discovery_events_append_only.sql` installs triggers and
`0016_discovery_events_immutable.sql` makes them unconditional (no settable bypass) and sets
the event foreign keys to `ON DELETE RESTRICT`, so the event log is immutable under all DML for
every role and history cannot be cascaded or blanked away by a DML delete.
`0017_discovery_events_dml_scope.sql` records the honest scope: this is an application-integrity
guard, not a privilege boundary — the migration runner and runtime share one role in the current
deployment, and a table owner can still disable the trigger with DDL. No
PlumX/Elsevier dependency was added; the layer is useful with open metadata on its own.
Support semantics are unchanged: a discovered, cited, or popular source is not evidence, and
the support chain still runs through `claim_sources`/`evidence_claims`.

Per-deliverable status:

| Deliverable | Status | Evidence |
| --- | --- | --- |
| Storage: identifiers, candidates, metrics, provenance columns | Implemented, verified | migration `0012` applied locally; `trope-cards/test/schema-research-sources.test.ts` (DB-free) + migrate-check round-trip |
| DML-immutable review/promotion event log | Implemented, verified | migrations `0013` + `0015` + `0016` + `0017`; store integration test asserts one event per decision/promotion, none on refusal, direct UPDATE/DELETE rejected by the trigger (no settable bypass), and candidate/source deletes with history refused by `ON DELETE RESTRICT`; immutability is scoped to DML — the shared owner/runtime role can still disable the trigger via DDL (see §"Foundation" above) |
| Identifier normalization (DOI/URL; per-provider extraction for Crossref and DataCite) | Implemented, verified | `trope-cards/test/discovery-identifiers.test.ts` |
| Crossref provider adapter (bounded rows, timeout, throttle, tolerant mapping, single-page) | Implemented, verified | `trope-cards/test/discovery-crossref.test.ts` (mocked HTTP) |
| Discovery service (allow-list provider, limit clamp, dedupe) | Implemented, verified | `trope-cards/test/discovery-service.test.ts` |
| Idempotent candidate ingest preserving review state | Implemented, verified | `trope-cards/test/discovery-store.integration.test.ts` (live Postgres) |
| Explicit promotion; no auto-promotion, no evidence edge | Implemented, verified | store integration test (link only; `claim_sources`/`evidence_sources` stay empty) |
| Concurrency-safe review/promote (revision-token conditional update) | Implemented, verified | migration `0014`; store integration tests: two promotions race, two reviews race, and a promotion races a review — exactly one decision applies and one consistent event is written; the loser is `stale`/`already_promoted` |
| Review API: list / search / review / promote / events, admin-gated | Implemented, verified | `server/api/discovery.test.ts` (401/403, 400, 404, 409, 502) |
| Raw-payload retention | **Unavailable** while retention terms are unresolved | report §3.3/§5; no adapter option exists and `discovery_candidates.raw_payload` is a reserved, unpopulated column |
| Provider pagination | Outstanding (single-page only) | report §7 |
| Second provider — **DataCite** (search port) | Implemented, verified | `trope-cards/test/discovery-datacite.test.ts` (mocked HTTP); routed through the service allow-list alongside Crossref (`server/api/discovery.ts`, `DATACITE_MAILTO`) |
| OpenCitations (citation links / `citation_count`) | Outstanding, **fit-checked** | PID-addressed only (Index v2 / Meta v1 have no keyword search), so it cannot implement the search port; belongs to the metrics work (report §3.3/§3.4) |
| OpenAlex (search) | Outstanding | pending ToS / rate-limit review (report §3.3, §7) |
| Discovery-review UI | Outstanding (API-only today) | report §3.3 "Acceptance" |
| Research Metrics UI | Outstanding | provider-neutral port; empty state renders honestly |

Crossref and DataCite adapters ship; the shared polite transport lives in
`trope-cards/src/discovery/providers/http.ts` so timeout, throttle, abort, and status handling
cannot drift apart between them. Still outstanding: OpenCitations (which has no keyword-search
endpoint — it is a citation-links/metrics provider, report §3.3), OpenAlex (pending terms review),
provider pagination, the Research Metrics component, and the discovery-review UI. Unresolved
data-licence/privacy decisions are tracked in `docs/issue-12-plumx-research-report.md`.

---

## Milestone 7 — Account onboarding and participation

**Goal:** introduce a clear account lifecycle and integrate account-required actions without compromising research continuity, privacy, or semantic boundaries.

Account planning starts now. It can proceed alongside independent Explore/Sources work after the existing implementation and contracts are audited. Do not wait until every surface is complete to plan it, and do not begin an uncontrolled auth rewrite.

### First: inventory before implementation

Inspect and report the current behaviour of:

- Better Auth configuration, routes, sessions, verification and redirect handling.
- Existing `User`, `Account`, `Session`, and `Verification` records.
- `UserInteraction` and existing account/profile/activity/settings routes.
- Current Save card gating and any existing onboarding UI.
- Relevant account/onboarding Figma frames and any unresolved design gaps.
- Existing tests, environment requirements, and deployment assumptions.

Do not add a new persistence model unless this inventory demonstrates why existing structures are insufficient.

### Target state flow

```
Anonymous
  ↓ account-required action
Sign in / Create account
  ↓
Email verification
  ↓
Onboarding
  ↓
Authenticated user
```

Include pending, expired, failed, and resent verification; sign-in return; cancellation; and recoverable error states. Distinguish authenticated from verified where permissions require it.

### First vertical slice

Deliver the smallest complete end-to-end flow:

1. An anonymous user encounters a clearly explained account-required action.
2. Sign-in and account creation use the existing supported auth boundary.
3. Verification states are clear and recoverable.
4. Onboarding completion is explicit.
5. The user returns to the intended route/card/research context where safe and feasible.
6. One account-gated action—preferably Save card—works for an eligible user.
7. Profile/activity/settings navigation is reconciled with existing implementation; expand scope only where needed for a coherent flow.

### Non-negotiable boundaries

- Keep identity and participation in `public`; keep ontology semantics in `trope_graph`.
- Preserve the role ladder `ANONYMOUS → VERIFIED → ACADEMIC → RESEARCHER → MODERATOR → ADMIN`; onboarding cannot self-assign privileged roles.
- Do not silently reassign anonymous interactions to a new account.
- Preserve research context where feasible, but do not treat context preservation as ownership transfer or activity migration.
- Keep profile, account activity, saved cards, settings, and sign-out distinct from the research workspace.
- Audit cookies, verification tokens, redirect/return URL validation, error disclosure, rate limiting, CORS/proxy assumptions, and data storage/logging claims. Provider-side logging remains unverified unless independently confirmed.
- Map each screen/state to Figma; label unresolved design decisions.

### Required tests

Cover anonymous, authenticated, verified, and unverified states; verification expiry/failure/resend; safe return-context preservation; authorization boundaries; Save card persistence; duplicate/retry behaviour where relevant; and proof that anonymous history is not silently reassigned.

### Acceptance

A complete account lifecycle and one account-gated action work end-to-end; role and persistence boundaries are tested; errors are recoverable; the design/state matrix and privacy/security assumptions are documented.

**Status:** in progress — first account surfaces implemented (issue #13).

| Deliverable | Status | Evidence |
| --- | --- | --- |
| Multi-step onboarding journey (profile → appearance → research preferences → completion) with validation, skip/back, loading/error states, and server-confirmed persistence only | Implemented, verified | `src/onboarding/wizard.test.tsx` (journey state machine), `src/onboarding/preferences.test.tsx`, `src/auth/profile.test.tsx`; route `src/pages/Onboarding.tsx` |
| Improved My profile panel: sidebar nav, public/private cards, edit form | Implemented, verified | `src/components/account/*`, `src/components/account/account-panels.test.tsx`; Figma `62:13257` (Atmospheric·Improved) |
| Unverified-email resolution: amber state + working resend via Better Auth `send-verification-email` | Implemented, verified | `src/auth/verification.test.tsx`, unverified/verified/error render tests |
| Appearance + participation preferences | Device-local (localStorage), labelled as such in UI | No account columns exist by design; revisit when Settings ships email settings |
| Anonymous account-required action, Save card gating, My activity/Settings panel parity, email change, account-side preference persistence, sign-in/dropdown/settings improved panels | Outstanding | tracked in issues |

Journey and panel copy follows the improved Figma onboarding/profile frames; unresolved design decisions (Lora typography without a font dependency, omitted "Choose visibility"/"Change email" affordances that have no product capability, "Saved cards" sidebar entry with no route) are labelled in the issue #13 implementation report.

---

## Milestone 8 — Security, privacy, and operational readiness

**Goal:** resolve deployment assumptions and ensure product claims match verified behaviour.

### Security review

Track in [Issue #10](https://github.com/ubuntupunk/as-truth-cards/issues/10), separately from visual/product-shell implementation:

- Decide whether API consumers require cross-origin access; replace default CORS behaviour with the intentional policy.
- Establish correct trusted-proxy/IP handling for the Render deployment.
- Verify Better Auth cookie Secure/SameSite behaviour behind the proxy.
- Add tests for the selected CORS/headers policy.
- Document any assumptions and avoid treating a review concern as a demonstrated exploit before evidence exists.

### Privacy and operational claims

- Distinguish application code behaviour from Render, Neon, and other provider/platform practices.
- Do not claim that no logs exist merely because application request-logging middleware is absent.
- Review stored account/session/activity data and browser-local research/theme/presentation state.
- Keep privacy wording scoped to what has actually been verified.

### Acceptance

- Security decisions are documented and tested where feasible.
- Privacy copy accurately reflects known data flows and explicitly labels unverified provider behaviour.
- Open risks have an owner, mitigation, and disposition.

---

## Milestone 9 — Full verification and release readiness

Run applicable repository checks, including:

```text
pnpm run trope-graph:check
pnpm test
pnpm run test:ui
pnpm run typecheck
pnpm run build
```

Run configured lint/format checks as well. If script names or package boundaries differ, report the actual commands used.

For each gate, record **pass**, **fail**, or **blocked**, with command, environment/context, concise result, and relevant commit. Separate existing baseline failures from regressions. A blocked database/environment check is not a pass.

Release acceptance also requires:
- route integrity and navigation usability verified separately;
- responsive/keyboard checks reported with accurate evidence labels;
- account authorization and persistence boundaries tested;
- no known data-fabrication or provenance misrepresentation;
- unresolved work tracked in issues rather than hidden in prose.

---

## Recommended sequence and parallelism

1. **Current shell acceptance:** review the Issue #9 matrix; sign off the mobile/navigation/drawer criteria; document the graph-check blocker and current test baseline. Do not close Issue #9 until acceptance is established or remaining scope is explicitly moved to tracked follow-ups.
2. **In parallel — account discovery/planning:** inventory existing auth/account functionality and deliver the Milestone 7 state diagram, screen/Figma map, persistence/security boundaries, tests, and first-slice proposal. Planning is not blocked on finishing every product surface.
3. **Explore and Sources:** proceed in small vertical slices using canonical APIs and shared discovery contracts. Coordinate search decisions with Issue #8.
4. **Compose and Research:** complete workflows with explicit draft persistence and research/auth separation; integrate account gates only where required.
5. **Account first vertical slice:** implement after the inventory/contract is reviewed; it may overlap independent surface work, but do not duplicate or replace existing auth infrastructure without justification.
6. **Security and release readiness:** continue Issue #10 separately; run full verification against the integrated branch before declaring release readiness.

Dependencies matter more than a rigid page-by-page queue. Do not block independent read-only discovery work on account preferences; do not implement account-bound persistence before the identity and authorization contract is clear.

### Explicitly deferred unless a demonstrated requirement changes priority

- Custom user-created deck CRUD and its persistence/authorization model.
- Broader account preferences beyond the onboarding slice.
- Ontology/schema redesign undertaken merely to simplify a screen.
- Any inferred source/evidence relationships not supported by canonical data.
- Visual polish that does not address an accepted requirement or a material usability/accessibility issue.

---

## Cross-surface invariants

Every implementation agent must preserve these invariants:

1. `trope_graph` is the semantic authority for ontology and graph data.
2. Server-side graph projections/API responses are authoritative.
3. UI state must not become a second ontology.
4. Reuse domain/projection components instead of duplicating graph semantics.
5. Keep Source, Evidence, Claim, Inference, and Argument Chain distinct.
6. Keep Axis, Suit/Collection, Mechanism, Concept, and Locale distinct.
7. Do not fabricate evidence, provenance, classification, or relationships.
8. Research session state is distinct from Better Auth user session state.
9. Application identity and participation remain in `public`.
10. Anonymous, authenticated, verified, academic/researcher, moderator, and admin capabilities remain explicit.
11. Authentication does not silently reassign anonymous activity.
12. Figma guides visual composition and interaction; `SPEC.md` governs product and semantic requirements.
13. Every completion claim identifies the evidence supporting it and the checks not performed.

---

## Agent work protocol

Before implementation:

1. Read `SPEC.md` and this roadmap.
2. Inspect current routes, APIs, domain/projection components, persistence, and tests.
3. Inspect relevant Figma frames; state explicitly if visual assets could not be inspected.
4. Identify the authoritative data and authorization contracts.
5. Inventory existing functionality before adding routes, schemas, or auth infrastructure.
6. Propose the smallest coherent vertical slice and list its acceptance criteria.
7. Add/update tests for behaviour, routes, semantics, accessibility, and persistence boundaries.
8. Verify responsive behaviour and keyboard interaction at the appropriate level.
9. Report schema/API/semantic changes separately rather than silently changing ontology semantics.
10. Record commits, test commands/results, limitations, blockers, and deferred scope.

## Definition of roadmap completion

The roadmap is complete when:

- The new Deck is canonical and the old flat Deck is legacy/reference only.
- Explore/Browse is functional over canonical data.
- Graph remains canonical and server-authoritative.
- Compose/Decompose is functional without contaminating canonical ontology.
- Research Workspace is functional and distinct from authentication state.
- Sources is functional and provenance-first.
- Account onboarding and participation integrate without contaminating `trope_graph` or silently migrating anonymous activity.
- Shared visual/navigation patterns are coherent and accessible at supported viewports.
- Security/privacy decisions are documented and product claims are scoped to verified facts.
- Required repository checks are green, or remaining failures are explicitly documented as blocked/pre-existing with an owner and follow-up.
