import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit configuration for the Trope Graph.
 *
 * The graph lives in the `trope_graph` PostgreSQL schema, alongside the host
 * application's Prisma-managed `public` schema. `drizzle-kit` does not need to be told
 * about the schema name directly: each table module calls `pgSchema("trope_graph")`, so
 * the generated SQL is schema-qualified automatically.
 *
 * `schema` and `out` are relative to the working directory, which is how drizzle-kit
 * resolves them. Run this from inside `trope-cards/`:
 *
 *     cd trope-cards && pnpm exec drizzle-kit generate
 *
 * Passing absolute paths does not work: drizzle-kit concatenates them onto `.`, producing
 * `.//home/...`. `scripts/check-drift.mjs` therefore sets the working directory itself
 * rather than passing `--config`.
 *
 * Two concerns are deliberately separated:
 *   - `migrate` (drizzle-kit) GENERATES SQL into `drizzle-kit/generated/`. The canonical
 *     migration history is the hand-written SQL in `drizzle/`, which is applied by
 *     `src/db/migrate.ts` with a checksum ledger. Overwriting that history would discard
 *     the provenance of the v0.1-v0.9 consolidation.
 *   - `drizzle-kit generate` is therefore only a drift detector: regenerate from the
 *     schema modules and compare against the canonical history. That comparison is
 *     `pnpm run trope-graph:check-drift`, which implements it in
 *     `scripts/check-drift.mjs`; drizzle-kit's own output is not a diff, because it keeps
 *     its own snapshot under `generated/meta` and would report "no changes" even when the
 *     hand-written migrations had diverged.
 *
 * `out` is NOT `drizzle`, so an accidental `drizzle-kit push` cannot clobber the
 * canonical migrations.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle-kit/generated',
  casing: 'snake_case',
  migrations: {
    table: '__drizzle_migrations',
    schema: 'trope_graph',
  },
  dbCredentials: {
    // Resolved by the client, not by drizzle-kit, so both share one fallback chain.
    url:
      process.env.TROPE_GRAPH_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql:///trope_cards_dev',
  },
  strict: true,
  verbose: true,
})
