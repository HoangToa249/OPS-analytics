import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { 
  getAllUsers, 
  getAllRoles, 
  assignRoleToUser, 
  removeRoleFromUser,
  getUserRoles,
  isAdmin
} from '../utils/permissionUtils';
import { Role, UserRole } from '../utils/permissionUtils';

interface User {
  id: string;
  email?: string;
  roles: Role[];
}

const RoleManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<Map<string, Set<string>>>(new Map());
  const [canManage, setCanManage] = useState(false);

  // Load data
  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check admin permission
      const admin = await isAdmin();
      setCanManage(admin);

      if (!admin) {
        setError('You do not have permission to manage roles');
        return;
      }

      // Load users and roles
      const [usersData, rolesData] = await Promise.all([
        getAllUsers(),
        getAllRoles()
      ]);

      setUsers(usersData);
      setRoles(rolesData);

      // Build user role map
      const roleMap = new Map<string, Set<string>>();
      usersData.forEach(user => {
        roleMap.set(user.id, new Set(user.roles.map(r => r.id)));
      });
      setUserRoles(roleMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      setError(null);
      const success = await assignRoleToUser(userId, roleId);
      
      if (success) {
        // Update local state
        const userRoleSet = userRoles.get(userId) || new Set();
        userRoleSet.add(roleId);
        setUserRoles(new Map(userRoles));
      } else {
        setError('Failed to assign role');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error assigning role');
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      setError(null);
      const success = await removeRoleFromUser(userId, roleId);
      
      if (success) {
        // Update local state
        const userRoleSet = userRoles.get(userId);
        if (userRoleSet) {
          userRoleSet.delete(roleId);
          setUserRoles(new Map(userRoles));
        }
      } else {
        setError('Failed to remove role');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing role');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 text-white p-6 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <div>
              <h2 className="text-xl font-bold">Role & Permission Manager</h2>
              <p className="text-sm text-slate-300">Manage user roles and access control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xl font-bold hover:text-red-300 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {!canManage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              ⚠️ You do not have permission to manage roles. Contact your administrator.
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <span className="ml-2 text-slate-600">Loading users and roles...</span>
            </div>
          )}

          {/* Users Table */}
          {!isLoading && canManage && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="text-left p-3 font-semibold text-slate-700">Email</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Current Roles</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Assign Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map(user => (
                      <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 text-sm text-slate-700">
                          {user.email || 'No email'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {userRoles.get(user.id)?.size === 0 ? (
                              <span className="text-slate-400 text-sm italic">No roles assigned</span>
                            ) : (
                              roles
                                .filter(role => userRoles.get(user.id)?.has(role.id))
                                .map(role => (
                                  <div
                                    key={role.id}
                                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"
                                  >
                                    {role.name}
                                    <button
                                      onClick={() => handleRemoveRole(user.id, role.id)}
                                      className="ml-1 hover:text-red-600 transition-colors"
                                      title="Remove role"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {roles
                              .filter(role => !userRoles.get(user.id)?.has(role.id))
                              .map(role => (
                                <button
                                  key={role.id}
                                  onClick={() => handleAssignRole(user.id, role.id)}
                                  className="px-3 py-1 bg-slate-200 hover:bg-blue-200 text-slate-700 hover:text-blue-700 rounded text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <Plus size={12} />
                                  {role.name}
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Role Reference */}
          {!isLoading && canManage && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="font-semibold text-slate-700 mb-4">Available Roles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map(role => (
                  <div key={role.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="font-semibold text-slate-800 capitalize">{role.name}</h4>
                    <p className="text-sm text-slate-600 mt-1">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleManagerModal;
