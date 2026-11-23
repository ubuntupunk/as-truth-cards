# Compose research method — audit and design proposal (ADR)

**Status: PROPOSAL — maintainer review requested. No implementation, schema change,
canonical data change, or `SPEC.md` / `ROADMAP.md` decision has been made.**
Tracks [issue #16](https://github.com/ubuntupunk/as-truth-cards/issues/16) and is
cross-referenced from issue #9. Issue #9 stays open at 0/11 release-verified criteria.

**Scope:** the Compose/Decompose method and its design dependencies only. Deck and Card
implementation scope remains in #9/#12/#14; Sources discovery/metrics remains in #12.

**Non-goals (per #16):** no seeding or editing of canonical graph data; no promotion of
draft claims into `trope_graph`; no parallel ontology, auth, session, or draft store; no
weakening of provenance, status, uncertainty, or account isolation; no counterargument
required where none has been identified.

---

## Executive summary

1. **The empty states are overwhelmingly genuine corpus sparsity, not a projection
   defect.** 47 cards exist; only 13 have any canonical claim, 2 have reasoning steps,
   2 have argument chains. 34 cards have zero claims. Orphan rows: zero. For the traced
   populated and empty cards, the graph API returned exactly the canonical rows, no
   truncation, no warnings, and the Compose selectors counted the same rows on both
   possible card-id derivations.
2. **One real interaction defect is adjacent to the empty states:** a card with no
   canonical claims cannot start an authoring step, because steps only accept canonical
   claim UUIDs and the drafts route rejects any claim not on the card. That is the
   blocker this proposal addresses with *working claims* inside the existing draft JSON.
3. **Recommended method:** move from assertion → reasons → inference → challenges →
   conclusion, in plain language, with formal ontology terms behind progressive
   disclosure; let a researcher author a working claim when canonical data has none;
   keep canonical data read-only; save honest partial work; make COUNTER optional.
4. **Recommended Figma decisions:** Deck hybrid, Card keeps three-stage navigation,
   appearance stays user-selectable, and the research tray is a read-only summary of the
   existing browser-local research session — no second persistence model.

---

## 1. Phase 1 — reproducible corpus and projection audit

### 1.1 Method and reproduction environment

- Database: local `postgresql:///trope_cards_dev` (Drizzle `trope_graph` schema). **Read
  only. No seed, insert, update, delete, or migration was run.**
- Tools: `psql` for corpus counts; an ephemeral in-process Express router calling the real
  `createGraphRouter()` and `selectComposeProjection()` against that database for the API
  trace. The trace script was temporary and is **not committed**; it is reproduced below
  so the audit can be rerun.
- No remote Neon connection was used; no canonical data was modified.

Corpus counts (exact SQL):

```sql
WITH per_card AS (
  SELECT c.id, c.slug, c.title,
    (SELECT count(*) FROM trope_graph.claims cl WHERE cl.card_id = c.id) AS claims,
    (SELECT count(*) FROM trope_graph.inference_steps s WHERE s.card_id = c.id) AS steps,
    (SELECT count(*) FROM trope_graph.argument_chains ch WHERE ch.card_id = c.id) AS chains
  FROM trope_graph.cards c
)
SELECT count(*) AS total_cards,
       count(*) FILTER (WHERE claims > 0) AS cards_with_claims,
       count(*) FILTER (WHERE steps > 0) AS cards_with_steps,
       count(*) FILTER (WHERE chains > 0) AS cards_with_chains,
       count(*) FILTER (WHERE claims = 0) AS zero_claim_cards,
       count(*) FILTER (WHERE claims > 0 AND steps = 0) AS claims_no_steps,
       count(*) FILTER (WHERE steps > 0 AND chains = 0) AS steps_no_chains
FROM per_card;
```

```bash
psql 'postgresql:///trope_cards_dev' -X -c "<SQL above>"
```

### 1.2 Corpus results

| Measure | Count |
|---|---:|
| Total cards | 47 |
| Cards with ≥1 canonical claim | 13 |
| Cards with canonical reasoning steps | 2 |
| Cards with canonical argument chains | 2 |
| Zero-claim cards | 34 |
| Cards with claims but no steps | 11 |
| Total claim rows | 33 |
| Total reasoning-step rows | 4 |
| Total argument-chain rows | 2 |
| Orphan claims / steps / chains (FK to a missing card) | 0 / 0 / 0 |

Claim-count distribution over cards:

| Claims on card | Cards |
|---:|---:|
| 0 | 34 |
| 1 | 1 |
| 2 | 8 |
| 3 | 3 |
| 7 | 1 |

Representative populated cards (from the same `per_card` CTE, ordered by reasoning depth):

| Slug | Title | Claims | Steps | Chains |
|---|---|---:|---:|---:|
| `canaanite-card` | The Canaanite Card | 7 | 2 | 1 |
| `jesus-was-a-zionist` | Jesus Was a Zionist | 3 | 2 | 1 |
| `jesus-is-a-muslim` | Jesus Is a Muslim | 3 | 0 | 0 |
| `jews-are-not-semites` | Jews Are Not Semites | 3 | 0 | 0 |

Representative empty card: `anc-hamas-equivalence` / *ANC / Hamas Equivalence* — 0
claims, 0 steps, 0 chains.

Orphan check (exact SQL):

```sql
SELECT (SELECT count(*) FROM trope_graph.claims) AS claims,
       (SELECT count(DISTINCT card_id) FROM trope_graph.claims) AS cards_with_claims_fk,
       (SELECT count(*) FROM trope_graph.inference_steps) AS steps,
       (SELECT count(DISTINCT card_id) FROM trope_graph.inference_steps) AS cards_with_steps_fk,
       (SELECT count(*) FROM trope_graph.argument_chains) AS chains,
       (SELECT count(DISTINCT card_id) FROM trope_graph.argument_chains) AS cards_with_chains_fk,
       (SELECT count(*) FROM trope_graph.claims cl LEFT JOIN trope_graph.cards c ON c.id=cl.card_id WHERE c.id IS NULL) AS orphan_claims,
       (SELECT count(*) FROM trope_graph.inference_steps s LEFT JOIN trope_graph.cards c ON c.id=s.card_id WHERE c.id IS NULL) AS orphan_steps,
       (SELECT count(*) FROM trope_graph.argument_chains ch LEFT JOIN trope_graph.cards c ON c.id=ch.card_id WHERE c.id IS NULL) AS orphan_chains;
```

### 1.3 Canonical → API → Compose trace

Read path, with exact locations:

1. **Canonical rows.** `claims.card_id`, `inference_steps.card_id`, and
   `argument_chains.card_id` are the card links. Premise/conclusion links are in
   `inference_premises` / `inference_conclusions`; chain membership is in
   `argument_chain_steps` (`role` = `MAIN` / `COUNTER`).
2. **Reader.** `trope-cards/src/graph/drizzle-reader.ts` — `findCardByRef` resolves a slug
   or uuid; `expandCards` / `hydrate` load card-scoped rows.
3. **Projection.** `trope-cards/src/graph/projection.ts` — `projectGraph()` performs a
   depth-bounded expansion, applies view node-type filters, and sets `meta.truncated`,
   `meta.reachedDepth`, and `meta.warnings`. `trope-cards/src/graph/views.ts` — the
   `argument` view admits `card`, `claim`, `inference_step`, `argument_chain`, `source`;
   depth 3 is needed to reach a chain behind its step.
4. **API.** `server/api/graph.ts:createGraphRouter()` → `GET /api/graph` parses
   `focus`, `view`, `depth` and calls `projectGraph`.
5. **Compose request.** `src/compose/use-compose.ts:canonicalProjectionQueryOptions()`
   requests exactly `focus=<slug>&view=argument&depth=3`.
6. **Compose selectors.** `src/compose/compose-projector.ts:selectComposeProjection()`
   and `claimPool()` scope rows to `metadata.cardId`; `src/pages/Compose.tsx` derives
   `cardId` from `nodes.find(node => node.type === 'card')?.id`.
7. **UI.** `src/compose/canonical-read.tsx` renders the three empty-state strings quoted
   in #16; `src/compose/compose-editor.tsx` renders the authoring pool and step/chain
   controls.

API trace script (temporary file `graph-audit.tmp.ts`, run from the repository root, then
deleted):

```ts
import express from 'express'
import { createGraphRouter } from './server/api/graph.ts'
import { selectComposeProjection } from './src/compose/compose-projector.ts'

async function main() {
  const app = express()
  app.use('/api/graph', createGraphRouter())
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  const base = `http://127.0.0.1:${address.port}`

  for (const slug of ['canaanite-card', 'jesus-was-a-zionist', 'anc-hamas-equivalence']) {
    const response = await fetch(`${base}/api/graph?focus=${slug}&view=argument&depth=3`)
    const body = (await response.json()) as any
    const nodes = body.nodes ?? []
    const firstCard = nodes.find((node: any) => node.type === 'card')
    const byType = (type: string) => nodes.filter((node: any) => node.type === type)
    const scoped = selectComposeProjection(body, firstCard?.id ?? '')
    const focusScoped = selectComposeProjection(body, body.focus?.id ?? '')
    console.log(JSON.stringify({
      slug, status: response.status,
      focus: body.focus && { id: body.focus.id, type: body.focus.type },
      firstCardNodeId: firstCard?.id ?? null,
      firstCardMatchesFocus: firstCard?.id === body.focus?.id,
      counts: {
        card: byType('card').length, claim: byType('claim').length,
        inference_step: byType('inference_step').length,
        argument_chain: byType('argument_chain').length,
      },
      meta: {
        truncated: body.meta?.truncated, reachedDepth: body.meta?.reachedDepth,
        warnings: body.meta?.warnings,
      },
      composeUsingFirstCard: {
        claims: scoped.claims.length, steps: scoped.steps.length, chains: scoped.chains.length,
      },
      composeUsingFocusId: {
        claims: focusScoped.claims.length, steps: focusScoped.steps.length,
        chains: focusScoped.chains.length,
      },
    }, null, 2))
  }
  server.close()
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
```

```bash
TROPE_GRAPH_DATABASE_URL='postgresql:///trope_cards_dev' node --import tsx graph-audit.tmp.ts
```

Trace results (all HTTP 200):

| Slug | Focus UUID | Card nodes | Claims | Steps | Chains | `truncated` | `reachedDepth` | Warnings | Compose counts (first card / focus id) |
|---|---|---:|---:|---:|---:|---|---:|---|---|
| `canaanite-card` | `09585518-486a-40e5-8b65-8d4a0f2a758c` | 1 | 7 | 2 | 1 | false | 3 | none | 7/2/1 and 7/2/1 |
| `jesus-was-a-zionist` | `542a4579-d5ca-488a-bf31-bfff8322f892` | 1 | 3 | 2 | 1 | false | 3 | none | 3/2/1 and 3/2/1 |
| `anc-hamas-equivalence` | `abd9e6cf-8a70-43f1-8a62-f1b471d37f73` | 1 | 0 | 0 | 0 | false | 1 | none | 0/0/0 and 0/0/0 |

In every sample the first card node was the focus node, so the current
`nodes.find(type === 'card')` derivation and the authoritative `focus.id` agree. There
is no truncation, no warning, and no lost neighbour. This does **not** make the
derivation safe in general (see §1.5).

### 1.4 Distinguishing the four possible causes

| Cause | Verdict for the sampled cards | Evidence |
|---|---|---|
| Genuinely absent canonical claims | **Confirmed dominant cause** | 34/47 cards have zero claim rows; `anc-hamas-equivalence` is 0/0/0 in the database and in the API. |
| Claims exist but are dropped by projection/query/filter defects | **Not observed in these samples** | API counts equal database counts; `truncated: false`, no warnings; Compose selectors equal raw counts. Chains require `view=argument&depth=3`, which Compose already requests. |
| Claims exist but are mislinked to the card | **Not observed** | 0 orphan claims/steps/chains; all `card_id` values resolve to real cards. |
| Projection intentionally sparse | **Confirmed by design** | `card-argument-taxonomy` excludes `argument_chain` nodes by an explicit scope decision in `views.ts` (chains remain grouping metadata on steps); the `argument` view is the declared home for chains. Compose selects the `argument` view. Evidence items are absent from the whole corpus by scope, so “no evidence” is honest, not a defect. |

**Conclusion:** the “No claims / No steps / No chains” messages shown for most cards are
truthful reports of canonical sparsity, not a projection bug. The real usability defect
is that the *authoring path* has no way to begin when canonical claims are absent.

### 1.5 Data-quality caveats and latent risks

- The two reasoning steps on `canaanite-card` carry `is_canonical = false` in the
  database. “Canonical steps” in the UI therefore means “rows in `trope_graph`”, not
  “flagged `is_canonical`”. The label should be reviewed, but does not change the counts.
- `nodes.find(type === 'card')` in `Compose.tsx` remains fragile if a future view emits
  neighbour cards before the focus. Prefer `projection.focus.id` (already present in the
  response) as the scoping identity; a test should pin the two to agree.
- Chain kind on the real example is `EDITORIAL_RECONSTRUCTION` and its status is
  `CONTESTED`. That is authored interpretation, not established fact; the UI must keep
  the status visible.
- `SPEC.md` §8.3 requires that an argument not be inferred from graph proximity, and §8.2
  that a source not be treated as verified evidence. The redesign must not use
  neighbouring cards or source counts to fill empty states.
- Relevant tests today: `src/compose/compose-projector.test.tsx`,
  `src/compose/compose-editor.test.tsx`, `src/compose/use-compose.test.tsx`,
  `src/compose/compose-model.test.tsx`, `src/compose/draft-types.test.tsx`,
  `src/compose/sign-in-return.test.tsx`, `server/composition/draft-contract.test.ts`,
  `server/api/drafts.test.ts`, and the graph projection/view suites under
  `trope-cards/test`. They pin current behaviour; none asserts the proposed workflow.

---

## 2. Phase 2 — research method in ordinary language

### 2.1 The five questions and the proposed UI sequence

Proposed plain-language labels (to be validated with researchers; #16 explicitly says
not to assume these exact words):

| Researcher question | Primary UI label | Formal term revealed on disclosure | What the researcher produces |
|---|---|---|---|
| What is being asserted? | **What is being claimed?** | Claim / working claim | The assertion under examination; canonical if present, otherwise a clearly marked working claim. |
| What reasons or material are offered? | **Add a reason** | Premise / source / evidence | Reasons attached to the assertion; authorship and provenance kept distinct. |
| How do those reasons lead to the conclusion? | **How does this follow?** | Inference / reasoning step | One stated link from reasons to a conclusion, with status and uncertainty. |
| What challenges or qualifications matter? | **What challenges this?** | COUNTER step / qualification | Optional challenge or alternative explanation; never required. |
| What can we responsibly conclude? | **Build an argument** / **What we can conclude** | Argument chain / epistemic status | A named path through the steps plus an explicit “still uncertain” note. |

Vocabulary rules:

- Plain language is the primary control label; the ontology word appears in a tooltip,
  `title`, or an “Advanced view” toggle, never as the only label.
- No word in the UI may imply that a source, a citation count, a narrative prose passage,
  or graph proximity is evidence. `SPEC.md` §§8.2–8.3 remain authoritative.
- Narrative analysis (#14) stays a separate reading region; it is not a step, a claim, or
  evidence.

### 2.2 Semantic guardrails carried into the new flow

| Distinction | UI consequence |
|---|---|
| Source ≠ evidence | A “source lead” is listed as material to check, never counted as support. |
| A source's assertion ≠ fact | Attribution is displayed with the claim's own `epistemic_status`. |
| Claim ≠ evidence | Reasons and evidence are separate fields; neither is auto-created from the other. |
| Evidence needs interpretation and provenance | No “supported” state without an explicit relationship and provenance; corpus currently has no evidence rows, so empty states say so honestly. |
| Reasoning step ≠ claim | A step is a stated link with premise(s) and conclusion(s), not another proposition in the pool. |
| Chain ≠ list of claims | A chain is an ordered path through the researcher's own steps, with roles. |
| Narrative analysis ≠ all of the above | Remains in the card reading/analysis region. |

### 2.3 Worked example A — populated card (`canaanite-card`)

Real canonical data (statements abbreviated for readability; full text is in
`trope_graph.claims`):

1. **What is being claimed?** The card's `core_question` is *“What can legitimately be
   inferred from ancient Canaanite populations, Israelite ethnogenesis, ancient ancestry
   and modern Palestinian identity?”* The canonical pool includes, among seven claims:
   - “Canaan refers to an ancient geographic and cultural region inhabited by multiple
     populations.” (`HISTORICAL`, `ESTABLISHED`)
   - “Modern populations of the Levant, including Jews and Palestinians, share ancestry
     with ancient populations of the region.” (`EMPIRICAL`, `ESTABLISHED`)
   - “Evidence of ancestry or continuity does not by itself establish that a modern
     Palestinian identity is identical to the ancient Canaanite population.”
     (`INTERPRETIVE`, `CONTESTED`)
2. **Reasons.** The canonical step *“Ancient Canaanite continuity to modern Palestinian
   identity”* (`RETROSPECTIVE_IDENTITY`, `CONTESTED`) already lists three `PRIMARY`
   premises, including the two claims above.
3. **How it follows.** The step's conclusion is “Some modern Palestinian nationalist
   narratives connect Palestinians with ancient Canaanites as part of an argument for
   continuity and autochthony.” The researcher sees this as a reconstruction of a
   narrative, not a verified fact, because the step's status is `CONTESTED`.
4. **Challenges.** A second canonical step, *“Continuity does not establish exclusive
   modern descent”* (`GENERALISATION`, `CONTESTED`), uses `CONTEXT` and `COUNTERPREMISE`
   roles and concludes that ancestry does not establish identity. The existing chain
   *“Canaanite continuity argument and counter-inference”* orders them `MAIN` then
   `COUNTER`.
5. **Conclusion.** The honest reading is a reviewable reconstruction with a counter-
   inference, both contested; “still uncertain” is not an empty box but the actual state.

In the new flow this canonical material is shown first as **reference material to study**,
and authoring remains a separate draft. The researcher can restate one of these claims as
a working claim to test it, but the canonical rows are never edited.

### 2.4 Worked example B — zero-claim card (`anc-hamas-equivalence`)

1. **What is being claimed?** The database has no claim rows for this card, so the UI must
   not display one. The researcher starts from the card's own authored summary:
   *“Separates the ANC's historical relationships and statements from later relationships
   between South African actors and Hamas.”* The card has no `core_question`, so the
   first authoring action is: *“State the assertion you want to examine (your own draft
   note — not a corpus claim).”*
2. **Reasons.** From sources they are reviewing elsewhere, the researcher records a
   working reason such as “A claim of equivalence appears in a particular political
   leaflet” — labelled `researcher-authored / unverified`, with provenance they supply.
3. **How it follows.** They write a step linking that working reason to a working
   conclusion, with status “unverified / under examination”.
4. **Challenges.** The UI offers “Add a challenge” but does not require one; “none
   identified yet” is a valid, visible state.
5. **Conclusion.** The draft saves with explicit uncertainty. Corpus coverage counters
   and canonical claim counts remain unchanged: the working claim is not a canonical
   claim and is not counted in §1.2.

---

## 3. Phase 3 — canonical vs working claims, and the smallest compatible contract

### 3.1 Current persistence model (audit)

| Property | Current implementation |
|---|---|
| Store | One `public.decomposition_drafts` row per `(user_id, card_slug)`; `payload` is a free Prisma `Json` column (`prisma/schema.prisma:183`, `server/composition/draft-store.ts`). |
| Payload shape | `{ steps: [...], chains: [...] }` only (`server/composition/draft-contract.ts:draftPayloadSchema`). |
| Claim references | `z.string().uuid()` in premises and conclusions; `referencedClaimIds()` collects them. |
| Referential integrity | `claimsOffCard()` in `server/api/drafts.ts` calls `graph.findClaimByRef()` and rejects any claim that is missing or belongs to another card. |
| Auth isolation | Draft routes resolve the Better Auth session; user id is the key half. Research session is separate and browser-local (`src/research/research-session.ts`). |
| Read-back safety | `parseStoredPayload()` revalidates on read and fails closed with `StoredDraftError`; stored work is never silently rewritten. |

**Why working claims are not compatible today:** there is no field in the payload to hold
a researcher-authored proposition, and every premise/conclusion must be an existing
canonical UUID on that card. Adding a working claim through the current UI would either
be impossible (no UUID) or would be rejected as off-card. The Json column means **no
database schema migration is required** to fix this; the change is to the validated
payload contract and the referential check.

### 3.2 Recommended contract (proposal, not implemented)

Extend the **draft JSON only**, additively and backward-compatibly:

```ts
// Illustrative shape — not committed.
type WorkingClaim = {
  readonly localId: string            // draft-local key, e.g. 'wc-1'; NOT a canonical UUID
  readonly statement: string
  readonly authorship: 'researcher'
  readonly origin: 'working-claim'
  readonly epistemicStatus: string    // e.g. 'UNVERIFIED / under examination'
  readonly sourceNote?: string        // provenance the researcher supplies; never auto-promoted
}
type DraftPayloadVNext = {
  readonly workingClaims?: readonly WorkingClaim[]   // default [] for existing stored drafts
  readonly steps: readonly DraftStepVNext[]
  readonly chains: readonly DraftChain[]
}
// A premise/conclusion reference becomes a tagged ref:
type ClaimRefVNext =
  | { readonly kind: 'canonical'; readonly claimId: string }   // UUID, off-card check unchanged
  | { readonly kind: 'working';  readonly localId: string }    // must exist in this draft's workingClaims
```

Required contract rules (all in `draft-contract.ts` + `server/api/drafts.ts`):

1. `workingClaims` optional, default `[]`, so existing stored drafts still parse under
   `parseStoredPayload()`; no silent rewrite, no data migration.
2. A `working` ref must resolve to a `localId` in the same payload; duplicate local ids
   rejected. `localId` must not be a UUID, so it can never be mistaken for a canonical
   claim identity.
3. Canonical refs keep the existing UUID format and the existing `claimsOffCard()` check.
4. A step may mix canonical and working refs; it still needs ≥1 premise and ≥1 conclusion
   (see §4 for the one relaxation proposed).
5. The API response and the editor label working claims visibly as
   **“researcher-authored draft — not a corpus claim”**; they are excluded from
   `claimPool()`, from canonical read panels, and from any coverage count.
6. `epistemicStatus` remains required on both kinds of ref; no default that says
   “established”.

### 3.3 Lifecycle

| Stage | Canonical claim | Working claim |
|---|---|---|
| Origin | Authored in `trope_graph` by an authorised editorial process. | Authored by a signed-in researcher in their draft. |
| Identity | Stable UUID, canonical provenance and status. | Draft-local `localId`, unique within one `(user, card)` draft. |
| Use | Read-only in Compose; can be a premise/conclusion. | Premise, intermediate proposition, conclusion, or challenge within that draft only. |
| Persistence | `trope_graph`. | Existing `decomposition_drafts.payload` JSON. |
| Save | N/A in Compose. | Saved/edited/discarded with the draft; never written to `trope_graph`. |
| Visibility | Read by every consumer of the corpus. | Visible only to its author through the drafts API; account isolation unchanged. |
| Promotion | N/A | **Out of scope.** A future editorial proposal flow must be separately reviewed with provenance and validation; do not implement it here. |

### 3.4 Alternatives considered

- **Store working claims in `trope_graph` with a draft flag:** rejected — changes
  canonical schema, risks contaminating coverage counts, and breaks the read-only
  boundary the issue says must be preserved.
- **A new `working_claims` table in `public`:** rejected for this issue — a parallel
  persistence system where the existing Json payload suffices; revisit only if query or
  cross-card reuse requirements appear.
- **Local component state only:** rejected — #16 explicitly warns that local state is
  not durable persistence.
- **Staged fallback if the maintainer rejects the tagged ref:** ship Phase 2's plain
  language and empty-state honesty first, keep authoring canonical-only, and re-open the
  working-claim contract as a separate decision. This delivers part of the value without
  changing the draft contract.

---

## 4. Phase 4 — reasoning and argument construction

### 4.1 Current rules and findings

| Current rule | Location | Finding / recommendation |
|---|---|---|
| A step needs ≥1 premise and ≥1 conclusion. | `stepSchema` in `draft-contract.ts`; `buildStep`/`draftIssues` in `compose-model.ts` | **Keep.** This is the semantic core of an inference. With §3 it can accept working refs. |
| Premises/conclusions are UUIDs; no duplicate per side; dense ordinals. | `draft-contract.ts` | **Keep** for canonical refs; add the tagged working ref and its integrity check. |
| A chain requires ≥1 `MAIN` **and** ≥1 `COUNTER` step. | `chainSchema` refinements; mirrored in `draftIssues` | **Relax.** Counterarguments are not always available at the start and must not be fabricated. Keep the `COUNTER` role available and surface “Add a challenge” as an optional, independently attachable action; make `COUNTER` a validation *warning* shown in the UI, not a save blocker. Requires maintainer approval because it changes the draft contract's parity with `validate-argument-chains.mjs`. |
| Empty chain must be created before steps are attached. | `addChain()`/`addChainStep()` in `compose-model.ts`; editor “Add chain” button | **Replace with derivation.** Let the editor derive candidate argument paths from connected steps (“Build an argument”), then create the named chain only when the researcher confirms. Explicit chain authoring remains available in Advanced view. No ontology change: a chain is still an ordered path through the draft's own steps. |
| A draft needs ≥1 step before it can save. | `draftPayloadSchema.steps.min(1)`; `draftIssues` | **Relax to ≥1 authored item** (working claim *or* step), so a researcher can save “this is the assertion I am examining; no reasons yet” honestly. Requires maintainer approval. |
| `epistemicStatus` required on steps/chains. | schemas | **Keep** and carry onto working claims. Preserve `CONTESTED` / unverified states verbatim. |

### 4.2 Minimal proposed interaction sequence

1. Choose a card (existing deep link `?card=<slug>`).
2. See the card's real assertion and canonical material first; empty states say what is
   absent and why, not “add a claim to fix this”.
3. State the assertion under examination — select a canonical claim or write a working
   claim, labelled draft.
4. Add a reason (canonical or working; provenance optional but recorded if supplied).
5. State how it follows; status and uncertainty required.
6. Optionally add a challenge, derive/name an argument path, and save partial work with
   “still uncertain” visible.

No step in this sequence requires a counterargument, an existing canonical claim, or a
pre-created chain.

---

## 5. Phase 5 — Figma divergence decision record (recommendations only)

Basis: `docs/ISSUE_9_FIGMA_DIVERGENCE_DESIGN_NOTE.md` (no broad re-enumeration here) and
`FIGMA_README.md` inspection guidance. Exact frames: Deck **`7:4434`**, Card **`7:4617`**.
The `1 / 8` count is accepted as illustrative; live data is authoritative.

| Topic | Recommendation | Concrete trade-off |
|---|---|---|
| Deck (`7:4434`) | **Hybrid adaptation.** Retain the working filter/index and card navigation; adopt Figma's visual language and add a research-tray summary using existing session data. Do not invent persisted “Your decks”, and do not remove filters without a product decision. | Gains visual convergence without losing tested behaviour; left rail stays out of scope. |
| Card (`7:4617`) | **Retain the functioning three-stage/face navigation**; improve hierarchy and surface research-path/classification information where useful. Do not replace it with three simultaneous panels solely to match a static frame. | Keeps #14's `inert`/`aria-hidden` and reduced-motion contracts; gives up literal frame parity. |
| Theme | **Preserve user-selectable appearance**; do not force dark mode. | Figma's dark palette becomes an option, not a mandate; existing appearance tests stay valid. |
| Research tray | **Read-only summary of the existing browser-local research session** (`src/research/research-session.ts`), labelled as browser-local and not account-synced. No second persistence model. | Honest about state that exists; avoids a new account-sync promise. |

These are recommendations for maintainer approval, not permission to implement a wider
redesign.

---

## 6. Decisions required from the maintainer

Items the agent cannot resolve from existing specs:

| ID | Decision | Why it needs approval |
|---|---|---|
| M1 | Accept tagged working refs inside the draft JSON (§3.2). | Changes the validated draft contract; must be confirmed compatible with the account/research-session architecture. |
| M2 | Make `COUNTER` optional / advisory at chain level (§4.1). | Changes parity with canonical chain validators and the meaning of a “complete” argument. |
| M3 | Allow saving a draft with working claims but no steps (§4.1). | Changes the minimum saveable state. |
| M4 | Derive candidate argument paths from connected steps, creating named chains on confirm (§4.1). | Changes chain authoring interaction; semantics of a chain must stay explicit. |
| M5 | Figma decisions D1–D4 (§5). | Product design sign-off for #9. |
| M6 | Confirm the Plain-language labels in §2.1, or supply alternatives for testing. | Wording is product-facing and was explicitly not assumed by #16. |

Details the agent can resolve from existing specifications without a new decision:
scoping selectors to `focus.id`; keeping canonical rows read-only; keeping source/evidence
and claim/inference distinctions; preserving `epistemicStatus`; honest empty states;
test coverage and file placement.

---

## 7. Acceptance criteria and incremental implementation slices

### 7.1 Testable acceptance criteria (for the future implementation, not claimed now)

1. Given a zero-claim card, the researcher can state a working assertion, add a reason,
   save, reload, and see the same draft, with the working claim labelled draft and absent
   from canonical claim counts.
2. Given a populated card, canonical claims render unchanged and remain read-only; no
   edit path writes to `trope_graph`.
3. A chain with only `MAIN` steps, or with no steps, saves; the UI shows “no challenge
   identified yet” instead of blocking. A `COUNTER` can be added later without rebuilding
   the chain.
4. A draft containing only working claims saves; an entirely empty draft does not.
5. Every premise/conclusion reference resolves either to a canonical claim on the card or
   to a working claim in the same draft; off-card UUIDs and dangling local ids are
   rejected by the server.
6. Off-origin `returnTo` values and cross-account draft ids remain rejected (existing
   behaviour, regression-tested).
7. Plain-language labels are present; formal ontology terms are available via disclosure;
   source ≠ evidence and claim ≠ evidence wording is preserved.
8. Figma decisions, once made, are reflected in the corresponding #9 dispositions with
   frames `7:4434` / `7:4617` cited.

### 7.2 Implementation slices (dependencies left to right)

| Slice | Scope | Depends on | Tests / gate |
|---|---|---|---|
| S0 — wording and honest empty states | Plain-language labels, disclosure tooltips, empty states that distinguish “no canonical data” from “not yet examined”; `focus.id` scoping fix. | None (M6 for final wording) | `canonical-read` / `Compose` render tests; typecheck, lint, build. |
| S1 — working claims in draft JSON | Tagged refs, `workingClaims`, additive default, referential checks, labels. | M1 | `draft-contract.test.ts`, `drafts.test.ts`, `compose-model.test.ts`, editor tests; old stored draft still parses. |
| S2 — partial-work saving and optional COUNTER | Relax `steps.min(1)` and COUNTER refinement; advisory warning in UI. | M2, M3, S1 | Contract + UI tests for save/reload; canonical validators unchanged. |
| S3 — derived argument paths | “Build an argument” derives candidates from connected steps; named chain created on confirm. | M4, S2 | Model tests for derivation and confirm; chain semantics regression tests. |
| S4 — Figma decisions | Implement only the maintainer-selected options. | M5 | #9 disposition update, visual QA via the project's vision sub-agent, existing theming/navigation tests. |

No slice is authorised by this document. Implementation starts only after maintainer
review of this proposal.

---

## 8. References

- Issue #16 (this proposal): https://github.com/ubuntupunk/as-truth-cards/issues/16
- `docs/ISSUE_9_FIGMA_DIVERGENCE_DESIGN_NOTE.md`
- `docs/ISSUE_9_ACCEPTANCE_DISPOSITIONS.md` (dispositions 3 and 6)
- `ROADMAP.md` (process only; no unapproved decision recorded there)
- `SPEC.md` §§5.5–5.7, §8.1–8.3, §12 (existing semantics, unchanged)
- Files cited in §§1.2–4.1 above.
