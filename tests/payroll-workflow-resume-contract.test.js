'use strict';

const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const monthsSource = fs.readFileSync('js/months.js', 'utf8');
const monthManagementSource = fs.readFileSync('js/month-management.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

assert.match(monthsSource, /async function returnWorkflowToPrevious\(monthId\)[\s\S]*?PayrollWorkflow\.previousState\(current\)[\s\S]*?AuditService\.appendToBatch/,
  'a previous-stage action is a persisted, audited lifecycle transition rather than a UI-only state change');
assert.match(appSource, /async function returnToPreviousWorkflowStage\(\)[\s\S]*?Months\.returnWorkflowToPrevious\(monthId\)[\s\S]*?await selectMonth\(monthId\)/,
  'the report reloads its real context after returning to a previous stage');
assert.match(appSource, /open: async \(monthId\) => \{[\s\S]*?await selectMonth\(monthId\);[\s\S]*?switchView\('report'\);[\s\S]*?PayrollWorkflowUI\.render/,
  'Month Management opens the selected month directly in its persisted Workspace');

['المرحلة الحالية', 'حالة التقرير', 'آخر خطوة مكتملة', 'الإجراء التالي', 'التقدم'].forEach(label => {
  assert.match(dashboard, new RegExp(`<th>${label}</th>`), `Month Control Center exposes ${label}`);
});
assert.match(monthManagementSource, /function workflowDetails\(month\)[\s\S]*?progress[\s\S]*?next/,
  'each month row derives lifecycle stage, action, and progress from existing metadata');
assert.match(monthManagementSource, /data-month-action="open"[\s\S]*?فتح آخر مرحلة من دورة الرواتب/,
  'month rows expose an explicit Resume action without a new route');

console.log('payroll workflow resume contract tests passed');
