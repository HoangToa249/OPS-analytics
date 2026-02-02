-- Clean up and recreate all RLS policies
-- Drop ALL existing policies from all RBAC tables

DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "Anyone can view roles" ON roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON roles;

DROP POLICY IF EXISTS "permissions_select" ON permissions;
DROP POLICY IF EXISTS "Anyone can view permissions" ON permissions;
DROP POLICY IF EXISTS "Only admins can manage permissions" ON permissions;
DROP POLICY IF EXISTS "Only admins can modify permissions" ON permissions;

DROP POLICY IF EXISTS "role_permissions_select" ON role_permissions;
DROP POLICY IF EXISTS "Anyone can view role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Only admins can manage role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Only admins can modify role permissions" ON role_permissions;

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_modify" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can modify user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can insert user roles" ON user_roles;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
DROP POLICY IF EXISTS "Only admins can manage audit logs" ON audit_log;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON audit_log;

-- Make sure RLS is enabled
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create fresh policies
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
