# Prisma Client Setup & Database Migration

Setup Prisma client and run database migrations for UserProfile table

## Tasks
- [ ] Install Prisma 6: `bun add -d prisma@6 @prisma/client@6`
- [ ] Generate Prisma client: `bunx prisma generate`
- [ ] Run migration in Neon SQL editor (prisma/sql/001_create_user_profiles.sql)
- [ ] Set admin user role (prisma/sql/set_admin_user.sql)
- [ ] Test database connection
- [ ] Create /api/auth/user-role endpoint for Vite

## Context
New Prisma schema created with UserProfile table for role management.
The UserProfile table stores user roles separately from Stack Auth's managed users_sync table.

## Files
- prisma/schema.prisma
- prisma/sql/001_create_user_profiles.sql
- prisma/sql/set_admin_user.sql
