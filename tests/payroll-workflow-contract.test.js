'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/payroll-workflow.js', 'utf8');
const context = { globalThis: null };
context.globalThis = context;
vm.runInNewContext(`${source}\nglobalThis.__workflow = PayrollWorkflow;`, context, { filename: 'payroll-workflow.js' });
const Workflow = context.__workflow;

assert.strictEqual(Workflow.derive({}), Workflow.STATE.DRAFT, 'legacy empty month is draft');
assert.strictEqual(Workflow.derive({ report: [{ moderatorId: 'm1' }], totals: {} }), Workflow.STATE.CALCULATED,
  'legacy calculated month derives without migration');
assert.strictEqual(Workflow.derive({ status: 'locked', report: [{}] }), Workflow.STATE.APPROVED,
  'existing locked month derives as approved');
assert.strictEqual(Workflow.derive({ status: 'locked', archived: true }, { status: 'paid' }), Workflow.STATE.ARCHIVED,
  'archive metadata remains the terminal state');
assert.strictEqual(Workflow.derive({ status: 'locked' }, { status: 'approved' }), Workflow.STATE.READY_FOR_PAYMENT,
  'existing approved salary snapshot derives as ready for payment');
assert.strictEqual(Workflow.previousState(Workflow.STATE.IN_REVIEW), Workflow.STATE.CALCULATED,
  'the review stage has an explicit safe previous transition');
assert.strictEqual(Workflow.previousState(Workflow.STATE.CALCULATED), Workflow.STATE.DRAFT,
  'the calculated stage can formally return to calculation');
assert.strictEqual(Workflow.previousState(Workflow.STATE.READY_FOR_PAYMENT), null,
  'payment stages do not expose an unsafe metadata-only reversal');

const calculatedContext = {
  month: { status: 'open', report: [{ moderatorId: 'm1', name: 'A', departmentId: 'd1' }], totals: {} },
  report: [{ moderatorId: 'm1', name: 'A', departmentId: 'd1' }]
};
assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.CALCULATED, Workflow.STATE.IN_REVIEW, calculatedContext));
assert.throws(() => Workflow.assertTransition(Workflow.STATE.DRAFT, Workflow.STATE.APPROVED, calculatedContext), /لا يسمح المسار/,
  'draft cannot skip calculation and review');
assert.throws(() => Workflow.assertTransition(Workflow.STATE.IN_REVIEW, Workflow.STATE.APPROVED, calculatedContext), /فحص الجاهزية/,
  'approval requires the existing readiness assessment');
assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.IN_REVIEW, Workflow.STATE.APPROVED, {
  ...calculatedContext, approvalAssessment: { critical: [] }
}));

const approvedContext = {
  month: { status: 'locked', workflowState: Workflow.STATE.APPROVED, report: calculatedContext.report },
  report: calculatedContext.report
};
assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.APPROVED, Workflow.STATE.REOPENED, approvedContext),
  'the established pre-payment reopen flow remains available');
assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.APPROVED, Workflow.STATE.SALARY_SNAPSHOT_CREATED, approvedContext));
assert.doesNotThrow(() => Workflow.assertTransition(
  Workflow.STATE.SALARY_SNAPSHOT_CREATED,
  Workflow.STATE.READY_FOR_PAYMENT,
  { ...approvedContext, salarySnapshot: { status: 'approved', report: calculatedContext.report } }
), 'a created salary snapshot becomes ready through the existing approval operation');
assert.throws(() => Workflow.assertTransition(Workflow.STATE.APPROVED, Workflow.STATE.SALARY_SNAPSHOT_CREATED, {
  ...approvedContext, salarySnapshot: { status: 'approved', report: calculatedContext.report }
}), /محفوظ/,
  'a second salary snapshot is rejected');

const readySnapshot = { status: 'approved', workflowState: Workflow.STATE.READY_FOR_PAYMENT, report: calculatedContext.report,
  employeePayments: { m1: { status: 'paid' } } };
assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.READY_FOR_PAYMENT, Workflow.STATE.PAID, {
  month: { status: 'locked' }, salarySnapshot: readySnapshot
}));
assert.throws(() => Workflow.assertTransition(Workflow.STATE.READY_FOR_PAYMENT, Workflow.STATE.PAID, {
  month: { status: 'locked' }, salarySnapshot: { ...readySnapshot, employeePayments: {} }
}), /جميع الموظفين/,
  'payment cannot complete while an employee is unpaid');

assert.doesNotThrow(() => Workflow.assertTransition(Workflow.STATE.PAID, Workflow.STATE.ARCHIVED, {
  month: { status: 'locked' }, salarySnapshot: { ...readySnapshot, status: 'paid', workflowState: Workflow.STATE.PAID }
}), 'a paid payroll may be archived');
assert.throws(() => Workflow.assertTransition(Workflow.STATE.ARCHIVED, Workflow.STATE.REOPENED, {
  month: { status: 'locked', archived: true }
}), /لا يسمح المسار/,
  'a paid archive cannot be reopened into an editable report');

assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.CALCULATE], 'reports.calculate');
assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.APPROVE], 'reports.approve');
assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.CREATE_SALARY_SNAPSHOT], 'salary_processing.approve');
assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.PAY], 'salary_processing.pay');
assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.ARCHIVE], 'months.write');
assert.strictEqual(Workflow.ACTION_PERMISSION[Workflow.ACTION.REOPEN], 'months.write');
assert.deepStrictEqual(
  Array.from(Workflow.availableActions(calculatedContext, permission => permission === 'reports.approve')),
  [Workflow.ACTION.START_REVIEW],
  'available actions expose only the permitted valid transition'
);

console.log('payroll workflow contract tests passed');
