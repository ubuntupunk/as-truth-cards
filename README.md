# React Card Deck Application

[![GitHub](https://img.shields.io/badge/GitHub-ubuntupunk/as--truth--cards-blue)](https://github.com/ubuntupunk/as-truth-cards)
[![License](https://img.shields.io/badge/License-GPL-green.svg)](LICENSE)

<a href="https://github.com/pedromxavier/flag-badges">
    <img src="https://raw.githubusercontent.com/pedromxavier/flag-badges/main/badges/ZA.svg" alt="made in za">
</a>

## Project info

A Preact/React card deck application built with TypeScript and Vite, served in production by an
Express server that also exposes the API, including the read-only `/api/graph` projection.

## How can I edit this code?

There are several ways of editing your application.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & pnpm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies. pnpm, because the repo is locked
# with pnpm-lock.yaml and the production deploy installs with pnpm too.
pnpm install

# Step 4: Start the development server with auto-reloading and an instant preview.
pnpm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

- Vite + Preact (React-compatible via `preact/compat`)
- TypeScript
- Express
- shadcn-ui
- Tailwind CSS
- Drizzle ORM + PostgreSQL for `trope_graph` (canonical ontology)
- Prisma + Neon for `public` (transitional host deck)

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
| Build | `corepack enable && pnpm install --frozen-lockfile && pnpm run build` | yes | Installs dependencies, runs `prisma generate`, builds `dist/` via Vite |
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
`trope-cards/src/db/migrations/`, or anything the seeder reads under `trope-cards/src/db/seed/`
— run all three, in order:

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
