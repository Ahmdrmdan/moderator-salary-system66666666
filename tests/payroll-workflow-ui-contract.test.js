'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const workflowSource = fs.readFileSync('js/payroll-workflow.js', 'utf8');
const uiSource = fs.readFileSync('js/payroll-workflow-ui.js', 'utf8');
const permissions = new Set([
  'reports.calculate', 'reports.approve', 'salary_processing.approve',
  'salary_processing.pay', 'months.write'
]);
const context = {
  document: { getElementById: () => null, querySelectorAll: () => [] },
  Permissions: { can: permission => permissions.has(permission) },
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(`${workflowSource}\n${uiSource}\nglobalThis.__workflow = PayrollWorkflow; globalThis.__workflowUi = PayrollWorkflowUI;`, context, {
  filename: 'payroll-workflow-ui.js'
});

const Workflow = context.__workflow;
const WorkflowUI = context.__workflowUi;
const rows = [{ moderatorId: 'employee-1', name: 'Employee', departmentId: 'operations' }];

assert.strictEqual(WorkflowUI.canAction(Workflow.ACTION.CALCULATE, { month: {}, report: rows }), true,
  'draft report exposes calculation only with the existing calculate permission');
assert.strictEqual(WorkflowUI.canAction(Workflow.ACTION.START_REVIEW, {
  month: { workflowState: Workflow.STATE.CALCULATED, report: rows }, report: rows
}), true, 'calculated report exposes the existing review/approval action');
assert.strictEqual(WorkflowUI.canAction(Workflow.ACTION.CREATE_SALARY_SNAPSHOT, {
  month: { status: 'locked', workflowState: Workflow.STATE.APPROVED, report: rows }, report: rows, snapshot: null
}), true, 'approved report exposes Salary Snapshot creation');
assert.strictEqual(WorkflowUI.canAction(Workflow.ACTION.ARCHIVE, {
  month: { status: 'locked' },
  snapshot: { status: 'paid', workflowState: Workflow.STATE.PAID, report: rows, employeePayments: { 'employee-1': { status: 'paid' } } }
}), true, 'fully paid payroll exposes the existing archive action');

permissions.delete('months.write');
assert.strictEqual(WorkflowUI.canAction(Workflow.ACTION.ARCHIVE, {
  month: { status: 'locked' }, snapshot: { status: 'paid', workflowState: Workflow.STATE.PAID, report: rows }
}), false, 'archive control is hidden/disabled without its existing permission');

const dashboard = fs.readFileSync('dashboard.html', 'utf8');
for (const state of Object.values(Workflow.STATE)) {
  assert.match(dashboard, new RegExp(`data-workflow-state="${state}"`), `header includes ${state}`);
}
assert.match(uiSource, /Months\.archiveMonth\(context\.monthId\)/,
  'archive UI delegates to the existing month lifecycle service');
assert.doesNotMatch(uiSource, /collection\(|\.firestore\(/,
  'UI adapter does not introduce a Firestore access path');

const salarySource = fs.readFileSync('js/salary-processing.js', 'utf8');
const rulesSource = fs.readFileSync('firebase/firestore.rules', 'utf8');
assert.match(salarySource, /batch\.set\(db\.collection\(COLLECTIONS\.MONTHLY_REPORTS\)\.doc\(periodId\),monthWorkflow/,
  'final payment mirrors only workflow metadata to the existing month document');
assert.match(salarySource, /batch\.set\(db\.collection\(COLLECTIONS\.MONTHLY_SUMMARIES\)\.doc\(periodId\),monthWorkflow/,
  'final payment mirrors only workflow metadata to the existing month summary');
assert.match(rulesSource, /function isPaidWorkflowWrite\(\)/,
  'Firestore Rules constrain the locked-month payment state mirror');

console.log('payroll workflow UI contract tests passed');
