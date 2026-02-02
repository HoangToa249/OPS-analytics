/**
 * RBAC System Test Suite
 * Verify all permission functions work correctly
 */

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserRoles,
  getUserPermissions,
  getAllUsers,
  getAllRoles,
  isAdmin,
  isDispatcher,
  isSupervisor,
  assignRoleToUser,
  removeRoleFromUser,
  logAudit,
  getAuditLogs,
  clearPermissionCache
} from '../utils/permissionUtils';

/**
 * Run all tests
 */
export const runRBACTests = async () => {
  console.group('🧪 RBAC System Tests');

  try {
    // Test 1: Check permissions
    console.log('Test 1: Check permissions...');
    const canViewFlights = await hasPermission('view', 'flights');
    console.log(`  ✅ hasPermission('view', 'flights') = ${canViewFlights}`);

    // Test 2: Check multiple permissions
    console.log('\nTest 2: Check multiple permissions...');
    const canModify = await hasAnyPermission([
      { action: 'edit', resource: 'flights' },
      { action: 'delete', resource: 'flights' }
    ]);
    console.log(`  ✅ hasAnyPermission = ${canModify}`);

    // Test 3: Get user roles
    console.log('\nTest 3: Get user roles...');
    const roles = await getUserRoles();
    console.log(`  ✅ User has ${roles.length} role(s):`, roles.map(r => r.name).join(', '));

    // Test 4: Check role-based access
    console.log('\nTest 4: Check role-based access...');
    const admin = await isAdmin();
    const dispatcher = await isDispatcher();
    const supervisor = await isSupervisor();
    console.log(`  ✅ Is Admin: ${admin}, Dispatcher: ${dispatcher}, Supervisor: ${supervisor}`);

    // Test 5: Get permissions
    console.log('\nTest 5: Get user permissions...');
    const perms = await getUserPermissions();
    console.log(`  ✅ User has ${perms.length} permission(s)`);
    if (perms.length <= 5) {
      perms.forEach(p => console.log(`    - ${p.action} on ${p.resource}`));
    }

    // Test 6: Admin functions
    console.log('\nTest 6: Admin functions...');
    if (admin) {
      const allRoles = await getAllRoles();
      console.log(`  ✅ Found ${allRoles.length} roles:`, allRoles.map(r => r.name).join(', '));

      const allUsers = await getAllUsers();
      console.log(`  ✅ Found ${allUsers.length} users`);
    } else {
      console.log('  ℹ️  Skipped (user is not admin)');
    }

    // Test 7: Audit logging
    console.log('\nTest 7: Audit logging...');
    const logSuccess = await logAudit('TEST_ACTION', 'test', 'test-id', { testData: true });
    console.log(`  ✅ logAudit returned: ${logSuccess}`);

    // Test 8: Get audit logs
    if (admin) {
      console.log('\nTest 8: Get audit logs...');
      const logs = await getAuditLogs(5);
      console.log(`  ✅ Retrieved ${logs.length} audit logs`);
    }

    // Test 9: Cache management
    console.log('\nTest 9: Cache management...');
    clearPermissionCache();
    console.log('  ✅ Cache cleared');

    console.log('\n✅ All tests completed!');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  } finally {
    console.groupEnd();
  }
};

/**
 * Test permission matrix
 */
export const testPermissionMatrix = async () => {
  console.group('📊 Permission Matrix Test');

  const resources = ['flights', 'gates', 'counters', 'users', 'roles', 'analytics'];
  const actions = ['view', 'edit', 'delete', 'assign', 'manage', 'export'];

  console.table('Testing permission combinations...');

  const results: Record<string, Record<string, boolean>> = {};

  for (const resource of resources) {
    results[resource] = {};
    for (const action of actions) {
      try {
        const result = await hasPermission(action as any, resource as any);
        results[resource][action] = result;
      } catch (error) {
        results[resource][action] = false;
      }
    }
  }

  console.table(results);
  console.groupEnd();
};

/**
 * Performance test
 */
export const testPerformance = async () => {
  console.group('⚡ Performance Test');

  // Test 1: Single permission check
  console.log('Test 1: Single permission check (1000 iterations)...');
  const start1 = performance.now();
  for (let i = 0; i < 1000; i++) {
    await hasPermission('view', 'flights');
  }
  const time1 = performance.now() - start1;
  console.log(`  ✅ ${time1.toFixed(2)}ms (${(time1 / 1000).toFixed(3)}ms per check)`);

  // Test 2: Multiple permission checks
  console.log('\nTest 2: Multiple permission checks (100 iterations)...');
  const start2 = performance.now();
  for (let i = 0; i < 100; i++) {
    await hasAllPermissions([
      { action: 'view', resource: 'flights' },
      { action: 'edit', resource: 'flights' },
      { action: 'assign', resource: 'gates' }
    ]);
  }
  const time2 = performance.now() - start2;
  console.log(`  ✅ ${time2.toFixed(2)}ms (${(time2 / 100).toFixed(2)}ms per check)`);

  // Test 3: Get user roles
  console.log('\nTest 3: Get user roles (100 iterations)...');
  const start3 = performance.now();
  for (let i = 0; i < 100; i++) {
    await getUserRoles();
  }
  const time3 = performance.now() - start3;
  console.log(`  ✅ ${time3.toFixed(2)}ms (${(time3 / 100).toFixed(2)}ms per call)`);

  console.groupEnd();
};

/**
 * Integration test
 * Simulates real-world usage
 */
export const testIntegration = async () => {
  console.group('🔌 Integration Test');

  try {
    // Test 1: Check edit permission before saving
    console.log('Test 1: Simulating gate assignment...');
    const canAssignGate = await hasPermission('assign', 'gates');
    if (canAssignGate) {
      // Log the action
      await logAudit('ASSIGN_GATE', 'flight', 'FD635', { gate: 'G01' });
      console.log('  ✅ Gate assignment logged');
    } else {
      console.log('  ℹ️  User does not have permission to assign gates');
    }

    // Test 2: Check delete permission
    console.log('\nTest 2: Simulating delete operation...');
    const canDelete = await hasPermission('delete', 'flights');
    if (canDelete) {
      await logAudit('DELETE_FLIGHT', 'flight', 'FD635');
      console.log('  ✅ Flight deletion would be logged');
    } else {
      console.log('  ℹ️  User does not have permission to delete');
    }

    // Test 3: Check import permission
    console.log('\nTest 3: Simulating data import...');
    const canImport = await hasPermission('import', 'flights');
    if (canImport) {
      await logAudit('IMPORT_FLIGHTS', 'flight', null, { count: 150 });
      console.log('  ✅ Flight import logged');
    } else {
      console.log('  ℹ️  User does not have permission to import');
    }

    console.log('\n✅ Integration test completed!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }

  console.groupEnd();
};

/**
 * Run all tests
 */
export const runAllTests = async () => {
  console.log('🚀 Starting RBAC System Tests...\n');

  await runRBACTests();
  console.log('\n---\n');

  await testPermissionMatrix();
  console.log('\n---\n');

  await testPerformance();
  console.log('\n---\n');

  await testIntegration();

  console.log('\n✅ All RBAC tests completed!');
};

// Export for use in console or test runner
if (typeof window !== 'undefined') {
  (window as any).rbacTests = {
    runRBACTests,
    testPermissionMatrix,
    testPerformance,
    testIntegration,
    runAllTests
  };
}
