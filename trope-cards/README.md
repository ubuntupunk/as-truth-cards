# Trope Graph

A structured, source-aware graph of the interpretive tropes used to describe
antisemitism, held in its own PostgreSQL schema and separate from the host
application's card data.

The graph records **how a claim is argued**, not whether it is true. It stores
claims, their inferential structure, the relationships between inference steps,
and eventually the evidence attached to each. It assigns no truth score, no
winner, and no preferred political interpretation.

## Relationship to the host application

The graph lives in the `trope_graph` schema. The host application — a Vite SPA
with a separate Express API, not Next.js — owns `public` via Prisma, including
its own `cards` table. The two never collide because the graph qualifies every
object with its schema. `trope_graph.cards` is a different table from
`public.cards`.

The graph is currently **not** served over any API and is not part of the
frontend bundle. It is an authoring and validation toolchain. See
[ARCHITECT_REPORT.md](docs/ARCHITECT_REPORT.md) for the integration decisions
still to be made.

The graph client accepts `DATABASE_URL` as a fallback so it can share the host's
connection. **Every write path refuses a non-loopback host by default**, because
the repository `.env` points `DATABASE_URL` at a live Neon instance. See
[Safety](#safety).

## Layout

```text
trope-cards/
  drizzle/                 canonical hand-written SQL, 0001-0007
  drizzle.config.ts        Drizzle Kit config; generates into drizzle-kit/generated/
  drizzle-kit/generated/   Drizzle Kit output; derived, never canonical
  src/db/schema/           Drizzle schema modules (source of truth for types)
  src/db/seed/             seed data and the transactional seeder
  src/db/migrate.ts        migration runner with a checksum ledger
  src/db/verify-seed.ts    idempotency and integrity verifier
  scripts/                 dependency-free source validators
  data/                    claim and evidence reference data
  docs/                    model and per-version design notes
  versions/                preserved v0.1-v0.9 source trees
```

Everything specific to the graph lives under `trope-cards/`. The only
graph-related references outside it are the root `package.json` scripts, the
root `tsconfig.json` project reference, the root `biome.json` include globs,
and the root `pnpm-workspace.yaml` build allowlist, all of which have to stay at
the repository root to function.

`trope-cards/drizzle/*.sql` is canonical. Drizzle Kit generates into
`drizzle-kit/generated/` and is used only to detect drift between the
hand-written migrations and the schema modules; its output is never applied.

## Local setup

Requires a local PostgreSQL. The database is local-only; nothing in this section
touches Neon.

```sh
createdb trope_cards_dev
export TROPE_GRAPH_DATABASE_URL=postgresql:///trope_cards_dev

pnpm run trope-graph:migrate    # apply 0001-0007
pnpm run trope-graph:seed       # load the current corpus
pnpm run trope-graph:check      # everything below, in order
```

A passwordless loopback URL is rewritten to the Unix socket, so `pg` and `psql`
authenticate the same way on a default Debian or Ubuntu install.

## Commands

Run from the repository root. All graph commands honour
`TROPE_GRAPH_DATABASE_URL`.

| Command | Purpose |
| --- | --- |
| `trope-graph:migrate` | Apply pending migrations |
| `trope-graph:migrate:check` | Report status; writes nothing |
| `trope-graph:migrate:reset` | `DROP SCHEMA trope_graph CASCADE`, then reapply. Destroys graph data |
| `trope-graph:seed` | Load the corpus in one transaction |
| `trope-graph:verify` | Seed twice, assert row counts are unchanged |
| `trope-graph:validate` | Structural validation of the seed sources |
| `trope-graph:check-drift` | Regenerate from the schema modules and compare to the database |
| `trope-graph:check` | All of the above, plus `typecheck:graph` |
| `typecheck:graph` | `tsc` over `trope-cards` |

`--allow-remote` on the migration runner, or `TROPE_GRAPH_ALLOW_REMOTE=1` on
the seed and verify entry points, are the only ways to target a remote host.

## Safety

The migration runner records each applied file in
`trope_graph.schema_migrations` with a SHA-256 of its contents, inside the same
transaction that applies it. A file whose contents changed after it was applied
is reported as drift rather than re-applied, and a failure leaves the schema at
the last migration that fully succeeded.

`--check` performs no writes at all, including no `CREATE SCHEMA` and no ledger
table; a missing ledger is reported as every migration pending.

`trope-graph:check-drift` compares the live database against a scratch database
built from the schema modules, comparing columns, constraints, indexes, and enum
labels from the system catalog. It is read-only against the live database and
drops its scratch database on exit. Object names are excluded from the
comparison, because Postgres auto-names unnamed constraints while Drizzle names
them explicitly; nothing in this codebase refers to a constraint by name.

## Current state

Seeded corpus: 5 collections, 14 mechanisms, 6 concepts, 47 cards, 19 claims,
11 relationships, 4 inference steps, 9 premises, 4 conclusions, 2 argument
chains, 4 chain steps, and 2 step relations.

Two validators report expected warnings rather than errors:

- 41 of 47 cards have no claims, and 9 claims are bound to no inference step.
  The v0.4 corpus of 152 claims is held back: 39 of its statements still read
  `SOURCE_REQUIRED` and cannot be published without located sources.
- The evidence layer is schema-only. No passages have been recorded.

The v0.6 claim-type assignments in `src/db/seed/identityRetrospection.ts` are
editorial judgments and should be reviewed before wider publication.

## Adding a migration

1. Write `trope-cards/drizzle/00NN_description.sql` by hand. Never edit an
   already-applied file; the checksum ledger will refuse to re-apply it.
2. Mirror the change in `src/db/schema/`.
3. Run `pnpm run trope-graph:migrate:reset` locally, then
   `pnpm run trope-graph:check`.

If a migration must undo data, write the compensating migration. The runner has
no down path by design.
