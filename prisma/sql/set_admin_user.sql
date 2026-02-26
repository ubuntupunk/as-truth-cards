-- Set User as Admin
-- Replace 'YOUR-STACK-USER-ID' with your actual Stack Auth user ID
-- You can find your user ID by running the query in add_admin_role.sql first

-- Step 1: Find your user ID (uncomment and run to list users)
-- SELECT id, email, name FROM neon_auth.users_sync ORDER BY created_at;

-- Step 2: Insert or update user profile with ADMIN role
INSERT INTO user_profiles (id, role, created_at, updated_at)
VALUES ('YOUR-STACK-USER-ID', 'ADMIN', NOW(), NOW())
ON CONFLICT (id)
DO UPDATE SET
  role = 'ADMIN',
  updated_at = NOW();

-- Step 3: Verify the update
SELECT
  u.id,
  u.email,
  u.name,
  p.role,
  p.created_at
FROM neon_auth.users_sync u
JOIN user_profiles p ON u.id = p.id
WHERE p.role = 'ADMIN';

-- Step 4: List all admins
SELECT
  u.id,
  u.email,
  u.name,
  p.role
FROM neon_auth.users_sync u
JOIN user_profiles p ON u.id = p.id
WHERE p.role IN ('ADMIN', 'MODERATOR')
ORDER BY p.role, u.created_at;
