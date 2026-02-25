-- ================================================================
-- CREATE RPC FUNCTION FOR DELETE OPERATION
-- ================================================================
-- This function allows authenticated users to delete flight records
-- if they have the 'delete' permission on 'flights' resource.
--
-- IMPORTANT: Database stores times in LOCAL format (not UTC)
-- User selects local time range, we query directly without timezone conversion
--
-- Usage from frontend:
-- ```typescript
-- const { data, error } = await supabase.rpc('delete_flights_in_range', {
--   p_from_local: '2026-02-12T05:00',   -- Local time (e.g., Bangkok  05:00)
--   p_to_local: '2026-02-13T05:00'      -- Local time (e.g., Bangkok 05:00)
-- });
-- ```

DROP FUNCTION IF EXISTS delete_flights_in_range(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS delete_flights_in_range(TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION delete_flights_in_range(
  p_from_local TEXT,
  p_to_local TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  deleted_count INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_permission BOOLEAN;
  v_deleted_count INTEGER := 0;
  v_from_ts TIMESTAMP;
  v_to_ts TIMESTAMP;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      'User not authenticated'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user has 'delete' permission on 'flights'
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = v_user_id
    AND p.action = 'delete'
    AND p.resource = 'flights'
    LIMIT 1
  ) INTO v_has_permission;
  
  -- If user doesn't have permission, return error
  IF NOT v_has_permission THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      'User does not have delete permission on flights'::TEXT;
    RETURN;
  END IF;
  
  -- Parse timestamps (no timezone conversion, just local times)
  BEGIN
    -- Handle format like "2026-02-12T05:00" or "2026-02-12 05:00"
    v_from_ts := (REPLACE(p_from_local, 'T', ' '))::TIMESTAMP;
    v_to_ts := (REPLACE(p_to_local, 'T', ' '))::TIMESTAMP;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      'Invalid date format: ' || SQLERRM;
    RETURN;
  END;
  
  -- Log debug info
  RAISE NOTICE '[Delete RPC] User: %, From: %, To: %', v_user_id, v_from_ts, v_to_ts;
  
  -- Delete records where sta or std falls within the LOCAL time range
  DELETE FROM flight_schedule
  WHERE (
    -- STA within range
    (sta >= v_from_ts AND sta <= v_to_ts)
    OR
    -- STD within range
    (std >= v_from_ts AND std <= v_to_ts)
    OR
    -- Record spans the range (starts before, ends after)
    (sta < v_from_ts AND std > v_to_ts)
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Return success
  RETURN QUERY SELECT 
    true, 
    v_deleted_count, 
    NULL::TEXT;
    
EXCEPTION WHEN OTHERS THEN
  -- Return error details
  RETURN QUERY SELECT 
    false, 
    0, 
    'Delete failed: ' || SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_flights_in_range(TEXT, TEXT) TO authenticated;

-- Verify function exists
SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'delete_flights_in_range';
