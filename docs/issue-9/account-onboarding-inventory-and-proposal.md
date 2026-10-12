# Account Onboarding — Inventory, Target Flow, and First-Slice Proposal

> **Status:** planning artifact (no implementation). Follows `ROADMAP.md` Milestone 7 ("Account onboarding and participation") and the Issue #9 sprint-review instruction to produce an inventory + proposal **before** broad account implementation.
> **Related:** product-shell tracking [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) · security review [Issue #10](https://github.com/ubuntupunk/as-truth-cards/issues/10) · shared search [Issue #8](https://github.com/ubuntupunk/as-truth-cards/issues/8).
> **Date:** 2026-10-12 · **HEAD at time of writing:** `b26cc00` · **Revision 2** — responds to the maintainer review of 2026-10-12T10:59:52Z (see **Part F**).
> **Scope rule:** this document proposes; it changes no schema, route, or config. Any "Decision needed" item must be resolved before implementation. **No broad account implementation or schema migration** until the policy (C1) and persistence (C3) decisions are reviewed.

---

## Part B — Inventory of the current implementation (audited)

### B.1 Server auth configuration

| Fact | Evidence |
|---|---|
| Single Better Auth instance, `appName: 'Trope Cards'`, Prisma adapter (`postgresql`) | `server/auth.ts:28-32` |
| **Email + password only.** No plugins, no OAuth/social providers, no 2FA, no organization, no admin plugin | `server/auth.ts:34-36` (no `plugins:`/`socialProviders:` array exists) |
| Extra `User` fields: `role` (union of 6 labels, `required:false`, `defaultValue:'ANONYMOUS'`, **`input:false`**), `bio`, `website`, `location` | `server/auth.ts:38-59` |
| `trustedOrigins`: `http://localhost:8080`, `http://localhost:3001` only (dev); production assumed same-origin | `server/auth.ts:66-69` |
| Session: `expiresIn` 7d, `updateAge` 1d; **no** `cookieCache`, no explicit strategy → database-backed sessions | `server/auth.ts:71-74` |
| **No `advanced` cookie block** — `useSecureCookies`/`sameSite`/`secure`/`crossSubDomainCookies` unset → Better Auth defaults | grep: no cookie config anywhere |
| `baseURL` not set in code; consumed from `BETTER_AUTH_URL` (documented, not referenced in source) | `.env.example:10`, `README.md:215-236` |
| Secret guard `assertAuthSecretConfigured()` runs before `betterAuth()`; rejects absent / published-fallback / `<32` chars / `<8` distinct chars; **production throws**, dev warns | `server/lib/auth-secret.ts`; called `server/auth.ts:14` |

### B.2 Auth HTTP boundary

- Mount: `server/index.ts:31-42` — `toNodeHandler(auth)` at `app.all('/api/auth/*', …)`, **before** `express.json()` (raw body for signatures/CSRF). All endpoints are Better Auth auto-generated (`/api/auth/sign-up/email`, `sign-in/email`, `session`, `sign-out`, …); **no custom auth routes**.
- Dev proxy: Vite proxies `/api` → `:3001` (`vite.config.ts:10-15`); client uses relative `/api` so the cookie stays first-party (`src/hooks/useAdminCheck.ts:19-27`).
- Other routers (`server/index.ts:46-49`): `/api/cards`, `/api/interactions`, `/api/graph`, `/api/drafts`.

### B.3 Authorization coverage (the important gap)

| API | Auth today | Evidence |
|---|---|---|
| `/api/drafts` | ✅ session-enforced; 401 when signed out; per-user isolation | `server/api/drafts.ts:112-119,139,177,226`; `server/api/drafts.test.ts` |
| `/api/cards` | ❌ **none** on GET/POST/PUT/DELETE | `server/api/cards.ts` |
| `/api/interactions` | ❌ **none**; accepts a **client-supplied `userId`** in the body | `server/api/interactions.ts:9,34` |
| `/api/graph` | ❌ none (read-only public projection) | by design |

> **Finding (a prerequisite, not later polish):** `/api/interactions` trusts a client-supplied identity, and `/api/cards` has no authorization on any verb. **No account-bound feature may rely on this.** Tracked as **[Issue #11](https://github.com/ubuntupunk/as-truth-cards/issues/11)** (participation authorization) — see **F.5** for the fix and test plan. Do **not** fold this into the account-UI ticket, and do **not** claim Issue #10 covers it unless #10's scope is deliberately expanded.

### B.4 Identity / participation schema (`public`)

Schema: `prisma/schema.prisma`.

| Model | Shape relevant to onboarding | Notes |
|---|---|---|
| `User` (`user`) | `id, name, email @unique, emailVerified Boolean @default(false), image, role UserRole @default(ANONYMOUS), bio, website, location, createdAt, updatedAt` | relations: `sessions`, `accounts`, `interactions`, `drafts` |
| `Session` (`session`) | `id, expiresAt, token @unique, ipAddress, userAgent, userId → User` | |
| `Account` (`account`) | Better Auth provider row incl. `providerId`, `accountId`, `password` | email/password rows land here |
| `Verification` (`verification`) | `identifier, value, expiresAt` | **exists but unused by current config** |
| `UserInteraction` (`user_interactions`) | `userId String?` (nullable, `onDelete: SetNull`), `cardId`, `interactionType`, `feedbackRating`, `feedbackText`, `status ContentStatus @default(PENDING)`, `ipAddress` | |
| `DecompositionDraft` (`decomposition_drafts`) | `userId → User (Cascade)`, `cardSlug`, `payload Json`, `@@unique([userId, cardSlug])` | the only per-user write model today |

Enums: **`UserRole`** `ANONYMOUS · VERIFIED · ACADEMIC · RESEARCHER · MODERATOR · ADMIN` (`schema.prisma:32-39`); `ContentStatus` `PENDING/APPROVED/FLAGGED/REJECTED/REMOVED`; `InteractionType` `VIEW/SHARE/RATING_UP/RATING_DOWN/STRUCTURED_FEEDBACK/ACADEMIC_FEEDBACK/MODERATION_ACTION`.

**Models that do NOT exist:** no `SavedCard`; no `Profile` (a `user_profiles` table existed and was **dropped** by `prisma/migrations/20260930210000_better_auth_users/migration.sql:1-2`, its columns folded onto `user`); no `Activity` (only `UserInteraction`); no `Role` table (enum is the single source of truth).

Privilege escalation is deliberately **manual**: `prisma/sql/promote_user.sql` (`UPDATE "user" SET role = :'target_role'::"UserRole"`).

### B.5 Verification and email — **not implemented**

- No `emailVerification` block, no `requireEmailVerification`, no `sendVerificationEmail`, no `sendResetPassword`.
- **No email provider/dependency** at all (no Resend/nodemailer/SendGrid/SMTP).
- `User.emailVerified` and the `Verification` table exist (Better Auth core shape) but nothing reads/writes them for verification today.

### B.6 Account UI — **none**

Client routes (`src/App.tsx:30-45`): `/`, `/legacy/deck`, `/explore`, `/research`, `/research/compose`, `/sources`, `/resources`, `/about`, `/privacy`, `/terms`, `/graph`, `/admin`, `*`.

- ❌ No `/sign-in`, `/sign-up`, `/login`, `/register` route or page.
- ❌ No profile / settings / account-activity page; no sign-out control; no header account menu (`Header.tsx` `NAV_ENTRIES` = Decks/Explorer/Graph/Research/Compose/Sources + Admin-on-`/admin` + `ThemeToggle`).
- `authClient` (`src/hooks/useAdminCheck.ts`) only calls `getSession()`; **no `signIn`/`signUp`/`signOut` call exists anywhere**.
- `/admin` gate (`src/pages/Admin.tsx:27,172-188`): signed-out → "Sign in required" text; signed-in non-admin → "Access denied"; **no form**.
- Compose gate (`src/compose/compose-editor.tsx` `PermissionGate`) wires "Sign in" → `navigate('/admin')` (`src/pages/Compose.tsx:327`) — **dead end**.
- **`Save card` is unconditionally `disabled`** with copy "Saving cards will be available when account participation is enabled." (`src/deck/card-actions.tsx:141-156`) — no session check, no handler.
- Research tray/workspace explicitly separate browser-local state from account-bound saving (`src/deck/research-tray.tsx`, `src/research/research-workspace-panel.tsx`).

### B.7 Tests that exist vs missing

**Exist:** `server/lib/auth-secret.test.ts` (secret contract); `server/api/drafts.test.ts` (401s, cross-user isolation); `server/composition/draft-contract.test.ts`; `src/compose/compose-editor.test.tsx` (`PermissionGate`/`SaveBar`); `src/deck/featured-card.test.tsx` (Save disabled + reason); `src/deck/research-tray.test.tsx`; `src/research/research-workspace-panel.test.tsx`; `src/components/Header.test.tsx`.

**Missing:** `useAdminCheck`; the `Admin` gate; the `betterAuth` config itself; sessions/cookies; email verification; role-based authorization; and any authorization test for `/api/cards` or `/api/interactions` (neither has any).

### B.8 Environment

`.env.example` / `README.md:215-236` / `render.yaml`: `DATABASE_URL`, `BETTER_AUTH_SECRET` (prod-enforced), `BETTER_AUTH_URL`, plus `NODE_ENV`, `TROPE_GRAPH_DATABASE_URL`, `TROPE_GRAPH_ALLOW_REMOTE`, `PORT`. **No email-related env vars anywhere.**

### B.9 Inventory conclusion

The **identity core is present and reasonable** (Better Auth + Prisma, role ladder server-owned via `input:false`, session/verification tables in place). What is missing is entirely on the **experience and participation** side: no auth UI, no verification wiring/provider, no account-gated action actually wired (`Save card` disabled), and two authorization gaps on participation APIs. Per `ROADMAP.md:212`, **no new persistence model should be added** until a decision below demonstrates the existing structures are insufficient.

---

## Part C — Proposal

### C.1 Target state machine

```
Anonymous
  │  (triggers account-required action: Save card)
  ▼
AccountGate ("Sign in to save")  ──cancel──▶ Anonymous (no state change, return context retained)
  │
  ├─ existing account ─▶ Sign in (email+password)
  └─ new account ──────▶ Create account ─▶ Verification pending
                                              │
                       resend / expired / failed ──▶ recoverable states
                                              ▼
                                         Verified
                                              ▼
                                        Onboarding (explicit completion)
                                              ▼
                                   Authenticated (return to intended context)
                                              ▼
                                   Account-gated action completes (Save card)
```

States to render explicitly: `unauthenticated`, `signing-in`, `unverified`, `verification-pending`, `verification-failed`, `verification-expired`, `verified`, `onboarded`. `authenticated` and `verified` must remain distinct where permissions differ.

### C.2 Identity, roles, permissions

- Keep the ladder **`ANONYMOUS → VERIFIED → ACADEMIC → RESEARCHER → MODERATOR → ADMIN`**; `role` stays server-owned (`input:false`) and escalation stays the manual `promote_user.sql` act. **Onboarding never self-assigns a privileged role.**
- Minimum capability mapping to make explicit:
  - `ANONYMOUS`: all read-only discovery/exploration (today's default).
  - `VERIFIED`: account-gated writes — candidate first action is **Save card**. Whether Save card requires a *verified* user (vs merely *authenticated*) is **not decided here** — it is the open **C1** question (see F.2). Whatever is chosen, "signed in but unverified" stays a distinct, honest state and no verified badge is ever faked.
  - `ACADEMIC`/`RESEARCHER`: reserved; no new capability proposed in the first slice.
  - `MODERATOR`/`ADMIN`: moderation; out of slice.

### C.3 Research continuity

- Browser-local research session (`localStorage`, `useResearchSession`) is **not** ownership and **not** migrated on sign-in (`ROADMAP` invariant 11). The first slice must show an explicit, opt-in affordance if a user wants to carry a card from the tray into a saved card; the default is no silent transfer.
- Preserve a validated **`returnTo`** (same-origin relative path only) so sign-in returns the user to the page they were on — this is *navigation* continuity, **not** activity migration.

### C.4 Account boundary

| Belongs to | Examples |
|---|---|
| **Canonical (`trope_graph`)** | ontology, graph projection, card/claim/evidence semantics — **untouched** |
| **Account (`public`)** | identity, role, verification status, sessions, saved cards, authored drafts, participation records |
| **Browser-local** | research session/tray, appearance treatment default, theme |
| **Never** | account state leaking into `trope_graph`; anonymous history reassigned to a new account; research session conflated with auth session |

### C.5 First vertical slice (proposed, smallest complete end-to-end)

1. **Account-required action.** Wire `Save card` to open an `AccountGate` explaining *why* an account is needed. (The disabled button + copy already exists; add the gate.)
2. **Sign-in / create-account UI** at `/sign-in` + `/sign-up`, using the existing `authClient` (`signIn.email` / `signUp.email`), relative `/api`, same-origin cookie. Add a header account affordance (sign-in link when anonymous; menu with sign-out when signed in). Replace the Compose `/admin` dead-end with this route.
3. **Verification.** Enable `emailVerification` and wire a provider **or** ship an honest "verification unavailable" state until the provider is chosen (Decision C1). Never fake a verified badge.
4. **Onboarding step.** One explicit, minimal screen that marks completion; prefer reusing existing `User` fields (e.g. `name`) over a new model (Decision C2).
5. **Return to context.** Validated `returnTo` back to the originating route/card.
6. **One gated action end-to-end.** `Save card` persists for a verified user and lists their saved cards (Decision C3 — see below).
7. **Account surface.** A minimal `/account` page: email, role, verification status, saved cards, sign-out — kept visually and semantically distinct from the research workspace.

**Decisions required before implementation (do not implement past a blocked decision):**

- **C1 — Verification provider (OPEN; see F.2).** No email dependency exists. Options: (a) add a provider (e.g. Resend / Postmark / SES-SMTP) behind env vars and require verification before the gated action; (b) ship sign-in/create-account + Save card gated on *authenticated* (not verified) first, with `emailVerification` explicitly deferred and labelled; (c) wire verification with a **configured-but-honest** sender that surfaces a "verification unavailable" state until a provider is set. **Do not treat any option as approved by default.** F.2 sets out provider options, env/config, operational prerequisites, test strategy, and the unavailable-email behaviour so the maintainer can decide.
- **C2 — Onboarding persistence (see F.3).** Does "onboarded" need its own flag, or is it a derived state (e.g. `name` set + role ≥ VERIFIED)? **Recommendation:** derive it; add a field only if the inventory proves it insufficient.
- **C3 — Save card persistence model (see F.4).** There is **no `SavedCard` model**. Options: (a) add a `SavedCard` model; (b) reuse `UserInteraction` with a new `InteractionType` value (e.g. `SAVED`) plus a unique `(userId, cardId)` rule; (c) defer the action. F.4 documents the **schema evidence** in the section below showing `UserInteraction` is an append-only participation/moderation log keyed to the **legacy `Card` integer id**, not the canonical graph slug — so option (b) is a poor fit. **Recommendation:** a narrowly scoped `SavedCard` model keyed by `(userId, cardSlug)`; do not overload `UserInteraction`.

### C.6 Privacy / security audit (Issue #10 boundary — do not mix into UI work)

- Cookies: no `advanced` config today; verify Better Auth **Secure/SameSite** behaviour behind the Render proxy.
- Verification/reset tokens: `Verification` table; expiry + single-use semantics; never log token values.
- Redirect/return-URL validation: restrict `returnTo` to same-origin relative paths; validate against `trustedOrigins`/`BETTER_AUTH_URL`.
- Error disclosure: avoid account-existence enumeration on sign-in/sign-up/reset.
- Rate limiting: none configured on `/api/auth`; evaluate Better Auth's rate-limiter.
- CORS/trusted-proxy: default `cors()` in `server/index.ts:20` — replaced under Issue #10, not here.
- Storage/logging claims: keep `Privacy.tsx` scoped to verified app behaviour; provider-side remains unverified.
- **`/api/interactions` client-supplied `userId`** must be replaced with server-derived identity before it backs any account feature.

### C.7 Required tests (per ROADMAP Milestone 7)

Anonymous → authenticated → verified → unverified states; verification expiry/failure/resend; safe `returnTo`; authorization boundaries (including `/api/interactions` identity); Save card persistence + duplicate/retry idempotency; unsave; and an explicit test proving anonymous history is **not** reassigned on sign-in. Add the currently-missing coverage for `useAdminCheck`, the `Admin` gate, and the auth config.

### C.8 Design traceability (Figma)

Account/onboarding frames **have now been identified** in `qmVMnfR9DpQFyYtaiSizYD`. The maintainer added **improved** frames (node group `62:*`, six surfaces × three treatments) — these are the **current design targets**; the older **`49:*`** screens are **historical/reference only**. Mapping of C.1 states → frames is in **F.6**. Key result: **no dedicated "Verification" frame exists** (verification is a state of Sign In / Onboarding, not a distinct screen), and there is **no "Sources" frame at all** (consistent with the M6 hedge in `issue9-figma-gap.md`). Frame **content** could not be read this pass (Figma API returned `429 Rate limit exceeded`); node names/ids/variants were obtained from file discovery before the limit was hit. Detailed content inspection is a pending follow-up. **Note:** the Figma REST API has **no node/frame-creation endpoint**, so the missing Sources frame cannot be auto-created; a build-ready spec was posted as an in-file comment (`1962148829`) and recorded in `issue9-figma-gap.md` §7.

---

## Part D — Recommended next sequence (with dependencies)

1. **Review this inventory + resolve C1/C2/C3** (owner: maintainer). Nothing account-related proceeds until these are decided.
2. **Auth UI shell** (C.5 steps 1-2): `/sign-in`, `/sign-up`, header account affordance, `AccountGate`, replace the Compose `/admin` dead-end. *Depends on: none. Can start immediately after decisions.*
3. **Fix participation authorization** (`/api/interactions` server-derived identity; audit `/api/cards`) — tracked as **[Issue #11](https://github.com/ubuntupunk/as-truth-cards/issues/11)**. *Depends on: decision to expose any participation write.* This is a **prerequisite** for any account-bound persistence; keep it separate from the account-UI slice and from Issue #10.
4. **Verification + onboarding** (C.5 steps 3-5): honest states; provider per C1.
5. **Save card end-to-end** (C.5 step 6): persistence per C3; unsave; idempotency; tests from C.7.
6. **Account surface** (C.5 step 7): `/account` profile/activity/settings minimal, distinct from research.
7. **Security audit sign-off** (C.6, Issue #10) **before** enabling account-bound persistence in production.

**Parallel-safe:** Explore (#3), Sources (#6), and the Milestone-1 route test are independent of the account layer and can proceed concurrently. **Do not** implement account-bound persistence before the identity/authorization contract (C.3-C.5) is reviewed.

---

## Part E — ROADMAP.md review (factual accuracy / missing acceptance criteria)

Method: read `ROADMAP.md` (as committed in `851ba72`) against routes, APIs, schema, tests, and gates at HEAD.

**Concrete factual inaccuracies found: none.** Spot-checked load-bearing claims all hold:

- M1 `/` = new Deck, `/legacy/deck` = old flat Deck, legacy absent from primary nav — ✅ confirmed (`src/app-routes.tsx`, `Header.tsx` `NAV_ENTRIES`).
- Established-foundation claims (canonical `trope_graph` + projection; `public` identity incl. Better Auth + `UserInteraction`; two-faced card; `tools/bidi-firefox/`; Issues #9/#10) — ✅ all confirmed.
- Cited commits in M1/M2 (`9b71931`, `ccd30eb`, `fe747bc`, `666f1e6`) — ✅ all exist with matching subjects.
- M9 gate list (`trope-graph:check`, `test`, `test:ui`, `typecheck`, `build`) — ✅ matches `package.json` scripts.
- M8 security scope points (default CORS, trusted-proxy/IP, cookie Secure/SameSite) — ✅ confirmed against `server/index.ts`, `server/auth.ts`.

**Missing / under-specified acceptance criteria (proposed additions, not applied to ROADMAP.md):**

1. **M1 route test — 🔧 implemented in `e30898d`.** `src/app-routes.test.tsx` now asserts `/` → `Deck`, `/legacy/deck` → `LegacyDeck` (and not `Deck`), unknown → `NotFound`, and the nav↔route contract (every header destination routable; legacy absent from `NAV_ENTRIES`). M1's criterion ("Route/navigation tests prove canonical and legacy routing") is therefore satisfied in code; the ROADMAP text still does not name the test to add — a wording gap only.
2. **M9 should name the graph-check environment precondition.** The `check-drift` provisioning gap is **fixed** (`704f6b6`): the scratch DB now receives `pg_trgm`+`unaccent`, so the gate no longer depends on provisioning `template1`. The remaining precondition is that `TROPE_GRAPH_DATABASE_URL` must be exported (the graph scripts do not load `.env`); without it, "run applicable repository checks" reads as self-contained when it is not.
3. **M3/M6 Figma frame existence — now verified (this pass).** M3's Explore node `7:4787` **exists**; **no Sources frame exists at all**, so M6's hedge becomes a **definitive negative**. Both results are recorded in `issue9-figma-gap.md` §6.4 and reflected in the landmark matrix (landmarks 3, 6).
4. **M7 target flow omits the `authenticated ≠ verified` distinction in the diagram** (it is stated in prose at `ROADMAP.md:228` but not in the flow). Minor.

Per the maintainer's correction, **no ROADMAP.md edit is made**: the inaccuracies are "none", and the items above are *additions* better routed through review than applied silently. Items 1–2 are now addressed in code/tooling; the smallest remaining targeted correction is the M9 env-precondition note (item 2).

---

## Part F — Response to sprint review (2026-10-12T10:59:52Z)

Deliverables requested: (1) account / verification / role transition table; (2) provider options + recommendation for C1; (3) Save-card persistence recommendation **with schema evidence**; (4) tracking location + test plan for the `/api/interactions` identity fix; (5) Figma traceability result. Nothing below is implemented; this is planning only.

### F.1 Account / verification / role transition table

All transitions are **server-authoritative**. The `role` field is `input:false` (`server/auth.ts:38-59`), so **no app code path can set a role**; there is no self-service escalation. "Identity" = session presence; "capability" = what the API will allow.

| # | From | Event / trigger | Who may cause it | Resulting identity | Server-side effect | Capability delta |
|---|---|---|---|---|---|---|
| 1 | — | Sign-up (email + password) | Anyone | Session (if auto sign-in) · `role=ANONYMOUS`, `emailVerified=false` | `user` + `account` rows; optional `session` | none (still cannot write account-bound data) |
| 2 | — | Sign-in (email + password, correct) | Anyone with credentials | Session · role unchanged | `session` row | none unless already `VERIFIED` |
| 3 | — | Sign-in with wrong password / unknown email | Anyone | none | none; generic error (no enumeration) | none |
| 4 | `emailVerified=false` | Verification link with valid, unexpired, **single-use** token | Holder of the email inbox | `emailVerified=true`; role unchanged | `Verification` row consumed | unlocks **verification-gated** actions (per C1) |
| 5 | `emailVerified=false` | Verification token expired / invalid / already used | — | no change | none | none; resend permitted (rate-limited) |
| 6 | `emailVerified=false` | **Resend** verification email | Signed-in unverified user | no change | new `Verification` row; email sent | none |
| 7 | Authenticated | **Onboarding completion** (see F.3) | The user | no role change | derived (`name` set) or explicit flag | none (UI/UX only) |
| 8 | `ANONYMOUS` | **Role escalation** to `VERIFIED/ACADEMIC/RESEARCHER/MODERATOR/ADMIN` | **Operator only**, manual `promote_user.sql` | role changes | single `UPDATE "user"` | gains that role's capabilities |
| 9 | Any | Sign-out | The user | none | `session` deleted | loses account-bound capability |
| 10 | Any | Session expiry (`expiresIn` 7d, `updateAge` 1d) | Server clock | none | session invalidated on next check | same as sign-out |
| 11 | Any | Account deletion | *(not implemented — out of scope)* | — | would cascade `sessions`/`accounts`, `SetNull` interactions, `Cascade` drafts | — |

Notes: rows 4–6 show verification changes **only** `emailVerified`, never `role`. `ANONYMOUS` is the default role but the app does **not** currently treat "has session" and "is permitted to write" as the same thing — that mapping is the open C1 decision.

### F.2 C1 — Email-verification provider: options, prerequisites, test strategy, unavailable behaviour

Facts today: **no email dependency, no `emailVerification` block, no `sendVerificationEmail`/`sendResetPassword`, no email env vars** (B.5, B.8). `User.emailVerified` and the `Verification` table already exist unused. Better Auth supports (verified against current docs): `emailVerification.sendVerificationEmail({ user, url, token }, request)`, `sendOnSignUp` (default follows `requireEmailVerification`), `sendOnSignIn` (default `false`), `autoSignInAfterVerification`, `expiresIn` (default 3600s); the handler should **not** await the send (timing attacks); resend via `authClient.sendVerificationEmail({ email, callbackURL })`; `emailAndPassword.requireEmailVerification` gates sign-in on a verified address.

**Options**

| Option | Shape | Pros | Cons / prereqs |
|---|---|---|---|
| A — Hosted API (Resend; Postmark/SendGrid/SES similar) | `sendVerificationEmail` calls a provider SDK/`fetch` | Best deliverability & DX; minimal code | New external dependency + secret; **verified sending domain** (SPF/DKIM/DMARC); provider account; usage cost |
| B — SMTP (e.g. Nodemailer + any SMTP host or self-hosted) | `sendVerificationEmail` sends over SMTP | Provider-agnostic; works with existing mail | More moving parts; deliverability is on us; SMTP creds in env |
| C — **Defer provider** (option "b"): ship sign-in/create-account + gated action on *authenticated* (not verified) | No `emailVerification` wired; UI labels verification as "coming" | Zero new deps/ops; fastest honest slice | "Authenticated ≠ verified" capabilities stay collapsed until a later slice |
| D — Configured-but-honest sender | Wire `emailVerification` with a sender that surfaces failure when unconfigured | Correct wiring in place | Must never fake success |

**Env/config if a provider is chosen (A/B):** `RESEND_API_KEY` (or SMTP host/user/pass), `EMAIL_FROM` (verified sender), `BETTER_AUTH_URL` (must be the production origin so the verify link is not `localhost`). Secret stored in Render env, **never** in the repo. DNS (SPF/DKIM/DMARC) configured at the sending domain.

**Test strategy (must not send real mail in CI).** Inject the transport/sender as a dependency. Assert: (i) the handler is invoked with the correct `to` and a `url` containing the verification token; (ii) `emailVerified` flips `true` **only** when the verification endpoint is called with a valid token; (iii) expired / reused tokens are rejected; (iv) with the sender throwing, sign-up still succeeds and the app renders the unavailable state (see below). Real-delivery verification (if any) is a manual staging smoke test, not a CI assertion.

**Unavailable-email behaviour.** If the provider is unconfigured or the send throws: sign-up/sign-in must still succeed, the user stays `emailVerified=false`, the UI shows an honest "verification unavailable — signed in but unverified" state, and **nothing gated on `VERIFIED` unlocks**; never auto-set `emailVerified`; never render a verified badge. If `requireEmailVerification=true` (option A with gating) and the provider is down, that failure is surfaced, not silently bypassed.

**Recommendation:** **do not decide here.** If the maintainer wants the smallest honest slice, option **C** (defer provider; authenticated-only gating, labelled) is the lowest-risk start; if verification is required up front, option **A (Resend)** is the least-code hosted path. Either way, blocking rule: **no verified badge and no verification-gated capability without a working sender.** This is material for **Issue #10** (secret handling, link host) but the *provider choice* is a product/ops decision, not a security-bug fix.

### F.3 C2 — Onboarding persistence (derived)

**Recommendation: derive it.** "Onboarded" = the user has completed the single onboarding screen, evidenced by `User.name` being set (Better Auth core field; only `role` is `input:false`). **No new column, no migration.** Add an explicit flag only if we must later distinguish "dismissed" from "completed", or gate a capability on onboarding — neither is required by the first slice.

### F.4 C3 — Save-card persistence: recommendation + schema evidence

**Schema evidence (`prisma/schema.prisma`).** `UserInteraction` is an **append-only participation/moderation log**, not a user collection:

- `userId String?` is **nullable** with `onDelete: SetNull` — rows may have no owner (moderation history survives user deletion).
- `cardId Int` is a FK to the **legacy `Card`** table (integer id), with no `onDelete` (defaults to Restrict) — it keys legacy cards, **not** canonical `trope_graph` cards (which are addressed by **slug/uuid**).
- `interactionType` enum has **no `SAVED`**: `VIEW/SHARE/RATING_UP/RATING_DOWN/STRUCTURED_FEEDBACK/ACADEMIC_FEEDBACK/MODERATION_ACTION`.
- `status ContentStatus @default(PENDING)` is a **moderation** status, not a user-collection state.
- **No `@@unique([userId, cardId])`** — the table is not idempotent and has no unsave semantics.
- The only per-user write model today, `DecompositionDraft`, already keys on **`cardSlug`** with `@@unique([userId, cardSlug])` and `onDelete: Cascade`.

**Why option (b) (reuse `UserInteraction`) is a poor fit:** wrong key type (legacy int `Card` vs graph slug), wrong semantics (moderation-queued log vs a user's save collection), no idempotency, and "unsave" would mean deleting a row from an append-only log.

**Recommendation:** add a **narrow `SavedCard` model** keyed to the canonical slug:

```prisma
model SavedCard {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cardSlug  String
  createdAt DateTime @default(now())

  @@unique([userId, cardSlug])
  @@index([userId])
}
```

This makes save **idempotent** (upsert on the unique key), unsave a **row delete**, survives user deletion via cascade, and couples to the canonical slug (mirroring `DecompositionDraft`) rather than the legacy integer id. **This is a new persistence model and therefore must not be added until C3 is reviewed/approved** (`ROADMAP.md:212` guard). Fallback if a zero-new-model outcome is mandated: extend `InteractionType` with `SAVED`, add a unique index, and accept the semantic overloading — documented here, not recommended.

### F.5 `/api/interactions` identity fix — tracking + test plan

**Location of the gap:** `server/api/interactions.ts` (POST create + GET), which accepts a **client-supplied `userId`** (`:9,:34`) with no auth. Adjacent: `/api/cards` has **no authorization on any verb** (`server/api/cards.ts`) — audit whether POST/PUT/DELETE is a legacy/admin surface to restrict or remove from user-facing flows.

**Tracking:** **[Issue #11](https://github.com/ubuntupunk/as-truth-cards/issues/11)** — "Participation authorization". Kept **separate** from the account-UI ticket (#9) and from Issue #10; do not claim #10 covers it unless #10's scope is deliberately expanded to include it. This is a **prerequisite** for any account-bound persistence.

**Fix pattern to reuse** (`server/api/drafts.ts:112-119,139`): `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`; derive the actor server-side; `401` for actions that require a session; keep Prisma clients **lazily injected** so tests can pass fakes.

**Test plan** (mirrors `server/api/drafts.test.ts`):

1. Signed out → auth-required interaction types return `401` (no row written).
2. Client-supplied `userId` in the body is **ignored/overridden** — the row is attributed to the session user, or the request is rejected.
3. **Cross-user isolation** — user A cannot create or read rows attributed to user B; `GET` never leaks another user's rows.
4. Anonymous-permitted types (e.g. `VIEW`/`SHARE`, if so decided) still work without a session but are **never attributed to a fabricated identity**.
5. Regression: existing public reads (`/api/cards`, `/api/graph`) are unchanged.

### F.6 Figma traceability result

File `qmVMnfR9DpQFyYtaiSizYD`. The maintainer's **improved** account frames (node group `62:*`) exist as **six surfaces × three treatments** (Atmospheric / Editorial / Workspace); earlier versions remain under `49:*`.

| C.1 state / surface | Improved frames (Atmospheric · Editorial · Workspace) | Original |
|---|---|---|
| Sign In / Create account | `62:12222` · `62:12332` · `62:12441` | `49:2` |
| Onboarding | `62:12550` · `62:12787` · `62:13022` | `49:30` |
| Profile | `62:13257` · `62:13385` · `62:13512` | `49:89` |
| Profile dropdown (header account affordance) | `62:11735` · `62:11897` · `62:12057` | `49:63` |
| My Activity (saved cards / participation) | `62:13639` · `62:13788` · `62:13936` | `49:122` |
| Settings | `62:11191` · `62:11373` · `62:11554` | `49:156` |

**Findings.** (i) **No dedicated "Verification" frame** → verification is a *state* of Sign In / Onboarding, so C.1's `unverified`/`verification-pending`/`verification-failed`/`verification-expired` states are **not separately designed** and must be treated as UI to specify (or map onto Sign In). (ii) **No "Sources" frame exists in the file at all** → confirms the M6 hedge in `issue9-figma-gap.md` ("if there is no dedicated final Sources frame"). (iii) **Caveat — content not inspected:** the Figma API returned `429 Rate limit exceeded` on every node fetch after discovery; node **names/ids/variants** above are reliable (from file discovery), but the **frame contents** (which C.1 states each screen actually draws) are **unverified**. The model cannot render image nodes, so verification requires the API once the rate limit clears. Pending follow-up: read Sign In (`62:12441`) + Onboarding (`62:13022`) to confirm whether they draw the unverified / verification-pending / verification-failed states.

**Authority + follow-up (2026-10-12T11:22:44Z).** The improved **`62:*`** frames are the **current design targets**; **`49:*`** are historical/reference only — do not map implementation to `49:*` by default. The Figma REST API exposes **no node/frame-creation endpoint** (read + comments + dev resources only), so the missing Sources frame cannot be auto-created; authoring requires the editor/Plugin API. A build-ready Sources spec was posted as an in-file comment (`1962148829`) and recorded in `issue9-figma-gap.md` §7. Node content reads remain `429` on this account. **C1/C2/C3 stay open** — design inspection does not decide them.
