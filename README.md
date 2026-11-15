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
| Pre-deploy | `pnpm run db:migrate:deploy` | **no** | Applies pending Prisma migrations to the `public` schema, using `DATABASE_MIGRATION_URL` when set |
| Pre-deploy | `pnpm run trope-graph:migrate -- --allow-remote` | **no** | Applies pending Drizzle migrations to the `trope_graph` schema |
| Pre-deploy | `pnpm run trope-graph:seed` | **no** | Loads the authored corpus into `trope_graph` |
| Pre-deploy | `pnpm run trope-graph:verify-runtime-role` | **no** | Fails the deploy if the runtime role can still issue DDL, which is what makes discovery-event history a privilege boundary |
| Start | `pnpm run start` | yes | Runs `server/index.ts` via `tsx`; serves `dist/` and `/api/*` on `$PORT` |
| Health | `GET /health` | n/a | Liveness endpoint; Render free tier port-scans instead of using `healthCheckPath` |

**All four database steps are required, and none runs automatically today.** Nothing
creates either schema, and migrate alone creates `trope_graph` without populating it.

### Free-tier deploys: migrations are manual

Render logs `Predeploy command not run. Commands can only run on paid instance types` and
then promotes the build anyway, reporting success. **A green deploy on the free tier proves
only that the build succeeded and the process started.** It says nothing about the schema.

When migrating by hand is required — after any commit touching `prisma/migrations/`,
`trope-cards/drizzle/`, or anything the seeder reads under `trope-cards/src/db/seed/` — run
all four, in order:

```sh
pnpm run db:migrate:deploy
pnpm run trope-graph:migrate -- --allow-remote
TROPE_GRAPH_ALLOW_REMOTE=1 pnpm run trope-graph:seed
pnpm run trope-graph:verify-runtime-role
```

`TROPE_GRAPH_ALLOW_REMOTE=1` is required on the third command. The seeder reads that
variable and has no `--allow-remote` flag of its own; without it it exits with
`Refusing to touch non-local database host`, after the first two commands have already run.

The last command is the one that matters for the discovery-event boundary: it connects with
the **runtime** URL and exits non-zero if that role can still issue DDL. See
[Separating migration and runtime database roles](#separating-migration-and-runtime-database-roles).

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

### Separating migration and runtime database roles

Discovery candidates and their review history live in `trope_graph` (migrations 0012–0018).
The event log (`discovery_candidate_events`) is append-only: it rejects every `UPDATE` and
`DELETE` under all DML for every role, and `ON DELETE RESTRICT` refuses to delete a candidate
or source that has history. That is enforced by the database.

What the database **cannot** enforce on its own is that the application cannot issue DDL. A
table owner can always run `ALTER TABLE … DISABLE TRIGGER`. So the strong guarantee — the
application cannot remove history even deliberately — needs two credentials:

| Purpose | Variable | Role |
|---|---|---|
| Serving requests, seeding, verification | `DATABASE_URL`, `TROPE_GRAPH_DATABASE_URL` | non-owner app role, DML only |
| Migrations only | `DATABASE_MIGRATION_URL`, `TROPE_GRAPH_MIGRATION_URL` | owner / DDL |

Provision the runtime role **once**, with the owner URL available (the role name and password
are read from the runtime URL, so exactly what the app uses is what gets granted):

```sh
export TROPE_GRAPH_MIGRATION_URL=postgresql://neondb_owner:…@ep-…/neondb
export TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:…@ep-…/neondb

pnpm run trope-graph:provision-runtime-role -- --allow-remote
```

The script is idempotent. It creates or re-passwords the role, then:

- `USAGE` (not `CREATE`) on schema `trope_graph`;
- `SELECT, INSERT, UPDATE, DELETE` on its tables, `USAGE, SELECT` on its sequences;
- **`SELECT, INSERT` only** on `discovery_candidate_events`, so the append-only rule is a
  privilege as well as a trigger;
- the same DML grants on `public` (the Prisma models use the same runtime URL);
- `ALTER DEFAULT PRIVILEGES` so future owner-created tables inherit the DML grants;
- no `TRIGGER`, no `CREATE`, no ownership, no membership in the owner role.

Then point the application at the non-owner role and keep the owner URL only in
`DATABASE_MIGRATION_URL` / `TROPE_GRAPH_MIGRATION_URL`. `db:migrate:deploy` swaps
`DATABASE_URL` for the owner URL in its child process; `trope-graph:migrate` resolves the
owner URL directly.

Verify, and keep verifying on every deploy:

```sh
pnpm run trope-graph:verify-runtime-role
```

It connects with the **runtime** credentials and checks the live catalog: not a superuser, not
the schema owner, not a member of it, no `CREATE` on the schema, no `TRIGGER` and no
`UPDATE`/`DELETE`/`TRUNCATE` on the event log — while still being able to insert events and
read candidates. On failure it prints one line per finding with the fix.

Local development usually keeps one role (the local Postgres user). That is supported: the
same command with `-- --allow-shared-role` downgrades findings to a warning, and
`server/index.ts` logs the boundary at startup either way. The distinction is explicit rather
than implied:

| Runtime role | Guarantee |
|---|---|
| non-owner, DML only | event history immutable under DML **and** a privilege boundary against the application |
| owner or superuser | event history immutable under DML only; the application could disable the guard with DDL |

`trope-cards/test/runtime-role.integration.test.ts` is the proof for the strong case. It is
skipped unless a provisioned role is available, and then asserts the refusals that matter:
`UPDATE`/`DELETE`/`TRUNCATE` on the event log, `ALTER TABLE … DISABLE TRIGGER`,
`DROP TRIGGER`, `DROP TABLE`, `CREATE` in the schema, `SET ROLE` escalation, and deleting a
candidate that has history. Run it against a local role with:

```sh
createuser --login --pwprompt trope_app
TROPE_GRAPH_MIGRATION_URL=postgresql:///trope_cards_dev \
TROPE_GRAPH_DATABASE_URL=postgresql://trope_app:…@127.0.0.1/trope_cards_dev \
  pnpm run trope-graph:provision-runtime-role

TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev \
TROPE_GRAPH_RUNTIME_TEST_URL=postgresql://trope_app:…@127.0.0.1/trope_cards_dev \
  pnpm run trope-graph:test
```

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
`render.yaml`. If you change them through the API, read
[Editing environment variables without wiping the rest](#editing-environment-variables-without-wiping-the-rest)
first — the collection endpoint replaces the whole list.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string. Serves the Prisma `public` schema and the Drizzle `trope_graph` schema. **In production this is the non-owner runtime role** — see [Separating migration and runtime database roles](#separating-migration-and-runtime-database-roles) |
| `DATABASE_MIGRATION_URL` | no | Owner/DDL connection string used only by the migration commands (`db:migrate:deploy` uses it for Prisma; `trope-graph:migrate` falls back to it when `TROPE_GRAPH_MIGRATION_URL` is unset). Without it migrations run with the runtime role, and `trope-graph:verify-runtime-role` fails the deploy |
| `BETTER_AUTH_SECRET` | yes | Session signing. Render generates it once from the blueprint. **One secret per environment — never copy it between them**; a leaked development secret must not mint tokens production accepts, and rotation signs out the environment you rotate. **Without it the deploy looks healthy but is not secure** — see below. Rotating it logs out every session in that environment |
| `BETTER_AUTH_URL` | yes | Public origin, e.g. `https://as-truth-cards.onrender.com`. Better Auth validates the `Origin` header against it, and it builds the links in verification/reset mail. Production refuses to start if it is missing, malformed, loopback, or not `https` |
| `RESEND_API_KEY` | for email | Resend API key. Without it verification resends and password resets are **silently skipped** — the auth endpoints still answer success and nothing is dispatched. Watch for `email.skipped_unconfigured` in the service logs. The account must have a verified sending domain; **the "test-mode" restriction is account-level, not a property of the key** — this account has `medialternatives.com` verified, and delivery to a non-owner mailbox was confirmed on 2026-11-15 |
| `RESEND_FROM` | for email | Sender identity, e.g. `Trope Deck <tropes@medialternatives.com>`. Must be on a domain verified in Resend (DKIM + SPF). `tropecards.com` is not registered and cannot send. Every message carries the sponsor signature; auth mail is sent with click tracking off |
| `CORS_ORIGINS` | no | Comma-separated browser origins that may call `/api/*` cross-origin. Replaces the default *development* allow-list (`http://localhost:8080`, `http://localhost:3001`). In production the app's own origin (`BETTER_AUTH_URL`) is **always** trusted, even alongside an explicit value, so the same-origin account API cannot be excluded by config. Never `*`. See [Reverse proxy and origins](#reverse-proxy-and-origins) |
| `NODE_ENV` | set by blueprint | `production`, which is what enables serving `dist/` |
| `TROPE_GRAPH_DATABASE_URL` | no | Only if the graph lives in a *different* database from the host app. Takes precedence over `DATABASE_URL`; an empty or whitespace-only value is treated as unset and falls back to `DATABASE_URL`. Also the **runtime** graph URL, so the same non-owner rule applies |
| `TROPE_GRAPH_MIGRATION_URL` | no | Owner connection string for `trope-graph:migrate` only. Falls back to `DATABASE_MIGRATION_URL`, then to the runtime URL |
| `TROPE_GRAPH_ALLOW_REMOTE` | set by blueprint | `1`. Required for the manual seed step above; the seeder and verifier read this and have no CLI flag |
| `PORT` | set by Render | Injected automatically; `server/index.ts` falls back to `3001` |

### Editing environment variables without wiping the rest

Render's **collection** endpoint replaces the entire set:

```
PUT /v1/services/{serviceId}/env-vars
```

It returns `200 OK` with no warning and **deletes every variable not present in the request
body**, so a partial payload looks like a successful update while silently clearing the rest.
Never use it to set a single variable.

To change one variable, use the per-key endpoint, which leaves every other variable untouched:

```sh
curl -s -X PUT \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars/BETTER_AUTH_URL" \
  --data '{"value":"https://as-truth-cards.onrender.com"}'
```

If the collection endpoint is unavoidable, back up first and treat the backup as the source of
truth. Note the shapes differ: `GET .../env-vars` returns `[{ "envVar": { "key", "value" },
"cursor": "..." }]`, while the `PUT` body is `[{ "key", "value" }]` — so the raw backup cannot
be posted straight back; unwrap `.envVar` first:

```sh
# 1. Back up every variable the service holds (record shape, not PUT shape).
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars" > render-env.backup.json

# 2. Unwrap to the PUT shape, apply your change, and send the complete list.
jq '[.[].envVar] + [{"key":"MY_NEW_VAR","value":"..."}]' \
  render-env.backup.json > render-env.full.json
curl -s -X PUT -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  --data @render-env.full.json \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars"
```

Four further traps:

- The service list (`GET .../env-vars`) **excludes variables from linked environment groups**,
  so it is not a complete backup whenever a group is linked. Restoring from the backup alone
  drops the group-provided values; re-link the group instead.
- The list is paginated (`limit` tops out at 100) — a single `GET` may not return every
  variable on a service with many of them.
- Env-var changes are **not deployed automatically** — call the deploy API (or trigger a
  deploy) afterwards, regardless of the service's `autoDeploy` setting.
- `render.yaml` defines the blueprint-managed variables; the `sync: false` ones (the secret and
  DB URL) exist only on the service. A redeploy does not recreate a deleted variable; a
  Blueprint sync reconstructs the ones `render.yaml` declares, and **never** the `sync: false`
  ones — those come back only from your backup.

### Why `BETTER_AUTH_SECRET` is required and enforced at startup

The build-time guarantee: in production, `server/auth.ts` calls `assertAuthSecretConfigured()` before `betterAuth()` runs, so the process exits immediately with a clear error if the secret is absent, is the published fallback, is too short, or has low entropy. `/health` will not be green and `/api/auth/*` will not answer. The server continues to run locally with a warning only.

Generate one with `openssl rand -base64 32`.

Local development uses a different set — see `.env.example`.

#### One secret per environment, never shared

`BETTER_AUTH_SECRET` is **not** a shared project-wide value. Every environment — each
developer's machine, staging if it exists, production — gets its own, generated independently.
Do not copy a development secret into Render, and do not copy production's secret anywhere.

The reason is that Better Auth signs email-verification, email-change and password-reset tokens
as **stateless JWTs** with this secret. There is no token table: a link is valid only for the
secret that signed it, so:

- A secret shared between two environments lets a token minted in one be accepted by the other.
  That is the wrong direction of trust: a leaked `BETTER_AUTH_SECRET` from a laptop or a preview
  deploy would mint links that a deployed server happily accepts.
- Rotating a shared secret signs out of **every** environment at once, which makes routine
  rotation something people avoid.
- A link is environment-scoped. A verification email sent by a local dev server does not work
  against the deployed site, and a deployed link does not work locally against a different
  secret. That is the intended rule, not a bug hunt: run the flow in the environment whose
  address is in the link.

The same reasoning applies to `BETTER_AUTH_URL`: it decides which host the link points at, so
a local process carrying the deployed origin mails a token the deployed server will reject.
`server/auth.ts` calls `assertAuthEnvironmentConsistent()` alongside the secret check above.
In production it **refuses to start** when `BETTER_AUTH_URL` is missing, is not an absolute URL,
points at loopback (`localhost`, `127.0.0.1`, `*.localhost`), or is not `https`. Outside
production it only warns, so a developer can deliberately reproduce a remote bug — but the
warning says why the link they are about to send will fail. Both behaviours are pinned in
`server/lib/auth-environment.test.ts`.

### Transactional email (Resend)

The only mail the product sends today is Better Auth's verification and password-reset message;
both go through `sendEmail()` in `server/lib/email.ts`.

- **Sender:** `Trope Deck <tropes@medialternatives.com>`. The sending domain
  `medialternatives.com` is verified in Resend (DKIM at `resend._domainkey`, MX + SPF at `send`,
  tracking CNAME at `links`), with sending enabled in `eu-west-1`. `tropecards.com` is not
  registered, so any address there is rejected by the provider — that is why the old README and
  `render.yaml` examples were corrected.
- **Delivery is best-effort, by design.** `requireEmailVerification=false`, so email is not an
  access gate: sign-up and reset requests succeed even when mail fails, and `sendEmail()` returns
  an `EmailDeliveryResult` instead of throwing. An unconfigured sender logs
  `email.skipped_unconfigured`, a provider refusal logs `email.provider_rejected`, and a network
  failure logs `email.send_threw` — in every environment. Recipient addresses are never logged.
  The user-facing copy can only say "on its way"; surfacing the real outcome for an
  authenticated self-resend is `as-truth-cards-tid`.
- **Click tracking is off**, hard-coded in `sendEmail()`. Tracking rewrites links through the
  domain's `links.` subdomain, and verification/reset tokens are single-use: a mail-security
  scanner that prefetches a tracked URL can consume the token before the reader clicks. Click
  tracking belongs to mailouts, which are a separate sender path.
- **Every message carries the sponsor signature** — "Trope Deck is proudly sponsored by
  Medialternatives." with a link to `https://www.medialternatives.com/` — in both the plain-text
  and HTML parts (`server/lib/email-signature.ts`). The sending domain is an in-kind sponsor, so
  this is part of the message contract and is pinned by tests.
- **On Render**, `RESEND_API_KEY` and `RESEND_FROM` are `sync: false`: a Blueprint sync neither
  creates nor restores them, so they must be set on the service and backed up like any other
  dashboard-only secret.

The non-owner delivery path was verified for bd `as-truth-cards-wab` by sending through the
product's own sender to a non-owner mailbox and receiving `{delivered: true}`. The earlier
"test-mode key" diagnosis was wrong: the restriction is account-level and disappears once a
domain is verified — and this account's restriction had already been lifted.

### Reverse proxy and origins

The Express server trusts **exactly one reverse-proxy hop** (`app.set('trust proxy', 1)`), so
behind Render's edge `req.ip` resolves to the client address from `X-Forwarded-For` and
`req.protocol`/`req.secure` reflect `X-Forwarded-Proto` (public HTTPS reads as `https`). This
matters because Better Auth records IP/user-agent in account/session records. The second
trusted hop is never enabled, and `X-Forwarded-For`/`X-Forwarded-Proto` arrive overwritten by
Render — if a deploy check ever shows `req.ip` as a proxy or `10.*` address, re-verify Render's
header semantics before shipping.

CORS is an **explicit allow-list**, never the package default and never `*`: the SPA is
same-origin in production, and the only cross-origin consumers are the known development
origins (`:8080`, `:3001`) — the same list Better Auth already trusts. A disallowed browser
origin receives no `Access-Control-Allow-Origin` and is blocked by the browser; non-browser
callers (curl, health checks) are unaffected. Add any sanctioned consumer to `CORS_ORIGINS`
(which replaces the development defaults only — the deployed `BETTER_AUTH_URL` origin is always
kept in production, so an explicit list can never lock out the app's own account API).
Session cookies are `Secure` (https base URL) + `SameSite=Lax` + `httpOnly` by Better Auth
default; no override is set. The policy is reviewed and tested in
[`docs/issue-10-security-review.md`](docs/issue-10-security-review.md) (`server/security-policy.test.ts`).

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
