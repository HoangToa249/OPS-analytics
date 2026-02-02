-- RBAC (Role-Based Access Control) System
-- Creates roles, permissions, and user-role mappings

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,           -- 'view', 'edit', 'delete', 'assign_gate', etc
  resource VARCHAR(50) NOT NULL,         -- 'flights', 'gates', 'counters', 'users', etc
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(action, resource)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles table (links users to roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Create audit log for permission changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Full system access - can do everything'),
  ('dispatcher', 'Can view and edit flight assignments'),
  ('supervisor', 'Can view and approve changes'),
  ('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (action, resource, description) VALUES
  -- Flight permissions
  ('view', 'flights', 'View flight data'),
  ('edit', 'flights', 'Edit flight details'),
  ('delete', 'flights', 'Delete flights'),
  ('import', 'flights', 'Import flight data'),
  
  -- Gate permissions
  ('assign', 'gates', 'Assign gates to flights'),
  ('manage', 'gates', 'Manage gate configuration'),
  ('view', 'gates', 'View gate information'),
  
  -- Counter permissions
  ('assign', 'counters', 'Assign counters to flights'),
  ('manage', 'counters', 'Manage counter configuration'),
  ('view', 'counters', 'View counter information'),
  
  -- User management
  ('view', 'users', 'View users'),
  ('manage', 'users', 'Manage user roles and permissions'),
  ('manage', 'roles', 'Create and manage roles'),
  
  -- Analytics
  ('view', 'analytics', 'View analytics data'),
  ('export', 'analytics', 'Export analytics data'),
  
  -- System
  ('view', 'audit_log', 'View audit logs'),
  ('manage', 'system', 'System configuration')
ON CONFLICT (action, resource) DO NOTHING;

-- Assign permissions to default roles
DO $$
DECLARE
  admin_role_id UUID;
  dispatcher_role_id UUID;
  supervisor_role_id UUID;
  viewer_role_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
  SELECT id INTO dispatcher_role_id FROM roles WHERE name = 'dispatcher';
  SELECT id INTO supervisor_role_id FROM roles WHERE name = 'supervisor';
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'viewer';
  
  -- Admin: All permissions
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, id FROM permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  
  -- Dispatcher: Can view, edit, assign, and import flights/gates/counters
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT dispatcher_role_id, id FROM permissions
  WHERE (action = 'view' OR action = 'edit' OR action = 'assign' OR action = 'import')
    AND resource IN ('flights', 'gates', 'counters')
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  
  -- Supervisor: Can view everything and approve changes
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT supervisor_role_id, id FROM permissions
  WHERE action = 'view'
  ON CONFLICT (role_id, permission_id) DO NOTHING;
  
  -- Viewer: Can only view
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT viewer_role_id, id FROM permissions
  WHERE action = 'view'
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- Enable RLS on all new tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Anyone can view roles" ON roles
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage roles" ON roles
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
    )
  );

-- RLS Policies for permissions
CREATE POLICY "Anyone can view permissions" ON permissions
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage permissions" ON permissions
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
    )
  );

-- RLS Policies for role_permissions
CREATE POLICY "Anyone can view role permissions" ON role_permissions
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage role permissions" ON role_permissions
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
    )
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
  ));

CREATE POLICY "Only admins can manage user roles" ON user_roles
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
    )
  );

-- RLS Policies for audit_log
CREATE POLICY "Users can view audit logs (admin only)" ON audit_log
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
    )
  );

CREATE POLICY "Service role can insert audit logs" ON audit_log
  FOR INSERT WITH CHECK (true);

-- Create function to check permission
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, p_action VARCHAR, p_resource VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN user_roles ur ON ur.role_id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = user_id
      AND p.action = p_action
      AND p.resource = p_resource
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log audit event
CREATE OR REPLACE FUNCTION log_audit(p_action VARCHAR, p_resource_type VARCHAR, p_resource_id VARCHAR DEFAULT NULL, p_changes JSONB DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes)
  VALUES (auth.uid(), p_action, p_resource_type, p_resource_id, p_changes)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION has_permission(UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit(VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated;
