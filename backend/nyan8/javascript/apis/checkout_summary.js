const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { requireField, assertTerminal } = require('../lib/validation');

function summarize(rawRows) {
  const items = rawRows.map((row) => ({
    orderItemId: row.order_item_id,
    itemName: row.item_name,
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    status: row.item_status,
    optionTotal: Number(row.option_total || 0),
    lineSubtotal: Number(row.line_subtotal || 0),
    lineTax: Number(row.line_tax || 0)
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.lineTax, 0);
  return {
    sessionId: rawRows[0]?.session_id || null,
    tableCode: rawRows[0]?.table_code || null,
    tableName: rawRows[0]?.table_name || null,
    sessionStatus: rawRows[0]?.session_status || null,
    items,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount
  };
}

module.exports = async function checkoutSummary(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  requireField(query.table_code, 'table_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'checkout');
  return ok({ summary: summarize(rows(await nyanql('GET', '/checkout/summary', { table_code: query.table_code }))) });
};
