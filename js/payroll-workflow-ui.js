'use strict';

/*
 * Payroll Workflow UI Integration
 * ------------------------------------------------------------------
 * This is deliberately a view adapter. It reads the engine's existing
 * state, reflects it in the approved Report layout, and delegates writes to
 * Months / SalaryProcessing. No calculation, Firestore query, or lifecycle
 * rule lives here.
 */
const PayrollWorkflowUI = (() => {
  let initialized = false;

  const STEP_ORDER = [
    PayrollWorkflow.STATE.DRAFT,
    PayrollWorkflow.STATE.CALCULATED,
    PayrollWorkflow.STATE.IN_REVIEW,
    PayrollWorkflow.STATE.APPROVED,
    PayrollWorkflow.STATE.SALARY_SNAPSHOT_CREATED,
    PayrollWorkflow.STATE.READY_FOR_PAYMENT,
    PayrollWorkflow.STATE.PAID,
    PayrollWorkflow.STATE.ARCHIVED,
    PayrollWorkflow.STATE.REOPENED
  ];

  // The engine owns the lifecycle. This map owns only which existing report
  // surface is relevant to that lifecycle state; it creates no transition,
  // query, or financial data.
  const WORKSPACE = Object.freeze({
    CALCULATION: 'calculation',
    REVIEW: 'review',
    APPROVAL: 'approval',
    PAYROLL: 'payroll',
    PAYMENT: 'payment',
    ARCHIVE: 'archive'
  });

  const $ = id => document.getElementById(id);
  const label = state => PayrollWorkflow.LABEL[state] || 'غير معروف';

  function workspaceFor(state) {
    if ([PayrollWorkflow.STATE.DRAFT, PayrollWorkflow.STATE.REOPENED].includes(state)) return WORKSPACE.CALCULATION;
    if (state === PayrollWorkflow.STATE.CALCULATED) return WORKSPACE.REVIEW;
    if (state === PayrollWorkflow.STATE.IN_REVIEW) return WORKSPACE.APPROVAL;
    if (state === PayrollWorkflow.STATE.APPROVED) return WORKSPACE.PAYROLL;
    if (state === PayrollWorkflow.STATE.SALARY_SNAPSHOT_CREATED) return WORKSPACE.PAYROLL;
    if (state === PayrollWorkflow.STATE.READY_FOR_PAYMENT) return WORKSPACE.PAYMENT;
    return WORKSPACE.ARCHIVE;
  }

  function workspaceCopy(workspace) {
    const copy = {
      [WORKSPACE.CALCULATION]: ['مرحلة الحساب', 'حساب التقرير الشهري', 'استخدم أدوات الحساب لإعداد بيانات التقرير للشهر المحدد.'],
      [WORKSPACE.REVIEW]: ['مرحلة المراجعة', 'مراجعة التقرير والاستثناءات', 'راجع المستحقات والاستثناءات قبل اتخاذ قرار الاعتماد.'],
      [WORKSPACE.APPROVAL]: ['مرحلة الاعتماد', 'اعتماد التقرير الشهري', 'اكتملت المراجعة؛ نفّذ اعتماد التقرير لفتح مسار كشف الرواتب.'],
      [WORKSPACE.PAYROLL]: ['مرحلة كشف الرواتب', 'مراجعة كشف الرواتب', 'راجع كشف الرواتب المستقل قبل انتقاله إلى الصرف.'],
      [WORKSPACE.PAYMENT]: ['مرحلة الصرف', 'صرف الرواتب', 'سجّل الصرف من كشف الرواتب الحالي حتى تكتمل الدورة.'],
      [WORKSPACE.ARCHIVE]: ['مرحلة الأرشفة', 'أرشفة دورة الرواتب', 'اكتمل الصرف؛ تبقى الأرشفة آخر إجراء يحفظ الدورة للعرض والتدقيق.']
    };
    return copy[workspace] || copy[WORKSPACE.CALCULATION];
  }

  function decisionCopy(workspace) {
    const copy = {
      [WORKSPACE.CALCULATION]: ['جاهزية الحساب', 'ملخص الحساب', 'يعرض هذا الملخص بيانات التقرير التي ستُستخدم عند تشغيل الحساب.'],
      [WORKSPACE.REVIEW]: ['منطقة القرار', 'ملخص المراجعة', 'استخدم القيم والاستثناءات لتأكيد جاهزية التقرير قبل الاعتماد.'],
      [WORKSPACE.APPROVAL]: ['قرار الاعتماد', 'الملخص التنفيذي', 'هذه هي القيم المرجعية لاتخاذ قرار اعتماد التقرير الشهري.'],
      [WORKSPACE.PAYROLL]: ['كشف الرواتب', 'ملخص الكشف', 'يعرض الملخص النسخة المستقلة التي تنتقل منها دورة الصرف.'],
      [WORKSPACE.PAYMENT]: ['قرار الصرف', 'ملخص الصرف', 'تبقى قيم التقرير مرجعية أثناء تسجيل عمليات الصرف.'],
      [WORKSPACE.ARCHIVE]: ['إغلاق الدورة', 'ملخص الأرشفة', 'هذه القيم محفوظة للعرض والتدقيق بعد اكتمال دورة الرواتب.']
    };
    return copy[workspace] || copy[WORKSPACE.CALCULATION];
  }

  function query(selector) {
    return document.querySelector ? document.querySelector(selector) : null;
  }

  function slot(name) {
    return query(`[data-workspace-slot="${name}"]`);
  }

  function mount(id, target) {
    const element = $(id);
    if (element && target && element.parentElement !== target) target.appendChild(element);
  }

  function setWorkspaceVisibility(workspace) {
    const manager = $('reportWorkspaceManager');
    const reportView = $('view-report');
    if (reportView) reportView.dataset.workflowWorkspace = workspace;
    if (!manager) return;

    manager.dataset.activeWorkspace = workspace;
    manager.querySelectorAll('[data-workspace]').forEach(root => {
      const active = root.dataset.workspace === workspace;
      root.classList.toggle('is-active', active);
      root.setAttribute('aria-hidden', String(!active));
      root.toggleAttribute('inert', !active);
    });
  }

  function mountWorkspaceSurfaces(workspace) {
    const calculation = $('reportCalculationWorkspace');
    const calculationStatus = $('reportCalculationStatus');
    if (workspace === WORKSPACE.CALCULATION && calculation) {
      const summary = $('reportDecisionSummary');
      const actions = $('reportStateWorkspace');
      if (summary && calculationStatus && summary.parentElement !== calculation) calculation.insertBefore(summary, calculationStatus);
      if (actions && calculationStatus && actions.parentElement !== calculation) calculation.insertBefore(actions, calculationStatus);
    } else {
      mount('reportDecisionSummary', slot(`${workspace}-decision`));
      mount('reportStateWorkspace', slot(`${workspace}-actions`));
    }

    const snapshot = $('salarySnapshotDashboard');
    if (snapshot && [WORKSPACE.PAYROLL, WORKSPACE.PAYMENT, WORKSPACE.ARCHIVE].includes(workspace)) {
      mount('salarySnapshotDashboard', slot(`${workspace}-snapshot`));
      snapshot.dataset.workspace = workspace;
      snapshot.querySelectorAll('[data-snapshot-stage]').forEach(element => {
        const supported = (element.dataset.snapshotStage || '').split(/\s+/);
        const active = supported.includes(workspace);
        element.classList.toggle('is-workspace-visible', active);
        element.setAttribute('aria-hidden', String(!active));
      });
    }
  }

  function formatMoney(value) {
    return typeof Utils !== 'undefined' && Utils.formatCurrency
      ? Utils.formatCurrency(Number(value) || 0) : String(Number(value) || 0);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return typeof Utils !== 'undefined' && Utils.formatDateTime ? Utils.formatDateTime(value) : String(value);
  }

  function assessmentContext(context) {
    const appContext = typeof App !== 'undefined' && App.getSalaryProcessingContext
      ? App.getSalaryProcessingContext() : {};
    return {
      monthId: context.monthId,
      month: context.month,
      report: context.report,
      totals: appContext.totals || context.month.totals || {},
      departments: typeof Departments !== 'undefined' && Departments.all ? Departments.all() : []
    };
  }

  function assessmentMarkup(entries, kind) {
    if (!entries.length) return '';
    return `<section class="workspace-checklist-group is-${kind}"><h4>${kind === 'failed' ? 'موانع الاعتماد' : (kind === 'warning' ? 'تنبيهات المراجعة' : 'فحوصات مكتملة')}</h4><ul>${entries.map(entry => `<li>${typeof Utils !== 'undefined' && Utils.escapeHtml ? Utils.escapeHtml(entry.text) : entry.text}</li>`).join('')}</ul></section>`;
  }

  function renderApprovalWorkspace(context) {
    const executive = $('reportApprovalExecutive');
    const checklist = $('reportApprovalChecklist');
    if (!executive || !checklist) return;
    const data = assessmentContext(context);
    const assessment = typeof SmartApproval !== 'undefined' && SmartApproval.assess
      ? SmartApproval.assess(data) : { score: 0, critical: [], warnings: [], recommendations: [] };
    const departmentCount = new Set((context.report || []).map(row => row.departmentId).filter(Boolean)).size;
    executive.innerHTML = `<div class="workspace-executive-card is-primary"><span>صافي المستحق للصرف</span><strong>${formatMoney(data.totals.finalSalary)}</strong><small>القيمة المحفوظة في التقرير الحالي</small></div><div class="workspace-executive-card"><span>الموظفون</span><strong>${context.report.length}</strong><small>سجل محسوب</small></div><div class="workspace-executive-card"><span>الأقسام</span><strong>${departmentCount}</strong><small>ضمن التقرير</small></div><div class="workspace-executive-card"><span>جاهزية الاعتماد</span><strong>${assessment.score}%</strong><small>${assessment.critical.length ? 'توجد موانع يجب معالجتها' : 'لا توجد أخطاء مانعة'}</small></div>`;
    checklist.innerHTML = assessmentMarkup(assessment.critical, 'failed') || '<section class="workspace-checklist-group is-passed"><h4>فحوصات الاعتماد</h4><p>لا توجد أخطاء مانعة وفق فحوصات الجاهزية الحالية.</p></section>';
    checklist.insertAdjacentHTML('beforeend', assessmentMarkup(assessment.warnings, 'warning') + assessmentMarkup(assessment.recommendations, 'passed'));
  }

  function renderCalculationWorkspace(context) {
    const status = $('reportCalculationStatus');
    if (!status) return;
    const calculatedAt = context.month && context.month.calculatedAt;
    status.innerHTML = `<div><strong>${calculatedAt ? 'يوجد تقرير محسوب لهذا الشهر' : 'لا توجد نسخة محسوبة بعد'}</strong><span>${calculatedAt ? `آخر حساب: ${formatDateTime(calculatedAt)}` : 'استخدم إجراء الحساب لإعداد بيانات التقرير قبل المراجعة.'}</span></div><div><strong>${context.report.length}</strong><span>سجل ضمن التقرير الحالي</span></div>`;
  }

  function renderPaymentWorkspace(context) {
    const root = $('reportPaymentSummary');
    if (!root) return;
    const payments = (context.snapshot && context.snapshot.employeePayments) || {};
    const rows = (context.snapshot && context.snapshot.report) || [];
    const paid = rows.filter(row => payments[row.moderatorId] && payments[row.moderatorId].status === 'paid').length;
    const remaining = Math.max(rows.length - paid, 0);
    root.innerHTML = `<div><span>تم صرفهم</span><strong>${paid}</strong></div><div><span>المتبقي</span><strong>${remaining}</strong></div><div><span>حالة الكشف</span><strong>${context.snapshot && context.snapshot.status === 'paid' ? 'مكتمل الصرف' : 'جاهز للصرف'}</strong></div>`;
  }

  function renderArchiveWorkspace(context) {
    const root = $('reportArchiveSummary');
    if (!root) return;
    root.innerHTML = `<div><span>حالة الشهر</span><strong>${label(PayrollWorkflow.derive(context.month, context.snapshot))}</strong></div><div><span>تاريخ الإغلاق</span><strong>${formatDateTime(context.month && (context.month.archivedAt || context.month.closedAt))}</strong></div><div><span>Snapshot النهائية</span><strong>${context.snapshot ? 'متاحة للعرض والتدقيق' : 'غير متاحة'}</strong></div>`;
  }

  function renderWorkspace(state, context) {
    const workspace = workspaceFor(state);
    setWorkspaceVisibility(workspace);
    mountWorkspaceSurfaces(workspace);

    const [eyebrow, title, description] = workspaceCopy(workspace);
    const workspaceRoot = $('reportStateWorkspace');
    if (workspaceRoot) workspaceRoot.dataset.workflowWorkspace = workspace;
    const eyebrowNode = $('reportWorkspaceEyebrow');
    const titleNode = $('reportWorkspaceTitle');
    const descriptionNode = $('reportWorkspaceDescription');
    if (eyebrowNode) eyebrowNode.textContent = eyebrow;
    if (titleNode) titleNode.textContent = title;
    if (descriptionNode) descriptionNode.textContent = description;

    const summary = $('reportDecisionSummary');
    if (summary) summary.dataset.workflowWorkspace = workspace;
    const [summaryEyebrow, summaryTitle, summaryDescription] = decisionCopy(workspace);
    const summaryEyebrowNode = $('reportSummaryEyebrow');
    const summaryTitleNode = $('reportSummaryTitle');
    const summaryDescriptionNode = $('reportDecisionState');
    if (summaryEyebrowNode) summaryEyebrowNode.textContent = summaryEyebrow;
    if (summaryTitleNode) summaryTitleNode.textContent = summaryTitle;
    if (summaryDescriptionNode) summaryDescriptionNode.textContent = summaryDescription;
    renderCalculationWorkspace(context);
    renderApprovalWorkspace(context);
    renderPaymentWorkspace(context);
    renderArchiveWorkspace(context);
    return workspace;
  }

  function currentContext(input = {}) {
    const monthId = input.monthId || (typeof App !== 'undefined' && App.getSelectedMonthId
      ? App.getSelectedMonthId() : null);
    const month = input.month || (monthId && typeof Months !== 'undefined' ? Months.byId(monthId) : null) || {};
    const snapshot = Object.prototype.hasOwnProperty.call(input, 'snapshot')
      ? input.snapshot
      : (typeof SalaryProcessing !== 'undefined' && SalaryProcessing.getSnapshot
        ? SalaryProcessing.getSnapshot() : null);
    const report = input.report || (typeof App !== 'undefined' && App.getSalaryProcessingContext
      ? App.getSalaryProcessingContext().rows : []) || [];
    const appContext = typeof App !== 'undefined' && App.getSalaryProcessingContext
      ? App.getSalaryProcessingContext() : {};
    return { monthId, month, snapshot, report, totals: appContext.totals || month.totals || {} };
  }

  function canAction(action, input = {}) {
    const context = currentContext(input);
    const engineContext = { ...context, salarySnapshot: context.snapshot };
    const permission = PayrollWorkflow.ACTION_PERMISSION[action];
    if (!permission || !Permissions.can(permission)) return false;

    const state = PayrollWorkflow.derive(context.month, context.snapshot);
    if (action === PayrollWorkflow.ACTION.START_REVIEW) {
      return [PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW].includes(state) &&
        context.report.length > 0;
    }
    // A partial payment is already part of the established payment screen.
    // The engine itself still prevents the terminal PAID transition until
    // every employee has a payment record.
    if (action === PayrollWorkflow.ACTION.PAY) {
      return state === PayrollWorkflow.STATE.READY_FOR_PAYMENT &&
        Array.isArray(context.snapshot && context.snapshot.report) && context.snapshot.report.length > 0;
    }
    try {
      PayrollWorkflow.assertAction(action, engineContext);
      return true;
    } catch (_) {
      return false;
    }
  }

  function setAction(id, visible, enabled, title) {
    const button = $(id);
    if (!button) return;
    button.hidden = !visible;
    button.disabled = !enabled;
    if (title) button.title = title;
  }

  function renderHeaderSteps(state) {
    const currentIndex = STEP_ORDER.indexOf(state);
    document.querySelectorAll('#reportWorkflowSteps [data-workflow-state]').forEach((item, index) => {
      const stepState = item.dataset.workflowState;
      const reopened = state === PayrollWorkflow.STATE.REOPENED;
      const complete = reopened
        ? [PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW, PayrollWorkflow.STATE.APPROVED].includes(stepState)
        : currentIndex >= 0 && index < currentIndex;
      const current = stepState === state;
      item.classList.toggle('is-complete', complete);
      item.classList.toggle('is-current', current);
      item.classList.toggle('is-pending', !complete && !current);
      item.classList.toggle('is-locked', !complete && !current && index > currentIndex && !reopened);
      item.toggleAttribute('aria-current', current);
    });
  }

  function renderTimeline(state) {
    const timeline = $('salaryWorkflow');
    if (!timeline) return;
    const currentIndex = STEP_ORDER.indexOf(state);
    timeline.innerHTML = STEP_ORDER.map((step, index) => {
      const complete = currentIndex >= 0 && index < currentIndex;
      const current = step === state;
      const className = complete ? 'done' : (current ? 'current' : '');
      return `<span class="${className}" data-workflow-state="${step}">${label(step)}</span>`;
    }).join('');
  }

  function renderMessages(state, context) {
    const current = $('reportWorkflowCurrent');
    const next = $('reportWorkflowNext');
    const nextState = (PayrollWorkflow.TRANSITIONS[state] || [])[0] || null;
    if (current) current.textContent = `الحالة الحالية: ${label(state)}`;
    if (next) next.textContent = nextState
      ? `الخطوة التالية: ${label(nextState)}`
      : 'هذه الدورة مكتملة ومحفوظة في الأرشيف.';

    const notice = $('reportApprovalNotice');
    if (notice) {
      const messages = {
        [PayrollWorkflow.STATE.DRAFT]: '<strong>التقرير في المسودة.</strong> ابدأ بحساب التقرير الشهري.',
        [PayrollWorkflow.STATE.CALCULATED]: '<strong>التقرير محسوب.</strong> راجع النتائج ثم ابدأ فحص الجاهزية للاعتماد.',
        [PayrollWorkflow.STATE.IN_REVIEW]: '<strong>التقرير قيد المراجعة.</strong> أكمل فحص الجاهزية ثم أكد الاعتماد.',
        [PayrollWorkflow.STATE.APPROVED]: '<strong>تم اعتماد التقرير.</strong> يمكنك إنشاء كشف الرواتب المستقل.',
        [PayrollWorkflow.STATE.SALARY_SNAPSHOT_CREATED]: '<strong>تم إنشاء كشف الرواتب.</strong> ينتقل إلى جاهز للصرف بعد حفظه.',
        [PayrollWorkflow.STATE.READY_FOR_PAYMENT]: '<strong>كشف الرواتب جاهز للصرف.</strong> سجل صرف كل الموظفين لإكمال الدورة.',
        [PayrollWorkflow.STATE.PAID]: '<strong>تم صرف الرواتب بالكامل.</strong> أصبحت الدورة جاهزة للأرشفة.',
        [PayrollWorkflow.STATE.ARCHIVED]: '<strong>الدورة مؤرشفة.</strong> تبقى للعرض والتدقيق فقط.',
        [PayrollWorkflow.STATE.REOPENED]: '<strong>أُعيد فتح التقرير.</strong> أعد الحساب والمراجعة قبل الاعتماد التالي.'
      };
      const reviewState = [PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW].includes(state);
      const assessment = reviewState && typeof SmartApproval !== 'undefined' && SmartApproval.assess
        ? SmartApproval.assess(assessmentContext(context)) : null;
      const readiness = assessment
        ? `<span class="report-review-readiness">${assessment.critical.length} موانع · ${assessment.warnings.length} تنبيهات</span>` : '';
      notice.innerHTML = `${messages[state] || ''}${readiness}`;
    }
  }

  function renderActions(state, context) {
    const canCalculate = canAction(PayrollWorkflow.ACTION.CALCULATE, context);
    const canReview = canAction(PayrollWorkflow.ACTION.START_REVIEW, context);
    const canSnapshot = canAction(PayrollWorkflow.ACTION.CREATE_SALARY_SNAPSHOT, context);
    const canPay = canAction(PayrollWorkflow.ACTION.PAY, context);
    const canArchive = canAction(PayrollWorkflow.ACTION.ARCHIVE, context);
    const assessment = state === PayrollWorkflow.STATE.IN_REVIEW && typeof SmartApproval !== 'undefined' && SmartApproval.assess
      ? SmartApproval.assess(assessmentContext(context)) : null;
    const acknowledgement = $('reportApprovalAck');
    const canApprove = state === PayrollWorkflow.STATE.IN_REVIEW && Permissions.can('reports.approve') &&
      !!assessment && assessment.critical.length === 0 && !!(acknowledgement && acknowledgement.checked);

    setAction('calculateBtn', workspaceFor(state) === WORKSPACE.CALCULATION, canCalculate,
      canCalculate ? 'حساب التقرير' : 'الحالة الحالية لا تسمح بالحساب.');
    setAction('approveReportBtn',
      [PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW].includes(state),
      state === PayrollWorkflow.STATE.CALCULATED ? canReview : canApprove,
      state === PayrollWorkflow.STATE.CALCULATED
        ? (canReview ? 'فتح مساحة الاعتماد' : 'احسب التقرير أولًا أو راجع الصلاحيات.')
        : (canApprove ? 'اعتماد التقرير بعد اكتمال فحوصات الجاهزية' : 'أكمل فحوصات الجاهزية والتأكيد قبل الاعتماد.'));
    setAction('salarySnapshotApproveBtn', state === PayrollWorkflow.STATE.APPROVED, canSnapshot,
      canSnapshot ? 'إنشاء كشف الرواتب' : 'لا يمكن إنشاء كشف الرواتب في الحالة الحالية.');
    setAction('salaryMarkAllPaidBtn', state === PayrollWorkflow.STATE.READY_FOR_PAYMENT, canPay,
      canPay ? 'تسجيل صرف الجميع' : 'كشف الرواتب غير جاهز للصرف أو لا تملك الصلاحية.');
    setAction('workflowArchiveBtn', state === PayrollWorkflow.STATE.PAID, canArchive,
      canArchive ? 'أرشفة دورة الرواتب المدفوعة' : 'تتطلب الأرشفة اكتمال الصرف وصلاحية إدارة الأشهر.');

    const approveButton = $('approveReportBtn');
    if (approveButton) approveButton.textContent = state === PayrollWorkflow.STATE.CALCULATED
      ? 'فتح مساحة الاعتماد' : 'اعتماد التقرير';
    const secondaryActions = query('#reportStateWorkspace .report-secondary-actions');
    if (secondaryActions) secondaryActions.hidden = workspaceFor(state) !== WORKSPACE.REVIEW;
    const actionWorkspace = $('reportStateWorkspace');
    if (actionWorkspace) {
      const visibleActions = [...actionWorkspace.querySelectorAll('button')].some(button =>
        !button.hidden && !(button.closest('.report-secondary-actions') || {}).hidden);
      actionWorkspace.hidden = !visibleActions;
    }
  }

  function render(input = {}) {
    const context = currentContext(input);
    const state = PayrollWorkflow.derive(context.month, context.snapshot);
    const reportView = $('view-report');
    if (reportView) reportView.dataset.workflowState = state;
    const summary = $('reportFinancialSummary');
    if (summary) summary.dataset.workflowState = state;

    const reportBadge = $('reportApprovalBadge');
    if (reportBadge) {
      reportBadge.textContent = label(state);
      reportBadge.className = `badge ${[PayrollWorkflow.STATE.APPROVED, PayrollWorkflow.STATE.READY_FOR_PAYMENT, PayrollWorkflow.STATE.PAID].includes(state) ? 'badge-active' : (state === PayrollWorkflow.STATE.ARCHIVED ? 'badge-archived' : 'badge-locked')}`;
    }
    const salaryBadge = $('salaryProcessingStatus');
    if (salaryBadge) {
      const salaryState = context.snapshot ? PayrollWorkflow.derive(context.month, context.snapshot) : PayrollWorkflow.STATE.DRAFT;
      salaryBadge.textContent = context.snapshot ? label(salaryState) : 'لم يُنشأ بعد';
      salaryBadge.className = `badge ${context.snapshot ? 'badge-active' : 'badge-locked'}`;
    }

    renderHeaderSteps(state);
    renderWorkspace(state, context);
    renderTimeline(state);
    renderMessages(state, context);
    renderActions(state, context);
    ['smartApprovalModal', 'closeMonthModal'].forEach(id => {
      const dialog = $(id);
      if (dialog) dialog.dataset.workflowState = state;
    });
    return state;
  }

  function archiveCurrentCycle() {
    const context = currentContext();
    if (!canAction(PayrollWorkflow.ACTION.ARCHIVE, context)) {
      Toast.show('لا يمكن أرشفة هذه الدورة قبل اكتمال الصرف أو بدون الصلاحية المطلوبة.', 'error');
      return;
    }
    Confirm.show('هل تريد أرشفة دورة الرواتب المدفوعة؟ ستبقى متاحة للعرض والتدقيق فقط.', async () => {
      Loading.show('جاري أرشفة دورة الرواتب...');
      try {
        await Months.archiveMonth(context.monthId);
        Toast.show('تمت أرشفة دورة الرواتب بنجاح.', 'success');
      } catch (err) {
        console.error('Could not archive paid payroll cycle:', err);
        Toast.show(err.message || 'تعذرت أرشفة دورة الرواتب.', 'error');
      } finally {
        Loading.hide();
        render();
      }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    const archiveButton = $('workflowArchiveBtn');
    if (archiveButton) archiveButton.addEventListener('click', archiveCurrentCycle);
    const approvalAcknowledgement = $('reportApprovalAck');
    if (approvalAcknowledgement) approvalAcknowledgement.addEventListener('change', () => render());
    render();
  }

  return { init, render, canAction, workspaceFor };
})();
