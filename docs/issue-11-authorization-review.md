# Issue #11 — Participation authorization: identity for `/api/interactions`, and `/api/cards` write verbs

> **Status:** decision + implementation. Closed by the code and tests below.
> This is a **latent-authority** fix, not a demonstrated exploit: the shipped deck client
> (`src/components/Card.tsx`) posts no `userId`, so live rows already record `null`. The
> route nevertheless *trusted* any `userId` a caller chose to send, which is the property
> this document removes. Follow-up from the Issue #9 account-onboarding inventory
> (`docs/issue-9/account-onboarding-inventory-and-proposal.md`, B.3; fix plan F.4).

## Scope

- `server/api/interactions.ts` — `POST /api/interactions` had no session check and wrote
  `userId: userId || null` from the request body; `GET /api/interactions/card/:cardId` was
  public and returned other users' attributed rows and feedback.
- `server/api/cards.ts` — all four verbs (`GET`/`POST`/`PUT`/`DELETE`) were unauthenticated;
  the three write verbs mutate the canonical `Card` table the deck is built from.
- The anonymous-vs-authenticated policy for interaction types (acceptance criterion 3).
- Cross-user isolation tests mirroring `server/api/drafts.test.ts`.

## Findings (state at the time of the fix)

| # | Area | Observed |
|---|---|---|
| 1 | `/api/interactions` identity | `POST` destructured `userId` from the body (`server/api/interactions.ts:9,34`) and stored it verbatim — any caller could claim to be any account, or leave `null`. No session was consulted. |
| 2 | `/api/interactions` read | `GET /api/interactions/card/:cardId` was unauthenticated and returned the full activity log, including `userId` and `feedbackText`. |
| 3 | Type policy | Undefined. The route accepted only 4 of the schema's 7 `InteractionType` values but documented no rule about which may be anonymous. |
| 4 | `/api/cards` writes | `POST`/`PUT`/`DELETE` unauthenticated; the only UI caller is `src/pages/Admin.tsx`, which already gates the panel on an `ADMIN` session (`useAdminCheck`) — so the server merely failed to enforce what the UI assumed. |
| 5 | Tests | No interactions or cards route tests existed. |

Client usage checked before deciding: `src/components/Card.tsx:45` posts `{ cardId, interactionType }` only (no `userId`); `src/components/CardDeck.tsx:35` and `Admin.tsx` read `/api/cards`; only `Admin.tsx` writes it.

## Decisions

### 1. `POST /api/interactions` — identity is server-derived, full stop

The router now resolves the actor through the same injectable seam as `drafts.ts`
(`auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`, 401 when signed out for
authenticated types). The stored `userId` is `actor?.userId ?? null`; **nothing in the
request body is ever read as identity**. The payload is parsed with a `.strict()` Zod schema,
so a body carrying a `userId` (or any other unexpected key) is **rejected with `400`** —
"rejected, never trusted", the stronger of the two options criterion 2 allows.

### 2. Anonymous-vs-authenticated policy (criterion 3)

The policy is one explicit, typed table — `INTERACTION_AUTH_POLICY` — consulted before any
row is written, so the rule is readable and the future flip is a one-line change:

| Interaction type | Actor required? | Why |
|---|---|---|
| `VIEW` | anonymous | A read is a read; no account needed to view a card. |
| `SHARE` | anonymous | Sharing a public card is not a privileged act. |
| `RATING_UP` | anonymous | The deck vote surface runs signed-out and gates on `localStorage`; **no sign-up flow ships yet**, so requiring an account would silently drop every vote. Recorded as `null`-actor anonymous participation. |
| `RATING_DOWN` | anonymous | as `RATING_UP`. |
| `STRUCTURED_FEEDBACK`, `ACADEMIC_FEEDBACK`, `MODERATION_ACTION` | **not routable** | These content- or authority-bearing schema types are rejected as unknown (`400`) until a route exists and a policy is assigned — so nothing consequential can be recorded anonymously. |

The schema comment pairs `ANONYMOUS` with "basic view access only" and `VERIFIED` with
"limited interaction", so the intended end-state is authenticated (and, for moderation,
elevated) interaction. The seam is built for that: when email verification and the account UI
land (#9, Milestone 7), flip `RATING_*` to `'authenticated'` (and add any `verified` tier) in
`INTERACTION_AUTH_POLICY` — the payload logic and tests do not change shape.

### 3. `GET /api/interactions/card/:cardId` — authenticated

The card activity log carries who interacted and any feedback text, so it is not served to
the public: a signed-out read now returns `401`. It remains **card-scoped**, not user-scoped —
it is the card's public activity, and no shipped surface consumes it yet, so this is the
least-surprising hardening rather than an invented "my activity" filter.

### 4. `/api/cards` write verbs — admin surface, enforced server-side (criterion 5)

`GET /api/cards` and `GET /api/cards/:id` stay **public** (deck + graph browse cards
signed-out). `POST`/`PUT`/`DELETE` are the legacy/admin content surface, whose sole caller is
the admin panel, and are now restricted to a session whose role is `ADMIN`:
signed-out → `401`, signed-in non-admin → `403`. This makes the server enforce exactly what
`Admin.tsx` already assumes; it removes no user-facing flow.

### 5. Regression tests

- `server/api/interactions.test.ts` (13 cases) — anonymous view/share/vote stored with
  `userId: null`; a signed-in interaction attributed to the session user; **a body that
  asserts its own `userId` is rejected and writes nothing**; unknown type `400`; missing
  `cardId` `400`; nonexistent card `404`; feedback range/length `400`; signed-out read `401`;
  signed-in read returns the card's rows only; non-numeric id `400`.
- `server/api/cards.test.ts` (11 cases) — public list/get; writes `401` signed out, `403` for
  `VERIFIED`/`RESEARCHER`/`MODERATOR`, `201`/`200`/`204` for `ADMIN`, and the store is
  unchanged on every denial.

## Implementation

- `server/api/interactions.ts` — rewritten as `createInteractionsRouter(deps)` with lazy
  Prisma defaults (`InteractionStore`, `CardPresence`, `GetSession`), `INTERACTION_AUTH_POLICY`,
  and a `.strict()` payload schema. Default export preserved, so `server/app.ts` is unchanged.
- `server/api/cards.ts` — rewritten as `createCardsRouter(deps)` with a `HostCardStore` port
  and an ADMIN `allowWrite` gate on the three write verbs; public reads unchanged. Default
  export preserved.
- `server/api/interactions.test.ts`, `server/api/cards.test.ts` — new.
- `docs/issue-11-authorization-review.md` — this document.

## Residual / follow-ups

- **Policy flip when verification lands (#9, M7):** set `RATING_*` (and any future
  feedback type) to `'authenticated'` / a `'verified'` tier in `INTERACTION_AUTH_POLICY` and
  extend the tests. Until then, anonymous ratings are deliberate, not accidental.
- **`STRUCTURED_FEEDBACK` / `ACADEMIC_FEEDBACK` / `MODERATION_ACTION`** have no route; adding
  one requires assigning a policy tier in the same table before it can be written.
- **`ipAddress`** is still not captured (was `null` before this change); if abuse control
  needs it, capture it server-side from `req.ip` (now meaningful — see #10's `trust proxy`)
  rather than from the client.
- **CORS vs authorization:** `#10` is browser-enforcement only; this document is the resource
  authorization for the same routes.
