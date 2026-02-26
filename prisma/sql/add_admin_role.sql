-- Setup Admin Role System
-- This script creates the user_profiles table and sets up role management

-- Step 1: Create user_profiles table (run once)
CREATE TABLE IF NOT EXISTS user_profiles (
  id VARCHAR PRIMARY KEY,
  role VARCHAR(20) NOT NULL DEFAULT 'ANONYMOUS',
  bio TEXT,
  website TEXT,
  location TEXT,
  avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Step 3: Show existing users from Stack Auth's users_sync table
-- You can use these IDs to assign admin roles
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at,
  p.role
FROM neon_auth.users_sync u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at;
