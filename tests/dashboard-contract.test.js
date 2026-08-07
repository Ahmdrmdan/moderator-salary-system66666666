'use strict';

const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const chartsSource = fs.readFileSync('js/charts.js', 'utf8');
const htmlSource = fs.readFileSync('dashboard.html', 'utf8');
const widgetsSource = fs.readFileSync('js/dashboard-widgets.js', 'utf8');
const stylesSource = fs.readFileSync('css/style.css', 'utf8');

// The dashboard charts are a production dependency: a stale CDN path left the
// widgets in their fallback state despite the rest of the dashboard loading.
assert.match(htmlSource, /<script src="js\/vendor\/chart\.umd\.js"><\/script>/,
  'dashboard loads the pinned Chart.js UMD build from Firebase Hosting');
assert.ok(fs.existsSync('js/vendor/chart.umd.js'), 'the Chart.js UMD build is shipped with the application');
assert.doesNotMatch(htmlSource, /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com).*Chart\.js|chart\.js@/i,
  'dashboard does not rely on an external Chart.js CDN at runtime');
assert.match(htmlSource, /<link rel="stylesheet" href="css\/style\.css\?v=7\.0\.11-dashboard-ui-ux-audit-r3">/,
  'dashboard cache-busts the shared stylesheet after the UI/UX audit');

// The UI audit is explicitly visual-only. These stable hooks guarantee that
// the existing data bindings and quick-action controls remain in place.
assert.match(htmlSource, /class="cards-grid dashboard-financial-grid">/,
  'financial KPI cards retain their existing bindings in a visual-only grid');
assert.match(stylesSource, /#view-dashboard \.dashboard-hero\s*\{[\s\S]*?grid-template-columns:/,
  'dashboard hero has a responsive visual composition');
assert.match(stylesSource, /#view-dashboard \.stat-card\s*\{[\s\S]*?grid-template-areas:/,
  'dashboard KPI cards use a consistent visual hierarchy');
assert.match(stylesSource, /#view-dashboard \.dashboard-financial-grid\s*\{[\s\S]*?grid-template-columns:/,
  'financial KPI layout is explicitly responsive');

// Chart.js is responsive with maintainAspectRatio disabled, so the flex child
// that owns each canvas must be able to shrink. Without this constraint, the
// canvas ResizeObserver can grow its own parent indefinitely.
assert.match(stylesSource, /\.chart-card \.chart-wrap\s*\{[^}]*flex:\s*1 1 0;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/,
  'chart wrappers have a bounded, shrinkable flex height');
assert.match(stylesSource, /\.chart-card \.chart-wrap canvas\s*\{\s*width:\s*100% !important;\s*height:\s*100% !important;/,
  'chart canvases fill the bounded wrapper instead of defining its height');
assert.match(chartsSource, /function renderAllCharts\(report, options = \{\}\) \{[\s\S]*?destroyAll\(\);[\s\S]*?renderTopSales\(rows\);/,
  'each dashboard render destroys prior chart instances before creating replacements');

// Dashboard-only roles must not make reads that Firestore correctly denies.
assert.match(appSource, /const canReadMonths = \['months\.read', 'reports\.read', 'archive\.read', 'comparison\.read', 'backups\.create', 'backups\.restore'\][\s\S]*?\.some\(permission => Permissions\.can\(permission\)\);/,
  'month bootstrap derives access from the existing monthly-report read capabilities');
assert.match(appSource, /if \(canReadMonths\) \{[\s\S]*?const activeMonthId = await Months\.init\(\);[\s\S]*?await selectMonth\(activeMonthId\);/,
  'month initialization is skipped when the role cannot read month data');
assert.match(appSource, /if \(Permissions\.can\('settlements\.read'\)\) loadSettlements\(\);/,
  'settlements are loaded only for roles that can read them');
assert.match(appSource, /const canReadBackups = Permissions\.can\('backups\.read'\);[\s\S]*?const canReadAudit = Permissions\.can\('audit\.read'\);[\s\S]*?canReadBackups \? BackupService\.listBackups\(1\) : Promise\.resolve\(\[\]\)[\s\S]*?canReadAudit \? AuditService\.getRecent\(20\) : Promise\.resolve\(\[\]\)/,
  'dashboard status reads are individually capability-gated');
assert.match(appSource, /state\.backups = backups;[\s\S]*?state\.auditLogs = auditLogs;[\s\S]*?renderDashboard\(\);/,
  'completed status data refreshes the widgets from the same scoped cache');
assert.doesNotMatch(appSource, /console\.warn\('Dashboard status data could not be loaded:/,
  'expected background dashboard access failures do not emit a console warning');

// UI metadata is retained, while direct or stale quick-action events are
// guarded before routing into the underlying module action.
[
  ['quickAddEmployeeBtn', 'employees.write'],
  ['quickImportOrdersBtn', 'orders.import'],
  ['quickCalculateReportBtn', 'reports.calculate'],
  ['quickApproveReportBtn', 'reports.approve'],
  ['quickBackupBtn', 'backups.create']
].forEach(([id, permission]) => {
  assert.match(htmlSource, new RegExp(`id="${id}" data-permission="${permission.replace('.', '\\.')}"`), `${id} keeps its capability metadata`);
  assert.match(appSource, new RegExp(`runDashboardQuickAction\\('${permission.replace('.', '\\.')}'`), `${id} has a matching internal guard`);
});
assert.match(appSource, /async function runDashboardQuickAction\(permission, action\) \{[\s\S]*?Permissions\.require\(permission\);[\s\S]*?await action\(\);[\s\S]*?Toast\.show\(err\.message \|\| 'تعذر تنفيذ هذه العملية\.', 'error'\);/,
  'quick action denials are handled as user-visible messages');

// Month-state rendering must never undo the shared permission layer.
assert.match(appSource, /const lacksPermission = id === 'calculateBtn' && !Permissions\.can\('reports\.calculate'\);[\s\S]*?el\.disabled = readOnly \|\| lacksPermission;/,
  'the Calculate control remains disabled without reports.calculate');
assert.match(widgetsSource, /if \(!can\('audit\.read'\)\) return empty\(/,
  'recent activity remains protected even when a caller provides audit data');

console.log('dashboard contract tests passed');
