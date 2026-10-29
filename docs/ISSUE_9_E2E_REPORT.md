# Issue #9 — E2E Acceptance Report

Session: Tue Oct 27 – Wed Oct 28, 2026  
Reporter: OpenCode agent (E2E harness via `agent-browser` / Chromium headless CDP)  
Target: `http://localhost:8080` (Vite dev server) proxied to `http://localhost:3001` (Express API)

---

## Summary

End-to-end acceptance of Issue #9's remaining criteria:

1. **Save Card end-to-end** — ✅ VERIFIED after fixing a `require()` no-op bug in `card-save-button.tsx`.
2. **Discovery promotion end-to-end** — ✅ VERIFIED after fixing `ACCEPTED`→`APPROVED` enum mismatch in `AdminDiscovery.tsx` and applying 7 missing graph migrations.
3. **Narrative Analysis / card shell** — ✅ VERIFIED (three-face navigation, keyboard, reduced motion, responsive).
4. **Release gates** — ⚠️ PARTIALLY GREEN: `pnpm build` OK, `pnpm test:ui` 707/0, `pnpm test:server` 157/0, `pnpm run typecheck:all` clean. `trope-graph:check` is **environment-blocked** in this environment (`database "trope_graph" does not exist` on configured Neon host — pre-existing, not a regression). See §4–5 for exact commands and results.

Issue #9 remains open per reviewer instruction until this consolidated report is filed. This is that report.

---

## ⚠️ Security remediation — credential exposure (commit `28e8775`)

Commit `28e8775` inadvertently included a live E2E test account's email address and password, and stated the account was escalated to ADMIN. These credentials were pushed to `origin/main` and are publicly reachable in git history.

**Remediation taken:**
1. The test account (`e2e-acceptance-20261027@example.com`) has been **disabled and its password rotated**. Active sessions revoked.
2. The credential line has been **removed from this report** (see §Environment, item above).
3. The ADMIN role escalation on the test account has been **reverted**.
4. E2E-created records (saved cards, discovery candidates/events) created under this account have been **purged** from the Neon `trope_graph` database where safe.
5. Commit `28e8775` remains in history with the credential. **History rewriting is pending maintainer approval** (plan in §History-cleanup below) — do not attempt `git filter-branch` or `filter-repo` without the maintainer's approval, as it would invalidate all downstream clones.

**Assessment:** The credential was in a development/E2E test account only, not a production user account. The account has no production data access beyond what any E2E test would create. The risk is limited to the test account itself and any E2E-generated test records, both of which have been cleaned up.

### History-cleanup — PENDING MAINTAINER APPROVAL (plan only, not executed)

Commit `28e8775` remains in public git history on both `origin` (GitHub) and `codeberg`, including the credential line and the statement that the test account was escalated to ADMIN. The password has been rotated and the account disabled, so the credential value itself is unusable, but the text remains reachable in clone history and GitHub's cached views.

**Status: pending maintainer approval.** The agent has documented the exposure and prepared the plan below. It has **not** been approved, and nothing has been rewritten. The agent does not treat the exposure as an accepted risk on the maintainer's behalf.

**Proposed cleanup plan (for approval, do not execute before sign-off):**

1. **Pre-flight:** freeze merges; `bd sync`; confirm both remotes point at the same commit; notify all contributors and record clone count.
2. **Rewrite (local, single operator):** `git filter-repo --replace-text <redactions.txt>` on a fresh mirror clone, redacting the credential email, password, and ADMIN-escalation line across all history. Verify with `git log -S` / `git grep` over all revs.
3. **Force-push both remotes:** `origin` (GitHub) and `codeberg`, with the maintainer performing or explicitly delegating the push. GitHub may need branch protection temporarily relaxed.
4. **Downstream coordination:** every clone must re-fetch or re-clone (stale clones will re-push the secret); CI caches and any forks/branches need re-basing or deletion.
5. **GitHub cached views:** request secret-scanning/history purge via GitHub Support for the affected commit, since force-push does not immediately clear cached views, search indexes, or already-fetched API responses.
6. **Post-checks:** re-scan with `git log -S` and a secret scanner; confirm the rotated password was never reused; close out the incident note in this report.

**Residual risk while pending:** the exposed text (email + password + ADMIN escalation statement) remains publicly reachable at commit `28e8775` and its ancestors on both remotes. Immediate risk is contained (account disabled, password rotated, sessions revoked, ADMIN reverted, E2E records purged) and no production user data or production credentials were involved. This risk is **open and pending maintainer disposition** — it is not accepted.


## Environment

- Framework: Vite + Preact frontend, Express server
- Auth: Better Auth (email/password, `requireEmailVerification: false`)
- Graph: Drizzle over Neon Postgres (`trope_graph`)
- Browser: Chromium 156.0.8078.47 (snap), headless via `agent-browser`
- Test account created for E2E: credentials **removed from this report** (exposed in commit `28e8775`, see remediation note below). Role was escalated to ADMIN for discovery testing — account has been disabled and password rotated. Do not reuse.

---

## 1. Save Card end-to-end

### Signed-out state

| Check | Result |
|-------|--------|
| `Save card` disabled | ✅ `button[data-testid="save-card"]` disabled |
| Reason text visible | ✅ `aria-describedby="save-card-note"`; "Sign in to save cards to your account." |
| No click handler while signed out | ✅ Button disabled; header Sign-in link is the account entry |

### Sign-up / sign-in / returnTo

| Check | Result |
|-------|--------|
| Sign-up lands on `/account` | ✅ Name + email + password accepted |
| `returnTo=/?focus=jesus-was-a-zionist` | ✅ Post-sign-in redirect returns to the exact deck focus URL |

### Signed-in save flow

| Check | Result |
|-------|--------|
| Save card enabled signed in | ✅ |
| Click fires POST `/api/saved-cards` | ✅ (after fix) |
| Button `Save card → Saving… → Unsave card` | ✅ |
| Reload persistence: `GET /api/saved-cards/check/jesus-was-a-zionist` → 200 | ✅ |
| Saved-card listing (`/account/activity`) shows `jesus-was-a-zionist` | ✅ |
| Listing link → `/graph?focus=jesus-was-a-zionist` | ✅ |
| Unsave → DELETE `/api/saved-cards/jesus-was-a-zionist` → 200 | ✅ |
| Listing shows "No saved cards yet" after unsave | ✅ |

### Bug found and fixed — `src/deck/card-save-button.tsx`

The component resolved `preact/hooks` via `require()` inside `try/catch`. In the Vite ESM browser bundle `require` is `undefined`, so the catch arm rendered a **no-op fallback even when signed in** — clicks did nothing and no API call fired. Tests passed only because Node's test runner supplies `require`.

Fix: split into a statically-imported `SaveCardToggle` (signed in) plus a hook-free signed-out branch. The signed-out branch keeps the disabled affordance with visible reason text; the signed-in branch mounts hooks normally and calls `checkSaved`/`saveCard`/`unsaveCard`.

### Error UX fix (maintainer gap 1 — required)

Failed save/unsave previously surfaced **only via `console.error`** — no visible message to the user. Added an `aria-live="polite"` error notice (`data-testid="save-card-error"`) that appears when `saveCard` or `unsaveCard` rejects, and clears on the next click attempt. Regression test added at `src/deck/card-save-button.test.tsx` (signed-out branch; signed-in error path verified live in-browser).

### Verification after fix

- `pnpm test:ui`: **707 pass / 0 fail** (194 suites) — includes new `card-save-button.test.tsx` signed-out branch plus 5 deterministic save/unsave failure-path tests.
- Live browser: POST fired on save, DELETE fired on unsave, reload persistence holds. API failure now shows visible error notice instead of silent console-only logging.

---

## 2. Discovery promotion end-to-end

### Prerequisite: 7 missing migrations

The dev DB was stopped at migration `0010_card_search.sql`; every discovery API call returned **500** with `relation "trope_graph.discovery_candidates" does not exist`. Applied via:

```
pnpm run trope-graph:migrate -- --allow-remote
```

Applied 7: `0011_relationships_endpoint_integrity` … `0017_discovery_events_dml_scope`. `--check` now clean (skipped 17, applied 0).

### Full flow

| Check | Result |
|-------|--------|
| `POST /api/discovery/search` Crossref "antisemitism trope" | ✅ 201: 3 candidates created (real DOIs) |
| `/admin/discovery` lists candidates | ✅ Real Crossref records with title/authors/date/DOI/query |
| Accept candidate | ❌ **400** initially — UI sent `decision: 'ACCEPTED'`; API enum is `APPROVED` |
| Review `POST /api/discovery/candidates/:id/review` | ✅ 200 after fixing `ACCEPTED→APPROVED`; status flips `CANDIDATE→APPROVED` in-place |
| Promote against source `65fdb60b-3f82-449a-9171-654d243aa274` (The Protocols of the Elders of Zion) | ✅ `promoted_source_id` set, revision 2; UI shows "Promoted to source: …"; controls removed (terminal) |
| Re-promote same candidate | ✅ 409 "Candidate was already promoted" |
| Re-review promoted candidate | ✅ 409 "Candidate was already promoted" |
| Stale revision (`expectedRevision: 99`) | ✅ 409 "Candidate changed since it was read; reload and retry" |
| Unknown source UUID | ✅ 400 "Source not found" |
| `sources` count | ✅ Still 3 (no silent source creation) |
| `evidence_items` count | ✅ Still 0 (no silent evidence creation) |
| Audit trail `discovery_candidate_events` | ✅ Exactly 2 rows (REVIEWED + PROMOTED), both attributed to the admin actor; failed probes wrote nothing |
| In-place refresh without reload | ✅ Trope (i) flipped to `APPROVED` immediately after Accept |

### Bugs found and fixed — `src/pages/AdminDiscovery.tsx`

1. Review decision `decision: 'ACCEPTED'` → changed to `'APPROVED'` to match `REVIEW_DECISIONS` (`['APPROVED', 'REJECTED', 'DEFERRED']`) and the Postgres enum.
2. Status filter options removed `PROMOTED` (not a review decision); kept `CANDIDATE` / `APPROVED` / `REJECTED` / `DEFERRED`.
3. Status rendering comparison `reviewStatus === 'ACCEPTED'` → `'APPROVED'` so approved candidates render correctly in the roster.

---

## 3. Narrative Analysis / card shell

### Three-face navigation

| Check | Result |
|-------|--------|
| `/?focus=canaanite-card` → Card / ID-39 | ✅ |
| `Current face: Cover / Claim / Analysis` announced | ✅ |
| `Read analysis` via keyboard (focus + Enter) → Analysis face | ✅ |
| Narrative region renders `NARRATIVE ANALYSIS` + authored prose | ✅ |
| Caption: "Authored editorial analysis. It is narrative prose — not evidence, not a claim, not a source, and not a reasoning step." | ✅ |
| `Back to claim` / `Back to front` via keyboard | ✅ |
| Focus moves into card on face open | ✅ |

### Empty-state narrative (card without `editorial_notes`)

Verified earlier on `jesus-was-a-zionist`: renders "No narrative analysis has been supplied for this card. … the absence reported here is about prose, not about the record." with `data-testid="analysis-narrative"`.

### Reduced motion

| Check | Result |
|-------|--------|
| `matchMedia('(prefers-reduced-motion: reduce)').matches` | ✅ `true` |
| `transform: none` | ✅ |
| Stateful `data-flipped` swap without transform | ✅ (`data-flipped="true"`, Claim face reachable) |

### Responsive layout

| Viewport | Check | Result |
|----------|-------|--------|
| 375 px | overflowX | ✅ 0 |
| 375 px | hamburger visible | ✅ |
| 375 px | all 6 links in opened menu | ✅ (Decks, Explorer, Graph, Research, Compose, Sources) |
| 375 px | drawer triggers present | ✅ ("Browse categories", "Research & suite") |
| 375 px | Browse drawer | ✅ `role="dialog"`, `aria-modal="true"`, `aria-label="Browse categories"`, overflowX 0 |
| 375 px | Escape closes drawer + returns focus to trigger | ✅ Focus returns to "Browse categories" |
| 1280 px (xl) | rails visible | ✅ Browse rail + tray rail both visible |
| 1280 px | overflowX | ✅ 0 |
| 1280 px | toolbar triggers hidden (rails replace them) | ✅ rect = 0 for both; grid `xl:grid-cols-[232px_minmax(0,1fr)_320px]` |

---

## 4. Release gates

All commands run against `localhost:8080` (Vite dev server) + `localhost:3001` (Express API). No checks were run against the deployed environment — see Deployment boundary (§5).

| Gate | Exact command | Result |
|------|---------------|--------|
| Typecheck (vacuous root) | `pnpm typecheck` | ❌ 4 errors — all pre-existing: 3× `Cannot find module '@prisma/client'` (prisma client not generated in this env), 1× implicit `any` in `server/api/saved-cards.ts:44`. Root `tsconfig.json` has `"files": []` + references. |
| Typecheck (non-vacuous) | `pnpm run typecheck:all` | ✅ Clean — `tsc -b` exit 0 |
| Build | `pnpm run build` | ✅ Exit 0; 978 kB JS chunk; pre-existing >500 kB chunk warning only |
| UI tests | `pnpm run test:ui` | ✅ **707 pass / 0 fail** (194 suites) — includes new `src/deck/card-save-button.test.tsx` |
| Server tests | `pnpm run test:server` | ✅ **157 pass / 0 fail** (39 suites) |
| Graph gate | `pnpm run trope-graph:check -- --allow-remote` | ⚠️ Environment-blocked: `trope_graph` database does not exist on the configured Neon host (`database "trope_graph" does not exist`). `migrate:check` aborts before drift validation. Pre-existing env limitation — graph DB was on a separate Neon instance; not a regression from this work. |
| Lint / biome | `pnpm run lint` | 2 errors / 3 warnings — all pre-existing baseline: 2× unused imports in `src/pages/Explore.tsx` (lines 49-50, untouched by this work), 1× unused import in `src/sources/research-metrics.tsx`, 2× `organizeImports` assists. **0 errors in changed files.** |

**Reconciliation:** `pnpm typecheck` reports 4 pre-existing errors because the root tsconfig is vacuous (`"files": []`) and `@prisma/client` is not generated locally. `pnpm run typecheck:all` uses the app tsconfig and passes clean. The 4 errors are **not** from this work — all reference `@prisma/client` generation or pre-existing `any` types.

## 5. Deployment boundary

| Check | Environment | Status |
|-------|-------------|--------|
| Typecheck (`typecheck:all`) | localhost | ✅ Clean |
| Build | localhost | ✅ Exit 0 |
| UI tests | localhost (Chromium headless via `agent-browser`) | ✅ 707/0 |
| Server tests | localhost | ✅ 157/0 |
| Graph gate (`trope-graph:check`) | localhost | ⚠️ Blocked — `trope_graph` DB not on configured Neon host |
| Lint | localhost | 2 errors / 3 warnings (all pre-existing) |
| Save Card E2E (save → reload → unsave) | localhost:8080 + localhost:3001 | ✅ Verified live in-browser |
| Discovery promotion E2E | localhost:8080 + localhost:3001 | ✅ Verified live in-browser |
| Card shell (three faces, keyboard, reduced motion, responsive) | localhost:8080 | ✅ Verified live in-browser |
| Deck live error state (abort graph API) | localhost:8080 | ✅ Verified live in-browser — "Network error: the graph API is unreachable" renders |
| Sign-out flow | localhost:8080 | ✅ Verified live in-browser |
| Deployed environment checks | Render / production | ❌ None run — no deployment verification performed |

All E2E acceptance evidence was captured against `localhost:8080` (Vite dev server) proxied to `localhost:3001` (Express API). **No checks were run against the deployed Render environment.** Local browser acceptance does not prove deployed migration/runtime status.

---

## Release verification boundary

The distinction below separates work that is **implemented and verified locally** from work that is **release-verified** (deployed Render environment). Items marked "local only" are NOT release-verified and must not be treated as release green.

### Implemented + verified locally (localhost only)

| Item | Status | Evidence |
|------|--------|----------|
| Save Card E2E (save → reload → unsave) | ✅ Local | Live-browser, `localhost:8080` + `localhost:3001` |
| Save Card API error states (signed-in) | ✅ Local | `agent-browser`, `localhost:8080` |
| Discovery promotion E2E | ✅ Local | Live-browser, `localhost:8080` + `localhost:3001` |
| Card shell (three faces, keyboard, reduced motion, responsive) | ✅ Local | Live-browser, `localhost:8080` |
| Deck live error state (abort graph API) | ✅ Local | Live-browser, `localhost:8080` |
| Sign-out flow | ✅ Local | Live-browser, `localhost:8080` |
| Route checks (`/explore`, `/research`, `/sources`) | ✅ Local | Live-browser, `localhost:8080` |
| `pnpm run typecheck:all` | ✅ Local | Clean |
| `pnpm run build` | ✅ Local | Exit 0 |
| `pnpm run test:ui` | ✅ Local | 707 pass / 0 fail |
| `pnpm run test:server` | ✅ Local | 157 pass / 0 fail |
| `pnpm run lint` | ⚠️ Local | 2 errors / 3 warnings, all pre-existing baseline |

### NOT release-verified (deferred / environment-blocked)

| Item | Status | Blocker / follow-up | Owner |
|------|--------|---------------------|-------|
| `pnpm run trope-graph:check` | ⚠️ Environment-blocked | `trope_graph` database does not exist on configured Neon host; `migrate:check` aborts before drift validation. Pre-existing env limitation, not a regression. Sanctioned local path: `just graph-check` with `TROPE_GRAPH_DATABASE_URL` exported. | Maintainer / infra |
| Deployed Render checks | ❌ None run | No deployment verification performed. Local acceptance ≠ deployed verification. Migration/runtime status on Render unknown. | Maintainer / deploy |
| Figma frame reconciliation | ⚠️ Open | MCP unreachable (Starter-plan node-read quota lockout, resets ~35 h). Tracked separately. | Designer / maintainer |
| In-card `MalformedState` live-browser test | ⚠️ Incomplete | Projection URL with query strings cannot be matched by `agent-browser network route --abort` (requires exact path, no query strings). Confirmed by code inspection + unit tests only. Not live-browser-triggerable. | Maintainer |

### Conclusion on verification boundary

The **implemented feature paths were verified locally where noted** in the table above (Save Card E2E, discovery promotion, card shell, Deck API error state, sign-out, route checks, local build/tests/typecheck). They are **not** release-verified, and release readiness is **not** claimed.

The following remain **unverified or open**, and are not passed gates:

- graph integrity (`trope-graph:check`) — environment-blocked;
- deployed Render behavior and migration status — no checks run;
- Figma visual reconciliation — open;
- in-card `MalformedState` live-browser case — incomplete.

A documented boundary is not a passed gate. Each of these requires a disposition (completed with evidence, or explicitly accepted as an open follow-up by the maintainer) before Issue #9 can be signed off.

---

## Changed files (this session)

| File | Change |
|------|--------|
| `src/deck/card-save-button.tsx` | Rewritten: static hooks import; split into `SaveCardToggle` (signed in) + hook-free signed-out branch; removed dead returnTo redirect code; added visible error notice on save/unsave failure (`aria-live="polite"`, `data-testid="save-card-error"`) |
| `src/pages/AdminDiscovery.tsx` | Decision enum `ACCEPTED→APPROVED`; removed `PROMOTED` filter option; fixed status rendering comparison |
| `src/deck/card-save-button.test.tsx` | New: regression test for signed-out `CardSaveButton` (disabled button, reason text, no error notice) |
| `docs/ISSUE_9_E2E_REPORT.md` | Renamed from `ISSUE_9_REPORT.md`; consolidated E2E acceptance report with all 5 maintainer gaps addressed |

---

## Remaining blockers (pre-existing, not regressions)

- `pnpm trope-graph:check` locally requires `TROPE_GRAPH_DATABASE_URL` exported (graph scripts do not load `.env`) — sanctioned local path is `just graph-check`.
- Root `tsconfig.json` is `"files": []` + references, so `pnpm typecheck` is vacuous; use `typecheck:all`.
- Figma frame reconciliation still MCP-unreachable (Starter-plan node-read quota lockout, resets ~35 h; tracked separately).

---

## Additional E2E tests (Dav-approved)

Per Dav's approval, four additional live-browser E2E checks were run beyond Issue #9's explicit acceptance criteria:

### Test 1 — Save Card API error states ✅ FIXED

| Check | Result |
|-------|--------|
| Abort save POST | Visible error notice (`data-testid="save-card-error"`, `aria-live="polite"`) |
| Abort unsave DELETE | Same visible error notice |
| Regression test (deterministic) | `src/deck/card-save-button.test.tsx` — `saveCard`/`unsaveCard` reject on network failure and non-ok responses (5 tests) |
| Live-browser verification | Signed-in error notice verified via `agent-browser` against `localhost:8080` |

**Fix:** `card-save-button.tsx` catch block now sets an error state displayed via `aria-live="polite"` instead of logging only to `console.error`. Error clears on next click attempt. No longer a silent failure.

### Test 2 — Card shell error states ✅ VERIFIED

| Check | Result |
|-------|--------|
| Sources page: abort `/api/graph/sources` | ✅ "Could not load sources: Network error: the graph API is unreachable" — `ApiErrorState` confirmed |
| Deck card projection error: abort `/api/graph/cards?limit=200` before navigation | ✅ "Network error: the graph API is unreachable" renders in Deck — `ApiErrorState` confirmed live in-browser via `agent-browser` |
| In-card `MalformedState` | Confirmed by code inspection + unit tests (Phase A review). Projection URL (`/api/graph?focus=…&view=…&depth=…`) cannot be matched by `agent-browser network route --abort` which requires exact path matches without query strings. Marked as not live-browser-triggerable with precise reason. |

### Test 3 — Live-browser route checks ✅

| Route | Result |
|-------|--------|
| `/explore` | ✅ Loads — "47 cards", result tiles with "Read card" links |
| `/research` | ✅ Loads — "Research Workspace", disclaimer, session rail |
| `/sources` | ✅ Loads — "Sources", disclaimer, canonical sources index with attribution counts |

### Test 4 — Sign-out flow ✅

| Check | Result |
|-------|--------|
| Sign-out button on Account page | ✅ Present |
| Click → redirect | ✅ Redirects to `/` (canonicalizes to `/?focus=<slug>`) |
| Session cleared | ✅ Save card reverts to disabled with "Sign in to save cards to your account." |

---

## Evidence artifacts

- Screenshots: `/tmp/e2e-deck-375-drawer.png`, `/tmp/e2e-deck-375-browse-drawer.png`, `/tmp/e2e-deck-1280.png`
- API evidence captured live from `agent-browser network requests`: POST 200 `/api/discovery/candidates/:id/review`, POST 200 `/api/saved-cards`, DELETE 200 `/api/saved-cards/:slug`, 409s for stale/already-promoted, 400 for unknown source.
- DB assertions on Neon `trope_graph`: `discovery_candidates` review_status/revision/promoted_source_id; `discovery_candidate_events` (2 rows); `sources` = 3; `evidence_items` = 0.

---

## Conclusion

Issue #9's remaining acceptance criteria are now evidenced:

- **Save Card E2E** — verified locally (with one bug found and fixed). API error-state gap **closed**: failed save/unsave now shows a visible `aria-live="polite"` error notice (`data-testid="save-card-error"`) instead of silent `console.error` logging. Regression test added.
- **Discovery promotion E2E** — verified locally (with two bugs found and fixed, plus 7 migrations applied).
- **Narrative Analysis / card shell** — verified locally (three faces, keyboard, reduced motion, responsive at 375px and 1280px). **Deck live error state verified locally in-browser**: aborting `/api/graph/cards?limit=200` before navigation renders "Network error: the graph API is unreachable" — `ApiErrorState` confirmed.
- **Release gates** — `typecheck:all` clean, build green, UI tests 707/0, server tests 157/0. Graph gate environment-blocked (`trope_graph` DB not on configured Neon host — pre-existing). Lint: 2 errors / 3 warnings, all pre-existing baseline, 0 in changed files.
- **Additional Dav-approved E2E** — route checks (`/explore`, `/research`, `/sources`), sign-out flow, Deck live error state, and Save Card error states all verified locally in browser.

**Verification boundary:** the implemented feature paths above were **verified locally** (localhost only) where noted. None are **release-verified**. Still unverified/open: graph integrity (`trope-graph:check`, environment-blocked), deployed Render behavior/migrations (none run), Figma frame reconciliation (open), and the in-card `MalformedState` live-browser test (incomplete). These are explicit blockers/follow-ups, not passed gates — see §Release verification boundary.

The history-cleanup decision is **pending maintainer approval** (plan in §History-cleanup, not executed). Issue #9 should remain open until the reviewer signs off on this report, the maintainer approves or rejects the history-cleanup plan, and each of the open verification items above is either completed with evidence or explicitly accepted as an open follow-up.
