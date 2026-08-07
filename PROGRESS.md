# PROGRESS.md — Final Production Audit

## Dashboard UI / UX Consistency Audit — Phase 1 (awaiting user review)

### Visual root causes

- The Dashboard accumulated several visual override layers. Its Hero, status strip, quick-action rail, and KPI groups followed separate spacing and card rules, so the page lacked a clear visual hierarchy despite functioning correctly.
- The five existing month-status items were rendered in a single unstructured band. At common desktop widths this competed with the Hero copy; at narrower widths it could require three rows and create excess whitespace.
- KPI cards inherited generic auto-fit behavior despite two distinct data sets (six operational and eight financial metrics), producing uneven density and inconsistent label/value/icon reading order.
- The existing Topbar and Sidebar worked correctly but did not visually anchor the Dashboard content as one workspace at the same quality level as the reference.

### Visual-only implementation

- Kept every dashboard ID, data binding, Canvas, button, permission attribute, query, and event handler intact. The only markup classification added is `dashboard-financial-grid` to give the already-existing financial cards a stable visual grid.
- Introduced a scoped Dashboard composition: Hero copy and status overview, compact action rail, consistent section headings, KPI hierarchy, card rhythm, chart surfaces, tables, insights, and operational widgets.
- Updated Topbar and Sidebar surfaces, spacing, navigation rhythm, shadows, and active state using the existing dark palette and existing icon system; no role or behavior changed.
- Added responsive breakpoints for the Hero, status grid, KPI grids, actions, widgets, and charts. At 1280px the status summary is two rows instead of three.

### Verification and Firebase UAT

- Local regression passed: `node tests/dashboard-contract.test.js`, `node --check js/app.js`, `node --check js/charts.js`, and `git diff --check`.
- Firebase Hosting deployed successfully from `feature/dashboard-ui-ux-audit` to project `ahmed123-95a0e`.
- Published UAT at 1280×720 loaded `style.css?v=7.0.11-dashboard-ui-ux-audit-r2`; the Hero measured 218px (down from the pre-audit 252px), with five status items in two rows and three columns.
- All six Dashboard charts remained bounded at a 310px card / 225px wrapper / 205px canvas. Sidebar scrolling remained available (`overflow-y: auto`), all five quick-action controls remained present, and the existing Add Employee quick action opened and closed its dialog without writing data.
- Browser logs contained no Console or Runtime errors during load, navigation, action-modal open/close, or chart rendering.

### Scope confirmation

- This phase is visual-only and remains unmerged and untagged pending user review. No Firestore document, Authentication account, permission, report, salary, calculation, query, chart dataset, or production business record was changed.

## Users Lifecycle and Management Layout Hotfix (awaiting user review)

### Root causes and limited fixes

- Firebase Authentication Console creates an Authentication identity only. It cannot safely create or enumerate a Firestore user profile from this browser-only application. The existing secure flow deliberately creates `users/{uid}` only when that identity first signs in, using a self-only `pending` profile with no permissions. Therefore a Console-created account is intentionally absent from User Management until that first sign-in and cannot enter the Dashboard until a Super Admin activates it.
- The login handler created the safe pending profile correctly, but then threw a plain custom error which the generic mapper reduced to an unhelpful login failure. Authentication now retains explicit `auth/account-pending` and `auth/account-inactive` codes and shows the correct user-facing outcome. This is a feedback fix only; it does not alter Firestore Rules, role definitions, or the approval boundary.
- An unclosed Settings form and mismatched closing containers caused the browser parser to place `#view-users` directly under `body` rather than inside Dashboard `main`. The resulting independent layout flow created the reported blank area and low table. A structural wrapper balances the existing markup without changing Settings behavior.
- The existing sidebar used `height: 100vh` with no overflow rule. At common viewport heights, its lower navigation items could not be reached. `overflow-y: auto` restores its intended scrolling behavior while retaining all existing styling.

### Firebase UAT completed

- Created the disposable UAT identity `uat.users.lifecycle.20260807@ahmed123-95a0e.local` through the Firebase Authentication service, then exercised the same secure self-profile write used by first application sign-in. Firebase returned the Authentication UID and Firestore confirmed `role: pending`, `status: pending`, and an empty permission set.
- Refreshed User Management on the published site: the pending account appeared immediately. It was activated through the existing Super Admin editor as the built-in `viewer` role, with no custom permission overrides.
- Re-authentication with the new email/password succeeded. The active account could read its own Firestore profile; its `viewer` role resolves from the application's immutable built-in role template, as designed, so no public `roles` document read is required.
- Published UI UAT confirmed `#view-users` is inside `main`, with the Users panel, toolbar, and table starting at the normal top-of-content position. Sidebar scrolling reached and opened User Management in a 1270x720 viewport. No browser Console errors were observed during the page refresh, navigation, or user-editor operation.

### Verification completed

- Passed: `node --check js/auth.js`, `node --check js/user-management.js`, `node tests/users-security-contract.test.js`, `node tests/dashboard-contract.test.js`, `git diff --check`, and structural HTML validation for unclosed/misordered tags.
- Firebase Hosting deployed successfully to project `ahmed123-95a0e` from `hotfix/users-lifecycle-layout`. This hotfix remains unmerged and untagged pending user review.

### Scope confirmation

- No Firestore Rules, schema, role definition, business logic, production business record, report, salary amount, or existing user permission was changed. The UAT account is a separately created active Viewer account used solely to verify the supported lifecycle.

## Dashboard Chart-Height Hotfix (awaiting user review)

### Root cause and limited fix

- Dashboard charts use `responsive: true` with `maintainAspectRatio: false`. Their `.chart-wrap` flex child previously had no shrinkable minimum height, so the canvas height written by Chart.js could become the parent height and trigger a repeating ResizeObserver growth loop. The card itself remained 300px while its canvas overflow grew into the thousands of pixels.
- The fix applies only to Dashboard chart wrappers: `flex: 1 1 0`, `min-height: 0`, and hidden overflow bound the container; the canvas fills that container at `100%` height and width. No chart data, chart type, Dashboard design, calculation, or render logic changed.
- The first production deployment still loaded an older cached stylesheet because `dashboard.html` referenced an unversioned CSS URL. The Dashboard stylesheet now uses `?v=7.0.10-chart-height-hotfix`, ensuring clients receive the bounded layout.

### Verification completed

- Passed locally: `node --check js/charts.js`, `node --check js/app.js`, `node tests/dashboard-contract.test.js`, `node tests/production-config-contract.test.js`, and `git diff --check`.
- Firebase Hosting deployed successfully from `hotfix/dashboard-chart-height`.
- Production UAT measured all six Dashboard chart cards at 300px, their wrappers at 226px, and canvases at 210px. The same measurements remained unchanged after a second timed observation, confirming no unintended resize/render loop. Browser Console contained zero errors and zero warnings.

### Scope confirmation

- No Firestore data, Rules, Schema, Dashboard statistics, chart data, Chart.js configuration, or visual design was changed. This Hotfix remains unmerged and untagged pending user review.

## Final Production Audit (closed and approved)

### Scope and outcome

- Reviewed the approved production modules: Import, Shipping Integration, Orders, Departments, Employees, Salary Processing, Reports, Transactions, Dashboard, and Users & Security.
- Re-ran all 10 contract suites plus `node --check` for every application JavaScript file. Every check passed, including import compatibility/duplicates, phone-only shipping matching, CRUD and permission boundaries, atomic report/salary/transaction writes, Dashboard reads/actions, and the role/security matrix.
- Reviewed Firebase target alignment, Hosting assets, Firestore Rules/index definitions, permission-gated routes, and documented legacy compatibility paths. No runtime, Firestore, or authorization regression was observed in the final production smoke test.

### Root causes fixed during this audit

- The Dashboard referenced `cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js`, which returns HTTP 404. It caused the documented Chart.js Console warning and left chart rendering dependent on a failed external request. The pinned Chart.js 4.4.4 UMD file is now served as `js/vendor/chart.umd.js` from Firebase Hosting; `tests/dashboard-contract.test.js` prevents reintroducing an external Chart.js dependency.
- `index.html` initialized Authentication against the retired `moderator-salary9` project while `js/firebase.js`, Firestore Rules, and Hosting target `ahmed123-95a0e`. Opening the published root URL could therefore evaluate a different Auth session before redirecting. The root router now uses the same production project, verified by `tests/production-config-contract.test.js` and production UAT.

### UX and production UAT

- Authenticated production root route: `https://ahmed123-95a0e.web.app/` redirected on first load to `dashboard.html?v=7.0.19-final-audit` using the active production session and displayed the active month.
- First-click navigation passed for Dashboard, Departments, Employees, Orders, Months, Month Comparison, Reports, Transactions, Settlements, Archive, and Backups. First-click open/close checks passed for the Department and Employee dialogs.
- Browser Console contained zero errors and zero warnings during the final authenticated Dashboard/root smoke tests. No order, report, salary, transaction, user, or Audit data was written during this UAT.
- Firebase Hosting was deployed successfully to `ahmed123-95a0e`; the locally served Chart.js asset returned HTTP 200 with `text/javascript` from the published site.

### Remaining technical debt and recommendations

- No blocking production defect remains from the recorded technical-debt list: the stale root Firebase configuration and failed Chart.js dependency were resolved in this audit.
- Firebase SDKs are intentionally hosted by Google. Lucide and jsPDF remain external CDN dependencies; pinning/bundling them is a future resilience improvement, not a current defect, and was not expanded into this stabilization audit.
- Keep the current contract suites in the release gate and add a browser-runner when CI infrastructure is introduced, so first-click and download workflows are automatically exercised in addition to the existing deterministic contracts.

### Scope confirmation

- No schema migration, Firestore Rule change, role change, calculation change, report history change, or production-business-data write was made in this audit. The branch remains `feature/import-improvements` and has not been merged into `main`.
- Final approval authorizes the release merge to `main`, the `v7.0.10` tag, and the final Firebase deployment from `main`.

## Users & Security Audit (closed and approved)

### Root cause and minimal fix

- Firestore trusted a stored `permissions` list for every authenticated profile even when it was `pending` or `disabled`. A self-created pending document could therefore carry `['*']` and bypass the intended review flow. Active-state enforcement now applies to every ordinary and Super Admin authorization path, with a missing legacy status treated safely as active.
- The old first-account exception did not require the user profile and `adminBootstrap` marker to be in the same write, and the marker itself could be created alone. Both sides now verify the same atomic first-admin transaction.
- Only Super Admins could update `users/{uid}`, which rejected the existing `lastLoginAt` and `lastActivityAt` writes for active limited users. Rules now permit only those two fields for the authenticated owner; Authentication continues to keep all role normalization in memory.
- Login/Logout Audit entries were not included in the role capabilities of every active account. Rules now allow exactly self-attributed `auth.login` and `auth.logout` create records, while Audit update/delete and every other ordinary create remain denied.
- User Management omitted existing stored permission keys from its editor. The existing keys are now displayed without adding a role, permission, Schema field, or behavior.

### Files changed

- `firebase/firestore.rules` — active-profile gate, safe pending registration, atomic bootstrap pairing, self-only activity write, and narrow self session-Audit rule.
- `js/auth.js` — in-memory legacy normalization and activity write only after the active Dashboard authorization check.
- `js/user-management.js` — presentation entries for existing permission keys only.
- `dashboard.html` and `login.html` — versioned Authentication/User Management assets for cache-safe deployment.
- `tests/users-security-contract.test.js` — security and role-matrix contract coverage.

### Verification completed

- Passed: `node --check js/auth.js`, `node --check js/user-management.js`, `node tests/users-security-contract.test.js`, every `tests/*-contract.test.js` suite, and `git diff --check`.
- Security role matrix passed for Super Admin, Admin, the existing Supervisor role as the system's Moderator-compatible operational role, Viewer (Read Only), Pending, and Disabled. No new `Moderator` authentication role was created.
- Firebase deployed both Hosting and Firestore Rules to project `ahmed123-95a0e`; rules compilation completed successfully and the published app loads `js/auth.js?v=7.0.18-users-security` and `js/user-management.js?v=7.0.18-users-security`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` reloaded the Firebase-hosted Dashboard through the Authentication guard and confirmed the active session, current month, and versioned assets without changing any account, role, user document, or business data. The former Chart.js CDN warning was resolved during Final Production Audit.

### Scope confirmation

- No account, role assignment, production user document, Firestore schema, migration, report, salary calculation, or business data changed in this stage.

## Dashboard Stabilization (closed and approved)

### Root cause and minimal fix

- Dashboard bootstrap still initialized Months and settlements for roles that could open Dashboard but were not allowed to read those collections. The dashboard status loader also queried both backups and Audit as one unconditional `Promise.all`, so a legitimate denied read produced a Console warning and discarded the other result.
- The status loader now asks only for data allowed by the existing client capability. It refreshes the existing Dashboard renderer once both permitted reads complete, which gives Recent Activity the latest Audit cache without changing any widget aggregation, calculation, or scope.
- Dashboard quick actions depended on disabled UI state alone. Each now uses one caught existing-permission boundary, so a direct or stale event becomes the standard visible denial message rather than an unhandled rejection.
- `renderMonthStatusUI()` could re-enable the pre-existing Report Calculate control after permissions had disabled it. Its existing month-lock state now combines with the current `reports.calculate` capability.

### Files changed

- `dashboard.html` — versioned the App runtime URL for the deployed Dashboard fix.
- `js/app.js` — capability-gated Dashboard bootstrap/status reads, widget refresh after a successful read, quick-action guards, and permission-stable Calculate control.
- `tests/dashboard-contract.test.js` — Dashboard capability, asynchronous refresh, quick-action, and month-state regression coverage.

### Verification completed

- Passed: `node --check js/app.js`, `node --check tests/dashboard-contract.test.js`, every `tests/*-contract.test.js` suite, and `git diff --check`.
- Firebase Hosting deployed to project `ahmed123-95a0e`; the published dashboard loads `js/app.js?v=7.0.17-dashboard-stabilization`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` loaded the current Dashboard, July 2026 status strip, scoped operational widgets, and Recent Activity. The Add Employee quick action opened and closed without save; Import Orders opened the Import tab with no file selected. No production record, report, salary amount, Audit entry, import, or backup was created or changed.
- Browser Console contained zero errors. The sole existing Chart.js CDN warning remains recorded as pre-existing technical debt outside this limited stabilization scope. Restricted-role suppression and direct-event denial are covered by the isolated Dashboard contract without changing any production account or permission.

### Scope confirmation

- No Dashboard statistic or calculation, report/salary logic, historical data, Firestore schema, Firestore Rule, migration, or production data changed in this stage.

## Transactions Stabilization (closed and approved)

### Root cause and minimal fix

- The unified Transaction form checked `transactions.write` before calling `preventDefault()`, which could turn a denied submit into an uncaught browser error. The handler now stops the submit first and uses one caught internal guard for every create, edit, delete, and approve path, including the legacy hidden forms.
- The month-status refresh could re-enable Transaction fields after the shared permission layer disabled the Save button. Transaction fields and form submits now combine the existing month read-only state with `transactions.write`.
- Ledger action buttons did not respect write access, and approval was tied to a literal `admin` role name. The rendered actions and approval now use only the existing `transactions.write` capability; read-only users retain ledger search and filters.

### Files changed

- `dashboard.html` — capability metadata for Transaction save/cancel and an App runtime cache version.
- `js/app.js` — safe transaction write guard, permission-aware form state and ledger actions, and capability-based approval.
- `tests/transactions-contract.test.js` — capability, submit-order, legacy-display, DataLayer atomicity, and Rules compatibility coverage.

### Verification completed

- Passed: `node --check js/app.js`, `node tests/transactions-contract.test.js`, `node tests/reports-contract.test.js`, `node tests/salary-processing-contract.test.js`, `node tests/employees-contract.test.js`, `node tests/departments-contract.test.js`, `node tests/import-contract.test.js`, and `node tests/shipping-contract.test.js`; `git diff --check` passed before commit.
- Firebase Hosting deployed to project `ahmed123-95a0e`; the published dashboard loads `js/app.js?v=7.0.16-transactions-stabilization`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` opened Transactions, confirmed the permitted Save control, retained enabled search/filter controls, and rendered the current empty ledger without actions or errors. No advance, adjustment, audit entry, report, or other production data was created or changed. The browser recorded zero errors and one pre-existing Chart.js warning only.
- Read-only action suppression, direct-submit denial, and legacy record compatibility are covered by the isolated Transaction contract without modifying any production account or permission.

### Scope confirmation

- No financial amount, salary/report calculation, historical record, Firestore schema, Firestore Rule, migration, or production data was changed in this stage.

## Reports Stabilization (closed and approved)

### Root cause and minimal fix

- The Report-page toolbar bypassed the shared permission metadata: a `reports.read` user could see active Calculate, Approve, and export controls even though the calculate/approve paths later rejected the action. The controls now declare their existing capabilities.
- Excel, PDF, clipboard copy, and print did not verify `reports.export` inside the event boundary. A small caught guard now denies direct or stale events with a visible message instead of an uncaught console error.
- Report calculation saved `monthly_reports/{monthId}` and then wrote `report_calculated` separately. The same report payload and the unchanged Audit entry now share one Firestore batch, so neither can persist without the other.

### Files changed

- `dashboard.html` — existing Report controls now declare their existing permissions and the App runtime is versioned.
- `js/app.js` — protected Report exports and atomic calculation/Audit commit.
- `tests/reports-contract.test.js` — capability, direct-guard, atomic-write, and totals-regression coverage.

### Verification completed

- Passed: `node --check js/app.js`, `node --check js/reports.js`, `node tests/reports-contract.test.js`, `node tests/salary-processing-contract.test.js`, `node tests/employees-contract.test.js`, `node tests/departments-contract.test.js`, `node tests/import-contract.test.js`, and `node tests/shipping-contract.test.js`; `git diff --check` passed before commit.
- Firebase Hosting deployed to project `ahmed123-95a0e`; the published dashboard loads `js/app.js?v=7.0.15-reports-stabilization`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` opened the Report view and confirmed the current permission attributes on every controlled button. The active period has no calculated report, so selecting Excel safely showed the existing no-report message without creating a report, export, audit entry, salary record, or other production data. The browser recorded zero errors and one pre-existing Chart.js warning only.
- Restricted-role and direct-event denial are covered by the isolated Reports contract without changing any production user account or permission.

### Scope confirmation

- No salary formula, report calculation formula, historical report, Firestore schema, Firestore Rule, migration, or production data was changed in this stage.

## Salary Stabilization (closed and approved)

### Root cause and minimal fix

- Salary Processing was reading legacy Snapshot fields for additions and deductions while current monthly reports persist `totalAdjustments`, `totalAdvances`, and `previousDebt`. Commission report rows persist the amount in `totalBonus`, but the Snapshot view read only an absent commission field. A display-only adapter now maps both stored formats and uses the stored final/net amount without changing its calculation.
- The `paid` Snapshot status was rendered as `Draft` in the lifecycle badge. It now renders as `Paid`.
- Salary adjustment, payment, export, and print controls were visible before checking the existing Salary Processing capabilities. Rendering now follows `salary_processing.write`, `.pay`, and `.export`; the internal permission guards and Firestore Rules remain unchanged.
- Approve, payment, and manual-adjustment writes recorded their audit event separately after the financial write. They now use one existing-schema Firestore batch, so a Snapshot write and its Audit entry either both commit or neither does.

### Files changed

- `dashboard.html` — versioned the deployed Salary Processing runtime asset.
- `js/salary-processing.js` — display-field compatibility, `paid` label, permission-aware controls, and atomic existing-schema Snapshot/Audit writes.
- `tests/salary-processing-contract.test.js` — current/legacy display, commission, permission, status, aggregation, and atomic-write contract coverage.

### Verification completed

- Passed: `node --check js/salary-processing.js`, `node tests/salary-processing-contract.test.js`, `node tests/employees-contract.test.js`, `node tests/departments-contract.test.js`, `node tests/import-contract.test.js`, and `node tests/shipping-contract.test.js`; `git diff --check` also passed before commit.
- Deployed Firebase Hosting to project `ahmed123-95a0e`. The published dashboard loads `js/salary-processing.js?v=7.0.14-salary-stabilization`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` opened the Firebase-hosted Salary Processing Center for the active July 2026 period. The current state correctly displayed `Draft` because no Snapshot exists for that period; no approval, payment, adjustment, or Snapshot was created in production. The administrator's existing permitted controls render, and the browser recorded zero errors and one pre-existing Chart.js warning only.
- Paid-state and restricted-capability behavior are covered by the isolated contract test, so no production salary record or user permission was changed merely to exercise those cases.

### Scope confirmation

- No salary formula, salary calculation, historical report, Firestore schema, Firestore Rule, migration, report, or production data was changed in this stage.

## Employees Stabilization (awaiting user review)

### Root cause and minimal fix

- Employee management controls were rendered after the static permission pass and therefore appeared for `employees.read`-only users. A direct form submit could also throw before preventing the browser event. The repair renders Add/Edit/inline-salary/Reactivate only for `employees.write`, Delete only for `employees.delete`, and retains a caught internal `Permissions.require` guard for stale or direct events.
- Employees created before departments were previously read with null shape and the listener could start a migration write. The listener now supplies `Moderators`, `active`, empty-note, null-date, and zero-salary defaults in memory only. It performs no migration and no Firestore write during a legacy read.

### Files changed

- `dashboard.html` — capability metadata for Add Employee and an Employees runtime cache version.
- `js/app.js` — permission-aware Employee controls, caught internal guards, and read-only legacy normalization.
- `tests/employees-contract.test.js` — new permission and legacy-data contract coverage.
- `firebase.json` — revalidation header for HTML release shells.

### Verification completed

- Passed: `node --check js/app.js`, `node tests/employees-contract.test.js`, `node tests/departments-contract.test.js`, `node tests/import-contract.test.js`, and `node tests/shipping-contract.test.js`.
- Deployed Firebase Hosting to project `ahmed123-95a0e`; the deployed `dashboard.html` returns `Cache-Control: no-cache` and loads `js/app.js?v=7.0.13-employees-stabilization`.
- Production UAT as `admin.login.20260807@ahmed123-95a0e.local` opened Employees, showed nine existing rows with the safe `Moderators` department default, allowed only the administrator's existing management controls, opened and closed Add Employee without saving, and returned one row for the `Haba` search. No employee, salary, report, or historical document was changed and the browser console recorded zero errors.
- The `employees.read`-only behavior is exercised by the new isolated permission contract without modifying any production user account: no write/delete capability is granted and direct guards deny both operations.

### Out-of-scope observation (not changed)

- `index.html` still contains a bootstrap Firebase configuration for the legacy `moderator-salary9` project while `js/firebase.js` correctly targets `ahmed123-95a0e`. This is outside the approved Employees scope; it was not modified in this stage and should be handled as a focused Authentication follow-up.

## Departments Stabilization (completed and approved)

### Root cause and minimal fix

- The Department form already exposed Commission and custom sales-tier controls, but the Departments module discarded those fields and normalized `commission` as `hourly`. The repair preserves these existing fields with safe defaults for pre-existing documents; no migration was run.
- Fixed departments still clear all bonus configuration. Commission departments now route through the existing sales-tier bonus calculator, using their saved tiers when present and the existing company sales tiers otherwise. New report rows retain `commission`; no historical report document is modified or recalculated.
- Department Add/Edit/Archive/Restore controls now honor `departments.write`, and the same capability is required inside the Department write methods before the existing DataLayer and Firestore Rules checks.

### Verification completed

- `node tests/departments-contract.test.js` passed: legacy defaults, legacy custom tables, Commission create/update payloads, fixed-department invariants, archive/restore, internal write denial, read-only permission behavior, and the future-report calculation contract.
- Regression checks passed: `node tests/import-contract.test.js`, `node tests/shipping-contract.test.js`, and syntax checks for `js/departments.js`, `js/app.js`, and `js/permissions.js`.
- Firebase Hosting UAT on `https://ahmed123-95a0e.web.app` created and then updated the temporary `UAT Commission 20260807 Updated` department. Reopening it confirmed `commission`, `useBonusOverride: true`, `bonusType: sales`, and tier values `100 / 999 / 25` persisted through Firestore.
- The same temporary department was archived and restored successfully, with no browser-console errors. Existing report state was not recalculated or changed during UAT.
- The in-app browser could not reach the lower User Management navigation control in this viewport. The deployed Department UI and internal permission behavior are covered by the read-only permission contract; Firestore Rules remain unchanged and continue requiring `departments.write` for create/update.

### Formal closure — 2026-08-07

- Departments Module was formally approved and closed.
- Removed the temporary zero-employee UAT department `UAT Commission 20260807 Updated` from production by exact Firestore document path `departments/gbqHozmvyTRaODDzJpkT`; it had no employees and no historical report usage.
- Reloaded the deployed Departments view after removal: the UAT record was absent and the browser console recorded zero errors.
- The closure affects neither historical department/report data nor the established archive/restore behavior for production departments.

## Milestone 1 — Import Improvements (completed and production-verified)

### What changed

- Canonical import mapping now supports the official ten-column workbook and remains compatible with the historical name/packages/price layout.
- Import parsing keeps all available order metadata, cleans common number formats, detects repeated external IDs within a workbook, and skips only rows that cannot form a valid order.
- Missing moderator names use the explicit `غير محدد` placeholder with an import warning; this imports the operational order without assigning it to an actual employee.
- Data Sources now uses the same official-header aliases as the direct Excel importer.

### Files changed

- `js/utils.js`
- `js/app.js`
- `js/data-sources.js`
- `tests/import-contract.test.js`

### Verification completed

- `node tests/import-contract.test.js` passed: official mapping, legacy mapping, Arabic digits/currency, malformed required values, duplicate IDs, and missing-moderator fallback.
- `node --check` passed for every changed runtime module.
- The supplied workbook was structurally checked: exact ten headers, 237 rows, no duplicate IDs. Its one missing moderator value (`ID 81764`) is covered by the placeholder-warning path.
- Firebase deploy completed for project `ahmed123-95a0e`; the production bundles contain the new import code.
- Production Authentication, Firestore-backed dashboard load, and browser console smoke test passed with no console errors.

### Formal production UAT closure — 2026-08-07

- Ran the supplied official workbook through the deployed Import Center on Firebase project `ahmed123-95a0e` as the production Super Admin.
- Import Summary: 237 valid orders, 0 skipped orders, and 1 visible warning. The warning is the expected missing moderator on source `ID 81764`; it was imported as `غير محدد` and was not assigned to a real employee.
- Firestore verification: `monthly_reports/2026-07/orderBatches` contains exactly one production import batch with `count: 237`, `warningCount: 1`, and `errorCount: 0`.
- Re-imported the identical workbook through validation and approval. The deployed application returned `تم استيراد هذا الملف مسبقًا`; the Firestore batch count remained one, so no duplicate data or batch was written.
- No runtime or browser console errors were recorded during this UAT. The browser retained only the pre-existing Chart.js-unavailable warnings, which are outside the import flow and do not represent an error.

### Architecture note for the shipping milestone

The `ID` column imported from the official order workbook is an identifier issued by the source system. It is retained as external-source data and must not be assumed to be this system's primary identifier for the full order lifecycle. Shipping matching will be reviewed as part of the approved shipping-integration design before implementation; no schema migration or matching-policy change is included in Milestone 1.

### Shipping design review revision

- Expanded `SHIPPING_INTEGRATION_DESIGN.md` before Phase 2 implementation: full order-to-shipment workflow, comparison of matching approaches, the recommended layered matching service, backward-compatible Firestore impact, canonical status lifecycle, downstream module boundaries, conflict handling, and test/rollback coverage.
- The document retains the explicit approval gate. No Phase 2 source, rule, schema, migration, or production-data change was made.

### Final shipping matching decision

- Replaced the proposed layered matching policy with the approved phone-only strategy: normalize Arabic/English digits, remove `+20`, spaces, and hyphens, then match exactly one open order by phone.
- The official import `ID` is reference-only and is excluded from every shipping matching/update decision. Tracking number is stored on the uniquely matched order as the primary shipment reference after carrier hand-off.
- Multiple open orders sharing a normalized phone are recorded as `conflict` for manual review; they are never updated automatically.

## Milestone 2 — Shipping Integration (implementation in progress)

### Implemented so far

- The approved decision is now reflected in the code and design: shipping updates normalize Arabic/English numerals and Egyptian country-prefix variants, then select only one open order by phone. The imported order ID and customer name do not participate in the decision.
- Shipping-file validation now requires phone, tracking number, and governorate; status and provider update time are optional. Exact duplicate rows are ignored, while multiple non-identical rows for one normalized phone are visible conflicts.
- Matched updates persist tracking number, governorate, normalized status, provider/update timestamps, source fingerprint, and sync ID without moving or creating order documents. Flat historical shipping fields remain written and read.
- Updates are compare-and-write transactions, append to the immutable audit trail, respect locked/archived months, and create a bounded `shippingSyncs` summary under each affected month.
- The new capability `shipping.import` separates carrier-file writes from ordinary order editing in both client permission checks and Firestore Rules.
- Production UAT exposed a stale-browser asset mix (the older cached `utils.js` lacked the new phone normalizer). Script URLs for the shipping runtime are now versioned so the deployed Orders page always loads the matching utility, Firebase schema, and permission modules.

### Tests completed so far

- JavaScript syntax checks passed for all changed runtime modules.
- `node tests/import-contract.test.js` passed, including the new phone-normalization contract cases.
- `node tests/shipping-contract.test.js` passed: unique phone match, multi-order conflict, idempotent fingerprint, stale event, tracking collision, and duplicate source-phone scenarios.
- Firebase UAT passed on `https://ahmed123-95a0e.web.app`: a carrier row with `+20`/hyphen formatting uniquely matched an open production order, stored its tracking number/governorate/status/source time, and completed with no browser-console errors. Re-importing the exact same row produced `0 matched` and `1 unchanged`, so no duplicate order or shipment write was made.
- The successful atomic save and subsequent reload/re-import confirm the production order update, immutable audit append, and month-scoped `shippingSyncs` summary write passed deployed Firestore Rules.

### Remaining before milestone closure

- Review downstream Dashboard/Reports presentation and the remaining phase-two module impact before formally closing the broader Shipping Integration milestone. The phone-only import/update path itself is production-verified.

## Orders module closure (completed and production-verified)

- Corrected a verified UI reachability defect: the existing transactional edit/delete handlers were never rendered in an order row. They are now visible only to `orders.write` users for open months, retaining the existing confirmation, Rules, audit, and report-recalculation protections.
- Production review found that external Excel-library assets could be unavailable in a client session without a runtime exception. The root cause is removed: the verified SheetJS 0.18.5 mini runtime is bundled into the existing `js/utils.js` application asset and its URL is versioned; Orders import/export no longer depends on a CDN or a separately blockable library file.
- Final production UAT on `https://ahmed123-95a0e.web.app` generated the general Orders report with 248 rows, started three real `orders-report*.xlsx` downloads, and verified the newest workbook opens as `Order Report` with 248 rows and the expected eleven fields. Its first exported row matches the report (`81579`, Hind, 6 packages, 650 EGP) and no browser-console errors were captured.
- The supplied official workbook was then uploaded through the deployed Orders Import flow: 237 valid rows, 0 ignored rows, and the expected single missing-moderator warning. Its approval path correctly returned the existing-import message, proving duplicate protection without a duplicate Firestore write. No browser-console errors were captured during upload, analysis, validation, or duplicate approval.

## Version 4 completion

- Added a Configuration Center tab shell while preserving the existing settings form and backward-compatible saves.
- Existing per-department Bonus Overrides remain the supported bonus customisation; the package-count calculation itself is unchanged.
- Import confirmation is validation-gated: imports with invalid parsed rows cannot be committed.

## Version 4 — Operations & Configuration Center (compatible scope)

- Added an optional Import Center layer: explicit department selection, existing preview/validation/confirmation flow presented as a wizard, and Import History for the displayed month.
- Import History reads the existing order-batch records. New imports add optional descriptive fields (file name, error count, department) while legacy batches render safely with fallbacks.
- The existing import behavior remains the default: no update/replace policies were added, and duplicate protection is unchanged.
- The current department-level bonus table remains the supported editable configuration. No new bonus formula, sales rule, or calculation path was introduced.

## UI Refresh — Phase 1: Ledger Dark Visual Foundation

- Applied a visual-only Ledger Dark token layer for canvas, surfaces, semantic colours, typography, controls, radii, shadows, focus rings and motion.
- Refined the dark theme across sidebar, navigation, panels, cards, tables, buttons, form fields, chips, toasts, loading surfaces and modals without changing IDs, handlers, data attributes or business logic.
- Added a presentation-only Lucide adapter which replaces rendered UI emoji with Lucide SVG icons after each static or dynamic render. Existing text, events and generated markup contracts remain intact.
- Added stronger contrast, tabular figures, sticky table headers, zebra/hover rows, accessible focus indicators and reduced-motion support.
- Phase 2 (Dashboard/layout/navigation/report redesign, light mode and page-specific UX) has not started.

## UI Refresh — Phase 2: UX, Layout & Dashboard Redesign

- Redesigned the Dashboard presentation only: a month-status hero, quick actions, an alerts panel, and distinct operational and financial KPI sections now make the existing data hierarchy easier to scan.
- Grouped sidebar navigation by workflow, added an updating breadcrumb, and refined responsive layout behavior for mobile and tablet sizes.
- Added shared UX styling for page headings, toolbars, filters, search, comparison controls, reports, audit cards, Smart Approval, tables and charts. No page IDs, application logic, payroll calculations, Firebase calls or permission behaviour changed.
- Updated the visual Chart.js palette to the Ledger Dark tokens only; chart types, source data, options and calculation flow remain unchanged.
- Phase 2 scope is complete. No Phase 3 work was started.

## Version 3 — Roles & Permissions (Phase 1)

## Version 3.1 — Permissions Polish

- Added a “Copy permissions from” control to the user editor. It copies only `permissionOverrides` (allow/deny), never the role, status, email or profile data.
- Added one central display catalogue for every existing permission key, with friendly Arabic labels and group icons. Stored Firestore permission keys are unchanged.
- Redesigned the user editor modal with an identity header, dedicated copy area, responsive permission cards and clearer override controls.
- Permission changes now append an atomic `USER_PERMISSIONS_UPDATED` entry to the existing Audit Log. It stores the target account, actor (through the current Audit service), added/removed effective permissions, friendly names, and before/after snapshots without changing the audit schema.

### Compatibility repair

- Fixed a startup regression where a denied Users query aborted `App.init()` and consequently left the Dashboard and all data views uninitialised. User-management loading is now isolated; payroll data loading continues even if that optional query fails.
- Fixed the bootstrap migration to keep its physical Firestore role as `admin` while recording its logical `systemRole: super_admin`. This preserves compatibility with the deployed Admin-only ruleset while retaining Super Admin permissions in the centralized service.
- Added a rule-side `isSuperAdmin()` helper and grants it the required users-list/read/update access. This is necessary for the Super Admin user-management page; ordinary Admins and all other roles cannot enumerate or edit profiles.
- A deployment of `firebase/firestore.rules` is required with this repair so an account that was already migrated to `super_admin` can be reconciled automatically on its next login.

- Added the central `Permissions` service. All new checks use capability keys (for example `reports.approve` and `months.destructive`), never role-name checks scattered through pages.
- Added the approved role templates: `super_admin`, `admin`, `accountant`, `hr`, and `viewer`, with per-user allow/deny overrides and an effective-permissions snapshot.
- Added automatic profile migration: legacy Admin profiles receive a status, overrides and effective permissions; the original bootstrap account is promoted to `super_admin` without touching payroll data.
- Added the Super Admin-only Users & Permissions page: search, status filter, role/status editing, grouped permission controls, and Active/Suspended/Pending/Disabled states. Login blocks every non-active account.
- Added application/service guards for CRUD, import, report calculation/approval, month actions, backups, restore, and navigation. Existing pages and lifecycle logic were not redesigned.
- Kept Firestore rules compatible with the new bootstrap Super Admin role only. **Deliberately deferred full Firestore capability enforcement**: safely translating every capability and per-user override to server rules requires a dedicated rules migration and emulator coverage; a broad or partial rule would create a false security boundary. Until that phase is deployed, the existing Firestore rules still restrict payroll-data access to Admin/Super Admin accounts, so Accountant/HR/Viewer permissions are enforced by the application layer but cannot independently access Firestore data.
- Required Phase 2 Firestore work: introduce rule-side active-status and effective-permission helpers, map every collection/subcollection operation to the same capability catalogue, restrict `users` profile management to `users.manage`, and verify denial/allow matrices with the Firestore Emulator before deployment.

## Final root cause and fix

- The Reset Month failure was caused by sending a custom plain object back to Firestore instead of a native Firestore value.
- The root cause was in the shared cloning layer: `plainClone()` converts `Timestamp` and `FieldValue` values into tagged markers for safe storage, but `reviveClone()` must restore only marked timestamps and must pass real Firestore sentinels through unchanged.
- The fix preserves live `serverTimestamp()` / `delete()` sentinels as-is; it turns tagged timestamp markers back into Firestore `Timestamp` objects; it never re-wraps a real Firestore sentinel into a custom object.
- This is the exact condition that previously triggered the runtime error `Expected type 'Ju', but it was: a custom Xu object` when Reset Month tried to write the month/summary document.
- The change was limited to the serialization helper and the reset write path; no Firestore Rules or payroll logic were modified.

## Final verification status

- `node --check` was run against the reset/clone path files and the current code parses successfully.
- The month reset flow remains isolated to restoring only the imported/calculated month state while intentionally preserving advances, adjustments, previous debt source, and audit history.
- The production smoke check should be completed in the live browser by exercising Reset Month and confirming there are no console errors, no Firestore permission errors, and that the preserved records remain intact after reset.

---

# Version 3 — Feature 4: Professional Audit Timeline

## Completed

- Replaced the Audit Log presentation with a responsive, read-only Timeline of independently clickable operation cards, while retaining the existing audit query and stored record shape.
- Added activity statistics, search, severity/month/user/action/date/result filters, and incremental loading (100 additional records per request) without realtime listeners or duplicate audit reads.
- Added action-aware icons and visual severity treatment for create, update, import, report approval, backup, delete, and restore-related records.
- Added an Audit Details dialog that renders the existing optional `before`, `after`, `changed`, and `details` fields. It includes the Smart Approval score, warnings, and checks when available, and works with legacy entries that do not have them.
- No audit write path, Firestore structure, or existing business operation was changed.

## Verification

- `node --check js/app.js`, `js/audit.js`, and `js/smart-approval.js` passed.
- Timeline rendering uses the existing normalized audit entries and the existing paged `AuditService.getRecent()` / severity query only.

## Modified files

## Version 7.0 — Final Audit & Stabilization

- Completed static syntax validation for every JavaScript module.
- Reviewed central service boundaries: `Permissions`, `AuditService`, `BackupService`, `OrdersManagement`, `SalaryProcessing`, and `DataSources`.
- Confirmed the production ZIP excludes prior release ZIP files and contains only the current workspace source.
- Deferred intentionally: revoking other devices' Firebase sessions requires Admin SDK / Cloud Functions; this is not safely possible in a browser-only deployment.

- `dashboard.html` — Timeline container, filters, statistics, load-more action, and details modal.
- `css/style.css` — timeline and details presentation.
- `js/app.js` — Timeline rendering, filtering, incremental loading, and detail viewer.
- `PROGRESS.md` — Version 3 Feature 4 delivery record.

---

# Version 3 — Feature 3: Smart Approval

## Completed

- Added a professional RTL Smart Approval modal before the existing close-month confirmation. It renders a short loading phase, Approval Score, pass/warning/fail groups, and a numeric summary.
- The assessment reads the persisted active-month report through the existing `Months.loadMonthDetails()` path. It does not calculate a report, import data, or issue any write during the check.
- Critical findings block approval and hide the continue button: missing active month/report/report rows, invalid month state, incomplete employee identity/department data, non-finite financial values, and stored-total/report-row inconsistency.
- Added compatible non-blocking warnings for missing recorded hours, no orders, zero base salary, active departments missing from the report, and materially high advances or adjustments.
- Reused the existing irreversible close confirmation and `Months.closeMonth()` workflow unchanged after the Smart Approval gate passes. No payroll formula, close ordering, backup, snapshot, or lock logic was replaced.
- Added the Smart Approval score, check count, warning count, and critical count to the existing `month_closed` audit entry. The existing audit service continues to record the authenticated user, month, and approval timestamp.

## Verification

- `node --check js/smart-approval.js`, `js/app.js`, and `js/months.js` passed.
- Isolated assessment scenarios passed: a valid report had zero critical findings; a warnings-only report remained approvable; an incomplete employee department produced a critical finding.
- Static inspection confirms `js/smart-approval.js` has no Firestore API call; assessment is purely in-memory after the existing persisted-report read.

## Modified files

- `dashboard.html` — Smart Approval modal and script inclusion.
- `css/style.css` — responsive Smart Approval result styling.
- `js/smart-approval.js` — new read-only assessment module.
- `js/app.js` — gates existing approval entry points and passes the compact result to the existing close workflow.
- `js/months.js` — records the compact assessment in the existing close audit detail.
- `PROGRESS.md` — Version 3 Feature 3 record.

---

# Version 3 — Feature 2: Month Comparison

## Completed

- Added a dedicated **مقارنة الشهور** page to the sidebar and the existing view router; the page follows the current dashboard panels, tables, responsive grid, and dark-theme tokens.
- Added two persisted-report selectors that refuse a same-month comparison and show only months with a saved report index.
- Added read-only Firestore loading for the two selected `monthly_reports/{monthId}` documents. The feature never invokes payroll calculation and contains no create, update, or delete operation.
- Added metric comparison cards for payroll headcount, orders, sales, bonus, salaries, advances, adjustments, deductions, and net pay, including values for both months, delta, percentage, and directional colour/arrow.
- Added searchable, department-filterable, sortable employee comparison rows sourced from the two stored report arrays.
- Added top-ten highlights for orders, bonus, and net pay, plus most-improved and most-declined employees.
- Added department comparison from each month’s stored `departmentTotals`, and four simple Chart.js charts for orders, salaries, bonus, and net pay.

## Verification

- `node --check js/month-comparison.js`, `js/app.js`, and `js/months.js` passed.
- Static inspection confirms the new module has no Firestore write call and is loaded before `js/app.js`.
- The local dashboard shell loads successfully and exposes the normal authentication gate. A full live-data browser comparison was not run locally because the authenticated Firebase session is origin-scoped and is not present on `127.0.0.1`; no production deployment or production data write was performed for this feature.

## Modified files

- `dashboard.html` — navigation item, read-only comparison view, and module inclusion.
- `css/style.css` — responsive comparison page styling.
- `js/month-comparison.js` — new read-only comparison controller.
- `js/app.js` — lifecycle integration for the comparison page.
- `PROGRESS.md` — Version 3 Feature 2 delivery record.

---

# Future improvemِent — Reset Month must preserve payroll population

## Root-cause analysis (August 2026 production exercise, 2026-08-05)

- The stored August report contained **41** payroll rows and a net total of **102,806.45 EGP**. After Reset Month and a fresh calculation, the report contained **33** rows (net **99,400 EGP**).
- This is not caused by imported orders: August had zero imported orders before the reset. The Reset workflow intentionally clears the stored `report`, `totals`, `departmentTotals`, `employeeCount`, and `calculatedAt` fields, then leaves the month open for a new calculation (`js/months.js`, `emptyMonthDocument`).
- The calculator rebuilds the report from the *current live* employee list and explicitly excludes every employee whose current status is `inactive` (`js/app.js`, `payrollEmployees = state.employees.filter(emp => emp.status !== 'inactive')`). In contrast, the stored report is historical output and retains the 41 people who were eligible when it was first calculated.
- Therefore, any employee made inactive after the original calculation disappears when an open historical month is reset and recalculated. The observed eight-row difference is this time-of-calculation eligibility drift, not an order-import issue.

## Required future design

- Before permitting Reset Month on a calculated report, persist a recoverable month-scoped payroll-population snapshot (employee ids and the calculation-relevant employee fields), or restore that snapshot together with the prior report when undoing a reset.
- A recalculation for an existing month must derive its population from that month-scoped snapshot, applying hire/exit-date rules for the target month, rather than blindly using each employee's status today. Future-month calculations should continue to exclude inactive employees.
- The automatic Reset backup already captures the prior month report and summary as extra sections, but the generic `BackupService.restoreBackup()` currently restores only `COLLECTION_SPECS`; it does not restore these Reset-specific month sections. Add a dedicated, auditable Reset-restore path before presenting this backup as a full rollback mechanism.
- Add automated coverage for: calculate with 41 employees; mark eight employees inactive; reset; recalculate; assert the month remains at 41 historical payroll rows and original totals. Also verify that a normal new month excludes those inactive employees.

## Scope

- Documentation only. No payroll logic, production data, Firestore Rules, or restore behavior was changed in this pass.

---

# PROGRESS.md — Stage 4 / Part 4 (Monthly Report Accuracy)

This delivery implements only the monthly-report accuracy and presentation work. It retains the approval, close-month, archive, and reopen workflows delivered in Stage 4 Parts 1–3.

## Stage 4 / Part 4 completed

- The monthly report now labels the fixed component unambiguously as `الراتب الأساسي`, so bonus-department employees visibly show their base salary separately from their bonus, adjustments, and net payable amount.
- A financial summary above the report presents the five required monthly figures for the selected department scope: base salary, bonus, adjustments, deductions (advances plus previous debt), and net payables. This is a presentation-only aggregate; the stored payroll calculation is unchanged.
- The report table, Excel export, PDF export, clipboard export, and printable report now use the same clearer column order: employee details, payroll components, then operational order/sales data.
- The department breakdown and all exports now include every department snapshot and show base salary, bonus, adjustments, deductions, carried debt, and net payables. No live-department lookup is used to rewrite historical values.
- Report footer totals are calculated once per render and passed to the footer, removing a duplicate aggregation pass.
- Added safe guards around legacy inactive-employee controls that no longer exist in the current dashboard markup, preventing them from aborting app initialization before the report workflow can load.

## Modified files for Part 4

- `dashboard.html`
- `css/style.css`
- `js/app.js`
- `js/reports.js`
- `PROGRESS.md`

## Verification for Part 4

- `node --check js/app.js` passed.
- `node --check js/reports.js` passed.
- `node --check js/utils.js` passed.
- A Node aggregation fixture passed for a bonus employee and a fixed-salary employee, including base salary, bonus, adjustments, advances, previous debt, final salary, and department totals.
- Confirmed that the report has one financial-summary container and 13 aligned sortable columns.
- `firebase/firestore.rules` and all payroll/bonus formulas were not modified.

## Continuation notes

- Stage 4 Part 4 is complete. Do not begin Stage 5 without a separate request.
- The current reopened-month workflow intentionally requires the user to run `حساب` after edits before re-approving; salary and bonus formulas remain untouched by this delivery.

---

# PROGRESS.md â€” Production Live-Debug Continuation (In Progress)

## Confirmed trace

- After an authenticated session reaches `App.init`, the first Firestore promise that blocks the dashboard is `settings/general.get()` in `loadSettings()` (`js/app.js`). While it remains pending, `Departments.init()` and `Months.init()` are not reached, which explains the visible active month `-` and empty department/month selectors.
- The signed-in administrator identity itself is available before this point: the dashboard email label is populated, so the role/profile guard has already completed.
- The embedded browser test session left `settings/general.get()` pending for more than 30 seconds with no Firestore permission rejection or JavaScript exception. It therefore could not reach the Excel preview or confirmation write.

## Implemented repair

- `js/auth.js` now suppresses login-page auto-redirect while `Auth.login()` is still creating/loading the Firestore profile. This removes the confirmed redirect race that could otherwise enter the dashboard before the explicit login flow completes.
- The optional `enablePersistence({ synchronizeTabs: true })` initialization was temporarily isolated during the live trace, then restored unchanged after it did not affect the stalled request. No Firebase initialization change is retained.
- The `js/auth.js` redirect-race repair was deployed to `https://moderator-salary9.web.app` for live retesting.

## Verification / current blocker

- `node --check js/auth.js` and `node --check js/firebase.js` passed.
- Firebase Hosting deployment completed successfully for both source changes.
- In the available embedded browser, `settings/general.get()` still did not complete after 30 seconds. Console output contained no permission error or JavaScript exception. No Chrome or Edge browser connection is available in this workspace to run the required end-to-end production confirmation.
- Excel preview and Firestore confirmation have **not** been claimed as successful. No test order, employee, or audit record was written to production.

## Next required live check

- Open the deployed application in a browser that can complete Firestore reads, verify the active month appears, then upload the official Excel template and reach its preview. Before the confirmation click, obtain explicit approval for the resulting production write (orders plus one audit record).

---

This delivery implements only the archive-based report-reopen workflow. It relies on the constrained `locked → open` Firestore Rule added in Stage 4 Part 2 and does not modify that rule.

## Completed

- The Archive now shows `إلغاء اعتماد التقرير` only for locked months and only when the signed-in profile has the `admin` role.
- Selecting the action opens the existing confirmation modal with an explicit warning that the month will become editable again and that no Snapshot, Backup, or Monthly Summary will be deleted.
- After confirmation, `Months.reopenMonth()` performs only the allowed status transition from `locked` to `open`.
- The existing monthly-summary document is retained and its lifecycle status is refreshed to keep the archive index accurate; no summary data is deleted.
- The reopened month is made the active month, loaded into the report screen, and displayed as `غير معتمد`.
- In the report screen:
  - An approved/locked report hides `اعتماد التقرير`.
  - An open report shows the appropriate approval action when it is the active, calculated month.
- Re-approval continues to call the existing `Months.closeMonth()` workflow unchanged.

## Modified files

- `dashboard.html`
- `js/app.js`
- `js/months.js`

## Explicitly not modified

- `firebase/firestore.rules`
- Firebase data structure
- Salary, payroll, and bonus calculations
- Departments
- Snapshots, backups, and monthly-summary deletion logic

## Verification

- `node --check js/app.js` passed.
- `node --check js/months.js` passed.
- Verified the admin-role gate, archive reopen action, constrained status update, and report-action visibility paths.

## Continuation notes

- Stage 4 Part 3 is complete. Do not begin Stage 4 Part 4 or Stage 5 without a separate request.
- Reopening only changes the month and summary lifecycle status to `open`; it never recalculates salaries automatically. Make edits, run `حساب`, then use the existing `اعتماد التقرير` action to close the month again.
# PROGRESS.md — Stage 5 / Part 1 (Unified Advances & Settlements)

This delivery implements only the unified advances and manual-adjustments workspace. It preserves the existing advance and adjustment collections, payroll formulas, report logic, Firebase configuration, and Firestore Rules.

## Stage 5 / Part 1 completed

- Replaced the visible two-tab advances/adjustments interface with one professional form for employee, operation type, amount, date, note, and save.
- Kept the existing two collections behind the unified UI, so all existing calculations and historical data continue to work unchanged.
- Added a single operations table with employee, type, amount, date, approval status, note, and actions.
- New operations are saved as pending approval; legacy operations without a status are displayed as approved for backward compatibility.
- Added edit, delete, and approve actions. All writing actions continue to be protected by the existing month-lock checks and audited through `DataLayer`.
- Added employee, department, type, date, and free-text search filters. Department filtering supports legacy records by resolving the employee's department when an old record has no stored department id.
- Retained the current monthly totals and salary calculations exactly as before; approval status is a workflow label in Part 1 and does not alter any payroll formula or report aggregation.

## Modified files for Part 1

- `dashboard.html`
- `js/app.js`
- `PROGRESS.md`

## Verification for Part 1

- `node --check js/app.js` passed.
- `node --check js/data-layer.js` passed.
- Verified all unified-form, filter, table, and action element IDs are unique and their JavaScript bindings exist.
- Firebase configuration, Firestore Rules, report files, and salary/bonus formulas were not modified.

## Continuation notes

- Stage 5 Part 1 is complete. Do not begin Stage 5 Part 2 without a separate request.
- The unified workspace is an interface layer over the existing `advances` and `adjustments` data; no database migration is required.

---
# PROGRESS.md — Stage 5 / Part 2 (Integration & Final Workflow)

This delivery completes Stage 5 by integrating the unified advances and settlements workspace with the existing report, approval, archive, reopen, dashboard, and backup workflows. Salary and bonus formulas remain unchanged.

## Stage 5 / Part 2 completed

- Reviewed the operation-approval path end to end. Firestore Rules already allow an administrator to update an advance or adjustment while both its existing and destination months are open; no Rules change was required.
- Added an explicit admin-role guard before the approve action. A user without the required profile now receives a clear authorization message instead of initiating a write that returns `Missing or insufficient permissions`.
- Confirmed that the report calculation continues to aggregate the existing advances and adjustments for the selected month, and that the report/export pipeline includes both fields in the on-screen table, Excel, PDF, clipboard, and print output.
- Confirmed that report approval passes both collections to `Months.closeMonth()`, whose immutable monthly backup writes separate advances and adjustments chunks. This preserves the exact records, including unified-operation status, at close time.
- Confirmed that archive loading uses the stored report and that reopening only changes the month lifecycle status; live advances and adjustments remain intact, editable while open, and are backed up again upon re-approval.
- Added lightweight Dashboard indicators for total adjustments and the number of monthly operations. They refresh automatically when the advance or adjustment listeners receive changes.

## Modified files for Part 2

- `dashboard.html`
- `js/app.js`
- `PROGRESS.md`

## Firestore Rules

- No change. The existing least-privilege rule already permits only administrators to update open-month advances and adjustments, and blocks writes into or out of locked months.

## Verification for Part 2

- `node --check js/app.js` passed.
- `node --check js/months.js` passed.
- `node --check js/reports.js` passed.
- `node --check js/data-layer.js` passed.
- Static integration checks passed for approval updates, report/exports, close-month sources, immutable backup chunks, and open-month Rules conditions.

## Continuation notes

- Stage 5 is complete. Do not begin a new stage without a separate request.
- Approved and unapproved operation status is preserved in the existing advances/adjustments documents and included automatically in the existing monthly backup flow; no Firebase structure migration was introduced.

---
# PROGRESS.md — Stage 6 (Professional Dashboard & Final Polish)

This delivery implements only Stage 6: professional Dashboard presentation, lightweight status data, performance-conscious rendering reuse, and final interface polish. It does not alter payroll/bonus formulas, Firebase structure, or Firestore Rules.

## Stage 6 completed

- Added a compact system-status strip to the Dashboard showing the current month, report approval state, latest available backup, pending operations, and latest loaded import audit entry.
- Added quick actions for employee creation, order import, report calculation, report approval, and manual backup, all routed to the existing workflows.
- Expanded KPI cards with active employees and total base salaries while keeping existing sales, bonus, advances, adjustments, debt, net-payable, and operations metrics.
- Added professional employee and department highlight panels. They reuse the current report and stored department totals to show top bonus, sales, orders, packages, net department, productivity, advances, and base salary.
- Added department bonus and department orders charts alongside the existing sales, bonus, packages, and salary charts.
- The Dashboard now obtains the scoped report totals and department totals once per render, then reuses them for cards, highlights, charts, and the department table. This removes repeated fallback aggregation without changing results.
- Added a one-time, small status read (one backup and a short audit page), not a realtime listener, so the status strip does not add continuous Firestore reads.
- Reviewed the affected integration paths. The existing employees, departments, reports, archive/reopen, import, unified operations, and backups flows remain connected through their existing data sources.

## Modified files for Stage 6

- `dashboard.html`
- `css/style.css`
- `js/app.js`
- `js/charts.js`
- `PROGRESS.md`

## Verification for Stage 6

- `node --check js/app.js` passed.
- `node --check js/charts.js` passed.
- `node --check js/backup.js` passed.
- `node --check js/audit.js` passed.
- A Chart.js render fixture passed for all six Dashboard charts, including the new department bonus and orders charts.
- Verified all new status, action, KPI, insight, and chart element IDs are unique.

## Continuation notes

- Stage 6 is complete. No new accounting feature or database migration was introduced.
- The latest-backup and latest-import statuses use already loaded data plus one intentional initial status fetch; they never create a persistent listener.

---

# PROGRESS.md — Stage 7 / Part 1 (Safe Operational Data Reset)

This delivery implements only the requested in-app operational-data reset. It preserves the existing payroll-history guarantees: no salary, bonus, report, or settlement logic was changed.

## Completed

- Added `تصفير بيانات التشغيل` to the existing Backups page, restricted by the existing administrator profile guard and an explicit confirmation dialog.
- The reset only removes advances and adjustments belonging to open months. It does not touch employees, departments, users, settings, locked-month reports, monthly summaries, final settlements, audit logs, or existing backups.
- Before the first delete, the operation requires a successful automatic backup. A backup failure stops the reset completely; it does not use the best-effort automatic-backup path.
- Deletes are processed in safe Firestore batches, each paired atomically with its own audit entry. A critical summary entry records the reset and its backup ID after completion.
- The existing real-time transaction listeners refresh the operational workspace after the reset; the backups and audit views are refreshed explicitly.

## Modified files

- `dashboard.html` — reset action and a precise scope/safety notice in the existing Backups view.
- `js/app.js` — administrator confirmation, progress feedback, and post-reset UI refresh.
- `js/backup.js` — safe open-month transaction reset service with mandatory pre-reset backup and batched audit logging.
- `PROGRESS.md` — this continuation record.

## Verification

- `node --check js/backup.js` passed.
- `node --check js/app.js` passed.
- Confirmed the new button ID has one handler, the service is exported, and each clear batch contains both the delete and its audit entry.
- Confirmed no Firestore Rules change is required: the current rules already allow only administrators to delete advances/adjustments outside locked months, while retaining all protected historical records.

## Continuation notes

- This is deliberately a safe reset of mutable operating transactions, not an erasure of accounting history. Locked payroll data, final settlements, and audit logs remain immutable by design.
- A live Firebase run remains required to exercise the confirmation, backup, and Firestore write path against real data.

---

# PROGRESS.md — Stage 7 / Part 2 (Audit Log)

This delivery implements only the Audit Log stage. Payroll, bonus, reporting, and safe-reset behavior remain unchanged.

## Completed

- Added the Audit Log page to the sidebar with the existing table renderer, newest-first loading, manual refresh, severity filtering, and text search across action, record, user, month, and detail text.
- The page shows the latest 100 entries and displays both the filtered result count and the total currently loaded count.
- Fixed a logging gap in the archive workflow: archiving and restoring a department now produce explicit `department_archived` and `department_restored` actions instead of appearing as generic edits.
- Corrected audit action-chip coloring so an intentionally escalated stored severity (for example, bulk deletion) is displayed at its actual severity rather than its action default.
- Confirmed the existing audit paths cover create, update, delete, approval/close, archive, backup create/restore/download, and safe operational-data reset. DataLayer writes pair document changes with their audit entry in the same batch; lifecycle actions log after their completed operation.

## Modified files

- `dashboard.html` — Audit Log navigation and its complete display/filter/search interface.
- `js/app.js` — Audit view navigation, filter/search handlers, loaded-result rendering, and stored-severity presentation.
- `js/audit.js` — explicit archive/restore action names, labels, and archive severity.
- `js/data-layer.js` — narrow optional audit-action override required for an archive to retain its semantic action name.
- `js/departments.js` — sends the two department lifecycle actions through the existing atomic update-and-audit path.
- `PROGRESS.md` — this continuation record.

## Verification

- `node --check js/audit.js` passed.
- `node --check js/data-layer.js` passed.
- `node --check js/departments.js` passed.
- `node --check js/app.js` passed.
- Static checks confirm the Audit page IDs are unique, all three controls have one handler each, and the archive actions are declared, labeled, and passed to DataLayer.

## Continuation notes

- The Audit page reads the latest 100 records by design. The severity query has its existing fallback to an in-memory filtered recent page if the Firestore composite index has not been deployed.
- A live Firebase session is still required to validate real permissions, Firestore index deployment, and visible records with production data.

---

# PROGRESS.md — Stage 7 / Part 3 (Critical Workflow Bug Fixes)

This delivery reviews only the requested critical paths: final settlement, monthly report, close/reopen month, backup/restore, archive, and Firestore permissions. No new feature was added and no payroll, bonus, or report formula changed.

## Completed

- Fixed a critical race condition in final-settlement approval. Two administrators approving the same employee from separate tabs could both pass the old pre-write status check and create duplicate settlement records.
- Settlement approval now performs the decisive employee-status read and all related writes inside one Firestore transaction. If another approval changes the employee first, Firestore retries and the second transaction stops because the employee is already inactive.
- The existing pre-settlement backup remains before the transaction, and the settlement document, employee deactivation, and both audit entries remain part of the same successful transaction.
- Reviewed the monthly calculation, close/reopen lifecycle, backup/restore, archive read path, and Rules constraints. No additional confirmed bug was changed in this stage.

## Modified files

- `js/settlements.js` — prevents duplicate final settlements under concurrent approvals.
- `PROGRESS.md` — this continuation record.

## Verification

- `node --check js/settlements.js` passed.
- Static settlement check confirms approval uses `db.runTransaction`, re-reads the employee inside the transaction, and no longer commits a standalone batch.
- The transaction uses the existing `set`/`update`/audit operations, preserving the current write shape and Firestore Rules compatibility.

## Continuation notes

- A live Firebase concurrency test with two administrator sessions remains the final environment-level validation: both should attempt approval, while only one settlement document is committed.
- No Firestore Rules change was required. The rules continue to protect locked months, immutable financial history, append-only audit entries, and administrator-only business access.

---

# PROGRESS.md — Stage 7 / Part 4 (Production QA & Stability)

This delivery performs the requested production-readiness QA only. No feature, payroll, bonus, report, Firebase data-model, or Firestore Rules change was made.

## Completed

- Reviewed every sidebar View and confirmed that each navigation `data-view` has a matching `view-*` section.
- Checked all defined dashboard button IDs against their JavaScript bindings. The two legacy transaction-tab buttons intentionally use the shared `.tab-btn[data-tab]` binding; every other defined button is referenced directly or uses its documented inline modal-dismiss action.
- Checked all literal `document.getElementById(...)` references in the JavaScript source against the Dashboard DOM. No unguarded missing-DOM reference was found. The inactive-employees controls are deliberately optional and guarded; undo action IDs are created dynamically only after the existing snackbar host is rendered.
- Checked duplicate HTML IDs: none found.
- Ran a cross-module API check covering 782 service/module calls. All invoked exported methods are present in their corresponding module return contracts.
- Reviewed Firestore listener ownership and lifecycle: employees, advances, adjustments, departments, and month-index listeners retain unsubscribe functions, prevent accidental duplicate registration where applicable, and are released during page teardown.
- Reviewed dashboard chart lifecycle: each redraw destroys existing Chart.js instances before creating replacements.
- No confirmed production bug or permanently unused code was found, so no application code was changed unnecessarily.

## Modified files

- `PROGRESS.md` — recorded the Stage 7 / Part 4 QA result. No source-code file required modification.

## Verification

- `node --check` passed for every file under `js/`.
- Static DOM validation passed: 264 unique Dashboard IDs, no duplicate IDs, and no missing literal DOM target in active UI paths.
- Static navigation validation passed for all 11 sidebar Views.
- Static cross-module export/call validation passed with no unresolved call.
- A browser-based console pass could not be run in this workspace because the browser policy blocks `file:` URLs and no permitted local HTTP endpoint was available. Production Firebase authentication and live Firestore permissions therefore remain environment-level checks.

## Continuation notes

- Stage 7 / Part 4 is complete. The remaining live validation is to open the deployed app with an administrator account and exercise Firebase authentication, Firestore permissions, and the two-admin final-settlement concurrency scenario.

---

# PROGRESS.md — Stage 7 / Part 5 (Excel Template Import Fix)

This delivery fixes the confirmed Excel-import diagnostic failure only. Payroll, bonuses, reports, Firestore Rules, and the order-writing workflow are unchanged.

## Completed

- Kept the Excel reader on SheetJS's public API only: `XLSX.read(...)`, `workbook.SheetNames`, `workbook.Sheets`, and `XLSX.utils.sheet_to_json(...)`.
- Added explicit workbook and worksheet validation before extracting rows. The importer never derives or addresses an internal ZIP path such as `xl/worksheets/sheet*.xml`.
- Preserved the original SheetJS error message when a workbook cannot be read. A ZIP/worksheet reading failure now reaches the user as an Excel-specific message (for example, `تعذر قراءة ملف Excel: Cannot find file ... in zip`) rather than being mistaken for a Firestore permission problem.
- Confirmed the official-template structure generated by the application can be edited with an additional order row and read back through the production `Utils.analyzeExcelFile()` path.

## Modified files

- `js/utils.js` — validated the public SheetJS workbook path and preserved the original Excel-read diagnostic.
- `PROGRESS.md` — recorded this focused bug fix.

## Verification

- `node --check js/utils.js` passed.
- `node --check js/app.js` passed.
- A SheetJS 0.18.5 fixture recreated the official template (Arabic sheet name and three expected columns), added a user row, and verified all four rows are parsed through `Utils.analyzeExcelFile()`.
- A malformed ZIP fixture returned the real SheetJS diagnostic as `تعذر قراءة ملف Excel: Unsupported ZIP file`.
- The final Firestore write still requires a signed-in administrator session against the deployed Firebase project; no Firestore write or Rule was changed by this fix.

## Continuation notes

- Stage 7 / Part 5 is complete. Excel reading errors are now resolved before the import-confirmation write path, while genuine Firestore write errors continue to be reported only as write errors.

---

# Production follow-up — Firestore order import permission fix

## Completed

- Reproduced the complete official Excel-template flow on `https://moderator-salary9.web.app` as the existing administrator: upload, preview, and confirm.
- Traced the first failing operation to the write of `monthly_reports/2026-07/orderBatches/{batchId}`. SheetJS parsing and the month read both completed first.
- Fixed `firebase/firestore.rules`: `monthLocked()` now verifies that the existing month document actually contains `status` before reading it. Legacy month documents without that optional field are therefore treated as open; explicitly `locked` months remain protected.
- Deployed the corrected Firestore Rules and Hosting version to `moderator-salary9`.
- Re-ran the live import successfully. The production UI confirmed: `تم استيراد 4 طلب بنجاح`.
- Verified the new Firestore audit entry through Operations Log: `استيراد طلبات` for July 2026, user `ahmed123@gmail.com`, details `4 طلب`.

## Modified files

- `firebase/firestore.rules` — fixed the confirmed missing-`status` rule-evaluation denial for order-batch writes.
- `firebase.json` — keeps JavaScript revalidation enabled so production clients receive newly deployed fixes promptly.
- `js/auth.js` — retains the earlier login-redirect race fix.
- `js/utils.js` — retains the completed public-SheetJS Excel-read fix from Stage 7 / Part 5.
- `PROGRESS.md` — recorded production verification and the Rule fix.

## Verification

- `node --check js/app.js` passed after removing temporary live-debug instrumentation.
- Firestore Rules compiled and were released successfully to `moderator-salary9`.
- The final successful import produced no new Console error or Firestore permission-denied entry. The console retains only pre-existing warnings about Firestore IndexedDB persistence deprecation and absent Chart.js.

---

# Production follow-up — Duplicate Excel import prevention

## Completed

- Added a deterministic SHA-256 `importId` based on normalized order names, package counts, and prices. Filename and row ordering do not affect the duplicate decision.
- The importer checks the selected month's `orderBatches` before creating employees or writing any data. New batches store the same `importId` on every chunk.
- Added legacy content comparison for batches written before `importId` existed.
- Production test with the same official Excel fixture displayed `تم استيراد هذا الملف مسبقًا` after confirmation.
- No new import audit entry was created by the duplicate attempt, so no order-batch write occurred.

## Modified files

- `js/app.js` — pre-write content-hash duplicate detection and persisted `importId`.
- `PROGRESS.md` — production verification record.

## Verification

- `node --check js/app.js` passed.
- Hosting deployment to `moderator-salary9` completed.
- Live administrator duplicate-import test passed.

---

# Production follow-up — Report approval/reopen state consistency

## Confirmed root cause

- Live production inspection showed a split state for July 2026: `monthly_summaries/2026-07.status` was `locked`, while `monthly_reports/2026-07` had no `status` field.
- `Months.closeMonth()` correctly writes the archive summary before the final month lock. The final `set({ status: 'locked' }, { merge: true })` was denied by `thisMonthIsLocked()` in the Firestore Rule because it dereferenced the absent optional `status` field on a legacy report document.
- The summary write therefore completed before the failed lock, making the UI look approved. `Months.reopenMonth()` correctly reads the authoritative report document, saw it as open, and consequently reported that it was already unapproved.

## Completed

- Updated `thisMonthIsLocked()` to check for the optional `status` field before reading it. Legacy reports without that field are treated as open; locked reports remain protected.
- Reopen now normalizes a legacy report's missing lifecycle field to `open` and refreshes the existing summary to that same value. It does not modify salary data, report rows, snapshots, or backups.
- Restored the prior temporary calculation-stage diagnostics; no calculation behaviour is retained or changed by this repair.
- Deployed the Rule and Hosting changes to `https://moderator-salary9.web.app`.

## Production verification

- Opened the production Archive as the existing administrator and used **إلغاء اعتماد التقرير** for July 2026. It completed successfully, changed the report to open, synchronized the summary, made July active, and showed no permission-denied message.
- Re-approved July 2026 through the production confirmation UI. The complete close flow succeeded: Snapshot, Backup, Monthly Summary, audit record, report lock, and next-month activation. The success message confirmed August 2026 as active.
- Final Firestore read verified both `monthly_reports/2026-07.status` and `monthly_summaries/2026-07.status` are `locked`, with `closedAt` present on both documents.
- Production console contained no error or `permission-denied` entry during either action. The only retained messages were existing non-blocking warnings for Firestore persistence deprecation and unavailable Chart.js.

## Modified files

- `firebase/firestore.rules` — safe optional-field check in the month-lock rule.
- `js/months.js` — synchronize the legacy reopen state using the same `status` field on the report and summary documents.
- `js/app.js` — removed temporary calculation tracing from earlier live debugging.
- `PROGRESS.md` — recorded the confirmed diagnosis, deployment, and production test.

## Verification

- `node --check js/months.js` passed.
- `node --check js/app.js` passed.
- Firestore Rules compiled successfully in a Firebase CLI dry run and were released successfully to production.

---

# Production follow-up — Report calculation permission verification

## Confirmed result

- Tested the **حساب** action through the production UI as the administrator on the active August 2026 report. The calculation completed with no `Missing or insufficient permissions` message and no Console error.
- Firestore verification confirmed the calculated report was written to `monthly_reports/2026-08`: it has `calculatedAt` and 42 report rows. Its summary was refreshed in `monthly_summaries/2026-08` with 42 employees and `status: open`.
- The historic first failing operation was the `set(..., { merge: true })` of the calculated report at `monthly_reports/{monthId}`. For a legacy report without `status`, the prior `thisMonthIsLocked()` Rule evaluation dereferenced that absent field and denied the write. The optional-field guard deployed for the approval/reopen repair fixes this same calculation path.

## Modified files

- `PROGRESS.md` — recorded this production calculation verification. No application source change was required.

---

# Version 2 — Complete Orders Management

## Completed

- Added the **الطلبات** view to the dashboard navigation. It reads the actual imported `monthly_reports/{monthId}/orderBatches` data rather than deriving rows from a monthly report.
- Added server-generated immutable `orderId` values to all future imported order rows, with durable legacy IDs for rows created before this release. Each displayed row includes moderator, department, packages, sale value, price, batch, month, import time/importer, and last edit information.
- Added debounced name/Order-ID search, filters for month, department, moderator, and batch, plus in-memory pagination (50 rows per page). The data load uses direct authorized month paths rather than a Firestore collection-group query.
- Added an order details dialog and an edit dialog. Edits are limited to packages, price, moderator, and department and are committed in a Firestore transaction.
- Added a confirmed order delete action. The batch is updated (or removed when empty) in the same transaction.
- Added batch management: each visible batch shows its order count, import date, importer, and a scoped **Undo Import** action.
- Undo Import deletes only its selected batch, removes only recorded auto-created employees that have no remaining orders in any batch, then rebuilds the affected month.
- Each order edit, delete, and Undo Import appends its audit record in the same Firestore transaction. Mutating controls are guarded while a request is in flight, and both the UI and Firestore Rules reject changes to locked months.
- After every order mutation the existing report calculation is invoked for the affected month; this keeps reports, payroll, bonus values, and dashboard statistics aligned without changing their calculation rules.

## Production stability repair

- Reproduced an initialization failure in a fresh production tab where the active month stayed `-` and all Firestore-backed views remained empty.
- The blocking path was the optional multi-tab IndexedDB persistence initialization. The redirect page also started Firestore immediately before the dashboard initialized it again.
- Made `index.html` authentication-only and removed the optional persistent-cache initialization from `js/firebase.js`. Firestore now uses its normal in-memory cache; no business data or salary/report logic depends on offline persistence.
- Verified on a fresh production tab that the active month loads as **July 2026**, departments populate, 50 real order rows render on the first page, and no Console error or Firestore permission-denied message appears.

## Production verification

- Opened the production Orders view as the existing administrator and loaded 3,537 live orders with 71 pagination pages before test data was added.
- Tested search/filter rendering, details, a temporary imported order edit (packages `3 → 4`, price `321 → 322`), single-order delete, and Undo Import for two temporary batches.
- Each mutation completed its report recalculation successfully. The temporary batches were removed with Undo/Delete; the auto-created temporary employee was verified absent afterward.
- Confirmed the latest deployment starts from the root URL with the active month and departments populated, and the Orders table returns 50 rows immediately. The fresh-tab console had no JavaScript error or Firestore permission-denied entry.

## Modified files

- `dashboard.html` — Orders navigation, view, filter controls, table, batch section, and details/edit dialogs.
- `css/style.css` — responsive dark-theme Orders layout.
- `js/orders.js` — new Orders Management module, transactions, batch undo, pagination, and filters.
- `js/app.js` — Orders initialization/navigation and immutable metadata for future imported orders.
- `js/audit.js` — audit actions and labels for order mutations.
- `js/firebase.js` — removed the blocking optional multi-tab persistence initialization.
- `index.html` and `login.html` — cache-safe dashboard routing; the redirect page now initializes Auth only.
- `firebase.json` — cache revalidation for HTML as well as JavaScript so a deployed HTML shell cannot remain paired with newer scripts.
- `PROGRESS.md` — Version 2 record.

## Verification

- `node --check js/firebase.js`, `node --check js/orders.js`, `node --check js/audit.js`, and `node --check js/app.js` passed.
- Firebase Hosting deployment to `moderator-salary9` completed successfully.

---

# Final production verification & cleanup

## Completed

- Verified that importing into an archived month is blocked at the real business guard: `Months.assertEditable('2026-09', 'الاستيراد')` returns `شهر سبتمبر 2026 مؤرشف، والاستيراد مش مسموح فيه.`
- Verified archive/restore behavior in production: the archived month is blocked from imports while archived, and `Months.restoreArchivedMonth()` returns it to the open working state without modifying employee or payroll data.
- Removed the temporary fake month `2099-11` from the live production month list.
- Restored the production month state to the valid working set: `2026-08` active, `2026-09` open/usable as the restored state, and no extra test month remains.
- Final live smoke test passed: the app loads the dashboard, the month selector shows the real production months only, the active month is `أغسطس 2026`, and the month-management view renders without a crash.
- Checked the browser event log: no JavaScript console errors and no Firestore `Missing or insufficient permissions` entry were observed during the final smoke test; the remaining requests were non-blocking aborted listener attempts, not permission failures.

## Final state

- Active month: `2026-08`
- Remaining real months in the app: `2026-09`, `2026-08`, `2026-07`
- Test month `2099-11`: removed
- Archived-month import guard: confirmed active
- Archive/restore flow: verified and returned to production-safe state

## Notes

- This final cleanup kept the live production data aligned with the real working month set and removed only the temporary test-state artifacts created during live verification.
- No payroll logic, Firestore Rules, or feature redesign was changed in this final cleanup pass.

---

# Version 2 — Phase 2: Month Management

## Completed

- Added a dedicated **الشهور** page in the main navigation. It presents every month from the established `monthly_summaries` index with status, order count, employee count, sales, salaries, bonuses, created/last-modified dates, lock state, archive state, and the active-month marker.
- Added a responsive dark-theme month lifecycle UI: create (with a form dialog), activate, approve-and-lock, unlock, reopen, archive/restore, and delete-empty-month.
- Preserved the approved lock architecture: **اعتماد وقفل** reuses the existing `Months.closeMonth()` workflow, so snapshot and backup are still written before a report becomes locked. No parallel or weaker lock path was introduced.
- Added `archived`, `isEmpty`, and `orderCount` only where needed on month/index documents. New import batches atomically mark the month non-empty and increment the lightweight order counter; salary, bonus, report, and import calculation rules are unchanged.
- Archived months are read-only: the UI disables mutation controls, `Months.assertEditable()` rejects writes, and Firestore Rules reject writes to `orderBatches` under archived months.
- Added guarded empty-month deletion. The client checks for batches and performs the delete in a transaction; Firestore Rules permit deletion only for explicitly empty, unlocked, non-archived months. The corresponding summary is deleted atomically.
- Added lifecycle audit actions for lock/unlock/reopen/archive/restore/delete. Corrected a confirmed audit-display defect discovered during production QA: the new labels had been placed in the severity map, which made them render as raw action IDs with normal severity. They now render from `ACTION_LABELS` with their intended severity.

## Production verification

- Deployed Hosting and Firestore Rules to `https://moderator-salary9.web.app`.
- On production as the existing administrator, created a temporary month, verified duplicate creation is refused, activated it, archived it, restored it, and deleted it as an empty month. The active month was restored to **July 2026** and all temporary month documents were removed.
- Archived the existing September 2026 month temporarily, selected it, and confirmed its Excel input was disabled (`archivedInputEnabled: false`); then restored it and returned the selected/active working month to July 2026.
- Confirmed all corresponding month operations were recorded in Operations Log. The new audit label/severity repair was deployed after that check.
- Reopened a fresh production tab after the final deployment: July 2026 loaded as active, Months and Orders pages opened successfully, and the production console contained no error or Firestore permission-denied entry.
- Approval/lock and reopen/unlock continue to use the existing production-tested report approval lifecycle; they were not re-run against live payroll data during this phase because confirming them would create irreversible financial snapshots. The action opens the same existing approval confirmation and no payroll logic was changed.

## Modified files

- `dashboard.html` — Months navigation, dedicated management view, and accessible Create Month dialog.
- `css/style.css` — responsive dark-theme layout for the Months table and lifecycle controls.
- `js/month-management.js` — new dedicated Months UI/controller and guarded action handling.
- `js/months.js` — archive/restore/delete-empty APIs, archive-aware edit guard, index fields, and lifecycle audit integration.
- `js/app.js` — initializes the Months page, routes navigation, and atomically keeps the month/index order count current during import.
- `js/audit.js` — month lifecycle action constants, labels, and correct severities.
- `firebase/firestore.rules` — archive write protection, archived-month import rejection, and constrained empty-month deletion.
- `PROGRESS.md` — Phase 2 implementation and production verification record.

## Verification

- `node --check js/month-management.js`, `js/months.js`, `js/audit.js`, and `js/app.js` passed.
- Firestore Rules compiled successfully in Firebase CLI dry run and were deployed successfully.
- Final production fresh-tab check: active month **July 2026**, no JavaScript errors, no Firestore permission-denied errors.

---
