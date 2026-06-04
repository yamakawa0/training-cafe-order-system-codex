const { nyanql, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { assertTerminal, requireField } = require('../lib/validation');

module.exports = async function customerCurrentSession(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  requireField(query.table_code, 'table_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== query.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });
  const session = first(await nyanql('GET', '/sessions/current', { table_code: query.table_code }));
  return ok({ session });
};
