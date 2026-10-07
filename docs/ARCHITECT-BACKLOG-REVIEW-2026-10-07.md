# Architect backlog review — beads + GitHub (2026-10-07)

**Audience:** architect / maintainer  
**Product name:** Trope Cards (repo still `ubuntupunk/as-truth-cards`)  
**Sources:** `bd list` (20 open / 8 closed), GitHub issues #3 #4 #6, codebase verification on `main` @ `853236c`  
**Context:** Issue #3 has been the long engagement thread (22 comments). Graph projection + Graph Explorer UI (slices 1–4 + presentation corrections) are on `main`. Many beads date from Feb–Mar 2026 and predate that work.

---

## Executive verdict

| Tracker | Verdict |
|---|---|
| **GitHub #3** | **Functionally delivered** for the authorised v1 scope (projection API, views, Cytoscape consumer, Graph Explorer). Still OPEN as a mega-thread. Prefer **close #3** and open a **new focused issue** for remaining graph/product work. |
| **GitHub #4** | **Superseded / closable.** Render is canonical (`render.yaml`, README, service `trope-cards`, no Vercel). Residual deploy hygiene lives in beads (`gcg`, `z7n`, ops note `gvn`). |
| **GitHub #6** | **Likely closable after spot-check.** Locale schema (`0009_locales.sql`), seed, and projection dimensions exist. Remaining locale *product* work is browse/curation (`as-truth-cards-572`), not “add Locale”. |
| **bd open set** | ~**10 of 20** are stale or already done in code. ~**7** remain real. **1 P1 security item** (`skw`) is still urgent and unrelated to #3. |

---

## Recommended disposition of GitHub issues

### Close #3 — with a closing comment that points to a successor

**Delivered under #3 (evidence on `main`):**

- Read-only `GET /api/graph` + `GET /api/graph/views` over `trope_graph` (Drizzle reader, on-demand projection).
- Views include at least `card-argument-taxonomy`, `taxonomy`, `argument`, `evidence`, `identity-retrojection`.
- Thin Cytoscape presentation adapter; Graphology kept out of React as analysis consumer.
- Graph Explorer UI: URL-driven focus/view/depth, inspector, provenance/evidence empty states, facet filters, Figma-aligned shell + appearance treatments; Suit label correction (`south-africa` → “South Africa”).
- Ontology decisions Q1–Q10 recorded in the issue thread and largely reflected in code/docs.
- Closed beads covering UI slices: `xcq`, `ouc`, `qov`, `4gq`; also `4lm` (B1 Concept population).

**Explicitly out of #3 / still open (do not keep stuffing into #3):**

| Item | Bead | Nature |
|---|---|---|
| Focus/card discovery / locale→suite browse | `572` | Product + API (not `/api/graph` writes) |
| Type-qualified `GraphNode.id` | `2bq` | Contract decision |
| `relationships` RI hardening | `o1t` (B3) | Schema later (Q5: defensive now) |
| Status vocabulary documentation | `cn3` (B4) | Docs / ADR completeness |
| Competing claim→source paths | `lpp` (B5) | Ontology when evidence corpus grows |
| Inert nav: Explorer / Research / Sources | — | Product surfaces not started |
| Retire `public.cards` | — | Transitional host deck (Q8) |

### Proposed new GitHub issue (draft title)

**Trope Cards — post–Issue #3 graph & research surfaces**

Suggested body outline:

1. **Done under #3** (link closing comment / commits).
2. **In scope for this issue:**
   - Read-side card/locale browse for suite curation (`572`); keep `/api/graph` write-free.
   - Decide `GraphNode.id` qualification (`2bq`) at the contract layer.
   - Document B4 status decoupling (`cn3`); schedule B3/B5 only when corpus needs them.
   - Product placeholders: Explorer / Research / Sources (or explicitly defer).
3. **Out of scope:** schema redesign for polymorphic `relationships` until vocabulary stabilises; reviving `public.cards` as canonical; deploy/auth rewrites.
4. **Link beads:** `572`, `2bq`, `cn3`, `o1t`, `lpp`.

### Close #4

Objective (“Render sole production target”) is met. Leave follow-ups as beads (`gcg`, `z7n`) or a small deploy-hardening issue if preferred.

### Close or verify-close #6

Locale is first-class in schema/seed/projections. Closing comment should state that **curation UX** moves to the successor issue via `572`, not a second “add Locale” schema task.

---

## Bead-by-bead triage

### Close as done / superseded (code verified)

| ID | Title | Evidence |
|---|---|---|
| `8w3` | Add API routes for CRUD | `server/api/cards.ts` GET/POST/PUT/DELETE; `interactions.ts` |
| `661` | Connect Admin to database | `Admin.tsx` uses React Query → `/api/cards` |
| `n91` | Prisma Client Setup & Migration… | Prisma + Better Auth `User` model live; request is obsolete (Prisma 5, not 6; no Stack Auth `/api/auth/user-role`) |
| `1te` | `.issues/prisma-setup.md` | Leftover tracker pointer; work absorbed by host auth/DB path |
| `o59` | Remove `.next/` | No `.next/` in tree |
| `0vp` | Fix dynamic Tailwind `rotate-` in CardDeck | Inline `transform` styles in `CardDeck.tsx` |
| `bc1` | Card voting/rating UI | `Card.tsx` thumbs + `RATING_UP`/`RATING_DOWN` → `/api/interactions` |
| `jr2` | Add `&&` on live Render `buildCommand` | Live service: `pnpm install --frozen-lockfile && pnpm run build` |
| `7pn` | B2 — fate of `claim_relations` | GH #3 Q1 = KEEP + populate; `seed/claimRelations.ts` + seeder + `verify-seed` expects 5 rows. **Close** after confirming ADR/design § notes match; not “0 rows / no writer” anymore. |

### Reclassify as accepted ops decision (not active engineering)

| ID | Title | Notes |
|---|---|---|
| `gvn` | Free plan skips `preDeployCommand` | Explicitly **decided** 2026-10-05: stay on free; manual migrate/seed documented in README + `render.yaml`. Close as “accepted risk” or convert to a non-blocking ops checklist, not a P1 build task. |

### Still valid — keep

| ID | P | Title | Notes |
|---|---|---|---|
| **`skw`** | **P1** | Rotate production Neon `DATABASE_URL` | Credential in git history + local `.env` + transcript. **Independent of #3. Do first.** |
| `2bq` | P2 | Type-qualify `GraphNode.id`? | Undecided contract question; Cytoscape silent-merge risk documented. |
| `572` | P2 | Locale → suite browse (read-side) | Correct next product gap after Explorer shell. |
| `gcg` | P2 | Production start depends on `tsx` (devDep) | Still true; Render installs devDeps today. Cheap fix: move `tsx` to `dependencies`, or compile server. |
| `z7n` | P2 | Empty `TROPE_GRAPH_DATABASE_URL` treated as set | Still `??` in `url.ts`; empty string does not fall through. Small fix + test. |
| `o1t` | P2 | B3 — harden `relationships` RI | Projection whitelists CARD↔CARD; schema still polymorphic. Per Q5: later. |
| `cn3` | P2 | B4 — document status decoupling | Decision exists in #3 Q4; bead is about **durable ADR/docs** completeness. |
| `lpp` | P2 | B5 — competing claim→source paths | Blocks clean evidence-view authority when corpus grows; 0-row tables limit urgency. |
| `g66` | P2 | `typecheck:all` host UI errors | Still fails (~10 errors: Preact/`React` namespace, BadgeProps, sheet/sidebar unions). Unrelated to graph. |
| `1nh` | P2 | Error boundaries / loading on routes | No `ErrorBoundary` in `src/`; Graph has local states, rest of app does not. |

---

## Issue #3 engagement summary (for closing comment)

Chronology compressed from GH comments + closed beads:

1. **Ontology lock** — Q1–Q10 decisions; Locale prerequisite (#6); Graphology ephemeral; Cytoscape presentation-only.
2. **Projection v1** — domain projection + `/api/graph`; invariants tested; B1 Concept population later closed (`4lm`).
3. **UI plan** (`PLAN-graph-explorer.md`) — slices 1–4 landed (`xcq` → `ouc` → `qov` → `4gq`); presentation corrections `9f24c9f`.
4. **Still deferred by design** — discovery listing (`572`), id qualification (`2bq`), schema hardening B3/B5, host-deck retirement.

Keeping #3 open encourages drive-by scope expansion into a thread that already holds architecture decisions + implementation reports. A clean successor issue is healthier for review.

---

## Priority order for the architect

1. **Security:** action `skw` (rotate Neon; update Render env; stop local `.env` pointing at prod).
2. **Tracker hygiene:** close superseded beads in the “done” table; close or reclassify `gvn`; close GH #4 (and #6 after Locale spot-check); close GH #3 with successor issue.
3. **Next product work:** open successor issue; start with `572` (browse) and/or `2bq` (contract decision).
4. **Small hygiene:** `z7n`, `gcg`, `g66`, `1nh` as parallel cleanup, not graph-ontology blockers.
5. **Defer:** `o1t` / `lpp` until evidence/relationship corpus pressure appears; host `public.cards` retirement as its own milestone.

---

## Suggested bead actions (if approved)

```text
CLOSE: 8w3, 661, n91, 1te, o59, 0vp, bc1, jr2, 7pn (reason: implemented / superseded)
CLOSE: gvn (reason: accepted free-tier ops decision; documented)
KEEP:  skw, 2bq, 572, gcg, z7n, o1t, cn3, lpp, g66, 1nh
GH:    close #3 → open successor; close #4; verify-close #6
```

## Actions applied (2026-10-07)

- Closed beads: `8w3`, `661`, `n91`, `1te`, `o59`, `0vp`, `bc1`, `jr2`, `7pn`, `gvn`.
- Opened GitHub **#7** — [Trope Cards — post–Issue #3 graph & research surfaces](https://github.com/ubuntupunk/as-truth-cards/issues/7).
- Closed GitHub **#3**, **#4**, **#6** with linking comments.
- Remaining open beads: `skw`, `2bq`, `572`, `gcg`, `z7n`, `lpp`, `cn3`, `o1t`, `g66`, `1nh`.

---

## Appendix — tracker counts (after actions)

- **bd open:** 10 (`skw` P1 + nine P2)  
- **GH open:** [#7](https://github.com/ubuntupunk/as-truth-cards/issues/7) only  
- **GH closed this pass:** #3, #4, #6  
- **Render:** service display name `trope-cards`; hostname still `https://as-truth-cards.onrender.com`; project display name still “As Truth Cards” (dashboard-only rename)
