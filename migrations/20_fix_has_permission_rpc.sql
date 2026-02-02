-- Fix has_permission RPC function to work correctly with SECURITY DEFINER
-- The issue: hasPermission() in frontend passes user_id parameter, but migration 18 
-- redefined has_permission to NOT take user_id and use auth.uid() instead.
-- Solution: Redefine has_permission to accept p_action and p_resource only, 
-- using auth.uid() internally (SECURITY DEFINER context)

-- Drop the old function first
DROP FUNCTION IF EXISTS has_permission(UUID, VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS has_permission(TEXT, TEXT) CASCADE;

-- Create the corrected has_permission function
-- Takes: p_action (TEXT) and p_resource (TEXT)
-- Returns: BOOLEAN
-- Uses auth.uid() to get current user (works with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION has_permission(p_action TEXT, p_resource TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM role_permissions rp
    INNER JOIN permissions p ON rp.permission_id = p.id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND p.action = p_action
    AND p.resource = p_resource
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION has_permission(TEXT, TEXT) TO authenticated;

-- Verify the function is created correctly
SELECT 
  proname as function_name,
  pronargs as num_args,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'has_permission'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
