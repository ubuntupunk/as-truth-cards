# Common tasks for as-truth-cards.
#
# Run `just` with no arguments to list every recipe.
#
# Recipes delegate to the scripts in package.json; this file only adds the
# environment wiring (notably TROPE_GRAPH_DATABASE_URL) that is easy to forget.

# List available recipes
default:
    @just --list

# ---------------------------------------------------------------- app

# Run the app: Vite on :8080 and the API on :3001
dev:
    pnpm run dev:all

# Run only the Vite dev server
dev-web:
    pnpm run dev

# Run only the Express API
dev-api:
    pnpm run server:dev

# Kill the Express API on :3001, leaving any running Vite server alone
kill-api:
    @pids="$(lsof -ti tcp:3001 2>/dev/null)"; \
    if [ -z "$pids" ]; then echo "nothing listening on :3001"; else \
      echo "killing express on :3001 (pid $pids)"; kill -9 $pids; fi

# Kill the whole dev stack: Express on :3001, Vite on :8080, and any orphaned processes
#
# Killing by port alone is not enough. A `concurrently` supervisor that was killed
# directly leaves its children reparented to init; they release their listeners but stay
# resident holding memory. So this also matches the dev process command lines.
#
# Every pattern is bracketed and `$$` is filtered, because this recipe's own command line is
# itself a `pgrep -f` target for any name it contains. Without that it would kill itself.
kill:
    @pids="$(lsof -ti tcp:3001,tcp:8080 2>/dev/null)"; \
    if [ -n "$pids" ]; then echo "freeing ports (pid $pids)"; kill -9 $pids 2>/dev/null; fi; \
    orphans="$(pgrep -f "[v]ite/bin/vite.js|[t]sx watch server|[c]oncurrently" 2>/dev/null | grep -v "^$$\$" || true)"; \
    if [ -n "$orphans" ]; then echo "killing dev processes (pid $(echo $orphans))"; kill -9 $orphans 2>/dev/null; fi; \
    sleep 1; \
    if lsof -ti tcp:3001,tcp:8080 >/dev/null 2>&1; then \
      echo "warning: :3001 or :8080 still in use"; else echo "ports :3001 and :8080 are free"; fi

# Build for production
build:
    pnpm run build

# Serve the production build locally
start:
    NODE_ENV=production pnpm run start

# Typecheck, lint, and check formatting
check:
    pnpm run typecheck
    pnpm run lint
    npx biome format .

# Typecheck everything, including the server project
typecheck-all:
    pnpm run typecheck:all

# ---------------------------------------------------------------- public cards (Prisma)

# Load the public card corpus
db-seed:
    pnpm run db:seed

# Open Prisma Studio
db-studio:
    pnpm run db:studio

# Apply a Prisma migration
db-migrate:
    pnpm run db:migrate

# Sync the Prisma schema without a migration
db-push:
    pnpm run db:push

# Regenerate the Prisma client
db-generate:
    pnpm run db:generate

# ---------------------------------------------------------------- trope graph

# Create the local trope graph database
graph-create-db:
    @createdb trope_cards_dev 2>/dev/null || echo "trope_cards_dev already exists"

# Apply pending trope graph migrations
graph-migrate:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:migrate

# Load the trope graph seed corpus
graph-seed:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:seed

# Drop, reapply, and reseed the trope graph schema
graph-reset:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:migrate:reset
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:seed

# Every trope graph gate: migration status, validation, types, verify, tests, drift
graph-check:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:check

# Run the trope graph test suites
graph-test:
    pnpm run trope-graph:test

# Validate the seed sources without a database
graph-validate:
    pnpm run trope-graph:validate

# Show trope graph row counts and any integrity errors
graph-verify:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:verify

# Compare the live schema against the Drizzle modules
graph-drift:
    TROPE_GRAPH_DATABASE_URL="{{trope_graph_db}}" pnpm run trope-graph:check-drift

# ---------------------------------------------------------------- housekeeping

# Lint, format, and typecheck
fix:
    pnpm run lint:fix
    pnpm run format
    pnpm run typecheck

# ---------------------------------------------------------------- settings

# Connection string for the local trope graph database
trope_graph_db := env_var_or_default("TROPE_GRAPH_DATABASE_URL", "postgresql:///trope_cards_dev")
