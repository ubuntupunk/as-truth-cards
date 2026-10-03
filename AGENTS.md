# Project Overview

As Truth Cards is a research tool that displays "Truth Cards" — informational cards on antisemitic tropes. The application allows users to view cards with an admin interface for managing them. It uses a PostgreSQL database (via Neon) and Prisma as the ORM. User authentication and authorization are handled by Better Auth.

## Technologies Used

- **Framework**: Vite + Preact (frontend), Express (server)
- **Language**: TypeScript (strict mode)
- **Authentication**: Better Auth
- **ORM**: Prisma (host schema) + Drizzle (graph subsystem in `trope-cards/`)
- **Database**: PostgreSQL (Neon)
- **Styling**: Tailwind CSS, shadcn-ui

## Code Standards

- Prefer Server Components where applicable; use client components only when needed
- Destructure imports when possible (e.g., `import { foo } from 'bar'`)
- Use ES modules (import/export) syntax, not CommonJS (require)
- Avoid `any` type in TypeScript
- Code is formatted with Prettier and linted with ESLint (Next.js/TypeScript rules as configured)
- Named exports preferred over default exports
- One export per file: Mandatory
- Group imports: External libraries first, then internal imports
- Use absolute imports with `@/` prefix for src directory

### Naming Conventions

- **Components**: PascalCase (e.g., `UserCard.tsx`)
- **Functions**: camelCase
- **Files**: kebab-case for utilities
- **Constants**: SCREAMING_SNAKE_CASE

### Documentation (MANDATORY)

- JSDoc required for ALL public functions, components, classes
- Complete coverage: @param, @returns, @throws, @example tags where relevant
- Components must document props and return type

### Error Handling

- Use try/catch in async operations
- Convert technical errors to user-friendly messages
- Client-side validation with Zod, server-side for security
- Comprehensive error logging with context

### Testing

- Server tests run with Node's built-in test runner via `tsx`
- Graph subsystem uses its own test suite (`pnpm run trope-graph:test`)
- Test structure: Arrange-Act-Assert where appropriate
- Mock external dependencies when testing

### Security

- Production enforces `BETTER_AUTH_SECRET` at startup (`assertAuthSecretConfigured`); refuses missing, published fallback, too-short, or low-entropy secrets. Development warns but continues.
- Do not hardcode secrets. Use environment variables.
- Input sanitization and authorization checks on server routes.
- No hardcoded sensitive values.

## Development Conventions

### Database Commands

- **Migrate (deploy):** `pnpm run db:migrate:deploy`
- **Reset:** `pnpm run db:reset`
- **Seed:** `pnpm run db:seed`
- **Graph migrate:** `pnpm run trope-graph:migrate -- --allow-remote`

### Build & Run Commands

- **Development:** `pnpm run dev`
- **Build:** `pnpm run build`
- **Start:** `pnpm run start` (Render: `pnpm run db:migrate:deploy && pnpm run trope-graph:migrate -- --allow-remote && pnpm run start`)
- **Test (all):** `pnpm run test`
- **Test (server):** `pnpm run test:server`
- **Test (graph):** `pnpm run trope-graph:test`
- **Format:** `pnpm run format`
- **Lint:** `pnpm run lint`
- **Typecheck:** `pnpm run typecheck`

### Deployment

- **Canonical host:** Render (Express server). Vercel is not a supported deployment target.
- **Health check:** `/health` returns `{"status":"ok"}` and is registered before the SPA catch-all.
- **Auth enforcement:** Production startup exits immediately if `BETTER_AUTH_SECRET` is unusable. See README for generation (`openssl rand -base64 32`).

## Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

### Landing the Plane (Session Completion)

When ending a work session, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds, typecheck
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session
