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

| Stage | Command | Purpose |
|---|---|---|
| Build | `corepack enable && pnpm install --frozen-lockfile && pnpm run build` | Installs dependencies, runs `prisma generate`, builds `dist/` via Vite |
| Pre-deploy | `pnpm run db:migrate:deploy` | Applies pending Prisma migrations to the `public` schema |
| Pre-deploy | `pnpm run trope-graph:migrate -- --allow-remote` | Applies pending Drizzle migrations to the `trope_graph` schema |
| Start | `pnpm run start` | Runs `server/index.ts` via `tsx`; serves `dist/` and `/api/*` on `$PORT` |
| Health | `GET /health` | Liveness probe wired to `healthCheckPath` |

**Both migration steps are required.** Nothing creates either schema automatically. A deploy
that skips them produces a process that starts and then fails on first request.

The trope_graph step needs `--allow-remote` because it refuses a non-loopback host by
default. Do not add `--reset` to it: `--reset` drops the whole `trope_graph` schema and
rebuilds it, which is a destructive local-development tool, not a deploy step.

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
| `PORT` | set by Render | Injected automatically; `server/index.ts` falls back to `3001` |

### Why `BETTER_AUTH_SECRET` is required even though nothing fails without it

This is worth stating plainly, because the failure mode is invisible. If the variable is unset,
the server still boots, `/health` still returns `200`, and `/api/auth/*` still answers. Better
Auth quietly substitutes a hardcoded default secret that is published in its own source. Session
cookies are signed with it, so anyone who knows the constant — which is everyone — can mint a
valid session cookie, including one carrying an `ADMIN` role.

So a deploy missing this variable is not a broken deploy; it is an authentication bypass wearing a
green health check. Verify it is set before trusting a production URL.

Generate one with `openssl rand -base64 32`.

Local development uses a different set — see `.env.example`.

### Deploying by hand

For an out-of-band deploy (for example, a one-off migration against a hosted database):

```sh
pnpm run db:migrate:deploy
pnpm run trope-graph:migrate -- --allow-remote
```

Migrations are the only database-writing step in the deploy path. The application itself is
read-only with respect to `trope_graph`: the graph API projects from live queries on each
request and never migrates or seeds as a side effect of serving traffic.

### What is still transitional

The graph layer (`trope_graph`, Drizzle) is canonical for the ontology. The host deck
(`public.cards`, Prisma) is not yet migrated, and the `/api/cards` and `/api/interactions`
routes still depend on Prisma. Both schemas coexist in one database during the transition,
which is why a single `DATABASE_URL` covers both. Prisma must stay in the deployment until
those routes move to the graph layer.
