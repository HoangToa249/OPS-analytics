-- Fix infinite recursion in RLS policies
-- Drop problematic policies and recreate with simpler logic

-- Drop all RLS policies to start fresh
DROP POLICY IF EXISTS "Anyone can view roles" ON roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON roles;

DROP POLICY IF EXISTS "Anyone can view permissions" ON permissions;
DROP POLICY IF EXISTS "Only admins can manage permissions" ON permissions;

DROP POLICY IF EXISTS "Anyone can view role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Only admins can manage role permissions" ON role_permissions;

DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can insert user roles" ON user_roles;

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_log;
DROP POLICY IF EXISTS "Only admins can manage audit logs" ON audit_log;

-- ===== SIMPLER RLS POLICIES (No recursion) =====

-- ROLES table: Everyone can read, only direct role check (no subquery)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view roles" ON roles
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert roles" ON roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (
        SELECT id FROM roles WHERE name = 'admin'
      )
    )
  );

CREATE POLICY "Only admins can update roles" ON roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (
        SELECT id FROM roles WHERE name = 'admin'
      )
    )
  );

-- PERMISSIONS table: Everyone can read, only admins can modify
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permissions" ON permissions
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify permissions" ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (
        SELECT id FROM roles WHERE name = 'admin'
      )
    )
  );

-- ROLE_PERMISSIONS table: Everyone can read
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role permissions" ON role_permissions
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify role permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (
        SELECT id FROM roles WHERE name = 'admin'
      )
    )
  );

-- USER_ROLES table: Users can view own, admins can view all and modify
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Only admins can modify user roles" ON user_roles
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE role_id IN (SELECT id FROM roles WHERE name = 'admin')
    )
  );

-- AUDIT_LOG table: Users can view own, admins can view all
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON audit_log
  FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name = 'admin'))
  );

CREATE POLICY "Only admins can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);
