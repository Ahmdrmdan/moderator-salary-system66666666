# Changelog

## Unreleased — Payroll Workflow Engine (phase 1)

- Added a backward-compatible monthly payroll state machine: Draft, Calculated, In Review, Approved, Salary Snapshot Created, Ready for Payment, Paid, Archived, and Reopened. Legacy reports and Salary Snapshots derive their state from existing `status`, report, and archive fields, so no migration or historical data rewrite is required.
- Guarded the existing Calculate, Smart Approval, month close, Salary Snapshot, payment, archive, and reopen operations with the valid workflow transition and the permissions already used by those operations. Smart Approval remains the approval validation source; no salary formula, report calculation, or payment amount changed.
- Persisted small workflow metadata with the existing report/snapshot documents and summary index, together with append-only audit entries. Creating the existing Salary Snapshot continues to make it immediately ready for payment, while recording both logical milestones for the future workflow UI.
- Permitted the final archive marker for a locked report only after the linked Salary Snapshot is fully paid; a paid archive is terminal to prevent recalculation against an immutable paid Snapshot.

## [7.2.0] — 2026-08-07 (Monthly Report 2.0 UI / UX)

- Reorganized the existing monthly-report screen into a clear Arabic review workflow: calculate, review, approve the report, approve the independent Salary Snapshot, then record payment. All existing controls, IDs, permissions, calculations, Firestore reads/writes, and Snapshot behavior remain unchanged.
- Added a visual context strip for the current report scope and the already-stored last calculation/approval/update timestamps. The export indicator is explicitly session-local because the current schema has no persisted export timestamp.
- Grouped the unchanged financial summary into earnings, deductions, and a visually prominent net-payment decision; moved the existing employee table into the primary review position with grouped headers and a highlighted net column.
- Moved the existing Salary Snapshot into its own clearly labelled review area after the report table, retaining every Snapshot table, payment control, chart, and audit interaction without changing its data or lifecycle.
- Localized the remaining visible Salary Snapshot status, empty-state, action, and drawer labels into Arabic without changing stored status values or audit semantics.
- Added a versioned stylesheet/runtime reference so published clients cannot combine this visual layout with cached assets, and updated visual contract expectations accordingly.
- Removed the non-interactive salary-calculation explanation card from the Report view so the review flow stays focused on decision data; no calculation, record, or control changed.

## [7.1.0] — 2026-08-07 (Dashboard Analytics Filters)

- Added two explicitly separate Dashboard scopes: **Monthly Scope** (month and department) continues to drive the existing frozen report, financial Snapshot, settlement values, monthly summary, and payroll charts; **Analytics Filters** (period/custom dates) drive only date-based operational orders, shipping, delivery, operational charts, rankings, products, governorates, alerts, and recent activity.
- Added Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, and validated custom date ranges. Operational data refreshes in place without a page reload; Reset restores This Month.
- Reclassified the existing charts into three monthly Snapshot charts and three time-based operational charts, so no bonus or salary number is presented as if it were calculated for a partial date range.
- Added a bounded `audit.read` date-range read for the existing Recent Activity widget. It uses only the existing `at` field, existing permission, and a 50-entry limit; no Firestore Rule, Schema, role, or financial calculation changed.
- Added a persistent in-memory filter state across Dashboard navigation, a visible current-scope summary, an explicit operational empty state, and a loading state for manual refresh. Rapid filter changes debounce Audit reads and discard stale asynchronous responses.

## [7.0.11] — 2026-08-07 (UI / UX consistency release)

- Extended the approved Dashboard design language across Departments, Employees, Orders (including Import and Shipping tabs), Months, Month Comparison, Reports and Salary views, Transactions, Settlements, Archive, Backups, Audit, Settings, and User Management.
- Standardized visual-only layout primitives: content widths, panel surfaces, section headers, action/filter rails, buttons, visible form controls, data-table header and row rhythm, tab states, empty/drop states, and modal sizing/scrolling.
- Added responsive behavior for wide workspaces, stacked action rails, tables, forms, tabs, and modal interiors without changing any application workflow or data.
- Preserved every business action, Firestore access path, permission check, query, calculation, role, and JavaScript event binding. This release contains stylesheet and cache-version changes only.

## Unreleased — Dashboard UI / UX consistency audit (closed and approved)

- Re-composed the Dashboard visually without changing its data, Firebase queries, permissions, actions, chart configuration, or calculation behavior.
- Reworked the Hero into a responsive two-column composition: the monthly narrative and the existing status items now have clear hierarchy instead of competing in one undifferentiated band.
- Standardized Dashboard KPI cards into a label/value/icon hierarchy, with balanced operational and financial grids across desktop, tablet, and mobile widths.
- Refined the Dashboard quick-action rail, section headings, alerts, insights, widgets, charts, Topbar, and Sidebar using the existing dark visual language, shared controls, and existing icon conversion.
- Final visual review balanced the compact RTL Topbar against the Hero and makes a single alert span its row instead of leaving an unexplained empty grid area.
- Final polish strengthens the Dashboard reading hierarchy: the Hero status pane has a visible label, the existing Calculate Report action is the clear primary control, alerts have a scan-friendly rail, and Dashboard tables/widgets use consistent row rhythm.
- Added Dashboard visual contract coverage for the cache-busted stylesheet, responsive Hero, KPI card hierarchy, and financial KPI grid while retaining every existing binding and quick-action ID.

## Unreleased — Users lifecycle and management-layout hotfix (awaiting review)

- Clarified the safe Firebase Authentication lifecycle: an account created in Firebase Authentication receives its `users/{uid}` document at its first application sign-in as a pending, zero-permission profile; an existing Super Admin then activates it through User Management. This preserves the current secure no-self-escalation boundary.
- Preserved the pending account state in Authentication errors and mapped it to an actionable approval message instead of losing it to the generic login-error handler.
- Repaired a malformed Settings markup boundary that caused the Users view to be parsed outside the Dashboard `<main>` element, leaving a large blank region and pushing the table below the normal layout flow.
- Made the existing fixed-height sidebar scrollable, so User Management remains reachable at normal laptop-height viewports without changing its design or permissions.
- Added lifecycle and layout contract coverage for pending feedback, Users view containment, valid Settings structure, and sidebar overflow behavior.

## Unreleased — Dashboard chart-height hotfix (awaiting review)

- Bounded responsive Dashboard chart canvases to their existing fixed-height cards, eliminating the ResizeObserver/flex overflow loop that could grow a chart vertically without limit.
- Versioned the Dashboard stylesheet URL so the published layout hotfix bypasses a previously cached `style.css` asset.
- Added Dashboard contract coverage for the bounded chart wrapper, canvas sizing, cache-busted stylesheet, and existing destroy-before-render lifecycle.

## [7.0.10] — 2026-08-07 (Production release)

- Completed the production-wide regression audit across Imports, Shipping, Orders, Departments, Employees, Salary, Reports, Transactions, Dashboard, and Users & Security. Every module contract suite and JavaScript syntax check passed.
- Replaced the unavailable external Chart.js path with the pinned Chart.js 4.4.4 UMD build hosted by Firebase alongside the application. Dashboard charts no longer depend on a client-accessible CDN.
- Aligned the Hosting root authentication router (`/`) with the current `ahmed123-95a0e` Firebase project, eliminating the retired-project session split before the Dashboard redirect.
- Added production-configuration contract coverage for the CLI target, Dashboard client, and root Authentication router to remain on the same Firebase project.
- Completed production UAT for the authenticated root route, Dashboard loading, first-click navigation/dialog behavior, and Console health without modifying production business data.
- Formally approved as Production Ready; this release is tagged `v7.0.10` from `main`.

## Unreleased — Users & Security audit (closed and approved)

- Hardened Firestore authorization so explicit `pending`, `suspended`, and `disabled` profiles cannot use any stored permission, while legacy profiles without a status retain active-safe compatibility.
- Closed the self-registration escalation path: a new account may create only a `pending` profile with an empty stored permission list. The one-time bootstrap profile and marker now require the same atomic write.
- Restricted self profile updates to `lastLoginAt` and `lastActivityAt`; role, status, overrides, and permissions remain under the Super Admin boundary.
- Allowed only self-attributed `auth.login` and `auth.logout` Audit entries for active users, retaining the append-only Audit model and denying all other ordinary Audit writes.
- Changed legacy Authentication normalization to in-memory safe defaults, avoiding client-side role migrations during sign-in.
- Exposed the already-existing Dashboard, Department, Shipping, Salary Processing, and role-management permission keys in User Management; no key, role definition, or schema changed.
- Added Users & Security contract coverage for active/inactive access, safe registration, bootstrap atomicity, self-only activity/Audit writes, and the Super Admin/Admin/Supervisor/Viewer/Pending/Disabled role matrix.

## Unreleased — Dashboard stabilization (closed)

- Stopped Dashboard bootstrap from requesting monthly data or settlements for roles that lack their existing read capability, while retaining the safe defaults already used by the Dashboard.
- Made the backup and Audit status reads independently capability-gated. After their asynchronous read completes, the existing Dashboard widgets refresh from the same scoped cache; no Dashboard statistic or calculation changed.
- Added caught internal capability guards for every existing Dashboard quick action. Stale or programmatic events now show the normal permission message instead of creating an unhandled browser rejection.
- Kept the report Calculate control disabled after a month-status refresh whenever `reports.calculate` is absent.
- Added Dashboard contract coverage for the capability-gated reads, widget refresh, quick-action guards, and Calculate-button regression.
- Formally approved and closed after Firebase UAT; no production Dashboard, financial, report, or Audit data was created during testing.

## Unreleased — Transactions stabilization (closed)

- Bound the current Transaction save and edit-cancel controls, all transaction form fields, and every ledger create/edit/delete/approve action to `transactions.write`. Read-only users retain the ledger, search, and filters without mutation controls.
- Moved `preventDefault()` ahead of the write guard and added a caught capability boundary for direct or stale Transaction events, preventing permission rejection from becoming a browser-console error.
- Replaced the hard-coded `admin` transaction-approval check with the existing `transactions.write` capability, preserving compatible Super Admin access without changing any Firestore Rule.
- Added Transactions contract coverage for read-only UI state, internal guards, legacy record defaults, DataLayer audit batching, and existing Firestore write permissions.
- Formally approved and closed after Firebase UAT; no production financial or Audit data was created during testing.

## Unreleased — Reports stabilization (closed)

- Bound the existing Report Calculate, Approve, Excel, PDF, Copy, and Print controls to their current `reports.calculate`, `reports.approve`, and `reports.export` capabilities.
- Added a caught internal export guard for Excel, PDF, clipboard copy, and print so direct or stale UI events show a permission message without producing an uncaught browser error.
- Changed report calculation to commit the existing monthly-report payload and `report_calculated` Audit entry in one Firestore batch. Salary formulas, report schema, historical reports, and Firestore Rules remain unchanged.
- Added Reports contract coverage for capability metadata, protected export actions, atomic report/audit writes, and stable report totals.
- Formally approved and closed after Firebase UAT; no production report, export, Audit entry, or financial record was created during testing.

## Unreleased — Salary stabilization (closed)

- Corrected Salary Snapshot presentation by mapping the existing monthly-report fields (`salary`, `totalBonus`, `totalAdjustments`, `totalAdvances`, `previousDebt`, and `finalSalary`) without recalculating any payroll amount. Commission rows now present their already-stored `totalBonus` as commission when that is their existing salary type.
- Corrected the Snapshot lifecycle label so a persisted `paid` Snapshot is displayed as `Paid` rather than `Draft`.
- Bound Snapshot adjustment, payment, export, and print controls to the existing Salary Processing capabilities while retaining the existing internal permission checks and Firestore Rules.
- Made approve, payment, and manual-adjustment writes atomic with their Audit entry by committing both existing document writes in one Firestore batch. No document shape, rule, migration, historical report, or salary formula changed.
- Added Salary Processing contract coverage for current and legacy Snapshot display fields, commission presentation, stored net preservation, aggregation, lifecycle status, permission gating, and batched audit writes.
- Formally approved and closed after the Firebase UAT; no production payroll Snapshot, payment, or adjustment was created during testing.

## Unreleased — Employees stabilization (awaiting review)

- Restricted the Employees UI by capability: adding, editing, inline fixed-salary editing, and reactivation require `employees.write`; permanent deletion requires `employees.delete`. The Firestore Rules and DataLayer checks remain the authoritative write boundaries.
- Replaced automatic legacy-employee migration on read with safe in-memory defaults. A missing `departmentId` now reads as `Moderators`; no legacy employee document, payroll row, or historical report is written or recalculated when Employees loads.
- Added the Employees contract test for read-only roles, internal permission guards, and legacy-data compatibility.
- Added `no-cache` to Firebase Hosting HTML responses so a deployed dashboard shell revalidates before loading its versioned runtime scripts.

## Unreleased — Departments stabilization (closed)

- Fixed the existing Departments serialization gap: `commission`, `useBonusOverride`, `bonusType`, and `salesBonusRules` now round-trip through validation, Firestore writes, and normalization. Older department documents safely retain hourly/package/default values without migration.
- Kept fixed-salary departments bonus-free, made Commission use the existing sales-tier calculation path, and preserved the selected department salary type in newly calculated report rows. Existing monthly reports are not read, recalculated, or changed by this fix.
- Bound Department management controls to `departments.write` in the UI and added the same internal guard before every Department write; Firestore Rules remain the authoritative server-side protection.
- Versioned the Departments and App runtime URLs so deployed browsers cannot combine this change with cached scripts.
- Closed the Departments Module after production UAT approval. Removed the zero-employee temporary UAT document `UAT Commission 20260807 Updated` (`departments/gbqHozmvyTRaODDzJpkT`) from Firestore; no production department, employee, order, or historical report data was changed.

## Unreleased — Shipping Integration implementation

- Versioned the shipping runtime script URLs so a browser with prior Import-stage assets cannot combine the new Orders screen with a stale utility, schema, or permissions bundle.
- Replaced the legacy name-and-phone FIFO shipping matcher with the approved normalized-phone-only matching policy for open orders.
- Added validation, in-file duplicate detection, unmatched/conflict/stale/unchanged outcomes, tracking-number collision protection, and a manual-review conflict table; no shipping import can create an order.
- Added backward-compatible shipping fields (`shipping`, `lastShippingUpdate`, `lastShippingSyncedAt`) while retaining legacy flat fields, atomic order/audit writes, and per-month `shippingSyncs` import summaries.
- Added the distinct `shipping.import` permission and Firestore Rules protection; legacy Admin and Super Admin compatibility is retained.
- Added contract coverage for Egyptian phone normalization in local, country-prefixed, punctuation-formatted, and Arabic-digit formats.
- Production UAT on Firebase project `ahmed123-95a0e` matched one open order by a `+20`-formatted phone, stored the UAT tracking number/governorate/status/source time, and then classified the identical second import as unchanged with no additional order write or browser-console errors.

## Unreleased — Orders module closure

- Restored access to the existing guarded per-order edit and delete workflows in the Orders table. These actions remain hidden for read-only users and unavailable for locked months; no CRUD data model or permission boundary changed.
- Versioned the Orders runtime URL with this closure fix so active production browser sessions cannot retain the prior table renderer.
- Removed the runtime Excel CDN dependency by bundling the verified SheetJS 0.18.5 mini runtime into the existing `utils.js` application asset, with a versioned URL. This prevents browser content blockers or third-party CDN availability from interrupting Orders import/export.
- Final Firebase UAT verified a real Orders Excel download (`orders-report.xlsx`), opened the resulting workbook, and confirmed its 248 exported rows and fields match the generated production report. The supplied official workbook also parsed as 237 valid rows with one expected warning, and its repeat approval was refused as an existing import with no write.

## 7.0.11-import-production-uat

- Closed the Import Improvements milestone after a production UAT of the supplied official workbook against Firebase project `ahmed123-95a0e`.
- Confirmed that the workbook imports 237 orders with zero rejected rows and one visible missing-moderator warning, and that the persisted Firestore batch records the same counts.
- Confirmed idempotency in production: submitting the identical workbook again is refused with the existing-file message and creates no additional order batch.
- Added the shipping-integration design proposal and recorded the architecture constraint that the imported external Order ID is a source identifier, not automatically the internal order lifecycle identity.
- Expanded the shipping proposal with the full order-to-shipment workflow, matching-option comparison and recommendation, Firestore design, status lifecycle, cross-module impact, conflict policy, and pre-implementation test/rollback plan.
- Recorded the final shipping architecture decision: normalized phone is the sole automatic matching key for an open order; imported Order ID is reference-only, and multiple open matches are manual-review conflicts.

## 7.0.11-import-contract

- Made the primary Excel importer and Data Sources recognize the ten-column official operating workbook, including its established `Reciver` spelling, `Order_Amt`, `Order_Content`, `ID`, and `اسم المودريتور` headers.
- Preserved all legacy three-column imports while carrying date, external order number, customer, phone, notes, address, and product fields into the existing order-batch schema.
- Added tolerant Arabic-digit/currency parsing, Excel-date normalization, in-file duplicate `ID` detection, row-level error reporting, and non-blocking import of valid rows.
- A row with a missing moderator is now recorded as a visible `غير محدد` placeholder and a warning instead of being silently lost or attributed to a real employee.
- Replaced the incomplete import fingerprint with a backward-compatible v2 identity that includes official-order data and still detects historical batch imports through the legacy fingerprint.
- Added parser contract tests for the official format, legacy format, Arabic numeric values, invalid rows, duplicate IDs, and missing moderators.

## 7.0.10-uat-dashboard

- UAT Dashboard: stopped unauthorized employee, transaction, department, and settings reads during application startup for limited roles.
- Kept Dashboard usable with permission-safe defaults and masked the pending-transactions status when transaction access is absent.
- Prevented the legacy employee migration from attempting writes for read-only employee roles.

## 7.0.9-user-management-resilience

- Bound User Management controls before its first Firestore read, so search, refresh, edit, and retry remain available after a transient users-query failure.
- Added explicit loading and retryable error states for the users table without interrupting application initialization.
- Made User Management initialization idempotent and wrapped asynchronous UI handlers to prevent unhandled promise errors.
- Verified Super Admin authentication and `users` collection access against the configured Firebase project.

## 7.0.8-role-matrix-resilience

- Made custom-role loading fail-safe: an absent, empty, or temporarily unreadable `roles` collection now resolves to an empty custom-role list without affecting built-in roles.
- Cleared stale custom-role cache before every load and retained built-in role templates as the independent fallback catalogue.
- Removed the recoverable custom-role loading toast from Role Matrix initialization; the matrix continues with built-in roles only.
- Documented in Firestore Rules that no role seed or first-run migration is required for a new project.

## 7.0.7-final-stable

- Completed the final stability pass across the shared data, permission, audit, UI, and module integration paths.
- Fixed Salary Processing lifecycle timing: it now initializes after authenticated application startup and refreshes when the selected month changes.
- Removed superseded Salary Processing write/export implementations, guarded the read path, and release chart instances when their data becomes empty.
- Added the missing Firestore audit authorization for Salary Processing exports and normalized Audit labels for payroll, roles, users, and data sources.
- Corrected Salary Processing operational sales metrics to use `saleValue` with legacy `price` fallback.
- Fixed shipping matching for repeated customer name/phone pairs by consuming one order per shipping row instead of repeatedly updating the last matching order.
- Added final static regression coverage for JavaScript syntax, DOM references, authorization branches, bonus calculation, complex CSV parsing, chart states, dashboard widgets, and Firestore Rules compilation.

## 7.0.6-dashboard

- Scoped every operational Dashboard widget to the selected month and department instead of aggregating all historical orders.
- Corrected executive sales aggregation to prefer the persisted `saleValue`, preserving compatibility with older rows that only have `price`.
- Completed the operational row with recent audit activity, permission-safe data/empty states, shipping status, rankings, and actionable alerts.
- Added deterministic empty states for all Dashboard charts, including the Chart.js-unavailable case, and refresh the Dashboard once the shared order cache finishes loading.
- Applied permission-aware Dashboard values and quick actions, including protected employee, report, transaction, backup, audit, and order data.
- Kept KPI, pending-transaction, and department counts aligned to the active department scope; refined the operational grid for desktop, laptop, and tablet layouts.

## 7.0.5-data-sources

- Rebuilt Data Sources around real Google Sheets and Excel import flows, with source-level sync actions and multi-source selection UI.
- Replaced line-splitting CSV parsing with delimiter detection and RFC-style quoted-field handling, including escaped quotes and malformed-file rejection.
- Added live Google Sheets connection and schema validation, plus Excel workbook parsing through SheetJS at sync time.
- Added source create, update, delete, successful sync, and failed sync audit records.
- Enforced settings read/write and orders import permissions before source administration or synchronization.
- Clarified that Excel files are intentionally selected at sync time rather than stored in Firestore documents.

## 7.0.4-backup-restore

- Expanded full backups to include order batches, Salary Processing snapshots, settings (including bonus rules and data sources), role definitions, user role assignments, and the audit trail.
- Added independent partial backup and restore scopes for orders, salary processing, settings, roles and permissions, and audit records.
- Stored each backup's exact collection scope in its manifest; comparison and restore use that persisted scope only.
- Made the pre-restore safety backup mandatory and added elevated restore rules for protected payroll snapshots and role assignments.
- Preserved audit immutability during restore: missing audit records may be recreated, existing records are never overwritten.

## 7.0.3-role-matrix

- Added persisted custom roles with create, edit, clone, and guarded delete operations.
- Roles resolve into a stored permission list on each assigned user; role edits update that list atomically with the definition.
- Added custom-role assignment to User Management while retaining legacy built-in role profiles.
- Enforced custom-role permissions in Firestore Rules for employees, departments, settings, transactions, monthly reporting, settlements, salary processing, audit logs, and backups.
- Restricted role-definition management and role assignment to the existing Super Admin boundary.

## 7.0.2-critical-fixes

- Added production Firestore access rules for `salary_processing`; paid payroll snapshots remain immutable.
- Enforced distinct Salary Processing permissions for review, manual adjustment, approval, payment, and Excel export.
- Included manual additions, deductions, resulting net pay, and adjustment notes in salary snapshot Excel exports.
- Added audit records for payroll manual adjustments and exports.
- Scoped Configuration Center tabs so tabs in the salary details drawer cannot change or hide Settings panels.

## 7.0.0-stable

- Performed static JavaScript validation across all application modules.
- Consolidated the production handoff around central services for permissions, audit records, backups, orders, salary snapshots, and authentication metadata.
- Confirmed optional, backward-compatible storage for salary snapshots, data sources, user security metadata, and payment status.
- Documented intentional client-side limitations: revoking sessions on other devices requires Firebase Admin SDK / Cloud Functions; Google Sheets requires a publicly readable, CORS-accessible sheet.
