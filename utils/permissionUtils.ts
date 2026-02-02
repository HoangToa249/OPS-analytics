/**
 * Permission & Authorization Utilities
 * Handles role-based access control (RBAC)
 */

import { supabase } from '../supabaseClient';

export type Action = 'view' | 'edit' | 'delete' | 'import' | 'assign' | 'manage' | 'export';
export type Resource = 'flights' | 'gates' | 'counters' | 'users' | 'roles' | 'analytics' | 'audit_log' | 'system';

export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface Permission {
  id: string;
  action: Action;
  resource: Resource;
  description: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  role?: Role;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  changes?: Record<string, any>;
  created_at: string;
}

/**
 * Check if user has specific permission
 */
export const hasPermission = async (
  action: Action,
  resource: Resource
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user has permission via database function
    // Note: has_permission is a SECURITY DEFINER function that uses auth.uid() internally
    // so we only pass p_action and p_resource
    const { data, error } = await supabase.rpc('has_permission', {
      p_action: action,
      p_resource: resource
    });

    if (error) {
      console.error('[hasPermission] Error:', error);
      console.error('[hasPermission] Details:', { action, resource, userId: user.id });
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('[hasPermission] Exception:', error);
    return false;
  }
};

/**
 * Check multiple permissions (returns true if user has ANY)
 */
export const hasAnyPermission = async (
  permissions: Array<{ action: Action; resource: Resource }>
): Promise<boolean> => {
  const results = await Promise.all(
    permissions.map(p => hasPermission(p.action, p.resource))
  );
  return results.some(r => r === true);
};

/**
 * Check multiple permissions (returns true if user has ALL)
 */
export const hasAllPermissions = async (
  permissions: Array<{ action: Action; resource: Resource }>
): Promise<boolean> => {
  const results = await Promise.all(
    permissions.map(p => hasPermission(p.action, p.resource))
  );
  return results.every(r => r === true);
};

/**
 * Get user's roles
 */
export const getUserRoles = async (): Promise<Role[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_roles')
      .select('role:roles(*)')
      .eq('user_id', user.id);

    if (error) throw error;

    return (data || [])
      .map((ur: any) => ur.role)
      .filter((role): role is Role => role !== null && role !== undefined);
  } catch (error) {
    console.error('[getUserRoles] Error:', error);
    return [];
  }
};

/**
 * Get user's permissions
 */
export const getUserPermissions = async (): Promise<Permission[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission:permissions(*)')
      .in('role_id', [
        // Get all role IDs for this user
        (await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', user.id)
        ).data?.map((ur: any) => ur.role_id) || []
      ]);

    if (error) throw error;

    return (data || [])
      .map((rp: any) => rp.permission)
      .filter((perm): perm is Permission => perm !== null && perm !== undefined);
  } catch (error) {
    console.error('[getUserPermissions] Error:', error);
    return [];
  }
};

/**
 * Get all roles (admin only)
 */
export const getAllRoles = async (): Promise<Role[]> => {
  try {
    // Call SQL function that uses SECURITY DEFINER
    const { data, error } = await supabase
      .rpc('get_all_roles');

    if (error) {
      console.error('[getAllRoles] Error calling get_all_roles:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[getAllRoles] Error:', error);
    return [];
  }
};

/**
 * Get all users with their roles (admin only)
 */
export const getAllUsers = async (): Promise<Array<{ id: string; email?: string; roles: Role[] }>> => {
  try {
    // Call SQL function that uses SECURITY DEFINER
    const { data, error } = await supabase
      .rpc('get_all_users');

    if (error) {
      console.error('[getAllUsers] Error calling get_all_users:', error);
      throw error;
    }

    return (data || []).map((user: any) => ({
      id: user.id,
      email: user.email,
      roles: (user.roles || [])
    }));
  } catch (error) {
    console.error('[getAllUsers] Error:', error);
    return [];
  }
};

/**
 * Assign role to user (admin only)
 */
export const assignRoleToUser = async (
  userId: string,
  roleId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('assign_role_to_user', { 
        p_user_id: userId, 
        p_role_id: roleId 
      });

    if (error) {
      console.error('[assignRoleToUser] Error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('[assignRoleToUser] Error:', error);
    return false;
  }
};

/**
 * Remove role from user (admin only)
 */
export const removeRoleFromUser = async (
  userId: string,
  roleId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('remove_role_from_user', { 
        p_user_id: userId, 
        p_role_id: roleId 
      });

    if (error) {
      console.error('[removeRoleFromUser] Error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('[removeRoleFromUser] Error:', error);
    return false;
  }
};

/**
 * Create new role (admin only)
 */
export const createRole = async (
  name: string,
  description?: string
): Promise<Role | null> => {
  try {
    const canManage = await hasPermission('manage', 'roles');
    if (!canManage) {
      console.warn('[createRole] User does not have permission');
      return null;
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({ name, description })
      .select()
      .single();

    if (error) throw error;

    // Log audit event
    await logAudit('CREATE_ROLE', 'role', name, { description });

    return data;
  } catch (error) {
    console.error('[createRole] Error:', error);
    return null;
  }
};

/**
 * Get audit logs (admin only)
 */
export const getAuditLogs = async (
  limit: number = 100,
  offset: number = 0
): Promise<AuditLog[]> => {
  try {
    const canView = await hasPermission('view', 'audit_log');
    if (!canView) {
      console.warn('[getAuditLogs] User does not have permission');
      return [];
    }

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[getAuditLogs] Error:', error);
    return [];
  }
};

/**
 * Log audit event
 */
export const logAudit = async (
  action: string,
  resourceType: string,
  resourceId?: string,
  changes?: Record<string, any>
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('log_audit', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_changes: changes ? JSON.stringify(changes) : null
    });

    if (error) throw error;

    return !!data;
  } catch (error) {
    console.error('[logAudit] Error:', error);
    return false;
  }
};

/**
 * Check if user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  const roles = await getUserRoles();
  return roles.some(r => r.name === 'admin');
};

/**
 * Check if user is dispatcher
 */
export const isDispatcher = async (): Promise<boolean> => {
  const roles = await getUserRoles();
  return roles.some(r => r.name === 'dispatcher' || r.name === 'admin');
};

/**
 * Check if user is supervisor
 */
export const isSupervisor = async (): Promise<boolean> => {
  const roles = await getUserRoles();
  return roles.some(r => r.name === 'supervisor' || r.name === 'admin');
};

/**
 * Cache user permissions for better performance
 * Usage: const perms = await getCachedUserPermissions();
 */
let cachedPermissions: Permission[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedUserPermissions = async (): Promise<Permission[]> => {
  const now = Date.now();
  if (cachedPermissions && (now - cacheTime) < CACHE_DURATION) {
    return cachedPermissions;
  }

  cachedPermissions = await getUserPermissions();
  cacheTime = now;
  return cachedPermissions;
};

/**
 * Clear permission cache
 */
export const clearPermissionCache = (): void => {
  cachedPermissions = null;
  cacheTime = 0;
};
