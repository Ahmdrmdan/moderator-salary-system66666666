'use strict';

// Contract tests for the client-side Excel parser. They intentionally mock
// SheetJS at its public boundary so the same parser can be verified in Node
// without changing the browser-only application architecture.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');

const utilsSource = fs.readFileSync('js/utils.js', 'utf8');

function loadUtils(rows = []) {
  const sandbox = {
    console,
    crypto: crypto.webcrypto,
    TextEncoder,
    Date,
    Map,
    Set,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    RegExp,
    localStorage: { getItem: () => null, setItem: () => {} },
    XLSX: {
      read: () => ({ SheetNames: ['Orders'], Sheets: { Orders: {} } }),
      utils: { sheet_to_json: () => rows }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${utilsSource}\nthis.__Utils = Utils;`, sandbox, { filename: 'utils.js' });
  return sandbox.__Utils;
}

function analyze(rows) {
  return loadUtils(rows).analyzeExcelFile(new ArrayBuffer(0));
}

const officialHeaders = [
  'التاريخ', 'ID', 'Reciver name', 'Reciver phone', 'Reciver note',
  'Address', 'Order_Content', 'عدد العبوات', 'Order_Amt', 'اسم المودريتور'
];

{
  const result = analyze([officialHeaders, [
    new Date(Date.UTC(2026, 6, 13)), 81579, 'خالد لطفي', '01050250777',
    'ملاحظة', 'المنوفية، قويسنا', 'حليب الصويا', 6, 650, 'Hind'
  ]]);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.orders.length, 1);
  assert.deepStrictEqual(Object.values(result.mapping), [9, 7, 8, 0, 1, 2, 3, 4, 5, 6, null, null]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.orders[0])), {
    name: 'Hind', packages: 6, price: 650, lineNumber: 2,
    orderDate: '2026-07-13', externalOrderNumber: '81579', customerName: 'خالد لطفي',
    customerPhone: '01050250777', notes: 'ملاحظة', fullAddress: 'المنوفية، قويسنا',
    productName: 'حليب الصويا', waybillNumber: '', governorate: '', shipmentStatus: 'لم يتم التحديث'
  });
}

{
  const result = analyze([['اسم المشرف', 'عدد الطرود', 'السعر'], ['Hind', 4, 550]]);
  assert.strictEqual(result.orders.length, 1);
  assert.strictEqual(result.orders[0].name, 'Hind');
  assert.strictEqual(result.orders[0].packages, 4);
  assert.strictEqual(result.orders[0].price, 550);
}

{
  const result = analyze([officialHeaders, [
    '2026-07-13', '9001', 'عميل', '0100', '', '', '', '٤', '٦٥٠ ج.م', 'Hind'
  ]]);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.orders[0].packages, 4);
  assert.strictEqual(result.orders[0].price, 650);
}

{
  const result = analyze([officialHeaders,
    ['2026-07-13', '9001', 'عميل أ', '0100', '', '', '', 1, 100, 'Hind'],
    ['2026-07-13', '9001', 'عميل ب', '0101', '', '', '', 1, 100, 'Hind']
  ]);
  assert.strictEqual(result.orders.length, 1);
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].code, 'duplicate_external_id');
}

{
  const result = analyze([officialHeaders,
    ['2026-07-13', '9001', 'عميل أ', '0100', '', '', '', 1, 100, 'Hind'],
    ['2026-07-13', '9002', 'عميل ب', '0101', '', '', '', '', 100, 'Hind']
  ]);
  assert.strictEqual(result.orders.length, 1);
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].lineNumber, 3);
}

{
  const result = analyze([officialHeaders, [
    '2026-07-14', '81764', 'عميل', '0100', '', '', '', 4, 550, ''
  ]]);
  assert.strictEqual(result.orders.length, 1);
  assert.strictEqual(result.orders[0].name, 'غير محدد');
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.warnings.length, 1);
  assert.strictEqual(result.warnings[0].code, 'missing_moderator_assigned_placeholder');
}

console.log('Import contract tests passed');

{
  const Utils = loadUtils();
  assert.strictEqual(Utils.normalizeShippingPhone('010 5025-0777'), '1050250777');
  assert.strictEqual(Utils.normalizeShippingPhone('+20 10-5025-0777'), '1050250777');
  assert.strictEqual(Utils.normalizeShippingPhone('0020١٠٥٠٢٥٠٧٧٧'), '1050250777');
  assert.strictEqual(Utils.normalizeShippingPhone('٠١٠٥٠٢٥٠٧٧٧'), '1050250777');
  assert.strictEqual(Utils.normalizeShippingPhone(''), '');
}

console.log('Shipping phone normalization contract tests passed');
