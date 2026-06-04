const { nyanql, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { newId } = require('../lib/ids');
const { requireField, assertTerminal } = require('../lib/validation');

module.exports = async function customerOpenSession(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.table_code, 'table_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== input.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });
  const current = first(await nyanql('GET', '/sessions/current', { table_code: input.table_code }));
  if (current) return ok({ session: current });
  const session = first(await nyanql('POST', '/sessions', {
    id: newId('sess'),
    table_code: input.table_code,
    guest_count: Number(input.guest_count || 1)
  }));
  return ok({ session });
};
