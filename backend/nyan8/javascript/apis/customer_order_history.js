const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { assertTerminal, requireField } = require('../lib/validation');

module.exports = async function customerOrderHistory(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  requireField(query.table_code, 'table_code');
  requireField(query.session_id, 'session_id');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== query.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });
  return ok({ items: rows(await nyanql('GET', '/orders/history', { session_id: query.session_id })) });
};
