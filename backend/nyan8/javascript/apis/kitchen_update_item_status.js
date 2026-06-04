const { nyanql, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { newId } = require('../lib/ids');
const { requireField, assertTerminal, assertTransition } = require('../lib/validation');
const { audit } = require('../lib/audit');

const transitions = {
  ordered: ['accepted', 'cancelled'],
  accepted: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled']
};

module.exports = async function kitchenUpdateItemStatus(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.order_item_id, 'order_item_id');
  requireField(input.status, 'status');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'kitchen');
  const context = first(await nyanql('GET', '/order-items/context', { order_item_id: input.order_item_id }));
  if (!context) throw Object.assign(new Error('order item not found'), { status: 404 });
  assertTransition(context.status, input.status, transitions);
  const updated = first(await nyanql('POST', '/order-items/status', {
    order_item_id: input.order_item_id,
    status: input.status
  }));
  let task = null;
  if (input.status === 'ready') {
    task = first(await nyanql('POST', '/hall/tasks', {
      id: newId('task'),
      task_type: 'serve_item',
      session_id: context.session_id,
      table_id: context.table_id,
      order_item_id: input.order_item_id,
      priority: 10,
      title: `${context.table_code} ${context.item_name} 配膳`,
      note: ''
    }));
  }
  await audit({ actorType: 'terminal', actorId: terminal.id, action: 'kitchen.item.status', targetType: 'order_item', targetId: input.order_item_id, payload: { status: input.status } });
  return ok({ item: updated, task });
};
