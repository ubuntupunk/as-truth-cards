# Issue #9 — product-shell criterion reconciliation

> **Later-slice update (2026-11-23):** the dispositions in §6 were advanced in
> [docs/ISSUE_9_ACCEPTANCE_DISPOSITIONS.md](ISSUE_9_ACCEPTANCE_DISPOSITIONS.md) on
> `207bc9e`. The graph DB gate is now locally verified via `just graph-check` against a
> local database; deployed health/runtime/auth probes passed; Figma access is restored
> and frames were inventoried and reviewed. This document is retained as the baseline
> reconciliation and is not rewritten. Issue #9 stays open.

Prepared 2026-11-23 for [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) per the maintainer's P1 direction in [Milestone Review — 2026-11-23](MILESTONE-REVIEW-2026-11-23.md) §Recommended execution sequence. This is an evidence-led status report on current `main`, **not** an acceptance sign-off, a fresh implementation pass, or a production audit.

## 1. Evidence standard and status vocabulary

Statuses are kept deliberately separate. "The code exists" is not "the gate passed", and neither is "the release is verified".

| Status | Meaning |
| --- | --- |
| **Implemented** | Code present on `main` with a test file covering the contract. |
| **Locally verified** | Repeatable automated gate passed on local `main`, with command and result recorded in §3. |
| **Manually verified** | Documented live-browser or manual check performed on `localhost` only (source: [ISSUE_9_E2E_REPORT.md](ISSUE_9_E2E_REPORT.md)). |
| **Blocked** | Cannot be executed in this environment, or needs an external/maintainer action or disposition. Not a passed gate. |
| **Release-verified** | Passed against the deployed Render environment. No criterion in this report has this status. |

A criterion may carry several statuses at once (for example implemented + locally verified + manually verified). The **Boundary** column states what is *not* established.

## 2. Baseline audited

- Local `main` = `3f99f8099b7c0f427d832346f20fdc243862b6a7` (docs/tracking only); code baseline `c7a40dc1890b80f79db4d108e4bd5011f7173ee4`. GitHub and Codeberg `main` both at `3f99f80`.
- Route table: [src/app-routes.tsx](src/app-routes.tsx) with executable assertions in [src/app-routes.test.tsx](src/app-routes.test.tsx).
- Semantics: `trope_graph` is ontology authority; server-side projections are authoritative; account identity/participation stays in `public`; discovery candidates are not sources/evidence; research session is not the authentication session. No semantic change was made in this slice.

## 3. Gate results on current `main`

All commands run from the repo root on `3f99f80`. "Local" means this machine; no deployed checks were run.

| Command | Result | Boundary |
| --- | --- | --- |
| `pnpm run typecheck` | pass | local |
| `pnpm run test:ui` | **803 pass / 0 fail** (217 suites) | local |
| `pnpm run test:server` | **189 pass / 0 fail** (48 suites) | local |
| `pnpm run trope-graph:test` | **506 pass / 0 fail** (112 suites) | local, no DB required |
| `pnpm run trope-graph:validate` | pass, `errors: []` | DB checks skipped — no `TROPE_GRAPH_DATABASE_URL` / `DATABASE_URL` |
| `pnpm run typecheck:graph` | pass | local |
| `pnpm run build` | pass (chunk-size warning only) | local |
| `pnpm run lint` | 1 pre-existing warning — `src/sources/research-metrics.tsx:8` `noUnusedImports` | local; not in changed files |
| `pnpm run trope-graph:check -- --allow-remote` | **BLOCKED** — `No database connection string found. Set TROPE_GRAPH_DATABASE_URL, or DATABASE_URL to share the host application's connection.` | aborts at `migrate:check` before `verify` / `check-drift` |

The graph blocker is an environment limitation, not a regression: the DB-dependent steps (`migrate:check`, `verify-seed`, `check-drift`) could not run, while the DB-free steps (`validate`, `typecheck:graph`, `test`) did run and passed. The E2E report records the sanctioned local path as `just graph-check` with `TROPE_GRAPH_DATABASE_URL` exported.

## 4. Criterion-by-criterion reconciliation

Definitions of done are quoted from Issue #9.

| # | Definition of done | Status | Evidence | Boundary / not established |
| --- | --- | --- | --- | --- |
| 1 | New Deck canonical at `/` | Implemented; locally + manually verified | `APP_ROUTES` maps `/` → `Deck` ([app-routes.tsx:54](src/app-routes.tsx)); assertion `renders the canonical discovery deck at the root` ([app-routes.test.tsx:46](src/app-routes.test.tsx)); deck unit tests (`deck-model`, `deck-workspace`, `use-deck`, `card-navigation`, `featured-card`, `research-tray`, …); E2E report §3 three-face card shell, keyboard, reduced motion and responsive checks | Not release-verified; no deployed route check |
| 2 | Old flat Deck retained only at the legacy reference route | Implemented; locally verified | `/legacy/deck` → `LegacyDeck` ([app-routes.tsx:55](src/app-routes.tsx)); `LegacyDeck.tsx` header comment marks it preserved for comparison; assertions at [app-routes.test.tsx:50](src/app-routes.test.tsx) and `:92` confirm the route resolves the legacy component and is absent from `NAV_ENTRIES` | No manual browser check recorded for the legacy page; not release-verified |
| 3 | Explore is functional | Implemented; locally verified; manually verified (smoke) | `Explore.tsx` + `src/explore/*` with `explore-model`, `explore-filters`, `search-field`, `result-card` tests; E2E report Additional Test 3 records `/explore` loading "47 cards" with "Read card" links on `localhost` | Full surface acceptance (search/filter semantics, context preservation) still outstanding per ROADMAP Milestone 3; not release-verified |
| 4 | Graph remains canonical | Implemented; locally verified; **blocked** at full gate | `trope_graph` schema, server projections, `Graph.tsx`, `src/graph/*`; `projection-guards` guards the wire contract; `trope-graph:test` 506/506 and `typecheck:graph` pass (§3) | `trope-graph:check` blocked by missing DB URL (§3); interaction/route/responsive/keyboard acceptance for Graph Explorer still open; not release-verified |
| 5 | Compose / Decompose is functional | Implemented; locally verified | `/research/compose` → `Compose` ([app-routes.tsx:58](src/app-routes.tsx)); `src/compose/*` with `compose-model`, `compose-projector`, `compose-editor`, `draft-types`, `use-compose` tests | End-to-end draft workflow, explicit persistence and permission rules not accepted (ROADMAP Milestone 4); no manual browser check; not release-verified |
| 6 | Research Workspace is functional | Implemented; locally verified; manually verified (load) | `Research.tsx` + `src/research/*`; `research-session`, `research-workspace-panel`, `session-envelope`, `session-state` tests pin focus-reference identity and parsing; E2E report Test 3 records `/research` loading with disclaimer and session rail | Full graph/card/source/composition context integration not accepted (ROADMAP Milestone 5); not release-verified |
| 7 | Sources is functional and provenance-first | Implemented; locally verified; manually verified | `Sources.tsx` + `src/sources/*`; `source-model`, `source-index-panel` tests; E2E report Test 3 records `/sources` loading with canonical index and attribution counts, and §2 records reviewed candidate promotion with DB assertions (`sources` = 3, `evidence_items` = 0) | Discovery-review UI, Research Metrics UI, pagination and provider decisions remain (Issue #12); no deployed check |
| 8 | Account participation integrated without contaminating ontology semantics | Implemented; locally verified; manually verified | Saved cards, account panels, avatar, verification/email-change, research preferences and sign-in/out with tests across `src/account`, `src/auth`, `src/components/account`, `src/hooks`, `src/research`; E2E report §1 Save Card flow and Test 4 sign-out + returnTo context | Feedback/academic-participation delivery is undefined (Issue #15) — no account consent should be persisted for it; avatar cross-device persistence not separately audited here; not release-verified |
| 9 | Routes share the Figma-aligned visual system | Implemented; locally verified; **blocked** on Figma reconciliation | Unified theming across pages with `unified-theming`, `button-theming`, `selected-control-theming`, `typography-decision`, `settings-parity`, `page-shell` tests; theming fix commits on current history | Figma frame reconciliation still open — E2E report records Starter-plan node-read quota lockout (MCP unreachable); ROADMAP states visual differences are not automatically defects; no design sign-off; not release-verified |
| 10 | Responsive/accessibility requirements met | Implemented; locally verified; manually verified (Deck only) | A11y/responsive assertions in `deck/drawer-a11y`, `deck/card-navigation`, `explore/*`, `graph/graph-controls`, `compose/compose-editor`, `sources/source-index-panel`, account panels; E2E report §3 records card-shell keyboard/reduced-motion and 375px/1280px checks; screenshots at 320/375/768/1024/1280/1440/1920px in `docs/issue-9/screenshots/` | ROADMAP requires global mobile navigation/drawer acceptance against tracked criteria, not inferred from Deck screenshots; surface-by-surface responsive/keyboard acceptance for Explore, Compose, Research, Sources and Graph remains outstanding; not release-verified |
| 11 | Verification green or remaining pre-existing failures explicitly documented | Partially locally verified; **blocked** items documented | §3: typecheck, 803 UI, 189 server, 506 graph, graph validate, graph typecheck, build all pass; 1 pre-existing lint warning identified; `trope-graph:check` blocker and pre-existing failures documented in E2E report §Remaining blockers | Not all gates green: graph integrity blocked by DB env, Render checks not run, Figma reconciliation open, in-card `MalformedState` live-browser case incomplete; no release verification |

## 5. Roll-up by status

- **Release-verified:** 0 / 11 criteria. No deployed Render check has been run; local success is explicitly not production acceptance.
- **Manually verified (localhost only):** criteria 1, 3, 6, 7, 8, 10 — recorded in the E2E report, not repeatable in CI.
- **Locally verified (automated):** criteria 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, and partially 11, on the gate results in §3.
- **Implemented but not fully accepted:** criteria 3, 4, 5, 6, 7, 9, 10 — foundations and unit contracts exist; surface-by-surface acceptance is still open per ROADMAP Milestones 3–6.
- **Blocked:** criterion 4 (graph DB gate), criterion 9 (Figma reconciliation), criterion 11 (blocked gates listed above), plus the in-card `MalformedState` live-browser case recorded as not triggerable with the current browser-tooling constraint.
- **Accepted:** none. Issue #9 stays open.

## 6. Dispositions required before sign-off

Each item needs completed evidence or an explicit maintainer acceptance as an open follow-up:

1. `trope-graph:check` with a valid DB connection (`just graph-check` with `TROPE_GRAPH_DATABASE_URL` exported) — graph gate and drift validation.
2. Deployed Render checks — migrations, runtime, health/auth behaviour in the deployed environment.
3. Figma frame reconciliation for the deck/card/explore/compose/research frames.
4. In-card `MalformedState` live-browser case — current tooling cannot abort a projection URL with query strings; code inspection + unit tests are the available evidence.
5. Global mobile navigation/drawer acceptance and surface-by-surface responsive/keyboard/accessibility sign-off for Explore, Compose, Research, Sources and Graph.
6. End-to-end acceptance of Compose draft persistence/permissions, Research context integration, and Sources discovery-review/metrics UI (Issue #12) before their milestones can be called accepted.
7. Provider-cache purge, Codeberg cache confirmation and stale-clone inventory from the history-rewrite follow-up (`as-truth-cards-zs3`) — security follow-up, not a product criterion, but still blocking a clean close of #9.

## 7. Out of scope for this slice

No code, route, schema, styling or test behaviour was changed. Issue #14 (narrative/three-face) and Issue #13 (avatar/Save Card gate/return context) verification-only audits remain separate next slices, per the maintainer's sequence. This report does not close #9, accept any milestone, or establish release readiness.
