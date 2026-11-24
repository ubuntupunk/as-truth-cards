# Compose page — UI/UX design review handoff

**Status:** design review input for the shipped S0/S1 Compose workflow plus Bucket B Stage 1 (Q1 hierarchy + Q5 save feedback, Issue #16). This document describes current behaviour; it is not a new spec decision and does not authorize Stage 2 (Q3), Stage 3 (Q6), or S2–S4.

**Purpose:** give a UI/UX reviewer everything needed to pick up the page: product intent, full step flow, every data/UI type, exact copy, states, screenshots, and focused review questions.

**Implementation authority:** `src/pages/Compose.tsx`, `src/compose/*`, `server/api/drafts.ts`, `server/composition/draft-contract.ts`, `SPEC.md` §9.5, `ROADMAP.md` Milestone 4.

**Figma reference:** Compose / Decompose node `7:5057` (per `ROADMAP.md`). The screenshots below are the authority for **shipped behaviour**.

---

## 1. What the page is for

Compose is a researcher authoring surface over **one card at a time**. Its central invariant is strict separation:

| Surface | Canonical corpus | Researcher draft |
|---|---|---|
| Source | card-focused graph projection | `public.decomposition_drafts.payload` JSON |
| Editable here? | No | Yes |
| Visible in authoring pool? | Yes, as premise/conclusion options | Yes, as `working` refs |
| Visible in graph/API/cards/counts? | Yes | **Never** |
| Promotion path to canonical? | — | None |

The researcher first reads what is recorded for the card, then writes a private, account-owned decomposition. If the card has no canonical claim, the UI says so honestly and lets the researcher start with a **working assertion**.

Approved plain-language prompts, in order:

1. **What is the assertion?**
2. **What reasons are offered?**
3. **How does the reasoning work?**
4. **What challenges or qualifies it?**
5. **Construct an argument**

Formal ontology terms remain available through `<details>` disclosures. The assertion prompt uniquely shows a concrete example instead of an ontology explanation.

---

## 2. Screenshot index

Captured locally against `http://localhost:8080` (Vite) + `http://localhost:3001` (Express) on 2026-11-24 using `agent-browser`. Captures 01–06 are full page at 1440×1000 except 06, which is full page at 375×812. Captures 07–10 are viewport captures that show the sticky bar while scrolling (07–09 at desktop, 10 at 375×700). No production credentials or deployed account data appear.

| # | File | State |
|---|---|---|
| 01 | [`01-signed-out-gate.png`](compose/screenshots/01-signed-out-gate.png) | Signed out, card selected: read panel stays open; authoring gated behind sign-in |
| 02 | [`02-zero-claim-empty.png`](compose/screenshots/02-zero-claim-empty.png) | Signed in, zero-claim card, pristine empty draft, example disclosure expanded; no issue banner |
| 03 | [`03-working-assertion-saved.png`](compose/screenshots/03-working-assertion-saved.png) | One saved working assertion; no steps/chains yet; saved status and `NOT CANONICAL` draft frame |
| 04 | [`04-step-and-chain.png`](compose/screenshots/04-step-and-chain.png) | Developed draft: working assertion + reasoning step + named chain, saved |
| 05 | [`05-populated-canonical.png`](compose/screenshots/05-populated-canonical.png) | Signed in, card with recorded claims: read panel collapsed with `Read recorded`; pristine draft |
| 06 | [`06-mobile-375.png`](compose/screenshots/06-mobile-375.png) | 375px stacked layout, signed in, zero-claim card, empty draft |
| 07 | [`07-desktop-sticky-bar.png`](compose/screenshots/07-desktop-sticky-bar.png) | Desktop: sticky save bar pinned below the fixed header while scrolling a populated draft |
| 08 | [`08-blocked-review.png`](compose/screenshots/08-blocked-review.png) | Dirty blocked draft: `Review 4 issues`, amber issue banner, Save blocked but focusable |
| 09 | [`09-save-failure.png`](compose/screenshots/09-save-failure.png) | Simulated 400 response: exact server message in `role="alert"` |
| 10 | [`10-mobile-sticky-bar.png`](compose/screenshots/10-mobile-sticky-bar.png) | Mobile 375px: sticky save bar pinned below the header at 104px |

### 01 — Signed-out gate

![Signed-out gate](compose/screenshots/01-signed-out-gate.png)

### 02 — Zero-claim empty state

![Zero-claim empty state](compose/screenshots/02-zero-claim-empty.png)

### 03 — Saved working assertion

![Saved working assertion](compose/screenshots/03-working-assertion-saved.png)

### 04 — Step and chain authoring

![Step and chain authoring](compose/screenshots/04-step-and-chain.png)

### 05 — Populated canonical read panel

![Populated canonical read panel](compose/screenshots/05-populated-canonical.png)

### 06 — Mobile 375px

![Mobile 375px](compose/screenshots/06-mobile-375.png)

### 07 — Desktop sticky bar

![Desktop sticky bar](compose/screenshots/07-desktop-sticky-bar.png)

### 08 — Blocked draft and review action

![Blocked draft and review action](compose/screenshots/08-blocked-review.png)

### 09 — Save failure alert

![Save failure alert](compose/screenshots/09-save-failure.png)

### 10 — Mobile sticky bar

![Mobile sticky bar](compose/screenshots/10-mobile-sticky-bar.png)

---

## 3. Information architecture / screen anatomy

Render order is deliberate: **choose card → understand recorded reasoning → author your own**.

```
PageShell / PageBreadcrumb / PageHeading ("Compose", h1)
└── Card picker section                 "Choose a card"
    ├── Card <select>                  "Pick a card…"
    ├── Optional "Back to research"
    └── Separation explainer
└── ComposeWorkspace                    keyed by active card slug
    ├── CanonicalDecomposition         h2 "Recorded reasoning" (read-only study panel)
    │   └── h3 Claims / Reasoning steps / Argument chains
    └── PermissionGate
        └── Draft workspace            h2 "Your decomposition draft" + NOT CANONICAL
            ├── SaveBar                sticky under header: status + count + Save/Discard/Delete
            └── ComposeEditor
                ├── h3 What is the assertion?
                ├── h3 What reasons are offered?
                ├── h3 How does the reasoning work?
                ├── h3 What challenges or qualifies it?
                ├── h3 Construct an argument
                └── #compose-issues    full issue list; rendered only once issues exist
```

DOM order is intentionally **choose card → read recorded material → author draft**. The recorded panel and the draft frame are two distinct `h2` surfaces; no heading jumps from `h1` to `h4`.

### Shared page chrome

- Route: `/research/compose`
- Header nav: `Compose` (exact active match)
- Entry from Research workspace: card row → `Compose` (`?card=<slug>&returnTo=<safe path>`)
- Breadcrumb: `Trope Cards · Research · Compose`
- Heading: `Research / Compose`
- Description: `Study a card's recorded reasoning, then author your own — saved to your account, never into the corpus.`
- Geometry: shared `PageShell` container, `pt-24 pb-16`, theme-aware `bg-muted`, aligned header/main/footer edges.

### Component inventory

| Component | File | Responsibility |
|---|---|---|
| `Compose` | `src/pages/Compose.tsx` | URL state, card choice, queries, auth probe, workspace keying |
| `ComposeWorkspace` | `src/pages/Compose.tsx` | Draft hydration, dirty state, issue computation, save/delete wiring |
| `PermissionGate` | `src/compose/compose-editor.tsx` | Renders editor only for `signed-in`; checking/signed-out states |
| `SaveBar` | `src/compose/compose-editor.tsx` | Sticky status, issue count, `Review {n} issues`, Save/Discard/Delete, exact-error alert |
| `CanonicalDecomposition` | `src/compose/canonical-read.tsx` | Read-only claims/steps/chains panel; native disclosure with counts for populated cards |
| `ComposeEditor` | `src/compose/compose-editor.tsx` | Five authoring sections + one authoritative issue banner |
| `QuestionHeading` | `src/compose/compose-editor.tsx` | Plain-language prompt + progressive disclosure |
| `WorkingClaimCard` | `src/compose/compose-editor.tsx` | Assertion/notes/status/source fields |
| `StepCard` | `src/compose/compose-editor.tsx` | Step fields, premise/conclusion lists and role selects |
| `ChainCard` | `src/compose/compose-editor.tsx` | Chain fields and ordered draft-step list |
| `VocabSelect` / `ClaimSelect` / `WorkingClaimSelect` | `src/compose/compose-editor.tsx` | Served-vocabulary, card-pool and draft-local option pickers |
| `LoadingState` / `ApiErrorState` / `MalformedState` | `src/graph/graph-states.tsx` | Shared graph-state renderers |

---

## 4. Main flow diagram

```mermaid
flowchart TD
    A["Enter Compose<br/>nav / direct URL / Research card"] --> B["Parse ?card=slug and optional safe returnTo"]
    B --> C{"Card in served listing?"}
    C -- "No" --> C1["Unknown-card state<br/>'not a card in the served listing'"]
    C -- "No card chosen" --> C2["'Choose a card above to start composing.'"]
    C -- "Yes" --> D["Load graph projection<br/>view=argument, depth=3"]
    D --> E["Scope by projection.focus.id<br/>not first card node"]
    E --> F["CanonicalDecomposition<br/>populated signed-in: collapsed with counts<br/>signed-out / zero-claim: open"]

    B --> G["GET /api/drafts/:slug<br/>session probe"]
    G --> H{"Draft response"}
    H -- "401" --> I["signed-out<br/>Sign-in invitation + link"]
    H -- "other error" --> J["loading / API error"]
    H -- "200" --> K["signed-in<br/>hydrate or create empty draft"]

    I --> I1["Sign in with returnTo<br/>preserve card + research context"]
    I1 --> K

    F --> L["Draft workspace<br/>NOT CANONICAL<br/>sticky SaveBar beneath header"]
    K --> L

    L --> M["1. What is the assertion?<br/>Add working assertion<br/>label / status / note / source pointer"]
    M --> N["2. What reasons are offered?<br/>3. How does the reasoning work?<br/>Add step / Add inference step / Add challenge presets<br/>premises, conclusion, inference type, status"]
    N --> O["4. What challenges or qualifies it?<br/>COUNTERPREMISE / COUNTER / ALTERNATIVE / CONTEXT roles<br/>challenge preset seeds a labelled step; no separate card"]
    O --> P["5. Construct an argument<br/>Add chain after >=1 step<br/>auto-attach first step as MAIN"]

    P --> Q{"Client save gate<br/>draftIssues"}
    Q -- "Issues" --> R["Review {n} issues in sticky bar<br/>full banner at #compose-issues<br/>Save aria-disabled but focusable"]
    R --> L
    Q -- "Clean + dirty" --> S["Save enabled"]
    S --> T["PUT /api/drafts/:slug"]
    T --> U{"Server validation"}
    U -- "400" --> V["role=alert with exact server message<br/>focus returns to Save"]
    V --> L
    U -- "200" --> W["Saved at HH:MM<br/>focus returns to Save, no banner if valid"]

    W --> X["Discard changes → restore server copy"]
    W --> Y["Delete saved draft → empty draft"]
    X --> L
    Y --> L
```

### Data-flow diagram (why drafts cannot leak)

```mermaid
flowchart LR
    GAPI["Graph API projection"] --> SELECT["selectComposeProjection<br/>projection.focus.id"]
    SELECT --> READ["CanonicalDecomposition<br/>read only"]
    SELECT --> POOL["claimPool<br/>canonical premise/conclusion options"]
    USER["Researcher"] --> LOCAL["DraftPayload in local state"]
    LOCAL --> PUT["PUT /api/drafts/:cardSlug"]
    PUT --> JSON["public.decomposition_drafts.payload"]
    JSON --> GET["GET /api/drafts/:cardSlug"]
    GET --> LOCAL
    LOCAL -. "working claims / refs never cross" .-> READ
    LOCAL -. "no promotion path" .-> GAPI
```

---

## 5. Step-by-step walkthrough

### Step 0 — Entry and card selection

- **Control:** `select` labelled `Card`, test id `compose-picker-select`.
- **Placeholder:** `Pick a card…`
- **Optional back link:** `Back to research` (`data-testid="compose-return-link"`), only when a safe `returnTo` was supplied.
- **Loading:** `Loading the card list…`
- **Empty corpus:** `No cards in the corpus yet.`
- **Unknown slug:** `“{slug}” is not a card in the served listing.` + `Pick one from the list to author its decomposition.`
- **No selection:** `Choose a card above to start composing.`
- **Explainer:** `Author a decomposition of one card. The recorded reasoning is shown for study, kept separate, and never edited here.`

Selecting another card rewrites the URL and remounts the workspace, so no draft from the previous card can remain in view.

### Step 1 — Auth probe

The draft `GET` is the only session probe. There is no route-level guard.

| `ComposeAuthState` | Trigger | UI |
|---|---|---|
| `signing-in` | internal value only; it has no reachable awaiting/error UI | pending GET renders `Loading your draft…`; non-401 failure renders `ApiErrorState` |
| `signed-out` | `GraphApiError.status === 401` | `Sign in to author your own decomposition of this card.` + explanation + `Sign in` button; SaveBar says `Sign in to save your own decomposition.` with no action buttons |
| `signed-in` | HTTP 200 envelope | Full editor |

Sign-in link preserves the exact Compose route, card slug and nested research return context.

### Step 2 — Read the recorded reasoning

Panel: `CanonicalDecomposition`, test id `canonical-decomposition`.

The recorded surface is an `h2` named **Recorded reasoning**; its three subsections are `h3`s. When a card has recorded material and the author is signed in, the panel is a native `<details data-testid="recorded-disclosure">`, collapsed by default. Its `<summary>` always shows `READ ONLY · CORPUS`, accurate `{claims} claims · {steps} steps · {chains} chains`, and the cue `Read recorded` (or `Hide recorded reasoning` while expanded). It is left open for signed-out authors and for zero-claim cards, where the honest empty explanation must be visible. Expansion is local view state only: it never changes the draft, marks it dirty, persists, saves, or affects the canonical graph.

Subsections:

1. **Claims on this card**
   - Helper: `The authoring pool below is drawn from these claims, and only these.`
   - Empty: `Canonical claims are not currently recorded for this card. You can begin with a working assertion below; it stays in your draft.`
   - Rows show statement, `StatusBadge`, optional description.
2. **Reasoning steps recorded for this card**
   - Helper: `Published corpus records. A step may or may not be canonical; each row says which.`
   - Empty: `No reasoning steps are currently recorded for this card.`
   - Rows show label, inference-type badge, description, `Status: {status} · Canonical` or `Not yet canonical`, premises (statement + role) and conclusions. A `Raw is_canonical flag` disclosure keeps the underlying boolean available on demand.
3. **Argument chains**
   - Helper: `Named paths through the recorded steps. Whatever you draft below is yours, never one of these.`
   - Empty: `No argument chains are currently recorded for this card. You can construct your own below; it stays in your draft.`
   - Rows show label, kind badge, description, `{n} step(s) · status {status}`.

Closing disclaimer: `This recorded reasoning comes from the corpus. It cannot be edited here, and nothing you author below becomes part of it.`

**Wording note:** the UI says *recorded*, not *canonical*, for steps because a row may carry `is_canonical: false`. Rows use plain `Canonical` / `Not yet canonical` wording; the raw boolean remains available through the per-row disclosure. Underlying flags are unchanged.

### Step 3 — Save bar orientation

The save bar lives **inside the draft workspace**, after the recorded panel in DOM order. For signed-in authors it uses CSS `position: sticky` and an opaque background so status and actions stay reachable without a viewport-bottom fixed bar. Measured in-browser: header bottom is 81.5px at 1440px and 95px at 375px; the bar sticks at 88px / 104px respectively, with scroll margins 168px / 228px so focus and review jumps clear both the header and the bar. Mobile bar heights after compaction: 85px clean, 99px blocked and saved-but-now-invalid, 104px with a save-failure alert — all within the ≤104px proposal target. The sticky bar repeats only the concise `Saved draft · {n} issues to fix` status; the full issue details stay solely in the authoritative banner. This is the maintainer-approved Stage 1 replacement for the longer sentence shown in the proposal (gh#16 comment `7133203489`); the accepted proposal is left unchanged as the historical record. All controls and the exact alert remain visible. On a 375×420 keyboard-like viewport, `Review {n} issues` places the complete banner below the bar and inside the viewport; the saved-invalid state was re-checked with a genuinely stored, client-computed two-issue draft.

Status is a polite live region (`role="status" aria-live="polite"`). Blocker detail is guidance, not an error: the bar only summarizes counts and offers `Review {n} issues`; the full, single issue list lives in `#compose-issues`. A genuine save failure is an assertive `role="alert"` carrying the server's exact `error` text, and `aria-describedby` points Save at the active alert or blocker.

| State | Status | Detail / action |
|---|---|---|
| Pristine empty | `No draft saved yet.` | No detail, no issue banner; Save / Discard / Delete inactive |
| Pristine saved, valid | `Saved at HH:MM` | No issue banner |
| Pristine saved, now invalid | `Saved at HH:MM` | Amber `Saved draft · {n} issues to fix` + `Review {n} issues`; full details only in `#compose-issues`; no dirty flag |
| Dirty, valid | `Unsaved changes` | `Ready to save.`; Save enabled |
| Dirty, blocked | `Unsaved changes` | `{n} issue{s} to fix before saving` + `Review {n} issues`; Save `aria-disabled="true"` but still focusable |
| Saving | `Saving…` | No detail; Save natively `disabled` only during the write |
| Saved | `Saved at HH:MM` | Focus returns to `Save draft`, not stolen to the body or a new region |
| Save failed | `Unsaved changes` | Exact server message in `role="alert"`; Save remains available for retry |

Buttons:

- `Save draft` — inert unless dirty and client-clean; natively `disabled` only while saving. Focus is restored to this button when the write settles.
- `Review {n} issues` — focuses `#compose-issues` (`tabIndex={-1}`); disclosure, review and focus never mutate the payload, mark dirty, persist, or affect canonical data.
- `Discard changes` — enabled only when dirty and not saving; restores the server copy.
- `Delete saved draft` — enabled only when a draft exists and not saving; server `DELETE` is idempotent.

### Step 4 — What is the assertion?

Intro: `A draft for you, on this card only. It can never become canonical.`

Empty editor invitation: `Start with an assertion. It stays in your draft.` The single `not currently recorded` explanation lives in the read panel (Step 2), not in every editor section.

Formal term help text: `formal term: working claim`, always visible beside the heading.

Example disclosure (collapsed by default):

- Summary: `Example`
- Body: a muted, italic `<blockquote>` reading `Example: “The new rule reduced waiting times because it made the application process simpler.”`
- Caveat: `Illustration only — not pre-filled, and not drawn from this card.`

Helper copy: `Write the claim you are examining, and state its status. A source pointer is optional and is not evidence.`

Primary action: `Add working assertion`.

`WorkingClaimCard` fields:

| Field | Wire field | Notes |
|---|---|---|
| `Assertion` | `label` | Required; fallback title `Unlabelled working assertion` |
| `Notes (not evidence)` | `description` | Draft note only |
| `Epistemic status (free text)` | `epistemicStatus` | Required; never defaults to `ESTABLISHED` |
| `Source pointer (optional; not evidence)` | `source` | A lead, not evidence |

Remove button label: `Remove working assertion {label || localId}`. Removing a working claim also removes every working ref to it from steps.

### Step 5 — What reasons are offered? / How does the reasoning work?

Formal term help text: `formal term: premises`, `formal term: inference step`, always visible. Each has a collapsed `Example` disclosure:

- Premises: `Applications now pass through two review stages instead of four.`
- Inference step: `Fewer review stages mean faster decisions; this rule removed two stages, so waiting times should fall.`

The redundant `Used only in the draft vocabulary; it never changes the canonical ontology.` note is removed.

Primary actions, grouped as one row of three presets:

- `Add step` — blank card with the served vocabulary's first inference type; focuses `Label`.
- `Add inference step` — labels the new step `Inference step`, sets `UNSPECIFIED`, focuses `Inference type`.
- `Add challenge` — labels the new step `Challenge`, sets `UNSPECIFIED`, focuses the premise-add control. The role remains the author's choice.

All three create the same `DraftStep` shape via `addStep`. No preset pre-fills claims, roles or a required challenge.

`StepCard` fields and controls:

- `Label` (required), `Description` (required by server), `Inference type`, `Epistemic status (free text)`.
- `Premises · {n}` with role selects from served vocabulary; defaults to `PRIMARY`.
- `Conclusions · {n}`.
- Add selects: `Add a premise claim`, `Add a working premise`, `Add a conclusion claim`, `Add a working conclusion`.
- Remove controls: `Remove premise`, `Remove conclusion`.
- Empty rows: `No premises yet.`, `No conclusions yet.`
- A claim already used on either side is filtered from both add lists.
- Removing a step also removes every chain that named it.

**Gap to flag in review:** `notes` exists on the wire type but has no UI control in S1.

### Step 6 — What challenges or qualifies it?

Formal term help text: `formal term: counterpremise / challenge`, always visible. Collapsed `Example` disclosure: `Longer waiting times may reflect staffing levels rather than the number of form stages.` Guidance line: `A premise may be marked COUNTERPREMISE, or a COUNTER step may be attached in a chain. Add challenge seeds a labelled step; the role is still yours to choose. A challenge is optional in a draft.` The `Add challenge` preset creates the same kind of step card as `Add step`; there is no separate challenge card or new validation.

Challenge semantics are expressed through:

- Premise role `COUNTERPREMISE`
- Chain-step roles `COUNTER`, `ALTERNATIVE`, `CONTEXT`

A challenge is advisory: the save gate never fabricates one and never requires one.

### Step 7 — Construct an argument

Formal term help text: `formal term: argument chain`, always visible. Collapsed `Example` disclosure: `Simplification → fewer review stages → faster decisions → shorter waiting times.`

Helper: `Name a path through your own steps. A chain needs at least one actual step and a MAIN step; a COUNTER or CHALLENGE is optional in a draft. Paths and names are yours to confirm.`

Primary action: `Add chain`, disabled until at least one step exists. When unavailable it keeps visible button styling (muted border/background/text, `not-allowed` cursor) and exposes `aria-disabled="true"` alongside the native `disabled` state. Adding a chain immediately attaches the draft’s first step as `MAIN`, so the UI never creates an empty chain.

`ChainCard` fields:

- `Label` (required), `Description` (required by server), `Kind`, `Epistemic status (free text)`.
- `Steps · {n}` ordered list with role selects (`MAIN`/`COUNTER`/`ALTERNATIVE`/`CONTEXT`) and `Remove step from chain`.
- Attach select `Attach a step to the chain`, helper `attach · defaults to MAIN`.
- Empty: `No steps attached yet.`

Only the draft’s own steps can be attached; a chain can never point at a canonical step.

### Step 8 — Resolve issues and save

One authoritative banner: `The draft is not saveable yet.` followed by bullet messages, rendered at `#compose-issues` with `tabIndex={-1}` so `Review {n} issues` can move focus there. It is intentionally absent for a pristine empty draft and for a clean saved draft; a saved draft that is now invalid still shows it without becoming dirty. The sticky bar never duplicates the bullet list.

Exact issue messages:

| Subject | Message |
|---|---|
| draft | `Begin with a working assertion or a reasoning step before you can save.` |
| working claim | `A working claim needs a unique, non-uuid local id.` |
| working claim | `Working claim local ids must be unique in this draft.` |
| working claim | `Give the working assertion a label.` |
| working claim | `State the working claim’s epistemic status.` |
| step | `Give the step a label.` |
| step | `State the step’s epistemic status.` |
| step | `The step needs at least one premise claim.` |
| step | `A step cannot reuse a premise claim twice.` |
| step | `The step needs at least one conclusion claim.` |
| step | `A step cannot reuse a conclusion claim twice.` |
| step | `A working claim reference does not resolve in this draft.` |
| chain | `Give the chain a label.` |
| chain | `Attach at least one step to the chain.` |
| chain | `The chain references a step the draft no longer has.` |
| chain | `A chain cannot reuse a step twice.` |
| chain | `The chain needs a MAIN step.` |

Issue order is stable: draft-level, then steps, then chains. The client gate is guidance; the server contract is authoritative.

### Step 9 — Return context

If the page was entered from the Research workspace, `Back to research` returns through the sanitised `returnTo`. `safeReturnTo` rejects non-root-relative paths, `//`, `/\`, whitespace, backslashes and control characters.

---

## 6. Type inventory

### 6.1 View / interaction types

| Identifier | Definition / meaning |
|---|---|
| `ComposeAuthState` | `'signing-in' \| 'signed-out' \| 'signed-in'` |
| `ComposeIssue` | `{ subject: 'draft' \| 'step' \| 'chain'; key: string \| null; message: string }` |
| `StepPatch` / `ChainPatch` | Partial update payloads used by the model |
| `StepInput` / `ChainInput` / `WorkingClaimInput` | Creation payloads; `WorkingClaimInput` requires explicit `epistemicStatus` |
| `KeyFactory` | Generates stable client keys (`step-N`, `chain-N`) |
| `DRAFT_LIMITS` | Hard caps: see §6.5 |

### 6.2 Draft wire types (`src/compose/draft-types.ts`)

| Type | Shape / purpose |
|---|---|
| `DraftVocabulary` | `inferenceTypes`, `premiseRoles`, `chainKinds`, `stepRoles` — all served, never hardcoded |
| `CanonicalClaimRef` | `{ kind: 'canonical'; claimId: string }` — UUID + same-card checked server-side |
| `WorkingClaimRef` | `{ kind: 'working'; localId: string }` — resolves only inside the owning draft |
| `DraftClaimRef` | `CanonicalClaimRef \| WorkingClaimRef` |
| `DraftPremise` | `DraftClaimRef & { role: InferencePremiseRoleValue; ordinal: number }` |
| `DraftConclusion` | `DraftClaimRef & { ordinal: number }` |
| `DraftWorkingClaim` | `{ localId; label; description: string \| null; epistemicStatus: string; source: string \| null }` |
| `DraftStep` | `{ key; label; description; inferenceType; epistemicStatus; notes: string \| null; premises; conclusions }` |
| `DraftChain` | `{ key; label; description; kind; epistemicStatus; steps: { stepKey; role; ordinal }[] }` |
| `DraftPayload` | `{ steps; chains; workingClaims }` — the entire saved JSON |
| `StoredDraft` | `{ cardSlug; payload; createdAt; updatedAt }` |
| `VocabulariesResponse` | `{ vocabularies: DraftVocabulary }` |
| `DraftReadResponse` | `{ draft: StoredDraft \| null }` — absence is explicit, never a missing key |
| `DraftSaveResponse` | `{ draft: StoredDraft }` |
| `DraftSaveRejection` | either `{ error, issues: { path, message }[] }` or `{ error, detail?: { claims: string[] } }` |

Helpers: `canonicalRef()`, `workingRef()`, `claimRefIdentity()` (`canonical:<id>` / `working:<id>`), `isVocabulariesResponse()`, `isDraftEnvelope()`. Legacy drafts without `workingClaims` are accepted and default to `[]` on read.

### 6.3 Canonical projection types (`src/compose/compose-projector.ts`)

| Type | Shape / purpose |
|---|---|
| `CanonicalClaim` | `id`, `statement`, `claimType`, `epistemicStatus`, `description` |
| `CanonicalStep` | `id`, `label`, `description`, `inferenceType`, `epistemicStatus`, `isCanonical`, resolved `premises`/`conclusions` |
| `CanonicalChain` | `id`, `label`, `description`, `kind`, `epistemicStatus`, `stepIds` |
| `ComposeProjection` | `{ cardId, claims, steps, chains }` |

`composeCardId(projection)` returns `projection.focus.id` only when `focus.type === 'card'`. `selectComposeProjection()` filters nodes by that card id and drops references outside the card’s own claim set.

### 6.4 Enums / served vocabularies

| Family | Values |
|---|---|
| Inference type | `DEDUCTIVE`, `INDUCTIVE`, `ABDUCTIVE`, `ANALOGICAL`, `HISTORICAL_CONTINUITY`, `RETROSPECTIVE_IDENTITY`, `ANACHRONISTIC_MAPPING`, `GENERALISATION`, `EQUIVALENCE`, `CAUSAL`, `NORMATIVE`, `UNSPECIFIED` |
| Premise role | `PRIMARY`, `CONTEXT`, `BRIDGE`, `COUNTERPREMISE` |
| Chain kind | `PRIMARY_ARGUMENT`, `COUNTERARGUMENT`, `ALTERNATIVE_INTERPRETATION`, `EDITORIAL_RECONSTRUCTION` |
| Chain-step role | `MAIN`, `COUNTER`, `ALTERNATIVE`, `CONTEXT` |
| Epistemic status (badge) | `ESTABLISHED`, `CONTESTED`, `OPEN`, `CONTEXT_DEPENDENT`, `UNSUPPORTED`, `LIVE`; `OPEN` renders `OPEN · UNVERIFIED` |
| Last-resort fallbacks when the served vocabulary array is empty | inference `UNSPECIFIED`, chain kind `EDITORIAL_RECONSTRUCTION`; new working claims default to status `WORKING` |

### 6.5 Hard caps

| Limit | Value |
|---|---:|
| Steps | 50 |
| Chains | 20 |
| Working claims | 50 |
| Premises per step | 12 |
| Conclusions per step | 12 |
| Steps per chain | 20 |
| Label length | 200 |
| Description length | 2000 |
| Epistemic status length | 80 |
| Key / local id length | 64 |

### 6.6 API contract

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/drafts/vocabularies` | Public | Served vocabularies |
| `GET` | `/api/drafts/:cardSlug` | Required | Read own draft; `401` is the session probe |
| `PUT` | `/api/drafts/:cardSlug` | Required | Validate and save own draft |
| `DELETE` | `/api/drafts/:cardSlug` | Required | Delete own draft (idempotent) |

Server validation additionally resolves every canonical ref with `findClaimByRef()` and rejects missing or off-card UUIDs. Working local ids must be unique, resolvable and **not** UUID-shaped.

---

## 7. State matrix

| State | Copy / marker | Screenshot |
|---|---|---|
| Signed out | `Sign in to author your own decomposition of this card.` / `Sign in to save your own decomposition.` | 01 |
| Checking session | `Checking your session…` | — |
| Card list loading | `Loading the card list…` | — |
| Unknown card | `“{slug}” is not a card in the served listing.` | — |
| No card chosen | `Choose a card above to start composing.` | — |
| Projection loading | `Loading the decomposition…` / `Loading the recorded reasoning…` | — |
| Draft loading | `Loading your draft…` | — |
| API error | `The API replied {status}` / `Network error` + server message | — |
| Malformed response | `Malformed graph response` + bug-report instruction | — |
| Zero canonical claims | `Canonical claims are not currently recorded for this card…` | 02, 06 |
| No working assertion | `Start with an assertion. It stays in your draft.` | 02, 05, 06 |
| No steps | `Add a step to connect reasons to a conclusion.` | 02, 03, 05, 06 |
| No chains | `Add a reasoning step first, then construct a chain.` (with `Add chain` visibly disabled) | 02, 03, 05, 06 |
| Populated canonical | Claims + steps + chains with badges; step rows say `Canonical` / `Not yet canonical` with a `Raw is_canonical flag` disclosure | 05 |
| Saved working-only draft | `Saved at HH:MM`, no issue banner | 03 |
| Saved full draft | Assertion + step + chain, all saved | 04 |
| Pristine empty | `No draft saved yet.`; no amber banner | 02, 05, 06 |
| Dirty valid | `Unsaved changes` / `Ready to save.` | 07 |
| Dirty blocked | `Review {n} issues`, full banner at `#compose-issues`, Save `aria-disabled` but focusable | 08 |
| Saving | `Saving…`; Save natively disabled only in flight | — |
| Save failed | Exact server message in `role="alert"` | 09 |
| Saved draft, now invalid | `Saved at HH:MM` + issue banner + `Review {n} issues`; not marked dirty | — |
| Sticky geometry | Bar at 88px desktop / 104px mobile below fixed header | 07, 10 |

---

## 8. Accessibility and responsive notes for review

- Authoring controls have accessible labels (`Assertion`, `Label`, `Inference type`, `Add a working premise`, etc.), including the premise-role (`Premise role`) and chain-step-role (`Role in chain`) selects.
- Progressive disclosure uses native `<details>`/`<summary>`; keyboard-operable by default. Enter/Space toggles `Read recorded` while focus remains on the `<summary>`.
- Headings are `Compose` (`h1`) → `Recorded reasoning` / `Your decomposition draft` (`h2`) → their sections (`h3`); there is no `h1 → h4` jump.
- Status/blocker text is rendered as words, not colour alone. Status uses `role="status" aria-live="polite"`; a genuine failure uses `role="alert"` with the server's exact message.
- `Review {n} issues` moves focus to `#compose-issues`; it does not mutate the draft or steal focus on save success. Focus restoration after a save was verified with `agent-browser`.
- The sticky bar uses measured offsets (88px desktop / 104px mobile) and scroll margins (168px / 228px); browser checks covered top/bottom fields, the final actionable control, the full issue banner, a keyboard-like 375×420 viewport, resize, and visible focus. A genuine OS virtual-keyboard capture was not available: no Android device/emulator is attached, and headless Chrome's `navigator.virtualKeyboard.boundingRect` stays 0×0 even after `show()`.
- Remove controls use explicit `aria-label`s rather than relying on the `×` glyph.
- Shared page shell provides the `pt-24` header offset; the previously reported 375px heading/nav overlap is resolved.
- At 375px the empty and zero-claim layouts stack into one column with no horizontal overflow (screenshot 06). A populated step/chain draft still has the filed horizontal-overflow follow-up `as-truth-cards-z6q`; that fix belongs to Stage 3, not Stage 1.
- The unavailable `Add chain` action keeps button styling and exposes `aria-disabled="true"` with the native `disabled` state.
- A read-only vision QA pass over screenshots 01–10 found no clipping, overlap, misalignment, cramped spacing, low contrast or layout breakage; exact offsets, sticky behaviour, keyboard focus and live-region behaviour were verified separately in `agent-browser`.
- Behaviour is covered by component, model, projector, contract and API suites; see §10.

---

## 9. Review questions and Bucket outcomes

The UI/UX review answered the original eight questions. The maintainer-authorized Bucket A pass addressed Q2, Q4, Q7 and Q8, plus the a11y defect and disabled-action styling:

- **Q2 — example placement:** every question keeps its `formal term:` help text visible and adds a collapsed `Example` disclosure with a muted, italic quote block and the “illustration only” caveat.
- **Q4 — challenge guidance:** a one-line pointer names the `COUNTERPREMISE` premise role and `COUNTER` chain-step role. A maintainer-directed follow-up added an `Add challenge` step preset; it seeds a labelled step without pre-filling a role, and no challenge is required.
- **Q7 — terminology:** the read panel is titled “Recorded reasoning”; step rows use `Canonical` / `Not yet canonical`, with the raw `is_canonical` boolean behind a disclosure.
- **Q8 — empty-state tone:** one “not currently recorded” explanation remains in the read panel; editor sections use short invitations such as “Start with an assertion.”
- **A11y / disabled action:** premise- and chain-step-role selects have accessible names; unavailable `Add chain` keeps visible button styling and `aria-disabled="true"`.

Bucket B Stage 1 (Q1 + Q5) is implemented per the accepted proposal and the maintainer's Stage 1 authorization in issue #16 comment `7127734161`:

- **Q1 — hierarchy:** picker → recorded panel → draft workspace remains in DOM order; the two surfaces are distinct `h2`s with `NOT CANONICAL` on the draft; populated signed-in recorded material collapses behind native `Read recorded` with accurate counts; signed-out and zero-claim panels stay open.
- **Q5 — save feedback:** the opaque save bar sticks below the fixed header, summarizes blockers with `Review {n} issues`, keeps one full issue banner, uses polite status, shows exact server failures in an assertive alert, and restores focus to Save without stealing focus on success.

Still gated: Q3 step/chain disclosure (Stage 2), Q6 mobile section defaults and the populated-draft overflow follow-up (Stage 3), and S2–S4. Any further work requires a separate maintainer decision.

---

## 10. Implementation reference

### Source files

- `src/pages/Compose.tsx` — page orchestration
- `src/compose/compose-editor.tsx` — editor, gate, save bar, field cards
- `src/compose/canonical-read.tsx` — read-only panel
- `src/compose/compose-model.ts` — draft operations and client save gate
- `src/compose/draft-types.ts` — client wire contract
- `src/compose/compose-projector.ts` — focus-scoped projection
- `src/compose/use-compose.ts` — queries/mutations and error decoding
- `src/compose/sign-in-return.ts` — safe sign-in handoff
- `src/index.css` — sticky-offset and scroll-margin tokens
- `server/composition/draft-contract.ts` — authoritative validation
- `server/api/drafts.ts` — HTTP routes and isolation
- `SPEC.md` §9.5, `ROADMAP.md` Milestone 4 — product contract and staging

### Behaviour-defining tests

- `src/compose/compose-editor.test.tsx`
- `src/compose/compose-model.test.tsx`
- `src/compose/canonical-read.test.tsx`
- `src/compose/compose-projector.test.tsx`
- `src/compose/draft-types.test.tsx`
- `src/compose/use-compose.test.tsx`
- `src/compose/sign-in-return.test.tsx`
- `src/pages/Compose.test.tsx` — page-level render-order contract
- `server/composition/draft-contract.test.ts`
- `server/api/drafts.test.ts`

### Explicitly out of scope (gated)

- **S2:** additional partial-draft and advisory challenge UX
- **S3:** derived argument-path suggestions (candidates from connected steps, named chain on confirm)
- **S4:** Figma decisions D1–D4 implementation (visual QA); broader Deck/Card redesign is out of Compose scope (#9/#12/#14)

No canonical data, schema, migration, promotion path or external integration is part of this page.
