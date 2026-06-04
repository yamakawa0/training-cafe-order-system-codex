const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { assertTerminal, requireField } = require('../lib/validation');

module.exports = async function kitchenTickets(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'kitchen');
  return ok({ tickets: rows(await nyanql('GET', '/kitchen/tickets')) });
};
