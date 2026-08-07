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
    if ([PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW].includes(state)) return WORKSPACE.REVIEW;
    if (state === PayrollWorkflow.STATE.APPROVED) return WORKSPACE.APPROVAL;
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

  function renderWorkspace(state) {
    const workspace = workspaceFor(state);
    const reportView = $('view-report');
    if (reportView) {
      reportView.dataset.workflowWorkspace = workspace;
      reportView.querySelectorAll('[data-workflow-workspace]').forEach(element => {
        const supported = (element.dataset.workflowWorkspace || '').split(/\s+/);
        element.hidden = !supported.includes(workspace);
      });
    }

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
    return { monthId, month, snapshot, report };
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

  function renderMessages(state) {
    const current = $('reportWorkflowCurrent');
    const next = $('reportWorkflowNext');
    const nextState = (PayrollWorkflow.TRANSITIONS[state] || [])[0] || null;
    if (current) current.textContent = `الحالة الحالية: ${label(state)}`;
    if (next) next.textContent = nextState
      ? `الخطوة التالية: ${label(nextState)}`
      : 'هذه الدورة مكتملة ومحفوظة في الأرشيف.';

    const decision = $('reportDecisionState');
    if (decision) {
      const decisionMessages = {
        [WORKSPACE.CALCULATION]: 'تظهر قيم القرار بعد إكمال حساب التقرير الشهري.',
        [WORKSPACE.REVIEW]: 'تدعم هذه القيم قرار المراجعة والاعتماد قبل إنشاء كشف الرواتب.',
        [WORKSPACE.APPROVAL]: 'هذه هي القيم المعتمدة لاتخاذ قرار إغلاق التقرير الشهري.',
        [WORKSPACE.PAYROLL]: 'هذه القيم هي مرجع مراجعة كشف الرواتب المستقل.',
        [WORKSPACE.PAYMENT]: 'هذه القيم مرجع الصرف ولا يعاد حسابها أثناء الدفع.',
        [WORKSPACE.ARCHIVE]: 'هذه القيم محفوظة للدورة الحالية وللعرض والتدقيق فقط.'
      };
      decision.textContent = decisionMessages[workspaceFor(state)];
    }

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
      notice.innerHTML = messages[state] || '';
    }
  }

  function renderActions(state, context) {
    const canCalculate = canAction(PayrollWorkflow.ACTION.CALCULATE, context);
    const canReview = canAction(PayrollWorkflow.ACTION.START_REVIEW, context);
    const canSnapshot = canAction(PayrollWorkflow.ACTION.CREATE_SALARY_SNAPSHOT, context);
    const canPay = canAction(PayrollWorkflow.ACTION.PAY, context);
    const canArchive = canAction(PayrollWorkflow.ACTION.ARCHIVE, context);

    setAction('calculateBtn', [WORKSPACE.CALCULATION, WORKSPACE.REVIEW].includes(workspaceFor(state)), canCalculate,
      canCalculate ? 'حساب التقرير' : 'الحالة الحالية لا تسمح بالحساب.');
    setAction('approveReportBtn',
      [PayrollWorkflow.STATE.CALCULATED, PayrollWorkflow.STATE.IN_REVIEW].includes(state),
      canReview,
      canReview ? 'بدء مراجعة واعتماد التقرير' : 'احسب التقرير أولًا أو راجع الصلاحيات.');
    setAction('salarySnapshotApproveBtn', state === PayrollWorkflow.STATE.APPROVED, canSnapshot,
      canSnapshot ? 'إنشاء كشف الرواتب' : 'لا يمكن إنشاء كشف الرواتب في الحالة الحالية.');
    setAction('salaryMarkAllPaidBtn', state === PayrollWorkflow.STATE.READY_FOR_PAYMENT, canPay,
      canPay ? 'تسجيل صرف الجميع' : 'كشف الرواتب غير جاهز للصرف أو لا تملك الصلاحية.');
    setAction('workflowArchiveBtn', state === PayrollWorkflow.STATE.PAID, canArchive,
      canArchive ? 'أرشفة دورة الرواتب المدفوعة' : 'تتطلب الأرشفة اكتمال الصرف وصلاحية إدارة الأشهر.');
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
    renderWorkspace(state);
    renderTimeline(state);
    renderMessages(state);
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
    render();
  }

  return { init, render, canAction, workspaceFor };
})();
