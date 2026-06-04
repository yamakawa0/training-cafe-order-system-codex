const { nyanql, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { requireField, assertTerminal, assertTransition } = require('../lib/validation');
const { audit } = require('../lib/audit');

const transitions = {
  todo: ['doing', 'done', 'cancelled'],
  doing: ['done', 'cancelled']
};

module.exports = async function hallUpdateTaskStatus(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.task_id, 'task_id');
  requireField(input.status, 'status');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'hall');
  const tasks = await nyanql('GET', '/hall/tasks');
  const task = (Array.isArray(tasks) ? tasks : tasks.rows || tasks.data || []).find((row) => row.id === input.task_id);
  if (!task) throw Object.assign(new Error('task not found or already closed'), { status: 404 });
  assertTransition(task.status, input.status, transitions);
  const updated = first(await nyanql('POST', '/hall/tasks/status', {
    task_id: input.task_id,
    status: input.status,
    note: input.note || null,
    assigned_to: input.assigned_to || null
  }));
  if (updated.task_type === 'serve_item' && input.status === 'done' && updated.order_item_id) {
    await nyanql('POST', '/order-items/status', {
      order_item_id: updated.order_item_id,
      status: 'served'
    });
  }
  if (updated.task_type === 'clean_table' && input.status === 'done') {
    await nyanql('POST', '/sessions/cleanup-complete', {
      session_id: updated.session_id
    });
  }
  await audit({ actorType: 'terminal', actorId: terminal.id, action: 'hall.task.status', targetType: 'hall_task', targetId: input.task_id, payload: { status: input.status, note: input.note || '' } });
  return ok({ task: updated });
};
