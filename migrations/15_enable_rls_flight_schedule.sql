-- =================================================================
-- SECURITY FIX: Enable RLS on flight_schedule table
-- =================================================================
-- 
-- This migration implements Row-Level Security (RLS) on the 
-- flight_schedule table to protect operational flight data.
--
-- POLICIES:
-- 1. SELECT: Authenticated users can view all flights (operational visibility)
-- 2. INSERT/UPDATE/DELETE: Only service role (admin/system) can modify
--
-- WARNING: After enabling RLS, make sure:
-- - Dispatch app still works (uses service role via Edge Functions)
-- - Only authorized admins can insert/update flights
-- - Sync-external-db function still works (uses service role)

-- Step 1: Enable RLS
ALTER TABLE flight_schedule ENABLE ROW LEVEL SECURITY;

-- Step 2: Create SELECT policy (View flights)
-- All authenticated users can view flights (needed for dispatch)
CREATE POLICY "authenticated_users_can_view_flights" 
  ON flight_schedule 
  FOR SELECT 
  USING (
    -- Allow if user is authenticated
    auth.role() = 'authenticated'
    OR
    -- Allow if using service_role (backend/edge functions)
    auth.role() = 'service_role'
  );

-- Step 3: Create INSERT policy (Add flights)
-- Only service role can insert (prevents user tampering)
CREATE POLICY "service_role_can_insert_flights" 
  ON flight_schedule 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- Step 4: Create UPDATE policy (Modify flights)
-- Only service role can update (prevents unauthorized changes)
CREATE POLICY "service_role_can_update_flights" 
  ON flight_schedule 
  FOR UPDATE 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 5: Create DELETE policy (Remove flights)
-- Only service role can delete
CREATE POLICY "service_role_can_delete_flights" 
  ON flight_schedule 
  FOR DELETE 
  USING (auth.role() = 'service_role');

-- Step 6: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'flight_schedule'
ORDER BY policyname;

-- ✅ Expected output: 4 policies (select, insert, update, delete)
-- ✅ All should show role = 'service_role' or 'authenticated'
