-- Add role field to users_sync table
-- Run this in Neon SQL editor or via psql

ALTER TABLE neon_auth.users_sync 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'VERIFIED';

-- Create index for better performance on role queries
CREATE INDEX IF NOT EXISTS idx_users_sync_role ON neon_auth.users_sync(role);

-- Update existing users to have VERIFIED role by default
-- You can manually update specific users to ADMIN role later
UPDATE neon_auth.users_sync 
SET role = 'VERIFIED' 
WHERE role IS NULL;

-- Example: Set a specific user as admin (replace with your email/id)
-- UPDATE neon_auth.users_sync 
-- SET role = 'ADMIN' 
-- WHERE id = 'your-user-id-here';

-- Show current users and their roles
SELECT id, name, role, created_at FROM neon_auth.users_sync ORDER BY created_at;
