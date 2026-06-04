const { nyanql, rows, first } = require('../lib/nyanql_client');
const { body, ok } = require('../lib/http');
const { newId, businessNo } = require('../lib/ids');
const { lineSubtotal, taxFor, totalize } = require('../lib/money');
const { requireField, assertTerminal, assertQuantity } = require('../lib/validation');
const { audit } = require('../lib/audit');

function buildMenu(rawRows) {
  const items = new Map();
  for (const row of rawRows) {
    if (!items.has(row.item_id)) {
      items.set(row.item_id, {
        id: row.item_id,
        name: row.item_name,
        price: Number(row.price),
        taxRate: Number(row.tax_rate),
        kitchenStation: row.kitchen_station,
        allergyNote: row.allergy_note,
        soldOut: Boolean(row.sold_out),
        options: new Map()
      });
    }
    const item = items.get(row.item_id);
    if (row.option_id && !item.options.has(row.option_id)) {
      item.options.set(row.option_id, {
        id: row.option_id,
        name: row.option_name,
        required: Boolean(row.required),
        multiSelect: Boolean(row.multi_select),
        choices: new Map()
      });
    }
    if (row.option_id && row.choice_id) {
      item.options.get(row.option_id).choices.set(row.choice_id, {
        id: row.choice_id,
        name: row.choice_name,
        priceDelta: Number(row.price_delta)
      });
    }
  }
  return items;
}

function validateChoices(item, selectedChoiceIds) {
  const choices = [];
  for (const option of item.options.values()) {
    const selected = selectedChoiceIds.filter((choiceId) => option.choices.has(choiceId));
    if (option.required && selected.length === 0) {
      throw Object.assign(new Error(`${item.name}: required option ${option.name} is missing`), { status: 400 });
    }
    if (!option.multiSelect && selected.length > 1) {
      throw Object.assign(new Error(`${item.name}: option ${option.name} allows one choice`), { status: 400 });
    }
    for (const choiceId of selected) {
      const choice = option.choices.get(choiceId);
      choices.push({
        optionId: option.id,
        optionName: option.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceDelta: choice.priceDelta
      });
    }
  }
  return choices;
}

module.exports = async function customerSubmitOrder(request) {
  const input = body(request);
  requireField(input.terminal_code, 'terminal_code');
  requireField(input.table_code, 'table_code');
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw Object.assign(new Error('items are required'), { status: 400 });
  }

  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: input.terminal_code }));
  assertTerminal(terminal, 'customer');
  if (terminal.table_code !== input.table_code) throw Object.assign(new Error('table mismatch'), { status: 403 });

  const session = first(await nyanql('GET', '/sessions/current', { table_code: input.table_code }));
  if (!session || !['seated', 'ordering'].includes(session.status)) {
    throw Object.assign(new Error('order is not allowed for this session'), { status: 409 });
  }

  const menu = buildMenu(rows(await nyanql('GET', '/menu')));
  const lines = input.items.map((cartItem) => {
    assertQuantity(cartItem.quantity);
    const menuItem = menu.get(cartItem.menu_item_id);
    if (!menuItem || menuItem.soldOut) {
      throw Object.assign(new Error(`menu item is unavailable: ${cartItem.menu_item_id}`), { status: 400 });
    }
    const selectedChoices = validateChoices(menuItem, cartItem.choice_ids || []);
    const subtotal = lineSubtotal({ ...menuItem, quantity: cartItem.quantity }, selectedChoices);
    return {
      menuItem,
      quantity: Number(cartItem.quantity),
      customerNote: String(cartItem.customer_note || ''),
      selectedChoices,
      subtotal,
      taxAmount: taxFor(subtotal, menuItem.taxRate)
    };
  });
  const totals = totalize(lines);
  const order = first(await nyanql('POST', '/orders', {
    id: newId('ord'),
    session_id: session.id,
    order_no: businessNo('ORD'),
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total_amount: totals.totalAmount
  }));

  for (const line of lines) {
    const orderItem = first(await nyanql('POST', '/order-items', {
      id: newId('oi'),
      order_id: order.id,
      menu_item_id: line.menuItem.id,
      item_name: line.menuItem.name,
      unit_price: line.menuItem.price,
      quantity: line.quantity,
      kitchen_station: line.menuItem.kitchenStation,
      allergy_note: line.menuItem.allergyNote,
      customer_note: line.customerNote
    }));
    for (const choice of line.selectedChoices) {
      await nyanql('POST', '/order-item-options', {
        id: newId('oio'),
        order_item_id: orderItem.id,
        option_name: choice.optionName,
        choice_name: choice.choiceName,
        price_delta: choice.priceDelta
      });
    }
  }

  await audit({
    actorType: 'terminal',
    actorId: terminal.id,
    action: 'customer.order.submit',
    targetType: 'order',
    targetId: order.id,
    payload: { tableCode: input.table_code, totals }
  });

  return ok({ orderNo: order.order_no, ...totals });
};
