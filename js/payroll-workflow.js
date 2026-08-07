'use strict';

/*
 * Payroll Workflow Engine
 * ------------------------------------------------------------------
 * A small, dependency-free state machine for the existing month report
 * and salary-processing snapshot.  It deliberately owns transitions and
 * validation only; it does not calculate money, query Firestore, or render
 * UI.  Legacy documents with no workflowState are derived from their
 * established month/snapshot fields, so no migration is required.
 */
const PayrollWorkflow = (() => {
  const STATE = Object.freeze({
    DRAFT: 'draft',
    CALCULATED: 'calculated',
    IN_REVIEW: 'in_review',
    APPROVED: 'approved',
    SALARY_SNAPSHOT_CREATED: 'salary_snapshot_created',
    READY_FOR_PAYMENT: 'ready_for_payment',
    PAID: 'paid',
    ARCHIVED: 'archived',
    REOPENED: 'reopened'
  });

  const ACTION = Object.freeze({
    CALCULATE: 'calculate',
    START_REVIEW: 'start_review',
    APPROVE: 'approve',
    CREATE_SALARY_SNAPSHOT: 'create_salary_snapshot',
    MARK_READY_FOR_PAYMENT: 'mark_ready_for_payment',
    PAY: 'pay',
    ARCHIVE: 'archive',
    REOPEN: 'reopen'
  });

  const ACTION_PERMISSION = Object.freeze({
    [ACTION.CALCULATE]: 'reports.calculate',
    [ACTION.START_REVIEW]: 'reports.approve',
    [ACTION.APPROVE]: 'reports.approve',
    [ACTION.CREATE_SALARY_SNAPSHOT]: 'salary_processing.approve',
    [ACTION.MARK_READY_FOR_PAYMENT]: 'salary_processing.approve',
    [ACTION.PAY]: 'salary_processing.pay',
    [ACTION.ARCHIVE]: 'months.write',
    [ACTION.REOPEN]: 'months.write'
  });

  const ACTION_TARGET = Object.freeze({
    [ACTION.CALCULATE]: STATE.CALCULATED,
    [ACTION.START_REVIEW]: STATE.IN_REVIEW,
    [ACTION.APPROVE]: STATE.APPROVED,
    [ACTION.CREATE_SALARY_SNAPSHOT]: STATE.SALARY_SNAPSHOT_CREATED,
    [ACTION.MARK_READY_FOR_PAYMENT]: STATE.READY_FOR_PAYMENT,
    [ACTION.PAY]: STATE.PAID,
    [ACTION.ARCHIVE]: STATE.ARCHIVED,
    [ACTION.REOPEN]: STATE.REOPENED
  });

  const TRANSITIONS = Object.freeze({
    [STATE.DRAFT]: [STATE.CALCULATED],
    [STATE.REOPENED]: [STATE.CALCULATED],
    [STATE.CALCULATED]: [STATE.DRAFT, STATE.CALCULATED, STATE.IN_REVIEW],
    [STATE.IN_REVIEW]: [STATE.CALCULATED, STATE.APPROVED],
    // Existing administration already supports reopening an approved month.
    // Retaining that path keeps legacy month management compatible while the
    // new engine makes the transition explicit and auditable.
    [STATE.APPROVED]: [STATE.SALARY_SNAPSHOT_CREATED, STATE.REOPENED],
    [STATE.SALARY_SNAPSHOT_CREATED]: [STATE.READY_FOR_PAYMENT],
    [STATE.READY_FOR_PAYMENT]: [STATE.PAID],
    [STATE.PAID]: [STATE.ARCHIVED],
    // A paid archive is terminal. Reopening it would allow a recalculation
    // while an immutable paid snapshot still exists, creating two financial
    // truths. The established reopen flow remains available before payroll
    // payment, from the approved state above.
    [STATE.ARCHIVED]: []
  });

  const LABEL = Object.freeze({
    [STATE.DRAFT]: 'مسودة',
    [STATE.CALCULATED]: 'تم الحساب',
    [STATE.IN_REVIEW]: 'قيد المراجعة',
    [STATE.APPROVED]: 'تم الاعتماد',
    [STATE.SALARY_SNAPSHOT_CREATED]: 'تم إنشاء كشف الرواتب',
    [STATE.READY_FOR_PAYMENT]: 'جاهز للصرف',
    [STATE.PAID]: 'تم الصرف',
    [STATE.ARCHIVED]: 'مؤرشف',
    [STATE.REOPENED]: 'أُعيد فتحه'
  });

  function isState(value) { return Object.values(STATE).includes(value); }
  function previousState(state) {
    const previous = {
      [STATE.CALCULATED]: STATE.DRAFT,
      [STATE.IN_REVIEW]: STATE.CALCULATED,
      [STATE.APPROVED]: STATE.REOPENED
    };
    return previous[state] || null;
  }
  function hasReport(month) {
    return Array.isArray(month && month.report) && month.report.length > 0;
  }
  function hasTotals(month) {
    return !!(month && month.totals && typeof month.totals === 'object');
  }

  /** Resolves current state without assuming a migration has happened. */
  function derive(month = {}, salarySnapshot = null) {
    if (month.archived === true) return STATE.ARCHIVED;

    const snapshotState = salarySnapshot && salarySnapshot.workflowState;
    if (isState(snapshotState)) return snapshotState;
    if (salarySnapshot && salarySnapshot.status === 'paid') return STATE.PAID;
    if (salarySnapshot && salarySnapshot.status === 'approved') return STATE.READY_FOR_PAYMENT;

    if (isState(month.workflowState)) return month.workflowState;
    if (month.status === 'locked') return STATE.APPROVED;
    if (hasReport(month) || hasTotals(month) || month.calculatedAt) return STATE.CALCULATED;
    return STATE.DRAFT;
  }

  function reportRows(context) {
    if (Array.isArray(context && context.report)) return context.report;
    if (Array.isArray(context && context.month && context.month.report)) return context.month.report;
    return [];
  }

  function requiredErrors(next, context = {}) {
    const month = context.month || {};
    const salary = context.salarySnapshot || null;
    const rows = reportRows(context);
    const errors = [];

    if (next === STATE.IN_REVIEW || next === STATE.APPROVED ||
        next === STATE.SALARY_SNAPSHOT_CREATED || next === STATE.READY_FOR_PAYMENT) {
      if (!rows.length) errors.push('لا يوجد تقرير محسوب يحتوي على موظفين للمراجعة.');
    }

    if (next === STATE.APPROVED) {
      const critical = context.approvalAssessment && context.approvalAssessment.critical;
      if (!context.approvalAssessment || !Array.isArray(critical)) {
        errors.push('يجب تشغيل فحص الجاهزية قبل اعتماد التقرير.');
      } else if (critical.length > 0) {
        errors.push('توجد أخطاء مانعة يجب معالجتها قبل اعتماد التقرير.');
      }
      if (month.status === 'locked' || month.archived === true) {
        errors.push('حالة الشهر لا تسمح باعتماد التقرير.');
      }
    }

    if (next === STATE.SALARY_SNAPSHOT_CREATED) {
      if (month.status !== 'locked' && derive(month, salary) !== STATE.APPROVED) {
        errors.push('لا يمكن إنشاء كشف الرواتب قبل اعتماد التقرير الشهري.');
      }
      if (salary) errors.push('يوجد كشف رواتب محفوظ لهذا الشهر بالفعل.');
    }

    if (next === STATE.READY_FOR_PAYMENT) {
      if (!salary || !Array.isArray(salary.report) || !salary.report.length) {
        errors.push('كشف الرواتب غير متاح أو لا يحتوي على موظفين.');
      }
    }

    if (next === STATE.PAID) {
      const payrollRows = salary && Array.isArray(salary.report) ? salary.report : [];
      const payments = salary && salary.employeePayments ? salary.employeePayments : {};
      if (!payrollRows.length) errors.push('لا يوجد كشف رواتب صالح للصرف.');
      const pending = payrollRows.filter(row => {
        const id = row.moderatorId || row.employeeId || row.name;
        return !payments[id] || payments[id].status !== 'paid';
      });
      if (pending.length) errors.push('لا يمكن إكمال الصرف قبل تسجيل صرف جميع الموظفين.');
    }

    if (next === STATE.ARCHIVED) {
      if (derive(month, salary) !== STATE.PAID) {
        errors.push('لا يمكن أرشفة دورة الرواتب قبل اكتمال الصرف.');
      }
    }

    if (next === STATE.REOPENED && month.archived !== true && month.status !== 'locked') {
      errors.push('لا توجد دورة معتمدة أو مؤرشفة لإعادة فتحها.');
    }

    return errors;
  }

  function assertTransition(from, to, context = {}) {
    if (!isState(from) || !isState(to)) throw new Error('حالة Workflow غير معروفة.');
    if (!(TRANSITIONS[from] || []).includes(to)) {
      throw new Error(`لا يسمح المسار بالانتقال من «${LABEL[from]}» إلى «${LABEL[to]}».`);
    }
    const errors = requiredErrors(to, context);
    if (errors.length) throw new Error(errors.join(' '));
    return true;
  }

  function assertAction(action, context = {}) {
    const current = context.currentState || derive(context.month || {}, context.salarySnapshot || null);
    const target = ACTION_TARGET[action];
    if (!target) throw new Error('إجراء Workflow غير معروف.');
    assertTransition(current, target, context);
    return target;
  }

  function availableActions(context = {}, can = () => true) {
    const current = context.currentState || derive(context.month || {}, context.salarySnapshot || null);
    return Object.values(ACTION).filter(action => {
      if (!can(ACTION_PERMISSION[action])) return false;
      try { assertTransition(current, ACTION_TARGET[action], context); return true; }
      catch (_) { return false; }
    });
  }

  function metadata(state, actor = null) {
    if (!isState(state)) throw new Error('لا يمكن حفظ حالة Workflow غير معروفة.');
    return {
      workflowState: state,
      workflowVersion: 1,
      workflowUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      workflowUpdatedBy: actor || (typeof auth !== 'undefined' && auth.currentUser ? auth.currentUser.email || null : null)
    };
  }

  return { STATE, ACTION, ACTION_PERMISSION, ACTION_TARGET, TRANSITIONS, LABEL,
    isState, previousState, derive, requiredErrors, assertTransition, assertAction, availableActions, metadata };
})();
