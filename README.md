# Trope Cards

[![GitHub](https://img.shields.io/badge/GitHub-ubuntupunk/as--truth--cards-blue)](https://github.com/ubuntupunk/as-truth-cards)
[![License](https://img.shields.io/badge/License-GPL-green.svg)](LICENSE)

<a href="https://github.com/pedromxavier/flag-badges">
    <img src="https://raw.githubusercontent.com/pedromxavier/flag-badges/main/badges/ZA.svg" alt="made in za">
</a>

Research and education tool for antisemitic tropes: interactive **Trope Cards**, an admin
surface for managing the host deck, and a **Graph Explorer** over a structured claim ontology.

> The GitHub repository is still `as-truth-cards`. The Render **service** display name is
> `trope-cards`; the public hostname remains `https://as-truth-cards.onrender.com`. The
> Render **project** display name (“As Truth Cards”) is dashboard-only — rename it under
> Project → Settings.

## What this repo is

| Surface | Route | Role |
|---|---|---|
| Card deck | `/` | Flip cards (myth → truth); optional Israel/Palestine stack filter |
| Graph Explorer | `/graph` | Cytoscape view of depth-bounded projections from `trope_graph` |
| Admin | `/admin` | Manage host deck cards (Better Auth–protected) |
| About | `/about` | Project context |

The SPA is Vite + Preact (`preact/compat`). An Express process serves `/api/*` and, in
production, the built bundle from `dist/`. Production host is **Render** (`render.yaml`).
Vercel is not a deployment target.

### Dual database layer

One PostgreSQL database (Neon in production) holds two schemas during the transition:

| Schema | ORM | Owns | Status |
|---|---|---|---|
| `public` | Prisma | Host deck (`cards`), interactions, Better Auth tables | Transitional; `/api/cards` and `/api/interactions` still depend on it |
| `trope_graph` | Drizzle (`trope-cards/`) | Claims, relations, taxonomy, graph seed corpus | Canonical ontology; projected read-only via `/api/graph` |

`trope_graph.cards` is not `public.cards`. The application never writes to `trope_graph` while
serving traffic — migrate and seed are explicit deploy/authoring steps.

## Repository layout

```text
src/                 Vite SPA (pages, CardDeck, Graph Explorer under src/graph/)
server/              Express entry, Better Auth, /api/cards|interactions|graph
trope-cards/         Trope Graph schema, migrations, seed, projection, validators
prisma/              Host schema migrations (public)
docs/                Product/spec notes and phase reports
render.yaml          Canonical Render Blueprint
```

Graph subsystem details live in [`trope-cards/README.md`](trope-cards/README.md) and
[`trope-cards/docs/`](trope-cards/docs/).

## Stack

- **Frontend:** Vite, Preact, React Router, TanStack Query, Tailwind, shadcn/ui, Cytoscape
- **Backend:** Express, Better Auth, TypeScript (strict)
- **Data:** PostgreSQL — Prisma (`public`) + Drizzle (`trope_graph`)
- **Tooling:** pnpm, Biome (lint/format), Node test runner via `tsx`, optional `just`

Requires Node.js `>=20 <25` and pnpm.

## Local development

```sh
git clone https://github.com/ubuntupunk/as-truth-cards.git
cd as-truth-cards
pnpm install
cp .env.example .env   # then fill DATABASE_URL and BETTER_AUTH_*
```

Run the full stack (Vite on `:8080`, Express on `:3001`; Vite proxies `/api` to Express):

```sh
just dev
# or: pnpm run dev:all
```

Web-only: `pnpm run dev`. API-only: `pnpm run server:dev`.

Local env differs from production — see `.env.example`. `BETTER_AUTH_URL` must be the
origin the browser uses (`http://localhost:8080` in dev).

### Database (local)

Host deck (Prisma):

```sh
pnpm run db:migrate:deploy
pnpm run db:seed
```

Trope Graph (local Postgres recommended; write paths refuse non-loopback hosts by default):

```sh
createdb trope_cards_dev
export TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev
pnpm run trope-graph:migrate
pnpm run trope-graph:seed
pnpm run trope-graph:check   # validate + verify + test + drift
```

See [`trope-cards/README.md`](trope-cards/README.md) for safety rules and corpus workflow.

### Common scripts

| Command | Purpose |
|---|---|
| `pnpm run dev:all` | Vite + Express together |
| `pnpm run build` | `prisma generate` + Vite production build → `dist/` |
| `pnpm run start` | Production Express (serves `dist/` when `NODE_ENV=production`) |
| `pnpm run test` | Server + graph + UI graph tests |
| `pnpm run test:server` / `test:ui` / `trope-graph:test` | Subsystem tests |
| `pnpm run lint` / `format` | Biome check / write |
| `pnpm run typecheck` / `typecheck:graph` | Host / graph TypeScript |
| `pnpm run db:migrate:deploy` | Apply Prisma migrations |
| `pnpm run trope-graph:migrate` | Apply Drizzle graph migrations |
| `pnpm run trope-graph:seed` | Load authored corpus into `trope_graph` |

`just` wraps the same scripts with env wiring — run `just` with no args for the recipe list.

## API sketch

| Path | Notes |
|---|---|
| `GET /health` | `{"status":"ok"}` — registered before the SPA catch-all |
| `/api/auth/*` | Better Auth (mounted before `express.json()`) |
| `/api/cards` | Host deck CRUD (Prisma) |
| `/api/interactions` | Card ratings / interactions (Prisma) |
| `GET /api/graph` | Depth-bounded projection from `trope_graph` |
| `GET /api/graph/views` | Available views and population hints |

## Deployment

Production runs on **Render**. `render.yaml` is the canonical configuration and is applied
through Render's Blueprint support — connect the repository once and the service is defined
from that file.

Vercel is not a deployment target for this application. There is no `vercel.json`, and the
app is a long-running Express process that serves both `/api/*` and the built Vite bundle
from `dist/`, which does not fit a static or edge deployment model.

### What happens on deploy

**The service currently runs on Render's `free` plan, which does not execute pre-deploy
commands.** The pre-deploy rows below are configured but inert. See
[Free-tier deploys](#free-tier-deploys-migrations-are-manual).

| Stage | Command | Runs on `free`? | Purpose |
|---|---|---|---|
| Build | `pnpm install --frozen-lockfile && pnpm run build` | yes | Installs dependencies, runs `prisma generate`, builds `dist/` via Vite |
| Pre-deploy | `pnpm run db:migrate:deploy` | **no** | Applies pending Prisma migrations to the `public` schema |
| Pre-deploy | `pnpm run trope-graph:migrate -- --allow-remote` | **no** | Applies pending Drizzle migrations to the `trope_graph` schema |
| Pre-deploy | `pnpm run trope-graph:seed` | **no** | Loads the authored corpus into `trope_graph` |
| Start | `pnpm run start` | yes | Runs `server/index.ts` via `tsx`; serves `dist/` and `/api/*` on `$PORT` |
| Health | `GET /health` | n/a | Liveness endpoint; Render free tier port-scans instead of using `healthCheckPath` |

**All three migration steps are required, and none runs automatically today.** Nothing
creates either schema, and migrate alone creates `trope_graph` without populating it.

### Free-tier deploys: migrations are manual

Render logs `Predeploy command not run. Commands can only run on paid instance types` and
then promotes the build anyway, reporting success. **A green deploy on the free tier proves
only that the build succeeded and the process started.** It says nothing about the schema.

When migrating by hand is required — after any commit touching `prisma/migrations/`,
`trope-cards/drizzle/`, or anything the seeder reads under `trope-cards/src/db/seed/` — run
all three, in order:

```sh
pnpm run db:migrate:deploy
pnpm run trope-graph:migrate -- --allow-remote
TROPE_GRAPH_ALLOW_REMOTE=1 pnpm run trope-graph:seed
```

`TROPE_GRAPH_ALLOW_REMOTE=1` is required on the third command. The seeder reads that
variable and has no `--allow-remote` flag of its own; without it it exits with
`Refusing to touch non-local database host`, after the first two commands have already run.

Symptoms of skipping this, and what they mean:

| Symptom | Cause |
|---|---|
| `/api/graph/views` → 500, `relation "trope_graph.cards" does not exist` | `trope_graph` was never created; run the graph migrate |
| Graph endpoints answer 200 but every view is empty or `data_blocked` | schema exists, seed never ran |
| Graph shows stale claims or a missing Concept | seed is behind the corpus; re-run it — it is idempotent |
| Deploy fails at start with `BETTER_AUTH_SECRET is not set` | secret missing from the service env; unrelated to migrations |

All three commands are safe to re-run. The seeder upserts by slug and id and
`trope-graph:verify` asserts `"idempotent": true`, so re-seeding is the normal way to push a
corpus change to production.

### Build notes

Do not add `corepack enable` to the build command. Render's image already puts pnpm on
`PATH`, and corepack tries to unlink `/usr/bin/pnpm` to install its own shim, which fails with
`EROFS: read-only file system` and fails the build before anything else runs.

Use `&&`, not `;`, between install and build. With `;` the build runs even when the install
fails, producing a bundle assembled from a half-installed `node_modules` rather than a clean
failure.

Upgrading to the `starter` plan re-enables the pre-deploy chain automatically; `plan` in
`render.yaml` is the single line that changes. Note that Render's free tier spins down after
inactivity, so the first request to a cold instance can take tens of seconds.

The graph migrate needs `--allow-remote` because it refuses a non-loopback host by default.
Do not add `--reset` to it: `--reset` drops the whole `trope_graph` schema and rebuilds it,
which is a destructive local-development tool, not a deploy step.

### Environment variables

Set the `sync: false` variables in the Render dashboard. They are deliberately not in
`render.yaml`.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string. Serves the Prisma `public` schema and the Drizzle `trope_graph` schema |
| `BETTER_AUTH_SECRET` | yes | Session signing. Render generates it once from the blueprint. **Without it the deploy looks healthy but is not secure** — see below. Rotating it logs out every session |
| `BETTER_AUTH_URL` | yes | Public origin, e.g. `https://as-truth-cards.onrender.com`. Better Auth validates the `Origin` header against it |
| `NODE_ENV` | set by blueprint | `production`, which is what enables serving `dist/` |
| `TROPE_GRAPH_DATABASE_URL` | no | Only if the graph lives in a *different* database from the host app. Takes precedence over `DATABASE_URL`. Do not set it to an empty string — that is not treated as unset |
| `TROPE_GRAPH_ALLOW_REMOTE` | set by blueprint | `1`. Required for the manual seed step above; the seeder and verifier read this and have no CLI flag |
| `PORT` | set by Render | Injected automatically; `server/index.ts` falls back to `3001` |

### Why `BETTER_AUTH_SECRET` is required and enforced at startup

The build-time guarantee: in production, `server/auth.ts` calls `assertAuthSecretConfigured()` before `betterAuth()` runs, so the process exits immediately with a clear error if the secret is absent, is the published fallback, is too short, or has low entropy. `/health` will not be green and `/api/auth/*` will not answer. The server continues to run locally with a warning only.

Generate one with `openssl rand -base64 32`.

Local development uses a different set — see `.env.example`.

### Deploying by hand

For an out-of-band deploy, or for any migration on the free tier, run the three commands in
[Free-tier deploys](#free-tier-deploys-migrations-are-manual).

Migrations and seeding are the only database-writing steps in the deploy path. The
application itself is read-only with respect to `trope_graph`: the graph API projects from
live queries on each request and never migrates or seeds as a side effect of serving traffic.

### What is still transitional

The graph layer (`trope_graph`, Drizzle) is canonical for the ontology. The host deck
(`public.cards`, Prisma) is not yet migrated, and the `/api/cards` and `/api/interactions`
routes still depend on Prisma. Both schemas coexist in one database during the transition,
which is why a single `DATABASE_URL` covers both. Prisma must stay in the deployment until
those routes move to the graph layer.

Nav placeholders (Explorer, Research, Sources) are inert until their pages exist; Decks and
Graph are live.
