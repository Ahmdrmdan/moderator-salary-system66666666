'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const workflowSource = fs.readFileSync('js/payroll-workflow.js', 'utf8');
const source = fs.readFileSync('js/salary-processing.js', 'utf8');
assert.match(source, /await commitWithAudit\([\s\S]*?await load\(\);Toast\.show\('تم اعتماد وحفظ Snapshot الرواتب'/,
  'approval reloads the persisted Snapshot so Workspace, Stepper, and Decision Summary rerender immediately');

// The initial background load is irrelevant to this interaction harness; the
// approval path itself is kept intact through its batch write.
const isolated = source
  .replace("await load();Toast.show('تم اعتماد وحفظ Snapshot الرواتب','success');", "Toast.show('تم اعتماد وحفظ Snapshot الرواتب','success');")
  .replace('load().catch(()=>{});}', '}');
assert.notStrictEqual(isolated, source, 'test harness must isolate initial Snapshot loading');

function element() {
  return {
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    classList: { add() {}, remove() {} },
    dataset: {},
    querySelector() { return null; }
  };
}

const elements = Object.fromEntries([
  'salaryExecutiveSummary', 'salaryDepartmentSummary', 'salaryRankingBody',
  'salaryRankingMetric', 'salaryRankingDirection', 'salarySnapshotApproveBtn',
  'reportWorkspaceManager', 'salarySnapshotRows', 'salaryDrawerCloseBtn',
  'salaryDrawerTabs', 'salarySnapshotExcelBtn', 'salarySnapshotPrintBtn'
].map(id => [id, element()]));

const writes = [];
const batch = {
  set(ref, data, options) { writes.push({ type: 'set', ref, data, options }); return this; },
  update() { return this; },
  async commit() {}
};
const db = {
  collection(name) {
    return { doc(id) { return { name, id }; } };
  },
  batch() { return batch; }
};
const reportRows = [{ moderatorId: 'employee-1', name: 'Employee', departmentId: 'operations', finalSalary: 1000 }];
const month = { status: 'locked', workflowState: 'approved', report: reportRows };
const context = {
  document: { getElementById: id => elements[id] || element() },
  Utils: { formatCurrency: value => String(value), escapeHtml: value => String(value) },
  Permissions: { can: permission => permission === 'salary_processing.approve', require(permission) { assert.strictEqual(permission, 'salary_processing.approve'); } },
  App: { getSalaryProcessingContext: () => ({ monthId: '2026-08', rows: reportRows, totals: { finalSalary: 1000 } }) },
  Months: { byId: id => { assert.strictEqual(id, '2026-08'); return month; } },
  COLLECTIONS: { MONTHLY_REPORTS: 'monthly_reports', MONTHLY_SUMMARIES: 'monthly_summaries' },
  db,
  auth: { currentUser: { email: 'tester@example.test' } },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-timestamp' } } },
  AuditService: { OPERATION: { CREATE: 'create' }, SEVERITY: { WARNING: 'warning' }, appendToBatch() {} },
  Toast: { show() {} },
  confirm: () => true,
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(`${workflowSource}\n${isolated}\nglobalThis.__salary = SalaryProcessing;`, context, { filename: 'salary-processing-workspace-binding.test.js' });

context.__salary.init();
assert.strictEqual(elements.salarySnapshotApproveBtn.listeners.click, undefined,
  'the moving approval button intentionally has no fragile direct listener');
const rootClick = elements.reportWorkspaceManager.listeners.click;
assert.strictEqual(typeof rootClick, 'function', 'Workspace Manager owns the stable delegated handler');
rootClick({ target: { closest: selector => selector === '#salarySnapshotApproveBtn' ? elements.salarySnapshotApproveBtn : null } });

setImmediate(() => {
  assert.strictEqual(writes.length, 3, 'approval click writes the Snapshot and both existing workflow mirrors in one batch');
  assert.strictEqual(writes[0].ref.name, 'salary_processing');
  assert.strictEqual(writes[0].data.status, 'approved');
  assert.strictEqual(writes[1].data.workflowState, 'ready_for_payment');
  assert.strictEqual(writes[2].data.workflowState, 'ready_for_payment');
  console.log('salary processing workspace binding tests passed');
});
