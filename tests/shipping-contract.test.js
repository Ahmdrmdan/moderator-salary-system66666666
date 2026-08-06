'use strict';

// Exercise the actual Orders Management matching implementation without a
// browser or Firebase project. The test replaces only the module's public
// return value, leaving the production matching code untouched.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');

const utilsSource = fs.readFileSync('js/utils.js', 'utf8');
const ordersSource = fs.readFileSync('js/orders.js', 'utf8').replace(
  'return { init, open, refresh: load, getAll: () => state.orders.slice() };',
  'return { init, open, refresh: load, getAll: () => state.orders.slice(), __test: { state, shipping, matchShippingRows, orderRow } };'
);

const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', value: '', files: [], addEventListener: () => {} });
  return nodes.get(id);
}

const sandbox = {
  console, crypto: crypto.webcrypto, TextEncoder, Date, Map, Set, JSON, Math, Number, String, Array, Object, RegExp,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { getElementById: node, querySelectorAll: () => [] },
  Toast: { show: () => {} }, Loading: { show: () => {}, hide: () => {} }, Confirm: { show: () => {} },
  Permissions: { require: () => {}, can: () => true }, Months: { assertEditable: () => {}, all: () => [], isLocked: () => false },
  AuditService: { ACTION: { ORDERS_UPDATED: 'orders_updated' }, OPERATION: { UPDATE: 'update' }, appendToBatch: () => {} },
  firebase: { firestore: { FieldValue: { serverTimestamp: () => ({}), increment: value => value } } },
  auth: { currentUser: null }, db: {}, COLLECTIONS: { MONTHLY_REPORTS: 'monthly_reports' },
  MONTH_SUBCOLLECTIONS: { ORDER_BATCHES: 'orderBatches', SHIPPING_SYNCS: 'shippingSyncs' }
};
vm.createContext(sandbox);
vm.runInContext(`${utilsSource}\nthis.__Utils = Utils;`, sandbox, { filename: 'utils.js' });
sandbox.Utils = sandbox.__Utils;
vm.runInContext(`${ordersSource}\nthis.__OrdersManagement = OrdersManagement;`, sandbox, { filename: 'orders.js' });

const test = sandbox.__OrdersManagement.__test;
function row(phone, waybill = 'WB-1', update = null, status = 'في الشحن') {
  const result = { line: 2, customerPhone: phone, normalizedPhone: sandbox.Utils.normalizeShippingPhone(phone), waybillNumber: waybill, governorate: 'القاهرة', shipmentStatus: status, rawShipmentStatus: status, lastShippingUpdate: update };
  result.fingerprint = [result.normalizedPhone, waybill, result.governorate, status, update ? update.toISOString() : ''].join('|');
  return result;
}
function order(id, phone, overrides = {}) {
  return { id, customerName: id, customerPhone: phone, moderatorName: 'Moderator', departmentName: 'Sales', shipmentStatus: 'في الشحن', waybillNumber: '', ...overrides };
}
function match(orders, rows) {
  test.state.orders = orders;
  test.shipping.valid = rows;
  test.shipping.matches = []; test.shipping.unchanged = []; test.shipping.unmatched = [];
  test.shipping.conflicts = []; test.shipping.stale = [];
  test.matchShippingRows();
  return test.shipping;
}

{
  const result = match([order('one', '010 5025-0777')], [row('+20 10-5025-0777')]);
  assert.strictEqual(result.matches.length, 1);
  assert.strictEqual(result.matches[0].order.id, 'one');
}

{
  const result = match([order('one', '01050250777'), order('two', '+20 10 5025 0777')], [row('01050250777')]);
  assert.strictEqual(result.matches.length, 0);
  assert.strictEqual(result.conflicts.length, 1);
}

{
  const input = row('01050250777');
  const result = match([order('one', '01050250777', { shipping: { sourceRowHash: input.fingerprint } })], [input]);
  assert.strictEqual(result.unchanged.length, 1);
}

{
  const result = match([order('one', '01050250777', { lastShippingUpdate: new Date('2026-08-07T12:00:00Z') })], [row('01050250777', 'WB-2', new Date('2026-08-07T11:00:00Z'))]);
  assert.strictEqual(result.stale.length, 1);
}

{
  const result = match([order('one', '01050250777'), order('two', '01011111111', { waybillNumber: 'WB-1' })], [row('01050250777', 'WB-1')]);
  assert.strictEqual(result.conflicts.length, 1);
  assert.strictEqual(result.conflicts[0].reason, 'tracking_number_collision');
}

{
  const result = match([order('one', '01050250777')], [row('01050250777', 'WB-1'), row('01050250777', 'WB-2')]);
  assert.strictEqual(result.matches.length, 0);
  assert.strictEqual(result.conflicts.length, 2);
}

{
  test.state.busy = false;
  assert.match(test.orderRow(order('one', '01050250777')), /data-order-action="edit"/);
  assert.match(test.orderRow(order('one', '01050250777')), /data-order-action="delete"/);
  test.state.busy = true;
  assert.doesNotMatch(test.orderRow(order('one', '01050250777')), /data-order-action="edit"/);
  test.state.busy = false;
}

console.log('Shipping matching contract tests passed');
