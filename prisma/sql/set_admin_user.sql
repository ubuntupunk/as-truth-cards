-- Update user role to ADMIN
-- Replace 'your-user-id-here' with your actual Stack user ID
-- You can find your user ID from the Stack dashboard or debug page

-- First, let's see what users exist
SELECT id, name, role, created_at FROM neon_auth.users_sync ORDER BY created_at LIMIT 10;

-- Then update the specific user to ADMIN
-- Example: 
UPDATE neon_auth.users_sync 
SET role = 'ADMIN' 
WHERE id = 'your-user-id-here';

-- Verify the update
SELECT id, name, role, created_at FROM neon_auth.users_sync WHERE role = 'ADMIN';
