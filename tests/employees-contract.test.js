'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const dashboardSource = fs.readFileSync('dashboard.html', 'utf8');

// Legacy employee documents are completed for reads, but the listener must
// never write a migration merely because an old document is opened.
assert.match(appSource, /departmentId:\s*d\.departmentId \|\| Departments\.MODERATORS_ID/);
assert.match(appSource, /safe in-memory defaults only; no migration is required/);
assert.doesNotMatch(appSource, /Migration\.migrateEmployeesToDepartments/);

// Employee controls are capability-gated at both the static and dynamic UI
// layers, while direct/stale events are guarded before any business write.
assert.match(dashboardSource, /id="addModeratorBtn" data-permission="employees\.write"/);
assert.match(appSource, /const canWrite = Permissions\.can\('employees\.write'\);/);
assert.match(appSource, /const canDelete = Permissions\.can\('employees\.delete'\);/);
assert.match(appSource, /if \(!requireEmployeePermission\('employees\.write'\)\) return;/);
assert.match(appSource, /if \(!requireEmployeePermission\('employees\.delete'\)\) return;/);
assert.match(appSource, /e\.preventDefault\(\);\s*if \(!requireEmployeePermission\('employees\.write'\)\) return;/);

const permissionsContext = { console };
permissionsContext.globalThis = permissionsContext;
vm.runInNewContext(
  fs.readFileSync('js/permissions.js', 'utf8') + '\n;globalThis.__Permissions = Permissions;',
  permissionsContext,
  { filename: 'permissions.js' }
);

const Permissions = permissionsContext.__Permissions;
Permissions.setProfile({ status: 'active', permissions: ['employees.read'] });
assert.strictEqual(Permissions.can('employees.read'), true, 'read-only users retain the Employees view');
assert.strictEqual(Permissions.can('employees.write'), false, 'read-only users cannot add, edit, reactivate, or edit salary');
assert.strictEqual(Permissions.can('employees.delete'), false, 'read-only users cannot delete employees');
assert.throws(() => Permissions.require('employees.write'), /صلاحية|ØµÙ„Ø§Ø­ÙŠØ©/, 'the internal guard still denies a direct write');

console.log('employees contract tests passed');
