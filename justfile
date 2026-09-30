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
