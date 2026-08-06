'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const documents = new Map([
  ['legacy', { name: 'Legacy Department', status: 'active', order: 20 }],
  ['legacy-rules', { name: 'Legacy Rules', status: 'active', order: 21, bonusRules: { '1': 5 } }]
]);
const created = [];
const updated = [];
const backups = [];
let canWrite = true;

function snapshot() {
  return { docs: [...documents].map(([id, data]) => ({ id, data: () => ({ ...data }) })) };
}

const db = {
  collection() {
    return {
      get: async () => snapshot(),
      doc: id => ({ id, setData: value => documents.set(id, value) }),
      onSnapshot: () => () => {}
    };
  },
  batch() {
    return {
      set(ref, value) { ref.setData(value); },
      commit: async () => {}
    };
  }
};

const context = {
  console,
  db,
  COLLECTIONS: { DEPARTMENTS: 'departments' },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-timestamp' } } },
  Utils: {
    normalizeName: value => String(value || '').trim().toLowerCase(),
    cleanDisplayName: value => String(value || '').trim(),
    toFiniteNumber: value => Number.isFinite(Number(value)) ? Number(value) : 0
  },
  Permissions: { require(permission) { if (!canWrite) throw new Error(`denied:${permission}`); } },
  DataLayer: {
    create: async (_key, payload) => { created.push(payload); return { id: 'new-commission', undo: null }; },
    update: async (_key, id, payload, options) => { updated.push({ id, payload, options }); return { id, undo: null }; }
  },
  BackupService: { TRIGGER: { BEFORE_DEPARTMENT_ARCHIVE: 'before-department-archive' }, createAutomaticBackup: async (...args) => backups.push(args) },
  AuditService: { SEVERITY: { WARNING: 'warning' }, ACTION: { DEPARTMENT_ARCHIVED: 'department_archived', DEPARTMENT_RESTORED: 'department_restored' } }
};
context.globalThis = context;

const source = fs.readFileSync('js/departments.js', 'utf8') + '\n;globalThis.__Departments = Departments;';
vm.runInNewContext(source, context, { filename: 'departments.js' });
const Departments = context.__Departments;

(async () => {
  await Departments.init();

  const legacy = Departments.byId('legacy');
  assert.strictEqual(legacy.salaryType, Departments.SALARY_TYPE.HOURLY, 'old departments keep the hourly safe default');
  assert.strictEqual(legacy.useBonusOverride, false, 'old departments without a table do not require a migration');
  assert.strictEqual(legacy.bonusType, 'packages');
  assert.deepStrictEqual([...legacy.salesBonusRules], []);
  assert.strictEqual(Departments.byId('legacy-rules').useBonusOverride, true, 'legacy custom tables remain active');

  const commission = Departments.validate({
    name: 'Commission Department', color: '#123456', salaryType: 'commission', useBonusOverride: true,
    bonusType: 'sales', salesBonusRules: [{ from: '100', to: '499', bonus: '25' }]
  });
  assert.strictEqual(commission.ok, true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(commission.value)), {
    name: 'Commission Department', normalizedName: 'commission department', salaryType: 'commission', color: '#123456',
    bonusRules: null, useBonusOverride: true, bonusType: 'sales', salesBonusRules: [{ from: 100, to: 499, bonus: 25 }]
  });

  const fixed = Departments.validate({ name: 'Fixed Department', color: '#123456', salaryType: 'fixed', useBonusOverride: true, bonusType: 'sales', salesBonusRules: [{ from: 1, to: 2, bonus: 3 }] });
  assert.strictEqual(fixed.value.useBonusOverride, false, 'fixed departments retain the no-bonus invariant');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(fixed.value.salesBonusRules)), []);

  await Departments.create({ name: 'Commission Department', color: '#123456', salaryType: 'commission', useBonusOverride: true, bonusType: 'sales', salesBonusRules: [{ from: 100, to: 499, bonus: 25 }] });
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].salaryType, 'commission');
  assert.strictEqual(created[0].useBonusOverride, true);
  assert.strictEqual(created[0].bonusType, 'sales');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(created[0].salesBonusRules)), [{ from: 100, to: 499, bonus: 25 }]);

  await Departments.update('legacy', { name: 'Legacy Department', color: '#123456', salaryType: 'commission', useBonusOverride: true, bonusType: 'sales', salesBonusRules: [{ from: 500, to: 999, bonus: 40 }] });
  assert.strictEqual(updated.at(-1).payload.salaryType, 'commission');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(updated.at(-1).payload.salesBonusRules)), [{ from: 500, to: 999, bonus: 40 }]);

  await Departments.archive('legacy');
  assert.strictEqual(backups.length, 1, 'archive keeps its existing backup behavior');
  assert.strictEqual(updated.at(-1).payload.status, 'archived');
  await Departments.restore('legacy');
  assert.strictEqual(updated.at(-1).payload.status, 'active');

  canWrite = false;
  await assert.rejects(() => Departments.create({ name: 'Denied', color: '#123456' }), /denied:departments.write/);
  assert.strictEqual(created.length, 1, 'internal permission guard blocks writes before DataLayer');

  const appSource = fs.readFileSync('js/app.js', 'utf8');
  assert.match(appSource, /state\.settings\.salesBonusRules/, 'commission departments fall back to the existing global sales tiers');
  assert.match(appSource, /salaryType: Departments\.salaryTypeOf\(departmentId\)/, 'new report rows preserve the commission type');
  assert.match(appSource, /departmentBonusType'\)\.value = 'sales'/, 'commission selection switches the existing form to sales tiers');
  assert.match(appSource, /Permissions\.can\('departments\.write'\)/, 'management controls follow the write capability');

  const permissionsContext = { console };
  permissionsContext.globalThis = permissionsContext;
  vm.runInNewContext(fs.readFileSync('js/permissions.js', 'utf8') + '\n;globalThis.__Permissions = Permissions;', permissionsContext, { filename: 'permissions.js' });
  permissionsContext.__Permissions.setProfile({ status: 'active', permissions: ['departments.read'] });
  assert.strictEqual(permissionsContext.__Permissions.can('departments.read'), true);
  assert.strictEqual(permissionsContext.__Permissions.can('departments.write'), false, 'read-only users cannot invoke department writes');
  console.log('departments contract tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
