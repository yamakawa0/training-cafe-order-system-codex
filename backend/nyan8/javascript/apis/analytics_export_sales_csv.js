const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params } = require('../lib/http');
const { requireField, assertTerminal } = require('../lib/validation');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

module.exports = async function analyticsExportSalesCsv(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'analytics');
  const fromDate = query.from_date || today();
  const toDate = query.to_date || today();
  const ranking = rows(await nyanql('GET', '/analytics/item-ranking', { from_date: fromDate, to_date: toDate, limit: 100 }));
  const lines = [
    ['menu_item_id', 'item_name', 'quantity', 'sales_total'],
    ...ranking.map((item) => [item.menu_item_id, item.item_name, item.quantity, item.sales_total])
  ];
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sales-${fromDate}-${toDate}.csv"`
    },
    body: lines.map((line) => line.map(csvEscape).join(',')).join('\n')
  };
};
