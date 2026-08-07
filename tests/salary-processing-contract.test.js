'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/salary-processing.js', 'utf8');
const instrumented = source.replace(
  'return{init,load,isInitialized:()=>initialized,getSnapshot:()=>snapshot,getPaymentSummary:paymentSummary};',
  'globalThis.__salaryTest={financial,aggregate,paymentSummary};return{init,load,isInitialized:()=>initialized,getSnapshot:()=>snapshot,getPaymentSummary:paymentSummary};'
);
assert.notStrictEqual(instrumented, source, 'test instrumentation must expose Salary display helpers');

const context = {
  document: { getElementById: () => null },
  Utils: { formatCurrency: value => String(value), escapeHtml: value => String(value) },
  Permissions: { can: () => false, require: () => { throw new Error('denied'); } },
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(instrumented, context, { filename: 'salary-processing.js' });

const { financial, aggregate, paymentSummary } = context.__salaryTest;

const currentRow = {
  moderatorId: 'employee-1', departmentName: 'Operations', salaryType: 'hourly',
  salary: 1000, totalBonus: 100, totalAdjustments: 50,
  totalAdvances: 200, previousDebt: 30, finalSalary: 920
};
const current = financial(currentRow, { addition: 10, deduction: 20 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(current)), {
  salary: 1000, bonus: 100, commission: 0,
  additions: 60, deductions: 250, net: 910
}, 'current report fields are displayed without changing stored net pay');

const commissionRow = {
  moderatorId: 'employee-2', departmentName: 'Sales', salaryType: 'commission',
  salary: 1200, totalBonus: 175, totalAdjustments: -25,
  totalAdvances: 100, previousDebt: 0, finalSalary: 1250
};
const commission = financial(commissionRow);
assert.strictEqual(commission.bonus, 0, 'commission report rows do not double-count totalBonus as a package bonus');
assert.strictEqual(commission.commission, 175, 'commission report rows retain the existing stored totalBonus amount as display-only commission');
assert.strictEqual(commission.additions, 0);
assert.strictEqual(commission.deductions, 125);
assert.strictEqual(commission.net, 1250, 'no salary formula is recomputed by Snapshot presentation');

const legacy = financial({ moderatorId: 'legacy', salary: 500, additions: 25, deductions: 40, finalSalary: 485 });
assert.strictEqual(legacy.additions, 25, 'legacy Snapshot fields retain their old display mapping');
assert.strictEqual(legacy.deductions, 40);

const totals = aggregate([currentRow, commissionRow], { 'employee-1': { addition: 10, deduction: 20 } }).totals;
assert.strictEqual(totals.additions, 60);
assert.strictEqual(totals.deductions, 375);
assert.strictEqual(totals.commission, 175);
assert.strictEqual(totals.net, 2160);

assert.strictEqual(typeof paymentSummary, 'function', 'payment workspace reads the immutable snapshot through a display helper');
assert.match(source, /commitWithAudit\(batch=>\{[\s\S]*?batch\.set/, 'approval writes the snapshot through a batch');
assert.match(source, /commitWithAudit\(batch=>[\s\S]*?batch\.update/, 'adjustment and payment writes use a batch');
assert.match(source, /PayrollWorkflow\.metadata\(PayrollWorkflow\.STATE\.READY_FOR_PAYMENT\)[\s\S]*?MONTHLY_REPORTS[\s\S]*?MONTHLY_SUMMARIES/,
  'approved snapshots mirror only existing workflow metadata for resume');
assert.match(source, /const workflowRoot=\$\('reportWorkspaceManager'\)[\s\S]*?salarySnapshotApproveBtn[\s\S]*?salaryMarkAllPaidBtn[\s\S]*?\[data-pay\]/,
  'Snapshot approval and payment controls use stable delegated events after Workspace remounts');
assert.match(source, /AuditService\.appendToBatch\(batch,audit\)/, 'the audit entry shares the financial write batch');
assert.match(source, /status==='paid'\?'تم الصرف'/, 'paid snapshots have a distinct visible Arabic status');
assert.match(source, /Permissions\.can\('salary_processing\.write'\)/, 'Snapshot adjustment controls use the existing write capability');
assert.match(source, /Permissions\.can\('salary_processing\.pay'\)/, 'payment controls use the existing payment capability');
assert.match(source, /Permissions\.can\('salary_processing\.export'\)/, 'export controls use the existing export capability');

console.log('salary processing contract tests passed');
