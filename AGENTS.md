# Project Overview

This is a Next.js application that displays "Truth Cards," informational cards on various topics related to AntiSemitism. The application allows users to view cards, with an admin interface for creating, editing, and deleting them. It uses a PostgreSQL database (via Neon) and Prisma as the ORM. User authentication and authorization are handled by Stack.

## Technologies Used

- **Framework**: Next.js
- **Language**: TypeScript (strict mode)
- **Authentication**: Stack
- **ORM**: Prisma
- **Database**: PostgreSQL (Neon)
- **Styling**: Tailwind CSS, shadcn-ui

## Code Standards

- Follow the Airbnb Style Guide for JavaScript/React patterns
- Prefer Server Components, use Client Components only when needed
- Destructure imports when possible (e.g., `import { foo } from 'bar'`)
- Use ES modules (import/export) syntax, not CommonJS (require)
- Avoid `any` type in TypeScript
- No hardcoded values - use constants file (`src/lib/constants/`)
- Code is formatted with Prettier and linted with ESLint (Next.js, Prettier, Unicorn rules)

### Naming Conventions

- **Components**: PascalCase (e.g., `UserCard.tsx`)
- **Functions**: camelCase
- **Files**: kebab-case for utilities
- **Constants**: SCREAMING_SNAKE_CASE

### Imports & Structure

- Use absolute imports with `@/` prefix for src directory
- Named exports preferred over default exports
- One export per file: Mandatory
- Group imports: External libraries first, then internal imports
- Path aliases: Use `@/` for src directory imports

### Documentation (MANDATORY)

- JSDoc required for ALL public functions, components, classes
- Complete coverage: @param, @returns, @throws, @example tags
- Examples required for complex functions
- Components must document props and return type

### Error Handling

- Use try/catch in async operations
- Convert technical errors to user-friendly messages
- Client-side validation with Zod, server-side for security
- Comprehensive error logging with context

### Testing Requirements

- Minimum 70% coverage (statements, branches, functions, lines)
- Test structure: Arrange-Act-Assert pattern
- Comprehensive mocking for external dependencies
- Unit, integration, and E2E tests required

### Best Practices

- Security: Input sanitization, authentication, authorization
- Performance: Lazy loading, image optimization, query optimization
- Accessibility: ARIA attributes, keyboard navigation, WCAG compliance

## Development Conventions

### Database Commands

- **Deploy:** `npm run db:deploy`
- **Reset:** `npm run db:reset`
- **Seed:** `npm run db:seed`

### Build & Run Commands

- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Start:** `npm run start`
- **Test:** `npm run test`
- **Format:** `npm run format`
- **Lint:** `npm run lint`

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
2. **Run quality gates** (if code changed) - Tests, linters, builds
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

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds