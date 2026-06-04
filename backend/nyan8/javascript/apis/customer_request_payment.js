const { nyanql, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { requireField, assertTerminal } = require('../lib/validation');
const { audit } = require('../lib/audit');

module.exports = async function customerRequestPayment(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.table_code, 'table_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== input.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });
  const session = first(await nyanql('GET', '/sessions/current', { table_code: input.table_code }));
  if (!session) throw Object.assign(new Error('session not found'), { status: 404 });
  const updated = first(await nyanql('POST', '/sessions/payment-request', { session_id: session.id }));
  await audit({ actorType: 'terminal', actorId: terminal.id, action: 'customer.payment.request', targetType: 'session', targetId: session.id, payload: {} });
  return ok({ session: updated });
};
