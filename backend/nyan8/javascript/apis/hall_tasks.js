const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { assertTerminal, requireField } = require('../lib/validation');

module.exports = async function hallTasks(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'hall');
  return ok({ tasks: rows(await nyanql('GET', '/hall/tasks')) });
};
