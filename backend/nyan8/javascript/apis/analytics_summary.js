const { nyanql, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { requireField, assertTerminal } = require('../lib/validation');

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async function analyticsSummary(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'analytics');
  const fromDate = query.from_date || today();
  const toDate = query.to_date || today();
  return ok({ summary: first(await nyanql('GET', '/analytics/summary', { from_date: fromDate, to_date: toDate })) });
};
