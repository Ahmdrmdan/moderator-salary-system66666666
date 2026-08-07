'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const htmlSource = fs.readFileSync('dashboard.html', 'utf8');
const reportsSource = fs.readFileSync('js/reports.js', 'utf8');

// Reports controls must reflect their established capabilities before an
// interaction reaches the existing internal operation guards.
assert.match(htmlSource, /id="calculateBtn" data-permission="reports\.calculate"/);
assert.match(htmlSource, /id="approveReportBtn" data-permission="reports\.approve"/);
['exportExcelBtn', 'exportPdfBtn', 'copyReportBtn', 'printReportBtn'].forEach(id => {
  assert.match(htmlSource, new RegExp(`id="${id}" data-permission="reports\\.export"`));
});
assert.match(appSource, /function requireReportExport\(\)[\s\S]*Permissions\.require\('reports\.export'\)[\s\S]*Toast\.show\(/,
  'direct export attempts remain guarded and permission refusal is handled without an uncaught error');
assert.strictEqual((appSource.match(/if \(!requireReportExport\(\)\) return;/g) || []).length, 4,
  'Excel, PDF, copy, and print all use the same internal export guard');

// Calculation and its report audit entry must be queued into one batch.
assert.match(appSource, /const calculationBatch = db\.batch\(\);[\s\S]*calculationBatch\.set\(reportRef, reportPayload, \{ merge: true \}\);[\s\S]*AuditService\.appendToBatch\(calculationBatch, calculationAudit\);[\s\S]*await calculationBatch\.commit\(\);/,
  'a report write and its audit record share one Firestore batch');
assert.doesNotMatch(appSource, /await AuditService\.log\(AuditService\.ACTION\.REPORT_CALCULATED/,
  'report calculation no longer commits a separate post-write audit entry');

// Keep the report total contract stable for both currently stored and legacy
// rows; this stage must not alter any payroll formula.
const instrumented = reportsSource.replace('})();', '})(); globalThis.__reportsTest = Reports;');
assert.notStrictEqual(instrumented, reportsSource, 'test instrumentation must expose Reports');
const Utils = {
  rowDailyHours: row => row.dailyWorkHours ?? null,
  rowSalary: row => Number(row.salary || 0),
  rowPreviousDebt: row => Number(row.previousDebt || 0),
  rowCarriedDebt: row => Number(row.carriedDebt || 0),
  rowDepartmentId: (row, fallback) => row.departmentId || fallback,
  rowDepartmentName: (row, fallback) => row.departmentName || fallback,
  round2: value => Math.round(Number(value || 0) * 100) / 100
};
const context = { Utils, globalThis: null };
context.globalThis = context;
vm.runInNewContext(instrumented, context, { filename: 'reports.js' });

const totals = context.__reportsTest.computeTotals([
  { salary: 1000, dailyWorkHours: 8, ordersCount: 4, totalPackages: 6, totalSales: 650, totalBonus: 50, totalAdjustments: -20, totalAdvances: 100, previousDebt: 30, carriedDebt: 0, finalSalary: 900 },
  { salary: 500, ordersCount: 0, totalPackages: 0, totalSales: 0, totalBonus: 0, totalAdjustments: 10, totalAdvances: 0, previousDebt: 0, carriedDebt: 15, finalSalary: 510 }
]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(totals)), {
  workedHours: 8, salary: 1500, ordersCount: 4, totalPackages: 6,
  totalSales: 650, totalBonus: 50, totalAdjustments: -10, totalAdvances: 100,
  previousDebt: 30, carriedDebt: 15, finalSalary: 1410
}, 'report totals retain the stored salary figures and legacy-safe defaults');

console.log('reports contract tests passed');
