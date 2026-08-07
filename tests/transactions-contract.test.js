'use strict';

const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const htmlSource = fs.readFileSync('dashboard.html', 'utf8');
const dataLayerSource = fs.readFileSync('js/data-layer.js', 'utf8');
const rulesSource = fs.readFileSync('firebase/firestore.rules', 'utf8');

// The visible transaction submit/cancel controls use the existing write
// capability, and the month-status renderer cannot re-enable them for a
// read-only profile.
assert.match(htmlSource, /id="transactionSaveBtn" data-permission="transactions\.write"/);
assert.match(htmlSource, /id="transactionCancelEditBtn" data-permission="transactions\.write"/);
assert.match(appSource, /const canWriteTransactions = Permissions\.can\('transactions\.write'\);/);
assert.match(appSource, /el\.disabled = readOnly \|\| !canWriteTransactions;/);
assert.match(appSource, /submitBtn\.disabled = readOnly \|\| !canWriteTransactions;/);

// Browser submits must always be stopped before permission denial, while
// every mutating path retains the same caught internal guard.
assert.match(appSource, /async function onSaveTransaction\(e\) \{\s*e\.preventDefault\(\);\s*if \(!requireTransactionsWrite\(\)\) return;/);
['onAddAdvance', 'onAddAdjustment'].forEach(name => {
  assert.match(appSource, new RegExp(`async function ${name}\\(e\\) \\{\\s*e\\.preventDefault\\(\\);\\s*if \\(!requireTransactionsWrite\\(\\)\\) return;`));
});
['beginTransactionEdit', 'approveTransaction', 'onDeleteAdvance', 'onDeleteAdjustment'].forEach(name => {
  assert.match(appSource, new RegExp(`function ${name}\\([^)]*\\) \\{\\s*if \\(!requireTransactionsWrite\\(\\)\\) return;`));
});
assert.match(appSource, /function requireTransactionsWrite\(\)[\s\S]*Permissions\.require\('transactions\.write'\)[\s\S]*Toast\.show\(/,
  'permission denial is caught and surfaced without an uncaught console error');
assert.doesNotMatch(appSource.match(/function approveTransaction[\s\S]*?\n  \}/)?.[0] || '', /state\.userRole !== 'admin'/,
  'transaction approval uses capabilities, not a hard-coded role name');
assert.match(appSource, /const canWrite = Permissions\.can\('transactions\.write'\);[\s\S]*: !canWrite\s*\? '<span class="text-muted-inline">—<\/span>'/,
  'read-only ledger rows render no approve, edit, or delete buttons');

// Legacy records remain display-safe and all writes still use DataLayer's
// existing business-write-plus-audit batch. No schema or rule was changed.
assert.match(appSource, /departmentId: transactionDepartmentId\(a\),[\s\S]*status: a\.status \|\| 'approved'/,
  'legacy transaction rows keep their department fallback and approved-safe status');
assert.match(dataLayerSource, /registerCollection\('advances',[\s\S]*permissions: \{ create: 'transactions\.write', update: 'transactions\.write', delete: 'transactions\.write' \}/);
assert.match(dataLayerSource, /registerCollection\('adjustments',[\s\S]*permissions: \{ create: 'transactions\.write', update: 'transactions\.write', delete: 'transactions\.write' \}/);
assert.match(dataLayerSource, /const batch = db\.batch\(\);[\s\S]*AuditService\.appendToBatch\(batch,[\s\S]*await batch\.commit\(\);/,
  'DataLayer continues to commit each transaction write with its audit entry atomically');
assert.match(rulesSource, /match \/advances\/\{advanceId\}[\s\S]*hasAnyPermission\(\['transactions\.write'/);
assert.match(rulesSource, /match \/adjustments\/\{adjustmentId\}[\s\S]*hasAnyPermission\(\['transactions\.write'/);

console.log('transactions contract tests passed');
