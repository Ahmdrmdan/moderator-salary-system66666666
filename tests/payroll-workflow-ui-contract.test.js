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

assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.DRAFT), 'calculation',
  'draft reports expose the calculation workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.REOPENED), 'calculation',
  'reopened reports return to calculation without a new lifecycle state');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.CALCULATED), 'review',
  'calculated reports expose the employee review workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.IN_REVIEW), 'approval',
  'an in-review report exposes the dedicated approval workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.APPROVED), 'payroll',
  'an approved report advances to the dedicated payroll workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.SALARY_SNAPSHOT_CREATED), 'payroll',
  'the created Snapshot state exposes the existing payroll workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.READY_FOR_PAYMENT), 'payment',
  'ready payroll exposes only the existing payment workspace');
assert.strictEqual(WorkflowUI.workspaceFor(Workflow.STATE.PAID), 'archive',
  'paid payroll exposes the existing archive action workspace');

const dashboard = fs.readFileSync('dashboard.html', 'utf8');
for (const state of Object.values(Workflow.STATE)) {
  assert.match(dashboard, new RegExp(`data-workflow-state="${state}"`), `header includes ${state}`);
}
assert.match(dashboard, /id="reportStateWorkspace"/,
  'the state-driven action workspace preserves the existing action identifiers');
assert.match(dashboard, /id="reportWorkspaceManager"/,
  'the report owns a Workspace Manager rather than a single shared content surface');
['reportCalculationWorkspace', 'reportReviewWorkspace', 'reportApprovalWorkspace', 'reportPayrollWorkspace', 'reportPaymentWorkspace', 'reportArchiveWorkspace'].forEach(id => {
  assert.match(dashboard, new RegExp(`id="${id}"[^>]*data-workspace=`),
    `${id} is an independently declared workflow workspace`);
});
assert.match(dashboard, /id="reportReviewWorkspace"[^>]*data-workspace="review"/,
  'employee review remains an explicit review workspace');
assert.match(dashboard, /id="salarySnapshotDashboard"/,
  'the existing Salary Snapshot is retained as the payroll, payment, and archive surface');
assert.match(dashboard, /data-workspace-slot="approval-decision"/,
  'the Decision Summary can move into the approval workspace without duplicating its data');
assert.match(dashboard, /id="reportApprovalAck"/,
  'approval confirmation remains an inline report control, not a dialog-only acknowledgement');
assert.match(uiSource, /function mountWorkspaceSurfaces\(workspace\)/,
  'Workspace Manager mounts existing surfaces into the active workspace');
assert.doesNotMatch(uiSource, /element\.hidden\s*=/,
  'Workspace visibility is not implemented as a simple hidden flag toggle');
['calculateBtn', 'approveReportBtn', 'salarySnapshotApproveBtn', 'salaryMarkAllPaidBtn', 'workflowArchiveBtn'].forEach(id => {
  assert.strictEqual((dashboard.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1,
    `${id} retains its one existing binding`);
});
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
