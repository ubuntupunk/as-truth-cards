# Architect Report: `trope-cards` and its integration into the as-truth-cards stack

**Date:** 2026-09-27
**Commit base:** `821ba44` (`main`, in sync with `origin/main`)
**Purpose:** Brief the project architect on the newly-added `trope-cards/` subsystem, its
current state, and the decisions required before it can be integrated into the host
application. Written to be used as the basis for supervision instructions.

**How to read this document.** Every factual claim below was verified against the working
tree, the database, or the build at the commit base. Claims that are *interpretation* or
*recommendation* are marked as such. Where something is unknown, it is stated as unknown
rather than guessed. Section 8 lists the decisions that need an architect's ruling.

---

## 1. Executive summary

`trope-cards/` is a new, self-contained **knowledge-graph subsystem** for the Truth Cards
platform. It models *how* antisemitic tropes work — mechanisms, concepts, claims, inferences,
argument chains, and evidence — rather than simply displaying them as flat cards.

It arrived as nine loosely-related archives (v0.1–v0.9) and has since been consolidated into
one directory with a single hand-written migration history, a transactional seeder, four
validators, an idempotency verifier, and a structural schema-drift checker. The subsystem is
**internally complete and currently green**, and it is **completely disconnected from the host
application** — it has no API surface, no UI, and is not in the frontend bundle.

The central architectural fact: **the host's data model and the graph's data model share
almost nothing.** The host stores flat display cards; the graph stores a normalized 36-table
network. Nothing currently maps between them, and `PRD.md` / `SPEC.md` do not mention tropes at
all. Integration is therefore greenfield work, not an incremental wiring job.

There are also two pre-existing host issues (an unauthenticated write API, and a failing
`typecheck:all`) that will affect any plan which puts curated content behind the existing
admin UI. These are detailed in Section 7.

---

## 2. The repository contains two systems, not one application

This is the most important thing to understand before issuing instructions. The repository has
two largely independent halves that share a git repo, a package manifest, and a database
server — and almost nothing else.

| | **Host application** | **`trope-cards/` graph** |
|---|---|---|
| Runtime | Vite SPA + Express API | CLI / server-side tooling only |
| Framework | Vite 5, React 18 | `tsx`, plain Node scripts |
| API | Express 4 (`server/`) | **none** |
| ORM | Prisma 5 | Drizzle (`pg` driver) |
| Schema | `public` | `trope_graph` |
| Migrations | `prisma/sql/*.sql` (3 ad-hoc files) | `trope-cards/drizzle/*.sql` (7 files, hand-run) |
| Seeding | `tsx server/seed.ts` | `trope-cards/src/db/seed/run.ts` |
| Tests | none | `trope-graph:check` (5-stage gate) |
| Bundled to frontend | yes (`dist/`) | **no** — verified absent from build output |
| Deployed | Render (`render.yaml`) | not deployed |

Verified: `rg 'trope_graph|TropeGraph' dist/` returns nothing. The graph does not currently
exist at runtime for any user. It is a build-time and authoring-time asset only.

### 2.1 `AGENTS.md` is materially inaccurate

**The architect should not trust `AGENTS.md` as a description of the repo.** It states the
project is "Next.js", with "Stack" authentication and "shadcn-ui". Verified reality:

- **Not Next.js.** It is Vite + React with a separate Express server. `next` is not a
  dependency. The only reason it looks Next-ish is that some shadcn components and the
  Stack Auth client hook were copied from Next.js projects.
- **Stack Auth is a real dependency** (`@stackframe/stack ^2.8.78`) but is wired
  **client-side only** — see Section 7.1. `AGENTS.md`'s implication of server-enforced
  auth is wrong.
- **The Prisma models do not match `AGENTS.md`'s description either** — see Section 3.1.

`AGENTS.md` also instructs agents to run `npm run test` and `npm run lint`; neither script
exists. The real commands are in `package.json` (Section 6).

---

## 3. The host application today

### 3.1 Data model is flat and card-shaped

`prisma/schema.prisma` defines three models and one enum:

- **`Card`** — `id Int autoincrement`, `title`, `frontDescription`, `backDescription`,
  `symbol`, `imageUrl?`, `tags String[]`, `includedInPalestineStack Boolean`,
  `isFeatured Boolean`, `sources Json?`. Maps to table `cards` in schema `public`.
- **`UserProfile`**, **`UserInteraction`** — user state; `UserRole` enum with
  `ANONYMOUS` / `VERIFIED` (and an `ADMIN` value added by `prisma/sql/add_admin_role.sql`).

A host card is a *display unit*: a front (the trope), a back (the debunk), a symbol, and some
tags. It is exactly the shape the PRD describes. It has **no** concept of a mechanism, a
claim, a premise, a conclusion, or a source with provenance.

### 3.2 API surface

`server/index.ts` mounts two routers and a health check, serves `dist/` in production, and
listens on `PORT` (default 3001) with permissive CORS.

- `GET/POST /api/cards`, `GET/PUT/DELETE /api/cards/:id`
- `GET/POST /api/interactions` (routes in `server/api/interactions.ts`)
- `GET /health`

**There is no `/api/auth/*` router at all.** See Section 7.1.

### 3.3 Frontend

`src/pages/`: `Index`, `About`, `Admin`, `NotFound`.
`src/components/`: `CardDeck`, `Card`, `Header`, `Footer`, `ThemeProvider`, `ThemeToggle`,
`admin/`, and a shadcn-derived `ui/` directory. `src/hooks/useAdminCheck.ts` gates the admin UI.

The build is healthy: `pnpm run build` → `✓ built in 20.40s`.

### 3.4 Host migration state is inconsistent

`db:migrate` is `prisma migrate dev`, but there is **no `prisma/migrations/` directory**.
The actual applied SQL lives in `prisma/sql/` (3 files) and is not managed by the Prisma CLI:

```
prisma/sql/001_create_user_profiles.sql
prisma/sql/add_admin_role.sql
prisma/sql/set_admin_user.sql
```

`prisma migrate dev` against this state would likely attempt to reconcile drift or fail.
**Recommendation:** resolve this before adding a second migration system to the repo. It is
adjacent to the integration work but will be hit by anyone who runs the documented command.

---

## 4. The `trope-cards/` subsystem

### 4.1 What it is for

The host answers *"what is this trope, and what is the debunk?"*. The graph answers the
questions the host cannot: *what mechanism of operation does this trope rely on, which
specific claims does it make, how do those claims combine into an inference, and what is the
source provenance for each one?*

That is a meaningful upgrade in epistemic quality — a card asserting a debunk is weak
evidence; a graph showing a documented inference chain with located sources is strong. The
architecture in `trope-cards/docs/` argues this case in detail (13 documents, listed in 4.5).

### 4.2 Layout

```
trope-cards/
  README.md                  Canonical: layout, setup, commands, safety, current state
  docs/                      13 design documents (see 4.5)
  drizzle/                   7 canonical SQL migrations, hand-written
  drizzle.config.ts          Drizzle Kit config (output dir is gitignored/generated)
  drizzle-kit/generated/     DERIVED — gitignored, regenerable, never canonical
  src/db/
    client.ts  url.ts  migrate.ts  migrate-cli.ts
    schema/                 Drizzle table definitions
    seed/                   taxonomy, draftCards, claimPilot, claimDecomposition,
                            argumentChains, identityRetrospection, evidenceLayer, run
    verify-seed.ts          Idempotency + integrity verifier
  scripts/                   4 validators + check-drift.mjs + lib/seed-parse.mjs
  data/                      claims.json, claims.example.json, evidence-example.json,
                             claim-pilot-report.json
  versions/                  10 preserved release trees, v0.1 → v0.9 (see 4.6)
  validation-report.json     Generated validator output
  trope-card-deck-draft.md   Editorial drafts
```

### 4.3 Data model — 36 tables, 17 enums, in schema `trope_graph`

Verified by extracting `CREATE TABLE` statements from the migrations. Grouped by concern:

- **Taxonomy:** `collections`, `card_collections`, `mechanisms`, `concepts`
- **Cards:** `cards`, `card_versions`, `card_cases`, `card_concepts`, `question_cards`
- **Claims:** `claims`, `question_claims`, `claim_relations`, `claim_interpretations`
- **Inference:** `inference_steps`, `inference_premises`, `inference_conclusions`,
  `inference_step_relations`
- **Argument chains:** `argument_chains`, `argument_chain_steps`
- **Evidence:** `evidence_items`, `evidence_claims`, `evidence_inferences`,
  `evidence_sources`, `evidence_interpretations`, `claim_sources`, `interpretation_sources`,
  `question_sources`
- **Domain extensions:** `cases`, `case_legal_metadata`, `relationships`, `contributions`,
  `research_events`, `sources`
- **Shared:** `question_cards`, `questions`, `sources`

### 4.4 Schema isolation — the key integration enabler

`trope_graph` is a **Postgres schema inside the same database**, not a separate database.
Every object is schema-qualified; the migrations contain no `public.` writes (the single
`public.cards` mention is inside a comment explaining the distinction).

This means **the graph can share the host's database and its `cards` table name without
collision** — `trope_graph.cards` and `public.cards` coexist. This is the property that makes
same-database integration viable. The cost of that decision is that the graph's migration
runner and the host's Prisma migrations now coexist in one database, which is a coordination
problem, not a blocking one.

### 4.5 Design documents

`ARGUMENT_CHAIN_ENGINE.md`, `CLAIM_DECOMPOSITION_ENGINE.md`, `CLAIM_EXTRACTION.md`,
`CLAIM_EXTRACTION_PILOT.md`, `EVIDENCE_LAYER.md`, `IDENTITY_RETROJECTION_CLUSTER.md`,
`SCHEMA_REFINEMENT_V0.3.md`, `TROPE_GRAPH_MIGRATION.md`, `TROPE_GRAPH_SCHEMA.md`,
`V0.6_MIGRATION.md`, `V0.7_MIGRATION.md`, `V0.8_MIGRATION.md`, `V0.9_MIGRATION.md`.

`TROPE_GRAPH_SCHEMA.md` and `TROPE_GRAPH_MIGRATION.md` are the natural entry points.

### 4.6 `versions/` — release provenance

Ten trees preserving v0.1 → v0.9, including the four original `tar.gz` archives
(`trope-graph-schema-v0.1` … `v0.4`) which were extracted and then deleted in a separate,
verified-recoverable commit (`c5161fd`, recoverable at `3313109^`).

v0.1–v0.4 are **byte-identical to their archives** — this was verified by diff against
extracted tarballs, and `versions/README.md` records the procedure. `trope-cards/versions/**`
is **excluded from Biome** in `biome.json` specifically to protect that guarantee: broadening
`includes` to `trope-cards/**/*.ts` would otherwise silently reformat 22 archived files
(3,625 lines) and destroy it. *Supervision note: that guard is invisible in `biome.json`
(which cannot hold comments) and is a one-line deletion away from being lost.*

---

## 5. Current state and known gaps

### 5.1 Seeded corpus (verified via `trope-graph:verify`)

```
collections 5 · mechanisms 14 · concepts 6 · cards 47 · claims 19
relationships 11 · inferenceSteps 4 · inferencePremises 9 · inferenceConclusions 4
argumentChains 2 · argumentChainSteps 4 · inferenceStepRelations 2
```

`trope-graph:check` is **green end-to-end**: migration `--check` (read-only, no drift) →
4 validators → `typecheck:graph` → idempotency verify → structural drift check. Exit 0.

### 5.2 Deliberately deferred, not overlooked

These are the known gaps. They are documented in the README as intentional holds, and any
integration plan should assume they remain open.

1. **The v0.4 claim corpus is held back.** 152 claims exist in source but are not seeded.
   **39 of them still read `SOURCE_REQUIRED`** and cannot be published without located
   sources. Consequently **41 of 47 seeded cards have no claims**, and **9 claims are bound to
   no inference step**. The seeded graph is a skeleton, not a populated corpus.
2. **The evidence layer is schema-only — zero passages recorded.** Every `evidence_items`
   row count is 0. The `sources Json?` field on the host `Card` is likewise unpopulated. The
   provenance advantage described in 4.1 is **designed but not yet realized in data**.
3. **v0.6 claim-type assignments are unreviewed editorial judgments** — explicitly flagged in
   the README as needing review before wider publication.
4. **`taxonomies.double-standard` is defined but unused** (1 validator warning).
5. **Aliasing is normalized, not resolved** — the graph stores normalized alias keys, so
   `evil jew` etc. resolve at read time rather than being merged in data.

### 5.3 The system's own quality posture

Three properties are worth knowing, because they are deliberate and should be preserved:

- **The seeder is transactional and idempotent.** `verify-seed.ts` seeds twice and compares
  row counts; the unique indexes are load-bearing and were regression-tested by dropping an
  index and confirming the verifier caught the duplicate growth.
- **Validators read the seed sources as text, not by importing them.** This is why a seed that
  fails to typecheck is still validated — validation is not downstream of compilation.
- **The drift checker is structural, not nominal.** It regenerates the Drizzle schema into a
  scratch database and compares 378 catalog facts (tables, columns, types, enums, and
  *semantically* unique constraints via their backing indexes, ignoring constraint names).
  It was canary-tested for sensitivity. This is more reliable than most hand-rolled drift
  checks and should not be traded away for convenience.

---

## 6. Commands

Graph subsystem (all require `TROPE_GRAPH_DATABASE_URL`, see Section 7.3):

| Command | Purpose |
|---|---|
| `pnpm run trope-graph:check` | **The gate.** All five checks below, in order. |
| `pnpm run trope-graph:migrate` | Apply pending migrations |
| `pnpm run trope-graph:migrate:check` | Read-only: report pending/drifted, write nothing |
| `pnpm run trope-graph:migrate:reset` | Drop and rebuild from migrations |
| `pnpm run trope-graph:seed` | Idempotent transactional seed |
| `pnpm run trope-graph:validate` | 4 validators over seed sources |
| `pnpm run trope-graph:verify` | Seed twice, compare row counts |
| `pnpm run trope-graph:check-drift` | Structural schema drift (378 facts) |
| `pnpm run typecheck:graph` | Typecheck the graph only |

Host: `pnpm dev` (Vite), `pnpm run dev:all` (Vite + server), `pnpm run build`,
`pnpm run start` (Express), `pnpm run db:*` (Prisma). Note `pnpm run typecheck:all` currently
**fails** — see 7.2.

---

## 7. Risks the architect should supervise

### 7.1 CRITICAL — the host API has no authentication, including writes

This is pre-existing and unrelated to the graph, but it will affect any plan that exposes
curated content through the host. Verified:

- `rg -in 'auth|jwt|verifyToken|requireUser|session' server/` → **0 matches across all 5
  server files.** No middleware, no token verification, nothing.
- `POST /api/cards`, `PUT /api/cards/:id`, `DELETE /api/cards/:id` are **unauthenticated**.
  Anyone who can reach the API can create, overwrite, or delete cards.
- Admin gating is **client-side only**. `useAdminCheck.ts` first tries
  `GET /api/auth/user-role` — an endpoint that **does not exist**; the source comment says
  so: *"You need to create an API endpoint at /api/auth/user-role."* It then falls back to
  an **email allowlist hardcoded in the client bundle** (`VITE_ADMIN_EMAIL`,
  `admin@truthcards.com`, `admin@localhost`), which is trivially spoofable by anyone who can
  run client JS.
- Stack Auth is initialized client-side, so the UI can tell a user they are signed in, but
  the API never verifies that. **The admin page's appearance of being protected is not
  protection.**
- `server/index.ts` mounts `cors()` with no origin restriction.

**Supervision implication:** if the graph's curated content is ever written through the host
admin UI, it inherits this hole — and the graph is *more* sensitive than cards, because it
carries claim provenance and legal-case references. Recommend that authentication and
server-side authorization land **before** any write path to `trope_graph` is exposed, not
after.

### 7.2 `typecheck:all` fails — 8 errors, 3 unrelated causes

Filed as `as-truth-cards-g66` (P2). Pre-existing; baseline-verified against a stash during the
consolidation. `typecheck:graph` is clean, so the graph is not implicated.

1. **4 × `Cannot find namespace 'React'`** (`resizable.tsx`, `skeleton.tsx`, `sonner.tsx`) —
   shadcn components use the ambient `React` namespace without importing it; that namespace
   comes from `@types/react`, which is **not installed**, while `tsconfig.app.json` sets
   `"jsxImportSource": "preact"`. Note `package.json` declares `react ^18.3.1` with no types.
2. **1 × `badge.tsx`** — `BadgeProps` does not extend a props base carrying `className`.
3. **3 × `string` not assignable to a literal union** (`sheet.tsx`, `sidebar.tsx`).

**Supervision note:** installing `@types/react` is the tempting fix and is probably the
*wrong* one — preact and React types are not drop-in equivalent, and `@types/react` would
likely surface further errors while the runtime is preact. This is a decision about which
React surface is authoritative, and it should be made deliberately.

### 7.3 The repository `.env` points at live production

`.env` resolves `DATABASE_URL` to a **live Neon instance**:
`ep-wandering-hall-a2zhlxru-pooler.eu-central-1.aws.neon.tech`. The graph client accepts
`DATABASE_URL` as a fallback, so an unset `TROPE_GRAPH_DATABASE_URL` would otherwise seed
47 cards into production.

This is **already mitigated**: every write path refuses a non-loopback host by default
(`assertLocalHost` in `trope-cards/src/db/url.ts`), overridable only with an explicit
`TROPE_GRAPH_ALLOW_REMOTE=1` or `--allow-remote`. Local development uses
`TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev` (Unix socket, peer auth).

**Supervision implication:** the guard is in the graph, not in the host. Any new integration
code that connects to the graph must go through `url.ts` and must not bypass the host check.
When the graph is eventually deployed against a real database, the loopback guard will need
an explicit, reviewed bypass — that is a decision to make deliberately, at that time.

### 7.4 Deployment does not run graph migrations

`render.yaml` uses `buildCommand: npm install && npm build && npx prisma generate` and
`startCommand: npx tsx server/index.ts`. **No `trope-graph:migrate` step is invoked.** When
the graph is pointed at a deployed database, its `trope_graph` schema will not exist unless
migration is added to the deploy path. Note also that `npm build` (rather than
`npm run build`) is relied upon, which is worth correcting while touching this file.

### 7.5 Two migration systems in one database

Prisma (`prisma/sql/*.sql`, ad-hoc) and the graph's hand-rolled runner
(`trope-cards/drizzle/*.sql`, SHA-256 ledger in `trope_graph.schema_migrations`) will
eventually share one database. They are independent and unaware of each other. There is no
ordering guarantee between them, and no shared lock. *Verification:* the graph's
`migrate:check` is proven genuinely read-only, so it is safe to run against a
Prisma-migrated database — but coordinate deliberately.

### 7.6 Tooling footgun (resolved, recorded for awareness)

The pre-commit hook was `bunx biome format --write --staged`, which **fails** whenever a
staged path falls outside Biome's include list — so any commit touching a `.md`, `.sql`, or
`versions/` file would have been rejected. It now formats the tree and lets Biome apply its
own `includes`. Also resolved: a **global** `~/.gitconfig` setting
(`remote.origin.push = +refs/notes/*:refs/notes/*`) was causing bare `git push` to report
`"Everything up-to-date"` while silently pushing nothing, across ~50 repos. Both were fixed
and verified; the global one is removed.

---

## 8. Decisions required from the architect

These are the open questions. Recommendations are offered but the ruling is the architect's.

### D1 — How should the graph be exposed to the host?

The graph has no API. Three plausible paths:

- **(a) Graph as a read-only API alongside the existing Express app.** Add a router serving
  a projection of the graph (e.g. card → its claims, mechanisms, evidence status). Keeps the
  graph's write path entirely out of the app; content changes continue to go through
  migrations + seed. **Lowest risk, and it fits how the content is actually authored today
  (versioned SQL, not CRUD).** Recommended starting point.
- **(b) Serve the graph directly from Postgres** (e.g. PostgREST or a read replica) and have
  the SPA talk to it. Faster to stand up, but splits the API surface and reintroduces the
  host's missing-auth problem in a second place.
- **(c) Fold the graph into Prisma models in `public`.** Would unify ORM and migrations.
  **Not recommended** — it would discard the hand-written migration history, the drift
  checker, and the schema isolation that makes `trope_graph.cards` and `public.cards`
  coexist. High cost, low benefit.

### D2 — Where does the host's flat `Card` fit in the graph's card set?

`public.cards` (47 in the graph, N in the host) and `trope_graph.cards` (47) are independent.
The graph's card is a *research entry point* (per the schema comment: *"An editorial entry
point, not the atomic unit of truth"*), while the host card is a *display unit* with front and
back text. Options: keep them separate and link by a stable slug; make the host card the
canonical display and the graph card the analysis; or collapse to one. **This needs a ruling
before any UI work**, because it determines the join key and whether content is duplicated.

### D3 — Should the graph ship to production in this cycle?

The seeded corpus is a skeleton (41/47 cards have no claims; evidence is 0 rows). Shipping
the *schema* and a read API is low-risk and useful for internal tooling. Shipping it as
**user-facing surface** would expose a nearly empty evidence layer. Recommend: schema + read
API internally first; defer user-facing surfacing until the `SOURCE_REQUIRED` claims are
resolved and the evidence layer has real passages.

### D4 — Who owns resolving the 39 `SOURCE_REQUIRED` claims?

This is editorial work, not engineering, and it gates the corpus. It needs a named owner and
a definition of done (what counts as a "located source"?). It is the single largest
content-side blocker to the subsystem's value proposition.

### D5 — Should authentication land before or after integration?

Given 7.1, the architect should decide explicitly. My recommendation is **before** any write
path to `trope_graph` is exposed. If read-only, it can proceed in parallel.

### D6 — React: preact or React types?

Prevents `typecheck:all` from ever being a usable gate, and blocks the cleanest fix for 7.2.
Cheap to decide now, expensive later.

### D7 — `AGENTS.md`

Should it be corrected to describe the actual stack, or should the stack be migrated toward
what it claims? At present it will actively mislead any agent or new contributor, including
the instructions to run scripts that do not exist.

---

## 9. Verification appendix

Every non-obvious claim in this report, and how it was checked:

| Claim | Method |
|---|---|
| Host is Vite + Express, not Next.js | `package.json` scripts/deps; `next` absent; `server/index.ts` |
| Graph is not in the frontend bundle | `rg 'trope_graph\|TropeGraph' dist/` → no matches |
| `trope_graph` is a schema, not a separate DB | `CREATE SCHEMA IF NOT EXISTS trope_graph`; all DDL schema-qualified; no `public.` writes |
| 36 tables | `CREATE TABLE` extraction across the 7 migrations |
| 17 enums | `CREATE TYPE` count across the 7 migrations |
| Seeded counts | `pnpm run trope-graph:verify` output |
| All 5 checks green | `pnpm run trope-graph:check` → exit 0 |
| 41/47 cards lack claims; 9 unbound claims | Same verifier output (warnings) |
| Zero server auth | `rg -in 'auth\|jwt\|verifyToken\|requireUser\|session' server/` → 0 matches, 5 files |
| `/api/auth/user-role` does not exist | No `/api/auth` router in `server/index.ts`; absent from `server/` |
| Email allowlist is client-side | `src/hooks/useAdminCheck.ts` fallback branch |
| `@stackframe/stack` is a real dependency | `package.json: ^2.8.78`; `node_modules/@stackframe` present |
| Host app builds | `pnpm run build` → `✓ built in 20.40s` |
| 8 typecheck errors, 3 causes | `pnpm run typecheck:all`; filed as `as-truth-cards-g66` |
| `.env` → live Neon | `.env` `DATABASE_URL` host |
| Loopback guard exists | `assertLocalHost` in `trope-cards/src/db/url.ts` |
| No graph migration in deploy | `render.yaml` build/start commands |
| Host migrations ad-hoc | `ls prisma/` → `sql/` only, no `migrations/` |
| v0.1–v0.4 byte-identical to archives | `diff -rq` against extracted `tar.gz` from `3313109^` |
| Versions excluded from Biome | `biome.json` negation; verified it blocks a broadened `includes` |
| Graph untouched by `PRD.md`/`SPEC.md` | `rg -in 'trope' PRD.md SPEC.md README.md` → no matches |

**Not verified / unknown:** whether the host's Neon database is the intended eventual home
for the graph, or whether a separate database is preferred; the production status of the
`ADMIN` role migration (`prisma/sql/set_admin_user.sql`); whether `dist/` is current or
stale; the intended editorial standard for "a located source" (D4).
