# Issue #9 — acceptance dispositions (2026-11-23)

Prepared for [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) and bead
`as-truth-cards-4xq`. This advances the seven dispositions listed in
[docs/ISSUE_9_SHELL_RECONCILIATION.md](ISSUE_9_SHELL_RECONCILIATION.md) §6. It is a
status record with evidence, **not** an acceptance sign-off.

Statuses stay separate (same vocabulary as the reconciliation): **implemented**,
**locally verified**, **manually verified**, **blocked**, **release-verified**.
No criterion is promoted to release-verified here, and Issue #9 stays open.

## Baseline and environment

- Local `main` at `207bc9e8ed0414e1f5e00bded17b33155ddd5ef2`; GitHub `origin/main`
  and Codeberg `codeberg/main` both matched before this change.
- Node `v24.10.0`, pnpm `11.8.0`, Linux.
- A local Postgres (`postgresql:///trope_cards_dev`) is available, so the sanctioned
  `just graph-check` path could run against a loopback database. The live Neon URL in
  `.env` was deliberately **not** used: the full graph check includes `verify-seed`,
  which writes to its target and refuses non-loopback URLs.
- Figma access is restored: `whoami` succeeds, `create_session` + `get_metadata` work.
  The earlier Starter-plan node-read lockout recorded in `ISSUE_9_E2E_REPORT.md` is no
  longer in effect. Short-lived screenshot URLs are not reproduced here.

## Disposition 1 — `trope-graph:check` with a valid DB connection

**Status: locally verified (green).** This was previously blocked; the blocker is
resolved using the local dev database, not the remote Neon endpoint.

Command (from the justfile, which exports `TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev`):

```
just graph-check
```

Result: exit 0. Sub-gates:

| Sub-gate | Result |
|---|---|
| `migrate:check` | `Applied 0: (none)`; `Skipped 18` migrations (0001–0018); `--check: no changes written.` |
| `validate` (4 scripts) | `errors: []` for all four |
| `typecheck:graph` (`tsc -p trope-cards/tsconfig.json`) | pass |
| `verify-seed` | `idempotent: true`, `errors: []`, all 19 expected row counts; 2 documented warnings (23 unbound claims, 34 cards without claims) |
| `trope-graph:test` | 577 tests, 577 pass, 0 fail, 0 skipped |
| `check-drift --allow-remote` | `drift: false`, 484 compared facts |

Note: with a database present, `trope-graph:test` runs 577 tests (the DB-free runs
recorded elsewhere report 506); the additional 71 are DB-backed cases that now execute.

**Boundary:** local loopback database only. This does not verify the deployed Neon
migration state, and it is not a release gate.

## Disposition 2 — deployed Render checks

**Status: manually verified (public read-only probes).** Migrations were not directly
observable over HTTP; startup behaviour is inferred from `render.yaml`.

Public GETs against `https://as-truth-cards.onrender.com` (read-only):

| Request | Result |
|---|---|
| `GET /health` | HTTP 200, `{"status":"ok"}` (68 s — cold start) |
| `GET /` | HTTP 200, served SPA HTML (`<!DOCTYPE html>`, `<meta name="viewport" …>`) |
| `GET /api/graph/cards?limit=1` | HTTP 200, live graph JSON (`items[].slug = anc-hamas-equivalence`, …) |
| `GET /api/saved-cards` | HTTP 401, `{"error":"Sign in to view saved cards"}` |

**Boundary:** health, runtime and the unauthenticated account gate are confirmed on the
deployed host. Migration application on Render was not directly observed (the start
command in `render.yaml` runs `db:migrate:deploy` and `trope-graph:migrate -- --allow-remote`,
and the graph API returning live data is consistent with a healthy DB). No authenticated
deployed flow, no write operation, and no release-acceptance sign-off was performed.

## Disposition 3 — Figma frame reconciliation

**Status: partially advanced; design sign-off still blocked.** Figma is reachable again,
so the previous "MCP unreachable / quota lockout" blocker no longer applies. This slice
inventoried the file, reviewed the five named surfaces with a read-only vision sub-agent,
and identified both alignment and divergence. It does **not** declare visual parity.

Frame inventory (`get_metadata` on page `0:1`): 36 top-level frames. Relevant node ids:

| Surface | Frame | Node |
|---|---|---|
| Deck | Deck / Shuffle | `7:4434` (plus treatments `12:1446` / `12:1644` / `12:1841`) |
| Card | Card Detail — Front / Back | `7:4617` |
| Explore | Explore / Browse | `7:4787` |
| Compose | Compose / Decompose | `7:5057` |
| Research | Research Workspace | `7:5265` |
| Graph | Graph Explorer — Atmospheric / Editorial / Workspace | `38:3` / `38:168` / `38:332` |

Fresh captures were taken with `get_screenshot` (max edge 1280) and are preserved at
`docs/issue-9/screenshots/figma/current-2026-11-23/`. They were reviewed by the mandated
read-only vision sub-agent (`nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b`).

**What the frames establish (vision observations):**

- Deck: dark "Discover" page — global nav, research disclaimer, left rail ("Your decks",
  "Browse categories / CLASSIFICATION ONLY"), centre card with Read front & back / Read
  analysis / Save card, right rail ("In your research tray", "Before you connect"),
  Previous / `1 / 8` / Shuffle next.
- Card: three-up front/back detail (working claim | inquiry & limits | classification),
  an ANALYSIS strip with a "Narrative Analysis" state, provenance/evidence below, and
  Back to claim / Back to front / Explore in graph / Save card.
- Explore: filter rail (type, status, period, tags), search + sort + tab chips, entity
  table (ENTITY / TYPE / EPISTEMIC STATUS / PERIOD / LINKS), selection bar.
- Compose: research-elements rail, composite card with attached elements and constituent
  map, card preview with "Publish unavailable" review notes.
- Research: investigation rail, research brief, cards in workspace, working note, and
  open-questions / source-leads / connections rails.

**Material differences from the current local app (vision observations):**

- Figma Deck is a dark three-column "Discover" page with left and right rails; the local
  Deck is a light-themed "Decks" index with an Appearance control, 47 cards and no rails.
- Figma Card is a three-panel front/back detail; the local card is a single-card flip with
  Cover / Claim / Analysis faces (including the newly verified narrative region).
- Figma shows `1 / 8` illustrative cards; the live graph returns 47 cards.

Per `ROADMAP.md`, "visual differences are not automatically defects." These are recorded
as divergences requiring a maintainer design decision (align, adapt, or accept), **not**
as bugs found by this slice. No design sign-off is claimed.

The maintainer has accepted the `1 / 8` vs 47-card count as illustrative (no action).
Detailed Deck and Card differences, divergence classifications and concrete
align/adapt/accept options are in
[docs/ISSUE_9_FIGMA_DIVERGENCE_DESIGN_NOTE.md](ISSUE_9_FIGMA_DIVERGENCE_DESIGN_NOTE.md);
Deck and Card decisions remain pending. The 375px heading overlap seen in October
screenshots is resolved by `pt-24` and is not an open defect.

## Disposition 4 — in-card `MalformedState` live-browser case

**Status: blocked (tooling) with code + unit evidence.** A query-string projection URL
cannot be aborted by the available browser tooling, so the live failure injection
described in `ISSUE_9_E2E_REPORT.md` remains unreproducible here.

Available evidence: `MalformedState` is implemented in `src/deck/featured-card.tsx`,
`src/pages/Explore.tsx`, `src/pages/Compose.tsx` and `src/graph/graph-workspace.tsx`,
with unit coverage in `src/graph/graph-states.test.tsx`. The whole-suite run is green.

**Boundary:** code inspection + unit tests only; no live aborted-request observation.

## Disposition 5 — mobile nav + surface-by-surface responsive/keyboard/a11y

**Status: partially advanced (Deck visual only); broad sign-off open.**

New evidence: current local screenshots at 375px and 1024px were captured from the
running app on this commit and reviewed read-only by the vision sub-agent. They are at
`docs/issue-9/screenshots/current-2026-11-23/`.

- The heading/nav and heading/chip overlap reported from the **old** Oct-2026 screenshots
  is **not present** in the current captures at either viewport. The shared `pt-24` top
  offset that clears the fixed header was added on 2026-11-16 in commit `4e44325`, after
  those old captures — so the earlier finding is stale, not an open defect.
- Current 375px: single-column reflow, no horizontal clipping, controls reachable.
- Current 1024px: no overlap, clipping, misalignment or low contrast observed.
- The 375px capture shows the footer line cut at the **image boundary**; this is a
  viewport-only capture artifact (the footer sits below the fold), not a layout defect.

Existing automated coverage: `src/deck/drawer-a11y.test.tsx`, `deck-workspace`,
`card-navigation`, plus tests under `explore`, `graph`, `compose`, `sources`.

**Boundary:** only the Deck surface received a fresh visual look. Live keyboard tab order,
focus visibility, and surface-by-surface responsive/a11y acceptance for Explore, Compose,
Research, Sources and Graph remain open. No gate is signed off.

## Disposition 6 — E2E acceptance of Compose / Research / Sources

**Status: blocked (acceptance); foundations implemented and unit-tested.**

Unit-test files exist: `src/compose` (5), `src/research` (2), `src/sources` (2),
`src/explore` (4), `src/graph` (12). `src/graph/graph-states.test.tsx` covers
`MalformedState`. These pin contracts, not end-to-end workflows.

**Boundary:** no live accepted run of Compose draft persistence/permissions, Research
context integration, or Sources discovery-review/metrics UI. Issue #12 remains the
owner of the Sources discovery/metrics work. Milestones 4–6 are not accepted.

## Disposition 7 — history-rewrite external follow-ups

**Status: inventory completed 2026-11-23; provider purge and operator replies blocked
(external), tracked in `as-truth-cards-zs3`.**

The stale-history inventory was completed from this repository: GitHub forks=0, GitHub
Actions caches=0, one closed PR, no live branch reaches the old commit; Codeberg
forks=0, only `main`, no Actions; only the working local clone references this repo and
it contains no object/ref/reflog entry for the old commit. Status-only probes show the
old SHA's HTML view still returns HTTP 200 on both providers (GitHub API 200, Codeberg
API 404), so cached views remain. See
[docs/SECURITY-HISTORY-CLEANUP-DECISION-PACKAGE.md](SECURITY-HISTORY-CLEANUP-DECISION-PACKAGE.md)
§12 for the command/result table and ready-to-submit contact drafts.

Still blocked: filing the GitHub Support purge ticket (portal-only, no REST endpoint;
no ticket ID exists), Codeberg operator confirmation, and any third-party clone cleanup.
These are security follow-ups, not product criteria, but still block a clean close of #9. Disposition posted to Issue #9 as comment `7093630086`.

## Roll-up after this slice

| # | Disposition | Status now |
|---|---|---|
| 1 | Graph DB gate | locally verified (green via `just graph-check` on local DB) |
| 2 | Deployed Render checks | manually verified: health, runtime, public graph API, 401 auth gate |
| 3 | Figma reconciliation | access restored, frames inventoried and reviewed; divergences recorded; design sign-off open |
| 4 | MalformedState live case | blocked (tooling); code + unit evidence |
| 5 | Responsive / keyboard / a11y | Deck fresh visual check clean (stale defect resolved); other surfaces open |
| 6 | Compose / Research / Sources E2E | blocked (acceptance); unit contracts exist |
| 7 | Cache purge / stale clones | inventory completed; purge/operator replies blocked (external), `as-truth-cards-zs3` |

**Release-verified criteria: still 0 / 11.** No milestone is accepted, Issue #9 remains
open, and nothing here establishes release readiness. Items requiring maintainer action or
acceptance (3, 4, 5, 6, 7) are explicitly left open rather than marked passed.
