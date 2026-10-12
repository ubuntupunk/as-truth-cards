# Account Onboarding — Inventory, Target Flow, and First-Slice Proposal

> **Status:** planning artifact (no implementation). Follows `ROADMAP.md` Milestone 7 ("Account onboarding and participation") and the Issue #9 sprint-review instruction to produce an inventory + proposal **before** broad account implementation.
> **Related:** product-shell tracking [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) · security review [Issue #10](https://github.com/ubuntupunk/as-truth-cards/issues/10) · shared search [Issue #8](https://github.com/ubuntupunk/as-truth-cards/issues/8).
> **Date:** 2026-10-12 · **HEAD at time of writing:** `851ba72`.
> **Scope rule:** this document proposes; it changes no schema, route, or config. Any "Decision needed" item must be resolved before implementation.

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

> **Finding:** `/api/interactions` trusts a client-supplied identity. This is a participation-layer authorization gap to resolve as part of (or alongside) the account slice, and/or track under Issue #10.

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
  - `VERIFIED`: account-gated writes — starting with **Save card** (persisting a saved card should require a *verified* user, given the community-facing nature; "signed in but unverified" is a distinct, honest state).
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

- **C1 — Verification provider.** No email dependency exists. Options: (a) add a provider (e.g. Resend) behind env vars and require verification for Save card; (b) ship sign-in/create-account + Save card gated on *authenticated* (not verified) first, with `emailVerification` explicitly deferred and labelled; (c) add verification wiring with a no-op sender that surfaces an honest failure state until a provider is configured. **Recommendation:** (b) for the first slice — it delivers the end-to-end gate honestly without inventing verification; add the provider in a dedicated follow-up.
- **C2 — Onboarding persistence.** Does "onboarded" need its own flag, or is it a derived state (e.g. `name` set + role ≥ VERIFIED)? **Recommendation:** derive it; add a field only if the inventory proves it insufficient.
- **C3 — Save card persistence model.** There is **no `SavedCard` model**. Options: (a) add a `SavedCard` model; (b) reuse `UserInteraction` with a new `InteractionType` value (e.g. `SAVED`) and a unique `(userId, cardId)` rule; (c) defer the action. **The inventory shows `UserInteraction` is a general participation log (has `feedbackRating`/`status`/`interactionType`) whose `cardId` provenance (legacy vs graph slug) must first be confirmed** — drafts already key on `cardSlug`. **Recommendation:** investigate (b) first; add a dedicated model only if `UserInteraction` cannot express a stable, idempotent save (unique constraint, delete-on-unsave) without overloading a moderation/feedback table.

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

- Account/onboarding Figma frames have **not** been identified or inspected in this pass (Figma could not be re-opened here). `ROADMAP.md:250` requires each screen/state be mapped to Figma.
- **Open action:** locate the account/sign-in/onboarding frames in `qmVMnfR9DpQFyYtaiSizYD` (or record that none exist) and map C.1 states → frames before building UI. Until then, all account UI is **design-underspecified**.

---

## Part D — Recommended next sequence (with dependencies)

1. **Review this inventory + resolve C1/C2/C3** (owner: maintainer). Nothing account-related proceeds until these are decided.
2. **Auth UI shell** (C.5 steps 1-2): `/sign-in`, `/sign-up`, header account affordance, `AccountGate`, replace the Compose `/admin` dead-end. *Depends on: none. Can start immediately after decisions.*
3. **Fix participation authorization** (`/api/interactions` server-derived identity; audit `/api/cards`). *Depends on: decision to expose any participation write. Track under Issue #10 where it is a security concern.*
4. **Verification + onboarding** (C.5 steps 3-5): honest states; provider per C1.
5. **Save card end-to-end** (C.5 step 6): persistence per C3; unsave; idempotency; tests from C.7.
6. **Account surface** (C.5 step 7): `/account` profile/activity/settings minimal, distinct from research.
7. **Security audit sign-off** (C.6, Issue #10) **before** enabling account-bound persistence in production.

**Parallel-safe:** Explore (#3), Sources (#6), and the Milestone-1 route test are independent of the account layer and can proceed concurrently. **Do not** implement account-bound persistence before the identity/authorization contract (C.3-C.5) is reviewed.

---

## Part E — ROADMAP.md review (factual accuracy / missing acceptance criteria)

Method: read `ROADMAP.md` (as committed in `851ba72`) against routes, APIs, schema, tests, and gates at HEAD.

**Concrete factual inaccuracies found: none.** Spot-checked load-bearing claims all hold:

- M1 `/` = new Deck, `/legacy/deck` = old flat Deck, legacy absent from primary nav — ✅ confirmed (`src/App.tsx:31-32`, `Header.tsx` `NAV_ENTRIES`).
- Established-foundation claims (canonical `trope_graph` + projection; `public` identity incl. Better Auth + `UserInteraction`; two-faced card; `tools/bidi-firefox/`; Issues #9/#10) — ✅ all confirmed.
- Cited commits in M1/M2 (`9b71931`, `ccd30eb`, `fe747bc`, `666f1e6`) — ✅ all exist with matching subjects.
- M9 gate list (`trope-graph:check`, `test`, `test:ui`, `typecheck`, `build`) — ✅ matches `package.json` scripts.
- M8 security scope points (default CORS, trusted-proxy/IP, cookie Secure/SameSite) — ✅ confirmed against `server/index.ts`, `server/auth.ts`.

**Missing / under-specified acceptance criteria (proposed additions, not applied to ROADMAP.md):**

1. **M1 has no route test, and the criterion says "Route/navigation tests prove canonical and legacy routing."** No such test exists. Either add the test or mark the criterion explicitly outstanding (it is recorded in the §6 matrix).
2. **M9 should name the graph-check environment precondition.** The gate is only green with `TROPE_GRAPH_DATABASE_URL` exported **and** `pg_trgm`+`unaccent` available to the scratch DB (`check-drift` provisioning gap, §6.3). Without this, "run applicable repository checks" reads as self-contained when it is not.
3. **M3 (Explore) and M6 (Sources) cite Figma nodes (`7:4787`, Sources frame) that were not verified in this pass**; M6 already hedges ("if there is no dedicated final Sources frame"). Worth an explicit "frame existence verified: yes/no" cell.
4. **M7 target flow omits the `authenticated ≠ verified` distinction in the diagram** (it is stated in prose at `ROADMAP.md:228` but not in the flow). Minor.

Per the maintainer's correction, **no ROADMAP.md edit is made**: the inaccuracies are "none", and the items above are *additions* better routed through review than applied silently. If a single targeted correction is desired, item 1 (or the M9 precondition note) is the smallest, most concrete candidate.
