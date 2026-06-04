const { nyanql, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { newId } = require('../lib/ids');
const { requireField, assertTerminal } = require('../lib/validation');
const { audit } = require('../lib/audit');

module.exports = async function customerStaffCall(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.table_code, 'table_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== input.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });
  const session = first(await nyanql('GET', '/sessions/current', { table_code: input.table_code }));
  if (!session) throw Object.assign(new Error('session not found'), { status: 404 });
  const task = first(await nyanql('POST', '/hall/tasks', {
    id: newId('task'),
    task_type: 'staff_call',
    session_id: session.id,
    table_id: session.table_id,
    order_item_id: null,
    priority: 20,
    title: `${input.table_code} スタッフ呼び出し`,
    note: String(input.note || '')
  }));
  await audit({ actorType: 'terminal', actorId: terminal.id, action: 'customer.staff_call', targetType: 'hall_task', targetId: task.id, payload: { note: input.note || '' } });
  return ok({ task });
};
