'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const rulesSource = fs.readFileSync('firebase/firestore.rules', 'utf8');
const authSource = fs.readFileSync('js/auth.js', 'utf8');
const usersSource = fs.readFileSync('js/user-management.js', 'utf8');
const permissionsSource = fs.readFileSync('js/permissions.js', 'utf8');
const dashboardSource = fs.readFileSync('dashboard.html', 'utf8');

// Firestore remains the authority for every direct API path. A missing legacy
// status is safe-compatible, while every explicit inactive state is denied.
assert.match(rulesSource, /function hasActiveProfile\(\) \{[\s\S]*?!.*keys\(\)\.hasAll\(\['status'\]\)[\s\S]*?\.status == 'active'/,
  'legacy profiles retain active-safe compatibility and explicit statuses are enforced');
assert.match(rulesSource, /function hasAnyPermission\(required\) \{[\s\S]*?return hasActiveProfile\(\)/,
  'all persisted-permission checks require an active profile');
assert.match(rulesSource, /function isSuperAdmin\(\) \{[\s\S]*?return hasActiveProfile\(\)/,
  'inactive Super Admin profiles cannot retain management access');
assert.match(rulesSource, /function isSafePendingRegistration\(\) \{[\s\S]*?role == 'pending'[\s\S]*?status == 'pending'[\s\S]*?permissions\.size\(\) == 0/,
  'self-registration creates only an inert pending profile');
assert.match(rulesSource, /function isOwnActivityUpdate\(userId\) \{[\s\S]*?request\.auth\.uid == userId[\s\S]*?hasOnly\(\['lastLoginAt', 'lastActivityAt'\]\)/,
  'users can update only their own session timestamps');
assert.match(rulesSource, /function isOwnSessionAudit\(\) \{[\s\S]*?action == 'auth\.login'[\s\S]*?action == 'auth\.logout'[\s\S]*?documentId == request\.auth\.uid[\s\S]*?userId == request\.auth\.uid/,
  'Audit permits only self-attributed Login/Logout events');
assert.match(rulesSource, /request\.resource\.data\.claimedBy == request\.auth\.uid[\s\S]*?existsAfter\([^\n]+users\/\$\(request\.auth\.uid\)\)[\s\S]*?getAfter\([^\n]+users\/\$\(request\.auth\.uid\)\)\.data\.role == 'admin'/,
  'the bootstrap marker requires the matching first-admin profile in the same atomic write');
assert.match(rulesSource, /function isBootstrapProfile\(\) \{[\s\S]*?existsAfter\([^\n]+settings\/adminBootstrap\)[\s\S]*?getAfter\([^\n]+settings\/adminBootstrap\)\.data\.claimedBy == request\.auth\.uid/,
  'an initial admin profile cannot be created without the matching marker transaction');
assert.match(rulesSource, /allow update: if isSuperAdmin\(\) \|\| isOwnActivityUpdate\(userId\);/,
  'non-admin profile writes remain limited to the timestamp allowlist');
assert.match(rulesSource, /allow create: if isOwnSessionAudit\(\) \|\| hasAnyPermission\(/,
  'the audit exception does not open general Audit writes');

// Authentication normalizes legacy documents only in memory and never writes
// roles/permissions during a normal sign-in. Activity is written after the
// active-dashboard check.
assert.doesNotMatch(authSource, /migratedAt: firebase\.firestore\.FieldValue\.serverTimestamp\(\)/,
  'legacy profile normalization is no longer a client-side migration');
assert.match(authSource, /Permissions\.setProfile\(profile\);[\s\S]*?if \(\(profile\.status \|\| 'active'\) !== 'active' \|\| !Permissions\.can\('dashboard\.read'\)\)[\s\S]*?await db\.collection\(COLLECTIONS\.USERS\)\.doc\(user\.uid\)\.set\(\{ lastActivityAt:/,
  'only an active dashboard user records page activity');
assert.match(authSource, /const profile = await ensureUserDoc\(cred\.user\);[\s\S]*?const status = profile\.status \|\| 'active';[\s\S]*?error\.code = status === 'pending' \? 'auth\/account-pending' : 'auth\/account-inactive';/,
  'a first sign-in safely provisions the pending profile and reports its actual lifecycle state');
assert.match(authSource, /'auth\/account-pending': 'تم إنشاء طلب الحساب بنجاح وهو بانتظار تفعيل المسؤول\.'/,
  'pending Firebase Auth users receive the actionable approval message');
assert.match(dashboardSource, /data-config-content="bonus"><div class="settings-card">[\s\S]*?<div class="settings-bonus-content">[\s\S]*?<\/div><\/div><div class="settings-card">/,
  'the Settings bonus cards remain structurally balanced so User Management stays inside main content');

// No permission is introduced: the Users editor exposes existing system keys.
['dashboard.read', 'departments.read', 'departments.write', 'shipping.import',
  'salary_processing.read', 'salary_processing.write', 'salary_processing.approve',
  'salary_processing.pay', 'salary_processing.export', 'roles.manage']
  .forEach(permission => assert.match(usersSource, new RegExp(`'${permission.replace('.', '\\.').replace('_', '\\_')}'`), `${permission} is presented by User Management`));

// Client-side role coverage mirrors the stored permission model. "Moderator"
// is represented by the existing Supervisor operational role; no new role is
// invented by this test or this stage.
const context = vm.createContext({});
vm.runInContext(permissionsSource, context);
const permissions = vm.runInContext('Permissions', context);
const setProfile = (role, status = 'active', permissionsList) => {
  permissions.setProfile({ role, status, permissions: permissionsList || permissions.effective(role) });
};

setProfile('super_admin', 'active', ['*']);
assert(permissions.can('users.manage'), 'Super Admin retains full management access');
setProfile('admin');
assert(permissions.can('orders.write') && permissions.can('reports.approve'), 'Admin retains its existing operational permissions');
assert(!permissions.can('users.manage'), 'Admin does not gain Super Admin management access');
setProfile('supervisor');
assert(permissions.can('orders.read') && !permissions.can('orders.write'), 'Moderator-compatible Supervisor remains read-only for orders');
setProfile('viewer');
assert(permissions.can('reports.read') && !permissions.can('reports.calculate'), 'Read Only retains reports.read without calculation');
setProfile('pending', 'pending', ['*']);
assert(!permissions.can('dashboard.read') && !permissions.can('orders.write'), 'Pending denies even a malicious stored wildcard client profile');
setProfile('admin', 'disabled', ['*']);
assert(!permissions.can('dashboard.read') && !permissions.can('users.manage'), 'Disabled denies every client capability');

console.log('users and security contract tests passed');
