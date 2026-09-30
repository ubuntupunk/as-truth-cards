-- Promote a user to ADMIN (or any other role on the UserRole ladder).
--
-- Replaces the Stack Auth era scripts, which promoted users by writing to a separate
-- `user_profiles` table keyed by a Stack user id, and joined against Neon Auth's
-- external `neon_auth.users_sync` table. Under Better Auth the user, their session,
-- and their role all live in this database, so promotion is a single UPDATE.
--
-- The role column is a Postgres enum, so the database rejects any value that is not
-- one of: ANONYMOUS, VERIFIED, ACADEMIC, RESEARCHER, MODERATOR, ADMIN.
--
-- Usage: edit the email below, then run. Promotion is intentionally a manual,
-- reviewed act rather than anything a user can trigger for themselves.

\set target_email 'you@example.com'
\set target_role 'ADMIN'

-- Step 1: show the user exists and what they currently have
SELECT id, email, name, role, "emailVerified", "createdAt"
FROM "user"
WHERE lower(email) = lower(:'target_email');

-- Step 2: promote. ON CONFLICT is unnecessary because this is an UPDATE of an
-- existing row, not an insert: a user must sign up before they can be promoted.
UPDATE "user"
SET role = :'target_role'::"UserRole", "updatedAt" = NOW()
WHERE lower(email) = lower(:'target_email');

-- Step 3: verify the result
SELECT id, email, name, role
FROM "user"
WHERE lower(email) = lower(:'target_email');

-- Step 4: list everyone who can moderate or administer
SELECT id, email, name, role, "createdAt"
FROM "user"
WHERE role IN ('ADMIN', 'MODERATOR')
ORDER BY role, "createdAt";
