const { nyanql, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { requireField } = require('../lib/validation');

module.exports = async function bootstrap(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  if (!terminal) throw Object.assign(new Error('terminal not found'), { status: 404 });
  return ok({ terminal });
};
