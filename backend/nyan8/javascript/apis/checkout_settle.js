const { nyanql, rows, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { newId, businessNo } = require('../lib/ids');
const { requireField, assertTerminal } = require('../lib/validation');
const { audit } = require('../lib/audit');

const methods = new Set(['cash', 'card', 'qr']);

module.exports = async function checkoutSettle(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.table_code, 'table_code');
  requireField(input.method, 'method');
  if (!methods.has(input.method)) throw Object.assign(new Error('invalid payment method'), { status: 400 });
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'checkout');
  const rawRows = rows(await nyanql('GET', '/checkout/summary', { table_code: input.table_code }));
  if (rawRows.length === 0) throw Object.assign(new Error('checkout target not found'), { status: 404 });
  const subtotal = rawRows.reduce((sum, row) => sum + Number(row.line_subtotal || 0), 0);
  const taxAmount = rawRows.reduce((sum, row) => sum + Number(row.line_tax || 0), 0);
  const totalAmount = subtotal + taxAmount;
  const sessionId = rawRows[0].session_id;
  const payment = first(await nyanql('POST', '/payments', {
    id: newId('pay'),
    session_id: sessionId,
    payment_no: businessNo('PAY'),
    method: input.method,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount
  }));
  const closed = first(await nyanql('POST', '/sessions/close', { session_id: sessionId }));
  await nyanql('POST', '/hall/tasks', {
    id: newId('task'),
    task_type: 'clean_table',
    session_id: sessionId,
    table_id: closed.table_id,
    order_item_id: null,
    priority: 30,
    title: `${input.table_code} 片付け`,
    note: '精算完了後の片付け'
  });
  await audit({ actorType: 'terminal', actorId: terminal.id, action: 'checkout.settle', targetType: 'payment', targetId: payment.id, payload: { tableCode: input.table_code, method: input.method, totalAmount } });
  return ok({ receiptNo: payment.payment_no, payment });
};
