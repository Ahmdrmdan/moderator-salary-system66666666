'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const workflowSource = fs.readFileSync('js/payroll-workflow.js', 'utf8');
const source = fs.readFileSync('js/payroll-workflow-ui.js', 'utf8');
// Avoid the first full render: this test targets the delegated Timeline click
// only, while the existing UI contract covers every rendered Workspace.
const isolated = source.replace(/\r\n/g, '\n').replace(
  '\n    render();\n  }\n\n  return { init, render, canAction, workspaceFor };',
  '\n  }\n\n  return { init, render, canAction, workspaceFor };'
);
assert.notStrictEqual(isolated, source, 'test harness must isolate initial UI render');

function element() {
  return {
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; }
  };
}

const steps = element();
let returns = 0;
const context = {
  document: { getElementById: id => ({ reportWorkflowSteps: steps, workflowArchiveBtn: element(), reportApprovalAck: element() }[id] || null), querySelectorAll: () => [] },
  App: { returnToPreviousWorkflowStage: async () => { returns += 1; } },
  Toast: { show() {} },
  Permissions: { can: () => false },
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(`${workflowSource}\n${isolated}\nglobalThis.__workflowUi = PayrollWorkflowUI;`, context, {
  filename: 'payroll-workflow-stepper-interaction.test.js'
});

context.__workflowUi.init();
assert.strictEqual(typeof steps.listeners.click, 'function', 'Timeline has a delegated click handler');
steps.listeners.click({ target: { closest: selector => selector === '.report-workflow-step[data-workflow-previous="true"]' ? {} : null } });

setImmediate(() => {
  assert.strictEqual(returns, 1, 'a permitted previous Timeline stage calls the official workflow transition');
  console.log('payroll workflow stepper interaction tests passed');
});
