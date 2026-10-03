# Architect Report: `trope-cards` and its integration into the as-truth-cards stack

**Date:** 2026-09-27
**Commit base:** `821ba44` (`main`, in sync with `origin/main`)
**Purpose:** Brief the project architect on the newly-added `trope-cards/` subsystem, its
current state, and the decisions required before it can be integrated into the host
application. Written to be used as the basis for supervision instructions.

**How to read this document.** Every factual claim below was verified against the working
tree, the database, or the build at the commit base. Claims that are *interpretation* or
*recommendation* are marked as such. Where something is unknown, it is stated as unknown
rather than guessed. Section 10 lists the decisions that need an architect's ruling.

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
admin UI. These are detailed in Section 9.

**The finding that should be read first: this repository contains two applications, not one.**
`main` and `dev` share a one-day-old common ancestor (2025-03-19) and were then developed
independently for eleven months. `main` is a Vite/Preact/Express app on Render and holds all
the graph work. `dev` is a Next.js app, dormant since April 2025. `AGENTS.md` describes `dev`,
not the code anyone is currently working on — which is why the repo's own documentation
disagrees with the tree. Section 3 has the full timeline; **D0 is the decision to resolve it.**

The card UI that motivated keeping `dev` turns out to exist on `main` as well, with one small
portable exception (Section 4). So "the card shuffle" is not, on its own, a reason to continue
on `dev` — the case for `dev` rests on its auth model and enums (3.4), not its UI.

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

### 2.1 `AGENTS.md` describes the *other* branch

**Correction to an earlier draft of this report.** An initial version of this section
claimed `AGENTS.md` simply misdescribes the stack as Next.js. That was wrong, and the error
mattered: `AGENTS.md` is an accurate description of the **`dev` branch**, not of `main`.
See Section 3.

`AGENTS.md` is therefore not a documentation bug so much as a **branch-ambiguity** bug — it
silently assumes the reader is on `main` while describing `dev`. An agent following it on
`main` will look for Next.js and Stack server-side auth and find neither.

One claim is wrong on both branches: `AGENTS.md` instructs agents to run `npm run test` and
`npm run lint`; neither script exists.
exists. The real commands are in `package.json` (Section 8).

---

## 3. Repository history: two applications, not a migration

The repo is not one app that changed frameworks. It is **two divergent applications** that
split one day after creation and were developed independently for eleven months.

```
dev vs origin/dev : 0 behind, 0 ahead    (in sync with its remote, but dormant)
dev vs main       : 17 dev-only, 32 main-only
merge base        : 7279c23, 2025-03-19
```

### 3.1 Timeline (all dates from git, verified)

| Date | Branch | Event |
|---|---|---|
| 2025-03-18 | both | Created as `vite_react_shadcn_ts` by GPT Engineer (`00b8235`) |
| 2025-03-19 | — | **Split.** Merge base `7279c23` |
| 2025-03 → 04 | `dev` | Active work; **migrated to Next.js pages router 2025-04-20** |
| 2025-04-21 | `dev` | Last functional commit (`dae192f rm .next`) — then stops |
| 2025-10-19 | `dev` | One stray Prisma import fix — then dormant |
| 2025-10-19 | `main` | Drop Lovable branding; add **Vercel** deploy instructions |
| 2025-10 → 2026-02 | `main` | 4-month dormancy |
| 2026-02-26 | `main` | Biome, Husky, admin auth hook, `UserProfile` |
| **2026-03-27** | `main` | **Went the opposite way: Vite → Preact + Express**, then Render, then 9 consecutive Render fixes |
| 2026-04 | `main` | `tropes added` — the graph arrives |

### 3.2 Direction of travel — the key correction

A natural assumption is that the Next.js line is the intended future. **The evidence points
the other way:**

- **Next.js has never been a dependency on `main`.** Every historical revision of
  `package.json` on that branch was checked; zero hits.
- **The Next.js migration was started and abandoned in April 2025.** `dev` has had no
  functional commits since 2025-04-21.
- **`dev` has never had a Render config** — no `render.yaml`, and no reference to
  `render.com` anywhere in its tree. Next.js and Render are on *opposite branches*.
- **The surviving line moved away from Next.js**, adopting Preact + Express in March 2026.

There were also **three** deployment targets over time: Vercel (2025-10, README) → Render
(2026-03, `render.yaml`). See risk 9.6.

### 3.3 Stack comparison

| | `dev` (dormant) | `main` (active) |
|---|---|---|
| Framework | **Next.js 15.3.1**, pages router | Vite 5.4.1 |
| React | 19.1.0 | 18.3.1 (+ preact 10.29) |
| API | `pages/api/*` | Express 4 (`server/`) |
| Prisma | 6.5.0 | 5.22.0 |
| Lockfile | `bun.lockb` | `pnpm-lock.yaml` |
| Lint / test | eslint + vitest configured | Biome; **no test runner** |
| Stack Auth | `src/stack/{client,server}.ts` | client hook only |
| `trope-cards/` | **absent** | present |
| `Card` write API | none (reads only) | **unauthenticated writes** |
| `User` model | `User`, `AccessLevel`, `ContentStatus` | `UserProfile`, `UserRole` only |

### 3.4 What `dev` has that `main` never received

`dev` contains genuinely better material, which is why it is worth mining before deletion:

- **A `StackServerApp` in `src/stack/server.ts`.** *Caveat: it is imported nowhere*, and no
  API route checks it, so `dev` does not actually enforce auth either. It is unused
  infrastructure, not working auth.
- **A richer authorization model** — `AccessLevel` (BASIC / VERIFIED / ACADEMIC / MODERATOR /
  ADMIN) and `ContentStatus` (PENDING / APPROVED / FLAGGED / REJECTED / REMOVED), plus
  `User.institution`, `verifiedAt`, `moderatedAt`. `main` has a bare `UserRole` and no
  content lifecycle.
- **A read-only card API**, where `main` exposes unauthenticated writes. The *more advanced*
  branch is the *safer* one, by accident.
- **eslint + vitest configured.** `main` has no test runner at all.

`dev` also has three components `main` lacks: `HeroSection.tsx`, `CardSection.tsx`,
`FeaturedCard.tsx` (on `main` the featured-card logic is inlined in `CardDeck.tsx`).

---

## 4. The card UI: is it a reason to keep `dev`?

**The stated reason to continue on `dev` does not survive verification.** The card
shuffle/draw/flip UI exists on **both** branches. `main` is not missing it.

### 4.1 Feature-by-feature

| Feature | `main` | `dev` |
|---|---|---|
| Shuffle / draw-a-card | yes | yes |
| Card flip (3D, `perspective-1000`, `preserve-3d`) | yes | yes |
| Thumbs up / down voting | yes | yes |
| Featured card | yes (inlined in `CardDeck`) | yes (own component) |
| Hero section | no | yes |
| Data fetching | `@tanstack/react-query` | manual `useEffect` + `useState` + error state |
| **Never re-draws the same card twice** | **no** | **yes** |

`main` carries the same UX and adds react-query on top. The one genuine functional
difference is small and precisely located:

```ts
// dev — retries to guarantee a different card (src/components/CardDeck.tsx:60)
let newIndex;
do {
  newIndex = Math.floor(Math.random() * filteredCards.length);
} while (newIndex === selectedCardIndex && filteredCards.length > 1);
```

```ts
// main — a single draw; can return the same card twice in a row (CardDeck.tsx:53)
const randomIndex = Math.floor(Math.random() * filteredCards.length)
setSelectedCard(randomIndex)
```

**Assessment:** the "don't repeat" loop is a ~3-line change that can be ported to `main` in
minutes, with a re-roll or exclude-drawn set as a follow-up if desired. It is a ticket, not
a reason to maintain a second application. If the card UI is what the project values, `main`
already has it.

### 4.2 One caveat on `main`'s UI

`main` mixes runtimes in its card components: `Card.tsx` and `CardDeck.tsx` both import
`useState` from **`preact/hooks`** while importing `type React` from **`react`**. It builds
(`✓ built in 24.44s`) and the flip markup is a correct 3D CSS implementation, so this is
latent fragility rather than a live defect — but it is the same preact/React ambiguity that
produces the 8 `typecheck:all` errors in 7.2, and it is concentrated in exactly the two
files that implement the card UX.

---

## 5. The host application today

### 5.1 Data model is flat and card-shaped

`prisma/schema.prisma` defines three models and one enum:

- **`Card`** — `id Int autoincrement`, `title`, `frontDescription`, `backDescription`,
  `symbol`, `imageUrl?`, `tags String[]`, `includedInPalestineStack Boolean`,
  `isFeatured Boolean`, `sources Json?`. Maps to table `cards` in schema `public`.
- **`UserProfile`**, **`UserInteraction`** — user state; `UserRole` enum with
  `ANONYMOUS` / `VERIFIED` (and an `ADMIN` value added by `prisma/sql/add_admin_role.sql`).

A host card is a *display unit*: a front (the trope), a back (the debunk), a symbol, and some
tags. It is exactly the shape the PRD describes. It has **no** concept of a mechanism, a
claim, a premise, a conclusion, or a source with provenance.

### 5.2 API surface

`server/index.ts` mounts two routers and a health check, serves `dist/` in production, and
listens on `PORT` (default 3001) with permissive CORS.

- `GET/POST /api/cards`, `GET/PUT/DELETE /api/cards/:id`
- `GET/POST /api/interactions` (routes in `server/api/interactions.ts`)
- `GET /health`

**There is no `/api/auth/*` router at all.** See Section 9.1.

### 5.3 Frontend

`src/pages/`: `Index`, `About`, `Admin`, `NotFound`.
`src/components/`: `CardDeck`, `Card`, `Header`, `Footer`, `ThemeProvider`, `ThemeToggle`,
`admin/`, and a shadcn-derived `ui/` directory. `src/hooks/useAdminCheck.ts` gates the admin UI.

The build is healthy: `pnpm run build` → `✓ built in 20.40s`.

### 5.4 Host migration state is inconsistent

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

## 6. The `trope-cards/` subsystem

### 6.1 What it is for

The host answers *"what is this trope, and what is the debunk?"*. The graph answers the
questions the host cannot: *what mechanism of operation does this trope rely on, which
specific claims does it make, how do those claims combine into an inference, and what is the
source provenance for each one?*

That is a meaningful upgrade in epistemic quality — a card asserting a debunk is weak
evidence; a graph showing a documented inference chain with located sources is strong. The
architecture in `trope-cards/docs/` argues this case in detail (13 documents, listed in 4.5).

### 6.2 Layout

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

### 6.3 Data model — 36 tables, 17 enums, in schema `trope_graph`

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

### 6.4 Schema isolation — the key integration enabler

`trope_graph` is a **Postgres schema inside the same database**, not a separate database.
Every object is schema-qualified; the migrations contain no `public.` writes (the single
`public.cards` mention is inside a comment explaining the distinction).

This means **the graph can share the host's database and its `cards` table name without
collision** — `trope_graph.cards` and `public.cards` coexist. This is the property that makes
same-database integration viable. The cost of that decision is that the graph's migration
runner and the host's Prisma migrations now coexist in one database, which is a coordination
problem, not a blocking one.

### 6.5 Design documents

`ARGUMENT_CHAIN_ENGINE.md`, `CLAIM_DECOMPOSITION_ENGINE.md`, `CLAIM_EXTRACTION.md`,
`CLAIM_EXTRACTION_PILOT.md`, `EVIDENCE_LAYER.md`, `IDENTITY_RETROJECTION_CLUSTER.md`,
`SCHEMA_REFINEMENT_V0.3.md`, `TROPE_GRAPH_MIGRATION.md`, `TROPE_GRAPH_SCHEMA.md`,
`V0.6_MIGRATION.md`, `V0.7_MIGRATION.md`, `V0.8_MIGRATION.md`, `V0.9_MIGRATION.md`.

`TROPE_GRAPH_SCHEMA.md` and `TROPE_GRAPH_MIGRATION.md` are the natural entry points.

### 6.6 `versions/` — release provenance

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

## 7. Current state and known gaps

### 7.1 Seeded corpus (verified via `trope-graph:verify`)

```
collections 5 · mechanisms 14 · concepts 6 · cards 47 · claims 19
relationships 11 · inferenceSteps 4 · inferencePremises 9 · inferenceConclusions 4
argumentChains 2 · argumentChainSteps 4 · inferenceStepRelations 2
```

`trope-graph:check` is **green end-to-end**: migration `--check` (read-only, no drift) →
4 validators → `typecheck:graph` → idempotency verify → structural drift check. Exit 0.

### 7.2 Deliberately deferred, not overlooked

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

### 7.3 The system's own quality posture

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

## 8. Commands

Graph subsystem (all require `TROPE_GRAPH_DATABASE_URL`, see Section 9.3):

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

## 9. Risks the architect should supervise

### 9.1 CRITICAL — the host API has no authentication, including writes

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

### 9.2 `typecheck:all` fails — 8 errors, 3 unrelated causes

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

### 9.3 The repository `.env` points at live production

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

### 9.4 Deployment does not run graph migrations

`render.yaml` uses `buildCommand: npm install && npm build && npx prisma generate` and
`startCommand: npx tsx server/index.ts`. **No `trope-graph:migrate` step is invoked.** When
the graph is pointed at a deployed database, its `trope_graph` schema will not exist unless
migration is added to the deploy path. Note also that `npm build` (rather than
`npm run build`) is relied upon, which is worth correcting while touching this file.

### 9.5 Two migration systems in one database

Prisma (`prisma/sql/*.sql`, ad-hoc) and the graph's hand-rolled runner
(`trope-cards/drizzle/*.sql`, SHA-256 ledger in `trope_graph.schema_migrations`) will
eventually share one database. They are independent and unaware of each other. There is no
ordering guarantee between them, and no shared lock. *Verification:* the graph's
`migrate:check` is proven genuinely read-only, so it is safe to run against a
Prisma-migrated database — but coordinate deliberately.

### 9.6 The README documents a deployment target the project abandoned

`README.md` still instructs the reader to deploy to **Vercel**, including
`npm i -g vercel` and `vercel` CLI steps. The actual deploy config is **Render**, added in
`727aafe` (2026-03-27) and never reflected back into the README. Vercel instructions survived
every subsequent commit that touched `render.yaml`.

This is not cosmetic. Following the README today produces a broken deployment: the app is an
Express server with a `tsx` start command, which Vercel's static/Next.js model does not host.
Anyone onboarding, or any agent reading the README to learn how this ships, is actively misled.

`render.yaml` also has a latent bug worth fixing while it is open: `buildCommand` uses
`npm build` rather than `npm run build`, and the project is pnpm-based throughout
(`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `pnpm exec`), so the deploy path is inconsistent with
the documented toolchain.

> **Resolved (GitHub Issue #4).** The README now documents Render as the sole production
> target and states explicitly that Vercel is not one. `render.yaml` was reconciled with the
> application: `pnpm install --frozen-lockfile` and `pnpm run build` replace the invalid
> `npm build`; a `preDeployCommand` applies both Prisma and Drizzle migrations; the invalid
> `hooks: [{type: post-deploy}]` block is replaced by correct blueprint keys; `healthCheckPath`
> points at the existing `/health` route; `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are
> declared; and the unused `VITE_ADMIN_EMAIL` is removed. The findings above are left as
> written because this document is a dated record of the tree at its commit base.

Two further deployment defects were found while reconciling `render.yaml`, beyond what this
report identified. Both are fixed.

- **`GET /health` was unreachable in production.** The `app.get('*')` SPA catch-all was
  registered before it and answers every GET, so `/health` returned `index.html` instead of
  JSON. Render's `healthCheckPath` accepts that `200`, so the defect hid behind a passing
  health check.
- **`BETTER_AUTH_SECRET` was not declared, and its absence is silent.** The server boots and
  `/api/auth/*` answers without it; Better Auth falls back to a hardcoded default secret
  published in its own source, so session cookies can be forged, including sessions carrying a
  privileged role. Verified by booting the production bundle with the variable unset and
  confirming auth still answered. This is an authentication bypass rather than an outage, so it
  will not surface through any health check.

### 9.7 Tooling footguns (resolved, recorded for awareness)

The pre-commit hook was `bunx biome format --write --staged`, which **fails** whenever a
staged path falls outside Biome's include list — so any commit touching a `.md`, `.sql`, or
`versions/` file would have been rejected. It now formats the tree and lets Biome apply its
own `includes`. Also resolved: a **global** `~/.gitconfig` setting
(`remote.origin.push = +refs/notes/*:refs/notes/*`) was causing bare `git push` to report
`"Everything up-to-date"` while silently pushing nothing, across ~50 repos. Both were fixed
and verified; the global one is removed.

---

## 10. Decisions required from the architect

These are the open questions. Recommendations are offered but the ruling is the architect's.

### D0 — What to do about the `dev` branch and the divergent-app problem

**This is the decision that should be made first, because several others depend on it.**

The framing question: is this a repository with a stale branch, or two applications? Verified,
it is the latter. `main` and `dev` share a one-day-old common ancestor and have been developed
independently for eleven months, with no tests on either side to arbitrate correctness.

Options, roughly in ascending order of cost:

- **(a) Salvage `dev`'s ideas onto `main`, delete the branch.** Mine the `AccessLevel` and
  `ContentStatus` enums and the `StackServerApp` from `dev` (3.4), port the no-repeat draw
  loop (4.1), then delete `dev` so there is one app again. `main` already builds, deploys, and
  holds all the graph work. **Recommended.** This captures essentially everything of value in
  `dev` at a fraction of the cost of maintaining it, and resolves the branch ambiguity that is
  currently making `AGENTS.md` wrong.
- **(b) Port `trope-cards/` onto `dev` and abandon `main`.** Would mean moving the graph to a
  Next.js app, re-deriving the Render deploy, and porting the Preact/Render work — while
  discarding eleven months of `main` commits. Only defensible if a Next.js deployment is a
  hard requirement (e.g. a hosting decision already made). **Nothing in the repo suggests one.**
- **(c) Start clean on a third branch.** The user's stated fallback if a structural problem
  is confirmed. Viable, but note what it discards: a working Render deployment, a verified
  36-table graph with a 5-stage check gate, and 11 months of content commits. A clean start is
  only justified if the *product* direction is changing, not just the framework. If the goal
  is the card UI, note that the card UI is the one asset both branches already share (4.1).

**Structural problems that actually exist** (so the "is it structural?" test can be answered
directly rather than assumed):

1. **No tests on `main`.** `dev` has vitest configured; `main` has no runner. This is the most
   serious structural gap, and it is the strongest argument for *not* starting clean — a
   rewrite without tests is how the current situation happened.
2. **Unauthenticated write API on `main`** (9.1) — worse than `dev`, which is read-only.
3. **Two migration systems, no coordination** (9.5).
4. **A React/Preact hybrid** in exactly the card components (4.2).

None of these require a new branch. All four are cheaper to fix in place than to re-encounter
in a rewrite. My recommendation is (a), with a test harness established *before* any further
feature work.

**Free win regardless of which option is chosen:** `AGENTS.md` should be corrected to name the
branch it describes, or deleted. As it stands it will keep misleading agents and new
contributors until the ambiguity is resolved.

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

## 11. Verification appendix

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
| Repo is two divergent apps, split 2025-03-19 | merge base `7279c23`; `dev` 17-only / `main` 32-only |
| Born as Vite + shadcn | first commit `00b8235` "Use tech stack vite_react_shadcn_ts" |
| `dev` is Next.js, `main` is not | `dev:package.json` has `next ^15.3.1`; no revision of `main:package.json` ever had it |
| `main` went Vite → Preact + Express | `ddc7313` (2026-03-27) "Complete v1 implementation - pnpm, Preact, Express API" |
| `dev` has no Render config | `git ls-tree dev` → no `render.yaml`; no `render.com` match in tree |
| README says Vercel, deploy is Render | `README.md:66-77` vs `render.yaml:6-7` |
| Card UI (shuffle/flip/thumbs) on **both** branches | keyword search of `CardDeck.tsx`/`Card.tsx` on each branch |
| `dev` is the only one that avoids re-draws | `dev:CardDeck.tsx:60` do-while; `main:CardDeck.tsx:53` single draw |
| `main` has thumbs voting too | `main:Card.tsx` imports `ThumbsUp`/`ThumbsDown` |
| `dev` extras | `HeroSection.tsx`, `CardSection.tsx`, `FeaturedCard.tsx` absent from `main` |
| `dev` has `AccessLevel`/`ContentStatus` enums | `dev:prisma/schema.prisma` |
| `dev`'s `StackServerApp` is unused | `git grep -l 'stack/server' dev` → no matches |
| `dev` card API is read-only | no `req.method` switch in `pages/api/cards.ts` |
| `main` has no test runner | `main:package.json` scripts — no `test` |
| `main` card components mix runtimes | `main:Card.tsx:2-3` `preact/hooks` + `type React from 'react'` |

**Not verified / unknown:** whether the host's Neon database is the intended eventual home
for the graph, or whether a separate database is preferred; the production status of the
`ADMIN` role migration (`prisma/sql/set_admin_user.sql`); whether `dist/` is current or
stale; the intended editorial standard for "a located source" (D4); **why the Next.js
migration on `dev` was abandoned** — no commit, issue, or doc in the repo records a decision,
which is itself the strongest argument for writing down the outcome of D0; whether the
Render deployment is currently live and healthy (no deployed instance was inspected); and
whether the three extra `dev` components (`HeroSection`, `CardSection`, `FeaturedCard`)
represent desired design work or abandoned experiments.

**One caveat on this document's own history.** Section 2.1 originally claimed `AGENTS.md`
simply misdescribed the stack as Next.js. That was wrong: `AGENTS.md` accurately describes
`dev`. The error came from describing the checked-out branch without checking for others. The
correction is left in place deliberately — a briefing that hides its own corrections is less
trustworthy than one that shows them.


*Update (Issue #5):* As of Issue #5, Render is canonical and the production auth configuration is enforced at startup (no silent fallback).
