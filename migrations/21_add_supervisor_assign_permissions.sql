-- Add assign gates and counters permissions to SUPERVISOR role
-- This migration extends SUPERVISOR role to include gate and counter assignment

-- Get the supervisor role ID and permission IDs
DO $$
DECLARE
  supervisor_role_id UUID;
  assign_gates_perm_id UUID;
  assign_counters_perm_id UUID;
BEGIN
  -- Get supervisor role ID
  SELECT id INTO supervisor_role_id FROM roles WHERE name = 'supervisor';
  
  -- Get permission IDs for assign actions
  SELECT id INTO assign_gates_perm_id FROM permissions 
  WHERE action = 'assign' AND resource = 'gates';
  
  SELECT id INTO assign_counters_perm_id FROM permissions 
  WHERE action = 'assign' AND resource = 'counters';
  
  -- Add assign gates permission to supervisor
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (supervisor_role_id, assign_gates_perm_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  
  -- Add assign counters permission to supervisor
  INSERT INTO role_permissions (role_id, permission_id)
  VALUES (supervisor_role_id, assign_counters_perm_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  
  -- Log the change
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (
    auth.uid(),
    'UPDATE_ROLE_PERMISSIONS',
    'role',
    supervisor_role_id::text,
    jsonb_build_object(
      'added_permissions', ARRAY['assign_gates', 'assign_counters'],
      'reason', 'SUPERVISOR now can assign gates and counters'
    )
  );
END $$;

-- Verify the changes
SELECT 
  r.name as role_name,
  p.action,
  p.resource,
  p.description
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'supervisor'
ORDER BY p.action, p.resource;
