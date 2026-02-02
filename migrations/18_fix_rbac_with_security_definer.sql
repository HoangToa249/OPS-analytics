-- Fix infinite recursion: Use SECURITY DEFINER functions instead of RLS
-- This approach bypasses RLS in function context

-- First, disable RLS on all tables temporarily
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Drop all problematic policies
DROP POLICY IF EXISTS "Anyone can view roles" ON roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON roles;

DROP POLICY IF EXISTS "Anyone can view permissions" ON permissions;
DROP POLICY IF EXISTS "Only admins can modify permissions" ON permissions;

DROP POLICY IF EXISTS "Anyone can view role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Only admins can modify role permissions" ON role_permissions;

DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can modify user roles" ON user_roles;

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON audit_log;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS has_permission(text, text) CASCADE;
DROP FUNCTION IF EXISTS log_audit(text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS is_user_admin() CASCADE;
DROP FUNCTION IF EXISTS get_user_roles() CASCADE;

-- Create helper functions with SECURITY DEFINER to bypass RLS

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'admin'
  );
$$;

-- Function to get user's roles
CREATE OR REPLACE FUNCTION get_user_roles()
RETURNS TABLE(id UUID, name VARCHAR, description TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.description
  FROM roles r
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid();
$$;

-- Function to check permission
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

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit(p_action TEXT, p_resource_type TEXT, p_resource_id TEXT, p_changes JSONB DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes, ip_address)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_changes, '0.0.0.0'::inet)
  RETURNING id;
$$;

-- Drop old policies first
DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "permissions_select" ON permissions;
DROP POLICY IF EXISTS "role_permissions_select" ON role_permissions;
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_modify" ON user_roles;
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;

-- Now enable RLS with SIMPLE policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ROLES: Everyone can read
CREATE POLICY "roles_select" ON roles FOR SELECT USING (true);

-- PERMISSIONS: Everyone can read
CREATE POLICY "permissions_select" ON permissions FOR SELECT USING (true);

-- ROLE_PERMISSIONS: Everyone can read
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT USING (true);

-- USER_ROLES: Users see own, admins see all
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT 
  USING (auth.uid() = user_id OR is_user_admin());

CREATE POLICY "user_roles_modify" ON user_roles FOR ALL 
  USING (is_user_admin());

-- AUDIT_LOG: Users see own, admins see all
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT 
  USING (auth.uid() = user_id OR is_user_admin());

CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT 
  WITH CHECK (true);

-- Function to get all users with their roles (for admin management)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(id UUID, email VARCHAR, roles JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id,
    au.email,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'description', r.description
        )
        ORDER BY r.name
      ) FILTER (WHERE r.id IS NOT NULL),
      '[]'::jsonb
    ) as roles
  FROM auth.users au
  LEFT JOIN user_roles ur ON au.id = ur.user_id
  LEFT JOIN roles r ON ur.role_id = r.id
  GROUP BY au.id, au.email
  ORDER BY au.email;
$$;

-- Function to get all available roles
CREATE OR REPLACE FUNCTION get_all_roles()
RETURNS TABLE(id UUID, name VARCHAR, description TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description FROM roles;
$$;

-- Function to assign role to user (admin only)
CREATE OR REPLACE FUNCTION assign_role_to_user(p_user_id UUID, p_role_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_user_admin() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  -- Insert the role assignment
  INSERT INTO user_roles (user_id, role_id)
  VALUES (p_user_id, p_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  -- Log audit
  PERFORM log_audit('ASSIGN_ROLE', 'user_role', p_user_id::text, jsonb_build_object('role_id', p_role_id));

  RETURN true;
END;
$$;

-- Function to remove role from user (admin only)
CREATE OR REPLACE FUNCTION remove_role_from_user(p_user_id UUID, p_role_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_user_admin() INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can remove roles';
  END IF;

  -- Delete the role assignment
  DELETE FROM user_roles
  WHERE user_id = p_user_id AND role_id = p_role_id;

  -- Log audit
  PERFORM log_audit('REMOVE_ROLE', 'user_role', p_user_id::text, jsonb_build_object('role_id', p_role_id));

  RETURN true;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_role_to_user(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_role_from_user(UUID, UUID) TO authenticated;
