var NYANQL_BASE_URL = "http://localhost:8890";
var NYANQL_USER = "nyanql";
var NYANQL_PASSWORD = "change-me";

function params() {
  return typeof nyanAllParams === "object" && nyanAllParams ? nyanAllParams : {};
}

function ok(data) {
  return { success: true, status: 200, result: data };
}

function error(status, message) {
  return { success: false, status: status, message: message, result: null };
}

function run(handler) {
  try {
    return JSON.stringify(handler());
  } catch (event) {
    if (event && event.success === false) return JSON.stringify(event);
    return JSON.stringify(error(500, event && event.message ? event.message : String(event)));
  }
}

function runText(handler) {
  try {
    return handler();
  } catch (event) {
    if (event && event.success === false) return JSON.stringify(event);
    return JSON.stringify(error(500, event && event.message ? event.message : String(event)));
  }
}

function requireField(value, name) {
  if (value === undefined || value === null || value === "") throw error(400, name + " is required");
}

function assertTerminal(terminal, expectedType) {
  if (!terminal || terminal.terminal_type !== expectedType) throw error(403, expectedType + " terminal is required");
  if (terminal.active === false) throw error(403, "この端末は無効です");
}

function assertAdminTerminal(input) {
  requireManager();
  requireField(input.terminal_code, "terminal_code");
  if (input.terminal_code !== "analytics-manager") throw error(403, "管理者端末ではありません");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  if (!terminal || terminal.terminal_type !== "analytics") throw error(403, "管理者端末ではありません");
  if (terminal.active === false) throw error(403, "管理者端末ではありません");
  return terminal;
}

function assertQuantity(quantity) {
  var number = Number(quantity);
  if (!Number.isInteger(number) || number < 1 || number > 99) throw error(400, "quantity must be 1-99");
}

function booleanValue(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return Boolean(value);
}

function integerValue(value, name, min) {
  var number = Number(value);
  if (!Number.isInteger(number) || (min !== undefined && number < min)) throw error(400, name + " must be an integer");
  return number;
}

function numberValue(value, name, min) {
  var number = Number(value);
  if (!Number.isFinite(number) || (min !== undefined && number < min)) throw error(400, name + " must be a number");
  return number;
}

function assertTransition(currentStatus, nextStatus, transitions) {
  var allowed = transitions[currentStatus] || [];
  if (allowed.indexOf(nextStatus) < 0) throw error(409, "invalid transition: " + currentStatus + " -> " + nextStatus);
}

function queryString(input) {
  var parts = [];
  input = input || {};
  Object.keys(input).forEach(function(key) {
    var value = input[key];
    if (value !== undefined && value !== null) parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

function nyanqlGet(apiName, input) {
  return unwrapNyanql(nyanGetAPI(NYANQL_BASE_URL + "/" + apiName + queryString(input || {}), NYANQL_USER, NYANQL_PASSWORD));
}

function nyanqlPost(apiName, input) {
  return unwrapNyanql(nyanJsonAPI(NYANQL_BASE_URL + "/" + apiName, JSON.stringify(input || {}), NYANQL_USER, NYANQL_PASSWORD));
}

function unwrapNyanql(response) {
  if (typeof response === "string") {
    response = response ? JSON.parse(response) : null;
  }
  if (response && response.success === false) throw error(response.status || 500, response.message || "NyanQL request failed");
  if (response && Object.prototype.hasOwnProperty.call(response, "result")) return response.result;
  if (response && Object.prototype.hasOwnProperty.call(response, "body")) return response.body;
  return response;
}

function rows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  if (result && Array.isArray(result.result)) return result.result;
  if (result === null || result === undefined) return [];
  if (typeof result === "object" && Object.keys(result).length === 0) return [];
  return [result];
}

function first(result) {
  return rows(result)[0] || null;
}

function newId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function businessNo(prefix) {
  var stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return prefix + "-" + stamp + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function lineSubtotal(item, selectedChoices) {
  var optionTotal = selectedChoices.reduce(function(sum, choice) { return sum + Number(choice.priceDelta || 0); }, 0);
  return (Number(item.price) + optionTotal) * Number(item.quantity);
}

function taxFor(subtotal, taxRate) {
  return Math.round(subtotal * (Number(taxRate) / 100));
}

function totalize(lines) {
  var subtotal = lines.reduce(function(sum, line) { return sum + line.subtotal; }, 0);
  var taxAmount = lines.reduce(function(sum, line) { return sum + line.taxAmount; }, 0);
  return { subtotal: subtotal, taxAmount: taxAmount, totalAmount: subtotal + taxAmount };
}

function audit(input) {
  return writeAuditLog({
    actorTerminalCode: input.actorTerminalCode || input.actorId || "",
    actorTerminalType: input.actorTerminalType || input.actorType || "",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel || "",
    status: input.status || "success",
    beforeData: input.beforeData || null,
    afterData: input.afterData || input.payload || null,
    requestData: input.requestData || {},
    errorMessage: input.errorMessage || ""
  });
}

function buildMenu(rawRows) {
  var items = {};
  rawRows.forEach(function(row) {
    if (!items[row.item_id]) {
      items[row.item_id] = {
        id: row.item_id,
        name: row.item_name,
        price: Number(row.price),
        taxRate: Number(row.tax_rate),
        kitchenStation: row.kitchen_station,
        allergyNote: row.allergy_note,
        soldOut: Boolean(row.sold_out),
        options: {}
      };
    }
    var item = items[row.item_id];
    if (row.option_id && !item.options[row.option_id]) {
      item.options[row.option_id] = {
        id: row.option_id,
        name: row.option_name,
        required: Boolean(row.required),
        multiSelect: Boolean(row.multi_select),
        minSelect: Number(row.min_select || 0),
        maxSelect: row.max_select === null || row.max_select === undefined ? null : Number(row.max_select),
        choices: {}
      };
    }
    if (row.option_id && row.choice_id) {
      item.options[row.option_id].choices[row.choice_id] = {
        id: row.choice_id,
        name: row.choice_name,
        priceDelta: Number(row.price_delta)
      };
    }
  });
  return items;
}

function validateChoices(item, selectedChoiceIds) {
  var choices = [];
  Object.keys(item.options).forEach(function(optionId) {
    var option = item.options[optionId];
    var selected = selectedChoiceIds.filter(function(choiceId) { return Boolean(option.choices[choiceId]); });
    var minSelect = option.required ? Math.max(1, Number(option.minSelect || 0)) : Number(option.minSelect || 0);
    var maxSelect = option.multiSelect ? option.maxSelect : 1;
    if (selected.length < minSelect) throw error(400, item.name + ": required option " + option.name + " is missing");
    if (maxSelect !== null && maxSelect !== undefined && selected.length > Number(maxSelect)) throw error(400, item.name + ": option " + option.name + " exceeds max selections");
    selected.forEach(function(choiceId) {
      var choice = option.choices[choiceId];
      choices.push({
        optionId: option.id,
        optionName: option.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceDelta: choice.priceDelta
      });
    });
  });
  return choices;
}

function customerMenu() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  var rawRows = rows(nyanqlGet("menu"));
  var categoriesById = {};
  rawRows.forEach(function(row) {
    if (!categoriesById[row.category_id]) {
      categoriesById[row.category_id] = { id: row.category_id, name: row.category_name, displayOrder: row.category_order, items: [] };
    }
    var category = categoriesById[row.category_id];
    var item = category.items.filter(function(candidate) { return candidate.id === row.item_id; })[0];
    if (!item) {
      item = {
        id: row.item_id,
        categoryId: row.category_id,
        name: row.item_name,
        description: row.description,
        price: Number(row.price),
        taxRate: Number(row.tax_rate),
        imageUrl: row.image_url,
        kitchenStation: row.kitchen_station,
        allergyNote: row.allergy_note,
        soldOut: Boolean(row.sold_out),
        options: []
      };
      category.items.push(item);
    }
    if (row.option_id) {
      var option = item.options.filter(function(candidate) { return candidate.id === row.option_id; })[0];
      if (!option) {
        option = {
          id: row.option_id,
          itemId: row.item_id,
          name: row.option_name,
          required: Boolean(row.required),
          multiSelect: Boolean(row.multi_select),
          minSelect: Number(row.min_select || 0),
          maxSelect: row.max_select === null || row.max_select === undefined ? null : Number(row.max_select),
          displayOrder: Number(row.option_order || 0),
          active: true,
          choices: []
        };
        item.options.push(option);
      }
      if (row.choice_id && option.choices.filter(function(choice) { return choice.id === row.choice_id; }).length === 0) {
        option.choices.push({ id: row.choice_id, optionId: row.option_id, name: row.choice_name, priceDelta: Number(row.price_delta), displayOrder: Number(row.choice_order || 0), active: true });
      }
    }
  });
  return ok({ categories: Object.keys(categoriesById).map(function(id) { return categoriesById[id]; }) });
}

function customerOpenSession() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  var current = first(nyanqlGet("sessions/current", { table_code: input.table_code }));
  if (current) return ok({ session: current });
  var session = first(nyanqlPost("sessions", { id: newId("sess"), table_code: input.table_code, guest_count: Number(input.guest_count || 1) }));
  if (!session) throw error(409, "table is not available");
  return ok({ session: session });
}

function customerCurrentSession() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  return ok({ session: first(nyanqlGet("sessions/current", { table_code: input.table_code })) });
}

function customerOrderHistory() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  requireField(input.session_id, "session_id");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  return ok({ items: rows(nyanqlGet("orders/history", { session_id: input.session_id })) });
}

function customerSubmitOrder() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  if (!Array.isArray(input.items) || input.items.length === 0) throw error(400, "items are required");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  var session = first(nyanqlGet("sessions/current", { table_code: input.table_code }));
  if (!session || ["seated", "ordering"].indexOf(session.status) < 0) throw error(409, "order is not allowed for this session");
  var menu = buildMenu(rows(nyanqlGet("menu")));
  var lines = input.items.map(function(cartItem) {
    assertQuantity(cartItem.quantity);
    var menuItem = menu[cartItem.menu_item_id];
    if (!menuItem || menuItem.soldOut) throw error(400, "menu item is unavailable: " + cartItem.menu_item_id);
    var selectedChoices = validateChoices(menuItem, cartItem.choice_ids || []);
    var subtotal = lineSubtotal({ price: menuItem.price, quantity: cartItem.quantity }, selectedChoices);
    return { menuItem: menuItem, quantity: Number(cartItem.quantity), customerNote: String(cartItem.customer_note || ""), selectedChoices: selectedChoices, subtotal: subtotal, taxAmount: taxFor(subtotal, menuItem.taxRate) };
  });
  var totals = totalize(lines);
  var order = first(nyanqlPost("orders", { id: newId("ord"), session_id: session.id, order_no: businessNo("ORD"), subtotal: totals.subtotal, tax_amount: totals.taxAmount, total_amount: totals.totalAmount }));
  lines.forEach(function(line) {
    var orderItem = first(nyanqlPost("order-items", { id: newId("oi"), order_id: order.id, menu_item_id: line.menuItem.id, item_name: line.menuItem.name, unit_price: line.menuItem.price, quantity: line.quantity, kitchen_station: line.menuItem.kitchenStation, allergy_note: line.menuItem.allergyNote, customer_note: line.customerNote }));
    line.selectedChoices.forEach(function(choice) {
      nyanqlPost("order-item-options", { id: newId("oio"), order_item_id: orderItem.id, option_name: choice.optionName, choice_name: choice.choiceName, price_delta: choice.priceDelta });
    });
  });
  writeAuditLog({
    actorTerminalCode: terminal.terminal_code,
    actorTerminalType: terminal.terminal_type,
    action: "customer_order_submitted",
    targetType: "order",
    targetId: order.id,
    targetLabel: order.order_no,
    status: "success",
    afterData: { orderNo: order.order_no, tableCode: input.table_code, totals: totals },
    requestData: { table_code: input.table_code, items: input.items }
  });
  return ok({ orderNo: order.order_no, subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount });
}

function customerRequestPayment() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  var session = first(nyanqlGet("sessions/current", { table_code: input.table_code }));
  if (!session) throw error(404, "session not found");
  var updated = first(nyanqlPost("sessions/payment-request", { session_id: session.id }));
  if (!updated) throw error(409, "payment request is not allowed for this session");
  writeAuditLog({
    actorTerminalCode: terminal.terminal_code,
    actorTerminalType: terminal.terminal_type,
    action: "customer_payment_requested",
    targetType: "session",
    targetId: session.id,
    targetLabel: input.table_code,
    status: "success",
    beforeData: { status: session.status },
    afterData: { status: updated.status, paymentRequestedAt: updated.payment_requested_at || null },
    requestData: { table_code: input.table_code }
  });
  return ok({ session: updated });
}

function customerStaffCall() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "customer");
  if (terminal.table_code !== input.table_code) throw error(403, "table mismatch");
  var session = first(nyanqlGet("sessions/current", { table_code: input.table_code }));
  if (!session) throw error(404, "session not found");
  var task = first(nyanqlPost("hall/tasks", { id: newId("task"), task_type: "staff_call", session_id: session.id, table_id: session.table_id, order_item_id: null, priority: 20, title: input.table_code + " スタッフ呼び出し", note: String(input.note || "") }));
  writeAuditLog({
    actorTerminalCode: terminal.terminal_code,
    actorTerminalType: terminal.terminal_type,
    action: "customer_staff_called",
    targetType: "hall_task",
    targetId: task.id,
    targetLabel: input.table_code,
    status: "success",
    afterData: { taskType: task.task_type, status: task.status, note: input.note || "" },
    requestData: { table_code: input.table_code, note: input.note || "" }
  });
  return ok({ task: task });
}

function kitchenTickets() {
  var input = params();
  requireRole(["kitchen", "manager"]);
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "kitchen");
  return ok({ tickets: rows(nyanqlGet("kitchen/tickets")) });
}

function kitchenUpdateItemStatus() {
  var input = params();
  requireRole(["kitchen", "manager"]);
  requireField(input.terminal_code, "terminal_code");
  requireField(input.order_item_id, "order_item_id");
  requireField(input.status, "status");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "kitchen");
  var transitions = { ordered: ["accepted", "cancelled"], accepted: ["cooking", "cancelled"], cooking: ["ready", "cancelled"] };
  var context = first(nyanqlGet("order-items/context", { order_item_id: input.order_item_id }));
  if (!context) throw error(404, "order item not found");
  assertTransition(context.status, input.status, transitions);
  var updated = first(nyanqlPost("order-items/status", { order_item_id: input.order_item_id, status: input.status }));
  if (!updated) throw error(404, "order item not found");
  var task = null;
  if (input.status === "ready") {
    task = first(nyanqlPost("hall/tasks", { id: newId("task"), task_type: "serve_item", session_id: context.session_id, table_id: context.table_id, order_item_id: input.order_item_id, priority: 10, title: context.table_code + " " + context.item_name + " 配膳", note: "" }));
  }
  audit({ actorType: "terminal", actorId: terminal.id, action: "kitchen.item.status", targetType: "order_item", targetId: input.order_item_id, payload: { status: input.status } });
  return ok({ item: updated, task: task });
}

function hallTasks() {
  var input = params();
  requireRole(["hall", "manager"]);
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "hall");
  return ok({ tasks: rows(nyanqlGet("hall/tasks/list")) });
}

function hallUpdateTaskStatus() {
  var input = params();
  requireRole(["hall", "manager"]);
  requireField(input.terminal_code, "terminal_code");
  requireField(input.task_id, "task_id");
  requireField(input.status, "status");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "hall");
  var transitions = { todo: ["doing", "done", "cancelled"], doing: ["done", "cancelled"] };
  var task = rows(nyanqlGet("hall/tasks/list")).filter(function(row) { return row.id === input.task_id; })[0];
  if (!task) throw error(404, "task not found or already closed");
  assertTransition(task.status, input.status, transitions);
  var updated = first(nyanqlPost("hall/tasks/status", { task_id: input.task_id, status: input.status, note: input.note || null, assigned_to: input.assigned_to || null }));
  if (!updated) throw error(404, "task not found");
  if (updated.task_type === "serve_item" && input.status === "done" && updated.order_item_id) {
    var served = first(nyanqlPost("order-items/status", { order_item_id: updated.order_item_id, status: "served" }));
    if (!served) throw error(409, "serve task completed but order item was not updated");
  }
  if (updated.task_type === "clean_table" && input.status === "done") {
    var cleaned = first(nyanqlPost("sessions/cleanup-complete", { session_id: updated.session_id }));
    if (!cleaned) throw error(409, "clean task completed but session was not closed");
  }
  audit({ actorType: "terminal", actorId: terminal.id, action: "hall.task.status", targetType: "hall_task", targetId: input.task_id, payload: { status: input.status, note: input.note || "" } });
  return ok({ task: updated });
}

function summarizeCheckout(rawRows) {
  var items = rawRows.map(function(row) {
    return { orderItemId: row.order_item_id, itemName: row.item_name, unitPrice: Number(row.unit_price), quantity: Number(row.quantity), status: row.item_status, optionTotal: Number(row.option_total || 0), optionsText: row.options_text || "", lineSubtotal: Number(row.line_subtotal || 0), lineTax: Number(row.line_tax || 0) };
  });
  var subtotal = items.reduce(function(sum, item) { return sum + item.lineSubtotal; }, 0);
  var taxAmount = items.reduce(function(sum, item) { return sum + item.lineTax; }, 0);
  return { sessionId: rawRows[0] ? rawRows[0].session_id : null, tableCode: rawRows[0] ? rawRows[0].table_code : null, tableName: rawRows[0] ? rawRows[0].table_name : null, sessionStatus: rawRows[0] ? rawRows[0].session_status : null, items: items, subtotal: subtotal, taxAmount: taxAmount, totalAmount: subtotal + taxAmount };
}

function checkoutSummary() {
  var input = params();
  requireRole(["cashier", "manager"]);
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "checkout");
  if (!first(nyanqlGet("tables/detail", { table_code: input.table_code }))) throw error(404, "table not found");
  return ok({ summary: summarizeCheckout(rows(nyanqlGet("checkout/summary", { table_code: input.table_code }))) });
}

function checkoutSettle() {
  var input = params();
  requireRole(["cashier", "manager"]);
  var rawRows = [];
  try {
    requireField(input.terminal_code, "terminal_code");
    requireField(input.table_code, "table_code");
    requireField(input.method, "method");
    if (["cash", "card", "qr"].indexOf(input.method) < 0) throw error(400, "invalid payment method");
    var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
    assertTerminal(terminal, "checkout");
    rawRows = rows(nyanqlGet("checkout/summary", { table_code: input.table_code }));
    if (rawRows.length === 0) throw error(404, "checkout target not found");
    if (rawRows[0].session_status !== "payment_requested") throw error(409, "payment has not been requested or is already settled");
    var subtotal = rawRows.reduce(function(sum, row) { return sum + Number(row.line_subtotal || 0); }, 0);
    var taxAmount = rawRows.reduce(function(sum, row) { return sum + Number(row.line_tax || 0); }, 0);
    var sessionId = rawRows[0].session_id;
    var payment = first(nyanqlPost("payments", { id: newId("pay"), session_id: sessionId, payment_no: businessNo("PAY"), method: input.method, subtotal: subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount }));
    var closed = first(nyanqlPost("sessions/close", { session_id: sessionId }));
    if (!closed) throw error(409, "session is already settled");
    nyanqlPost("hall/tasks", { id: newId("task"), task_type: "clean_table", session_id: sessionId, table_id: closed.table_id, order_item_id: null, priority: 30, title: input.table_code + " 片付け", note: "精算完了後の片付け" });
    writeAuditLog({
      actorTerminalCode: terminal.terminal_code,
      actorTerminalType: terminal.terminal_type,
      action: "checkout_settled",
      targetType: "payment",
      targetId: payment.id,
      targetLabel: payment.payment_no,
      status: "success",
      beforeData: { sessionId: sessionId, tableCode: input.table_code, sessionStatus: rawRows[0].session_status },
      afterData: { paymentNo: payment.payment_no, method: input.method, totalAmount: subtotal + taxAmount, sessionStatus: closed.status },
      requestData: { table_code: input.table_code, method: input.method }
    });
    return ok({ receiptNo: payment.payment_no, payment: payment });
  } catch (event) {
    auditFailure(input, "checkout_settle_rejected", "session", rawRows[0] ? rawRows[0].session_id : "", input.table_code || "", event, rawRows[0] || null);
    throw event;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function analyticsSummary() {
  var input = params();
  requireRole(["manager", "viewer"]);
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "analytics");
  return ok({ summary: first(nyanqlGet("analytics/summary", { from_date: input.from_date || today(), to_date: input.to_date || today() })) });
}

function analyticsItemRanking() {
  var input = params();
  requireRole(["manager", "viewer"]);
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "analytics");
  return ok({ items: rows(nyanqlGet("analytics/item-ranking", { from_date: input.from_date || today(), to_date: input.to_date || today(), limit: input.limit || 10 })) });
}

function analyticsExportSalesCsv() {
  var input = params();
  requireRole(["manager", "viewer"]);
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "analytics");
  var fromDate = input.from_date || today();
  var toDate = input.to_date || today();
  var salesRows = rows(nyanqlGet("analytics/sales-csv", { from_date: fromDate, to_date: toDate }));
  var lines = [["paid_date", "payment_no", "method", "table_code", "menu_item_id", "item_name", "quantity", "sales_total"]].concat(salesRows.map(function(item) {
    return [item.paid_date, item.payment_no, item.method, item.table_code, item.menu_item_id, item.item_name, item.quantity, item.sales_total];
  }));
  var csv = lines.map(function(line) {
    return line.map(function(value) {
      var text = String(value === undefined || value === null ? "" : value);
      return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }).join(",");
  }).join("\n");
  return ok({ contentType: "text/csv", filename: "sales-" + fromDate + "-" + toDate + ".csv", csv: csv });
}

function csvEscape(value) {
  var text = String(value === undefined || value === null ? "" : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function csvJson(value) {
  if (value === undefined || value === null || value === "") return "";
  var parsed = parseJsonValue(value, value);
  try {
    return JSON.stringify(sanitizeAuditValue(parsed));
  } catch (event) {
    return JSON.stringify({ serializationError: String(event) });
  }
}

function auditLogFilters(input) {
  return {
    from_date: input.from_date || "",
    to_date: input.to_date || "",
    action: input.action || "",
    target_type: input.target_type || "",
    target_label: input.target_label || "",
    actor_terminal_code: input.actor_terminal_code || "",
    actor_user_id: input.actor_user_id || "",
    actor_user_role: input.actor_user_role || "",
    status: input.status || "",
    keyword: input.keyword || ""
  };
}

function adminCategory(row) {
  return {
    id: row.id,
    name: row.name,
    displayOrder: Number(row.display_order),
    active: Boolean(row.active),
    itemCount: Number(row.item_count || 0),
    updatedAt: row.updated_at || null
  };
}

function adminMenuOption(row) {
  return {
    id: row.option_id,
    itemId: row.item_id,
    name: row.option_name,
    required: Boolean(row.required),
    multiSelect: Boolean(row.multi_select),
    minSelect: Number(row.min_select || 0),
    maxSelect: row.max_select === null || row.max_select === undefined ? null : Number(row.max_select),
    displayOrder: Number(row.option_order || 0),
    active: Boolean(row.option_active),
    updatedAt: row.option_updated_at || null,
    choices: []
  };
}

function adminMenuChoice(row) {
  return {
    id: row.choice_id,
    optionId: row.option_id,
    name: row.choice_name,
    priceDelta: Number(row.price_delta || 0),
    displayOrder: Number(row.choice_order || 0),
    active: Boolean(row.choice_active),
    updatedAt: row.choice_updated_at || null
  };
}

function buildAdminMenuOptions(rawRows) {
  var optionsById = {};
  rawRows.forEach(function(row) {
    if (!optionsById[row.option_id]) optionsById[row.option_id] = adminMenuOption(row);
    if (row.choice_id) optionsById[row.option_id].choices.push(adminMenuChoice(row));
  });
  return Object.keys(optionsById).map(function(id) { return optionsById[id]; });
}

function adminMenuItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description || "",
    price: Number(row.price),
    taxRate: Number(row.tax_rate),
    displayOrder: Number(row.display_order),
    active: Boolean(row.active),
    soldOut: Boolean(row.sold_out),
    allergyNote: row.allergy_note || "",
    updatedAt: row.updated_at
  };
}

function findAdminMenuItem(itemId) {
  return rows(nyanqlGet("admin/menu/items")).filter(function(row) { return (row.item_id || row.id) === itemId; })[0] || null;
}

function menuItemAuditId(row) {
  return row ? (row.item_id || row.id || "") : "";
}

function menuItemAuditName(row) {
  return row ? (row.item_name || row.name || "") : "";
}

function validateAdminMenuItemInput(input, requireId) {
  if (requireId) requireField(input.item_id, "item_id");
  requireField(input.name, "name");
  requireField(input.category_id, "category_id");
  var name = String(input.name).trim();
  if (!name) throw error(400, "商品名は必須です");
  return {
    item_id: input.item_id,
    category_id: String(input.category_id),
    name: name,
    description: String(input.description || ""),
    price: integerValue(input.price, "価格", 0),
    tax_rate: numberValue(input.tax_rate, "税率", 0),
    display_order: integerValue(input.display_order, "表示順"),
    active: booleanValue(input.active, true),
    sold_out: booleanValue(input.sold_out, false),
    allergy_note: String(input.allergy_note || "")
  };
}

function adminListMenuCategories() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ categories: rows(nyanqlGet("admin/menu/categories")).map(adminCategory) });
}

function findAdminMenuCategory(categoryId) {
  return rows(nyanqlGet("admin/menu/categories")).filter(function(row) { return row.id === categoryId; })[0] || null;
}

function validateAdminMenuCategoryInput(input, requireId) {
  if (requireId) requireField(input.category_id, "category_id");
  requireField(input.name, "name");
  var name = String(input.name).trim();
  if (!name) throw error(400, "カテゴリ名は必須です");
  return {
    category_id: input.category_id,
    name: name,
    display_order: integerValue(input.display_order, "表示順"),
    active: booleanValue(input.active, true)
  };
}

function adminCreateMenuCategory() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    var values = validateAdminMenuCategoryInput(input, false);
    values.id = newId("cat");
    var category = first(nyanqlPost("admin/menu/categories/create", values));
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_category_created", targetType: "menu_category", targetId: category.id, targetLabel: category.name, status: "success", afterData: category, requestData: input });
    return ok({ category: adminCategory(category) });
  } catch (event) {
    auditFailure(input, "admin_menu_category_created", "menu_category", "", input.name || "", event);
    throw event;
  }
}

function adminUpdateMenuCategory() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    var values = validateAdminMenuCategoryInput(input, true);
    before = findAdminMenuCategory(input.category_id);
    var category = first(nyanqlPost("admin/menu/categories/update", values));
    if (!category) throw error(404, "カテゴリが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_category_updated", targetType: "menu_category", targetId: category.id, targetLabel: category.name, status: "success", beforeData: before, afterData: category, requestData: input });
    return ok({ category: adminCategory(category) });
  } catch (event) {
    auditFailure(input, "admin_menu_category_updated", "menu_category", input.category_id || "", before ? before.name : "", event, before);
    throw event;
  }
}

function adminToggleMenuCategoryActive() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.category_id, "category_id");
    before = findAdminMenuCategory(input.category_id);
    var category = first(nyanqlPost("admin/menu/categories/toggle-active", { category_id: input.category_id, active: input.active === undefined ? null : booleanValue(input.active, false) }));
    if (!category) throw error(404, "カテゴリが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_category_active_changed", targetType: "menu_category", targetId: category.id, targetLabel: category.name, status: "success", beforeData: before, afterData: category, requestData: input });
    return ok({ category: adminCategory(category) });
  } catch (event) {
    auditFailure(input, "admin_menu_category_active_changed", "menu_category", input.category_id || "", before ? before.name : "", event, before);
    throw event;
  }
}

function adminMoveMenuCategory() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.category_id, "category_id");
    requireField(input.direction, "direction");
    if (["up", "down"].indexOf(input.direction) < 0) throw error(400, "direction must be up or down");
    before = findAdminMenuCategory(input.category_id);
    var category = first(nyanqlPost("admin/menu/categories/move", { category_id: input.category_id, direction: input.direction }));
    if (!category) throw error(404, "カテゴリが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_category_moved", targetType: "menu_category", targetId: category.id, targetLabel: category.name, status: "success", beforeData: before, afterData: category, requestData: input });
    return ok({ category: adminCategory(category) });
  } catch (event) {
    auditFailure(input, "admin_menu_category_moved", "menu_category", input.category_id || "", before ? before.name : "", event, before);
    throw event;
  }
}

function adminListMenuItems() {
  var input = params();
  assertAdminTerminal(input);
  var query = {
    category_id: input.category_id || "",
    keyword: input.keyword || "",
    active: input.active === undefined ? "" : input.active,
    sold_out: input.sold_out === undefined ? "" : input.sold_out
  };
  return ok({ items: rows(nyanqlGet("admin/menu/items", query)).map(adminMenuItem) });
}

function adminCreateMenuItem() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    var values = validateAdminMenuItemInput(input, false);
    values.id = newId("item");
    var item = first(nyanqlPost("admin/menu/items/create", values));
    if (!item) throw error(409, "商品を作成できませんでした");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_created", targetType: "menu_item", targetId: menuItemAuditId(item), targetLabel: menuItemAuditName(item), status: "success", afterData: item, requestData: input });
    return ok({ item: adminMenuItem(item) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_created", "menu_item", input.item_id || "", input.name || "", event);
    throw event;
  }
}

function adminUpdateMenuItem() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    var values = validateAdminMenuItemInput(input, true);
    before = findAdminMenuItem(input.item_id);
    var item = first(nyanqlPost("admin/menu/items/update", values));
    if (!item) throw error(404, "商品が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_updated", targetType: "menu_item", targetId: menuItemAuditId(item), targetLabel: menuItemAuditName(item), status: "success", beforeData: before, afterData: item, requestData: input });
    return ok({ item: adminMenuItem(item) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_updated", "menu_item", input.item_id || "", menuItemAuditName(before), event, before);
    throw event;
  }
}

function adminToggleMenuItemActive() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.item_id, "item_id");
    before = findAdminMenuItem(input.item_id);
    var item = first(nyanqlPost("admin/menu/items/toggle-active", {
      item_id: input.item_id,
      active: input.active === undefined ? null : booleanValue(input.active, false)
    }));
    if (!item) throw error(404, "商品が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_active_changed", targetType: "menu_item", targetId: menuItemAuditId(item), targetLabel: menuItemAuditName(item), status: "success", beforeData: before, afterData: item, requestData: input });
    return ok({ item: adminMenuItem(item) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_active_changed", "menu_item", input.item_id || "", menuItemAuditName(before), event, before);
    throw event;
  }
}

function adminToggleMenuItemSoldOut() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.item_id, "item_id");
    before = findAdminMenuItem(input.item_id);
    var item = first(nyanqlPost("admin/menu/items/toggle-sold-out", {
      item_id: input.item_id,
      sold_out: input.sold_out === undefined ? null : booleanValue(input.sold_out, false)
    }));
    if (!item) throw error(404, "商品が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_sold_out_changed", targetType: "menu_item", targetId: menuItemAuditId(item), targetLabel: menuItemAuditName(item), status: "success", beforeData: before, afterData: item, requestData: input });
    return ok({ item: adminMenuItem(item) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_sold_out_changed", "menu_item", input.item_id || "", menuItemAuditName(before), event, before);
    throw event;
  }
}

function adminMoveMenuItem() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.item_id, "item_id");
    requireField(input.direction, "direction");
    if (["up", "down"].indexOf(input.direction) < 0) throw error(400, "direction must be up or down");
    before = findAdminMenuItem(input.item_id);
    var item = first(nyanqlPost("admin/menu/items/move", { item_id: input.item_id, direction: input.direction }));
    if (!item) throw error(404, "商品が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_moved", targetType: "menu_item", targetId: menuItemAuditId(item), targetLabel: menuItemAuditName(item), status: "success", beforeData: before, afterData: item, requestData: input });
    return ok({ item: adminMenuItem(item) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_moved", "menu_item", input.item_id || "", menuItemAuditName(before), event, before);
    throw event;
  }
}

function findAdminMenuOption(optionId, itemId) {
  var found = null;
  rows(nyanqlGet("admin/menu/items/options", { item_id: itemId || "" })).some(function(row) {
    if (row.option_id === optionId) {
      found = row;
      return true;
    }
    return false;
  });
  if (found || itemId) return found;
  rows(nyanqlGet("admin/menu/items")).some(function(menuItem) {
    rows(nyanqlGet("admin/menu/items/options", { item_id: menuItem.item_id || menuItem.id })).some(function(row) {
      if (row.option_id === optionId) {
        found = row;
        return true;
      }
      return false;
    });
    return Boolean(found);
  });
  return found;
}

function findAdminMenuChoice(choiceId) {
  var found = null;
  rows(nyanqlGet("admin/menu/items")).some(function(menuItem) {
    rows(nyanqlGet("admin/menu/items/options", { item_id: menuItem.item_id || menuItem.id })).some(function(row) {
      if (row.choice_id === choiceId) {
        found = row;
        return true;
      }
      return false;
    });
    return Boolean(found);
  });
  return found;
}

function validateMenuOptionInput(input, requireId) {
  if (requireId) requireField(input.option_id, "option_id");
  requireField(input.item_id, "item_id");
  requireField(input.name, "name");
  var name = String(input.name).trim();
  if (!name) throw error(400, "オプション名は必須です");
  var required = booleanValue(input.required, false);
  var multiSelect = booleanValue(input.multi_select, false);
  var minSelect = input.min_select === undefined || input.min_select === "" ? (required ? 1 : 0) : integerValue(input.min_select, "最小選択数", 0);
  var maxSelect = input.max_select === undefined || input.max_select === "" || input.max_select === null ? null : integerValue(input.max_select, "最大選択数", 0);
  if (required && minSelect < 1) minSelect = 1;
  if (!multiSelect) maxSelect = 1;
  if (maxSelect !== null && maxSelect < minSelect) throw error(400, "最大選択数は最小選択数以上にしてください");
  return {
    option_id: input.option_id,
    item_id: String(input.item_id),
    name: name,
    required: required,
    multi_select: multiSelect,
    min_select: minSelect,
    max_select: maxSelect,
    active: booleanValue(input.active, true),
    display_order: integerValue(input.display_order, "表示順")
  };
}

function adminListMenuItemOptions() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.item_id, "item_id");
  return ok({ options: buildAdminMenuOptions(rows(nyanqlGet("admin/menu/items/options", { item_id: input.item_id }))) });
}

function adminCreateMenuItemOption() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    var values = validateMenuOptionInput(input, false);
    values.id = newId("opt");
    var option = first(nyanqlPost("admin/menu/items/options/create", values));
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_option_created", targetType: "menu_item_option", targetId: option.option_id, targetLabel: option.option_name, status: "success", afterData: option, requestData: input });
    return ok({ option: adminMenuOption(option) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_option_created", "menu_item_option", "", input.name || "", event);
    throw event;
  }
}

function adminUpdateMenuItemOption() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    var values = validateMenuOptionInput(input, true);
    before = findAdminMenuOption(input.option_id, input.item_id);
    var option = first(nyanqlPost("admin/menu/items/options/update", values));
    if (!option) throw error(404, "オプションが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_option_updated", targetType: "menu_item_option", targetId: option.option_id, targetLabel: option.option_name, status: "success", beforeData: before, afterData: option, requestData: input });
    return ok({ option: adminMenuOption(option) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_option_updated", "menu_item_option", input.option_id || "", before ? before.option_name : "", event, before);
    throw event;
  }
}

function adminToggleMenuItemOptionActive() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.option_id, "option_id");
    before = findAdminMenuOption(input.option_id, input.item_id || "");
    var option = first(nyanqlPost("admin/menu/items/options/toggle-active", { option_id: input.option_id, active: input.active === undefined ? null : booleanValue(input.active, false) }));
    if (!option) throw error(404, "オプションが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_option_active_changed", targetType: "menu_item_option", targetId: option.option_id, targetLabel: option.option_name, status: "success", beforeData: before, afterData: option, requestData: input });
    return ok({ option: adminMenuOption(option) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_option_active_changed", "menu_item_option", input.option_id || "", before ? before.option_name : "", event, before);
    throw event;
  }
}

function adminMoveMenuItemOption() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.option_id, "option_id");
    requireField(input.direction, "direction");
    if (["up", "down"].indexOf(input.direction) < 0) throw error(400, "direction must be up or down");
    before = findAdminMenuOption(input.option_id, input.item_id || "");
    var option = first(nyanqlPost("admin/menu/items/options/move", { option_id: input.option_id, direction: input.direction }));
    if (!option) throw error(404, "オプションが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_item_option_moved", targetType: "menu_item_option", targetId: option.option_id, targetLabel: option.option_name, status: "success", beforeData: before, afterData: option, requestData: input });
    return ok({ option: adminMenuOption(option) });
  } catch (event) {
    auditFailure(input, "admin_menu_item_option_moved", "menu_item_option", input.option_id || "", before ? before.option_name : "", event, before);
    throw event;
  }
}

function validateMenuChoiceInput(input, requireId) {
  if (requireId) requireField(input.choice_id, "choice_id");
  requireField(input.option_id, "option_id");
  requireField(input.name, "name");
  var name = String(input.name).trim();
  if (!name) throw error(400, "選択肢名は必須です");
  return {
    choice_id: input.choice_id,
    option_id: String(input.option_id),
    name: name,
    price_delta: integerValue(input.price_delta, "追加料金", 0),
    active: booleanValue(input.active, true),
    display_order: integerValue(input.display_order, "表示順")
  };
}

function adminCreateMenuOptionChoice() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    var values = validateMenuChoiceInput(input, false);
    values.id = newId("choice");
    var choice = first(nyanqlPost("admin/menu/items/options/choices/create", values));
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_option_choice_created", targetType: "menu_option_choice", targetId: choice.choice_id, targetLabel: choice.choice_name, status: "success", afterData: choice, requestData: input });
    return ok({ choice: adminMenuChoice(choice) });
  } catch (event) {
    auditFailure(input, "admin_menu_option_choice_created", "menu_option_choice", "", input.name || "", event);
    throw event;
  }
}

function adminUpdateMenuOptionChoice() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    var values = validateMenuChoiceInput(input, true);
    before = findAdminMenuChoice(input.choice_id);
    var choice = first(nyanqlPost("admin/menu/items/options/choices/update", values));
    if (!choice) throw error(404, "選択肢が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_option_choice_updated", targetType: "menu_option_choice", targetId: choice.choice_id, targetLabel: choice.choice_name, status: "success", beforeData: before, afterData: choice, requestData: input });
    return ok({ choice: adminMenuChoice(choice) });
  } catch (event) {
    auditFailure(input, "admin_menu_option_choice_updated", "menu_option_choice", input.choice_id || "", before ? before.choice_name : "", event, before);
    throw event;
  }
}

function adminToggleMenuOptionChoiceActive() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.choice_id, "choice_id");
    before = findAdminMenuChoice(input.choice_id);
    var choice = first(nyanqlPost("admin/menu/items/options/choices/toggle-active", { choice_id: input.choice_id, active: input.active === undefined ? null : booleanValue(input.active, false) }));
    if (!choice) throw error(404, "選択肢が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_option_choice_active_changed", targetType: "menu_option_choice", targetId: choice.choice_id, targetLabel: choice.choice_name, status: "success", beforeData: before, afterData: choice, requestData: input });
    return ok({ choice: adminMenuChoice(choice) });
  } catch (event) {
    auditFailure(input, "admin_menu_option_choice_active_changed", "menu_option_choice", input.choice_id || "", before ? before.choice_name : "", event, before);
    throw event;
  }
}

function adminMoveMenuOptionChoice() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.choice_id, "choice_id");
    requireField(input.direction, "direction");
    if (["up", "down"].indexOf(input.direction) < 0) throw error(400, "direction must be up or down");
    before = findAdminMenuChoice(input.choice_id);
    var choice = first(nyanqlPost("admin/menu/items/options/choices/move", { choice_id: input.choice_id, direction: input.direction }));
    if (!choice) throw error(404, "選択肢が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_menu_option_choice_moved", targetType: "menu_option_choice", targetId: choice.choice_id, targetLabel: choice.choice_name, status: "success", beforeData: before, afterData: choice, requestData: input });
    return ok({ choice: adminMenuChoice(choice) });
  } catch (event) {
    auditFailure(input, "admin_menu_option_choice_moved", "menu_option_choice", input.choice_id || "", before ? before.choice_name : "", event, before);
    throw event;
  }
}

function parseJsonValue(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (event) {
    return fallback;
  }
}

function adminTable(row) {
  return {
    tableId: row.table_id,
    tableCode: row.table_code,
    tableName: row.table_name,
    status: row.status,
    customerTerminalCode: row.customer_terminal_code || null,
    currentSessionId: row.current_session_id || null,
    sessionStatus: row.session_status || null,
    orderCount: Number(row.order_count || 0),
    unpaidOrderCount: Number(row.unpaid_order_count || 0),
    unservedItemCount: Number(row.unserved_item_count || 0),
    openTaskCount: Number(row.open_task_count || 0),
    updatedAt: row.updated_at || null
  };
}

function adminTableDetail(row) {
  var base = adminTable(row);
  base.sessionOpenedAt = row.session_opened_at || null;
  base.paymentRequestedAt = row.payment_requested_at || null;
  base.closedAt = row.closed_at || null;
  base.orders = parseJsonValue(row.orders, []);
  base.orderItems = parseJsonValue(row.order_items, []);
  base.payments = parseJsonValue(row.payments, []);
  base.hallTasks = parseJsonValue(row.hall_tasks, []);
  return base;
}

function adminTerminal(row) {
  return {
    terminalId: row.terminal_id,
    terminalCode: row.terminal_code,
    terminalType: row.terminal_type,
    tableCode: row.table_code || null,
    active: Boolean(row.active),
    description: row.description || null,
    updatedAt: row.updated_at || null
  };
}

function adminUser(row) {
  return {
    id: row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

function validateRole(role) {
  if (["manager", "cashier", "kitchen", "hall", "viewer"].indexOf(role) < 0) throw error(400, "invalid role");
  return role;
}

function adminListUsers() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ users: rows(nyanqlGet("admin/users", { keyword: input.keyword || "" })).map(adminUser) });
}

function activeManagerCount() {
  return rows(nyanqlGet("admin/users")).filter(function(user) {
    return user.role === "manager" && Boolean(user.active);
  }).length;
}

function findAdminUser(userId) {
  return rows(nyanqlGet("admin/users")).filter(function(user) { return user.id === userId; })[0] || null;
}

function adminCreateUser() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.login_id, "login_id");
    requireField(input.display_name, "display_name");
    requireField(input.password, "password");
    requireField(input.role, "role");
    var nextPasswordHash = hashPassword(input.password);
    var user = first(nyanqlPost("admin/users/create", {
      id: newId("user"),
      login_id: String(input.login_id).trim(),
      display_name: String(input.display_name).trim(),
      password_hash: nextPasswordHash,
      password_hash_version: passwordHashVersion(nextPasswordHash),
      role: validateRole(input.role),
      active: booleanValue(input.active, true)
    }));
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_user_created", targetType: "user", targetId: user.id, targetLabel: user.login_id, status: "success", afterData: user, requestData: { login_id: input.login_id, display_name: input.display_name, role: input.role, active: input.active } });
    return ok({ user: adminUser(user) });
  } catch (event) {
    auditFailure(input, "admin_user_created", "user", "", input.login_id || "", event);
    throw event;
  }
}

function adminUpdateUser() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    var currentUser = requireManager();
    requireField(input.id, "id");
    requireField(input.display_name, "display_name");
    requireField(input.role, "role");
    var before = findAdminUser(input.id);
    if (!before) throw error(404, "ユーザーが見つかりません");
    var nextRole = validateRole(input.role);
    if (input.id === currentUser.id && nextRole !== "manager") throw error(409, "自分自身の manager 権限は変更できません");
    if (before.role === "manager" && Boolean(before.active) && nextRole !== "manager" && activeManagerCount() <= 1) {
      throw error(409, "最後の active manager は変更できません");
    }
    var nextPasswordHash = input.password ? hashPassword(input.password) : "";
    var user = first(nyanqlPost("admin/users/update", {
      id: input.id,
      display_name: String(input.display_name).trim(),
      password_hash: nextPasswordHash,
      password_hash_version: passwordHashVersion(nextPasswordHash),
      role: nextRole
    }));
    if (!user) throw error(404, "ユーザーが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_user_updated", targetType: "user", targetId: user.id, targetLabel: user.login_id, status: "success", afterData: user, requestData: { id: input.id, display_name: input.display_name, role: input.role, passwordUpdated: Boolean(input.password) } });
    return ok({ user: adminUser(user) });
  } catch (event) {
    auditFailure(input, "admin_user_updated", "user", input.id || "", "", event);
    throw event;
  }
}

function adminToggleUserActive() {
  var input = params();
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.id, "id");
    var before = findAdminUser(input.id);
    if (!before) throw error(404, "ユーザーが見つかりません");
    var nextActive = booleanValue(input.active, true);
    if (before.role === "manager" && Boolean(before.active) && nextActive === false && activeManagerCount() <= 1) {
      throw error(409, "最後の active manager は無効化できません");
    }
    var user = first(nyanqlPost("admin/users/toggle-active", { id: input.id, active: nextActive }));
    if (!user) throw error(404, "ユーザーが見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_user_active_changed", targetType: "user", targetId: user.id, targetLabel: user.login_id, status: "success", afterData: user, requestData: { id: input.id, active: input.active } });
    return ok({ user: adminUser(user) });
  } catch (event) {
    auditFailure(input, "admin_user_active_changed", "user", input.id || "", "", event);
    throw event;
  }
}

function adminListTables() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ tables: rows(nyanqlGet("admin/tables", { status: input.status || "", keyword: input.keyword || "" })).map(adminTable) });
}

function adminGetTableDetail() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.table_code, "table_code");
  var detail = first(nyanqlGet("admin/tables/detail", { table_code: input.table_code }));
  if (!detail) throw error(404, "席が見つかりません");
  return ok({ table: adminTableDetail(detail) });
}

function adminUpdateTableStatus() {
  var input = params();
  var detail = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.table_code, "table_code");
    requireField(input.status, "status");
    if (["available", "disabled"].indexOf(input.status) < 0) throw error(400, "status must be available or disabled");
    detail = first(nyanqlGet("admin/tables/detail", { table_code: input.table_code }));
    if (!detail) throw error(404, "席が見つかりません");
    if (input.status === "available" && detail.current_session_id) {
      if (Number(detail.unpaid_order_count || 0) > 0 || Number(detail.unserved_item_count || 0) > 0) {
        throw error(409, "未精算または未提供の注文があるため空席にできません");
      }
      var closed = first(nyanqlPost("admin/tables/force-close-session", { session_id: detail.current_session_id }));
      if (!closed) throw error(409, "セッションをクローズできませんでした");
      writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_table_status_changed", targetType: "table", targetId: closed.table_id, targetLabel: closed.table_code, status: "success", beforeData: detail, afterData: closed, requestData: input });
      return ok({ table: closed });
    }
    var table = first(nyanqlPost("admin/tables/status", { table_code: input.table_code, status: input.status }));
    if (!table) throw error(404, "席が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_table_status_changed", targetType: "table", targetId: table.table_id, targetLabel: table.table_code, status: "success", beforeData: detail, afterData: table, requestData: input });
    return ok({ table: table });
  } catch (event) {
    auditFailure(input, "admin_table_status_changed", "table", detail ? detail.table_id : "", input.table_code || "", event, detail);
    throw event;
  }
}

function adminForceCloseSession() {
  var input = params();
  var target = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.session_id, "session_id");
    target = rows(nyanqlGet("admin/tables")).filter(function(table) { return table.current_session_id === input.session_id; })[0];
    if (!target) throw error(404, "セッションが見つかりません");
    if (Number(target.unpaid_order_count || 0) > 0 || Number(target.unserved_item_count || 0) > 0) {
      throw error(409, "未精算または未提供の注文があるため強制クローズできません");
    }
    var closed = first(nyanqlPost("admin/tables/force-close-session", { session_id: input.session_id }));
    if (!closed) throw error(409, "セッションを強制クローズできませんでした");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_session_force_closed", targetType: "session", targetId: input.session_id, targetLabel: closed.table_code, status: "success", beforeData: target, afterData: closed, requestData: input });
    return ok({ session: closed });
  } catch (event) {
    auditFailure(input, "admin_session_force_closed", "session", input.session_id || "", target ? target.table_code : "", event, target);
    throw event;
  }
}

function adminListTerminals() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ terminals: rows(nyanqlGet("admin/terminals", { keyword: input.keyword || "" })).map(adminTerminal) });
}

function adminUpdateTerminalActive() {
  var input = params();
  var before = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.target_terminal_code, "target_terminal_code");
    if (input.target_terminal_code === "analytics-manager") throw error(409, "analytics-manager は無効化できません");
    before = rows(nyanqlGet("admin/terminals", { keyword: input.target_terminal_code })).filter(function(row) { return row.terminal_code === input.target_terminal_code; })[0] || null;
    var terminal = first(nyanqlPost("admin/terminals/active", {
      terminal_code: input.target_terminal_code,
      active: booleanValue(input.active, true)
    }));
    if (!terminal) throw error(404, "端末が見つかりません");
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_terminal_active_changed", targetType: "terminal", targetId: terminal.terminal_id, targetLabel: terminal.terminal_code, status: "success", beforeData: before, afterData: terminal, requestData: input });
    return ok({ terminal: adminTerminal(terminal) });
  } catch (event) {
    auditFailure(input, "admin_terminal_active_changed", "terminal", input.target_terminal_code || "", input.target_terminal_code || "", event, before);
    throw event;
  }
}

function adminOrder(row) {
  return {
    orderId: row.order_id,
    orderNo: row.order_no,
    sessionId: row.session_id,
    tableCode: row.table_code,
    tableName: row.table_name,
    orderStatus: row.order_status,
    itemCount: Number(row.item_count || 0),
    cancelledItemCount: Number(row.cancelled_item_count || 0),
    unservedItemCount: Number(row.unserved_item_count || 0),
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    paymentStatus: row.payment_status || null,
    paymentMethod: row.payment_method || null,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at || null
  };
}

function adminOrderDetail(row) {
  var base = adminOrder(row);
  base.sessionStatus = row.session_status || null;
  base.sessionOpenedAt = row.session_opened_at || null;
  base.paymentRequestedAt = row.payment_requested_at || null;
  base.closedAt = row.closed_at || null;
  base.items = parseJsonValue(row.items, []);
  base.payments = parseJsonValue(row.payments, []);
  base.hallTasks = parseJsonValue(row.hall_tasks, []);
  return base;
}

function adminAuditLog(row) {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorTerminalCode: row.actor_terminal_code || null,
    actorTerminalType: row.actor_terminal_type || null,
    actorUserId: row.actor_user_id || null,
    actorUserDisplayName: row.actor_user_display_name || null,
    actorUserRole: row.actor_user_role || null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id || null,
    targetLabel: row.target_label || null,
    status: row.status,
    errorMessage: row.error_message || null
  };
}

function adminAuditLogDetail(row) {
  var base = adminAuditLog(row);
  base.beforeData = parseJsonValue(row.before_data, null);
  base.afterData = parseJsonValue(row.after_data, null);
  base.requestData = parseJsonValue(row.request_data, null);
  base.createdAt = row.created_at;
  return base;
}

function isPaidOrder(detail) {
  if (!detail) return false;
  if (detail.paymentStatus === "paid") return true;
  return (detail.payments || []).some(function(payment) { return payment.status === "paid"; });
}

function getAdminOrderDetail(orderId) {
  var detail = first(nyanqlGet("admin/orders/detail", { order_id: orderId }));
  if (!detail) throw error(404, "注文が見つかりません");
  return adminOrderDetail(detail);
}

function adminListOrders() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ orders: rows(nyanqlGet("admin/orders", {
    from_date: input.from_date || "",
    to_date: input.to_date || "",
    table_code: input.table_code || "",
    order_no: input.order_no || "",
    order_status: input.order_status || "",
    payment_status: input.payment_status || ""
  })).map(adminOrder) });
}

function adminListAuditLogs() {
  var input = params();
  assertAdminTerminal(input);
  return ok({ logs: rows(nyanqlGet("admin/audit-logs", auditLogFilters(input))).map(adminAuditLog) });
}

function adminGetAuditLogDetail() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.id, "id");
  var detail = first(nyanqlGet("admin/audit-logs/detail", { id: input.id }));
  if (!detail) throw error(404, "監査ログが見つかりません");
  return ok({ log: adminAuditLogDetail(detail) });
}

function adminExportAuditLogsCsv() {
  var input = params();
  var actor = assertAdminTerminal(input);
  var filters = auditLogFilters(input);
  var exportRows = rows(nyanqlGet("admin/audit-logs/export", filters));
  var header = [
    "occurred_at",
    "status",
    "action",
    "actor_user_id",
    "actor_user_display_name",
    "actor_user_role",
    "actor_terminal_code",
    "actor_terminal_type",
    "target_type",
    "target_id",
    "target_label",
    "error_message",
    "request_data",
    "before_data",
    "after_data"
  ];
  var lines = [header].concat(exportRows.map(function(row) {
    return [
      row.occurred_at,
      row.status,
      row.action,
      row.actor_user_id,
      row.actor_user_display_name,
      row.actor_user_role,
      row.actor_terminal_code,
      row.actor_terminal_type,
      row.target_type,
      row.target_id,
      row.target_label,
      row.error_message,
      csvJson(row.request_data),
      csvJson(row.before_data),
      csvJson(row.after_data)
    ];
  }));
  var csv = lines.map(function(line) {
    return line.map(csvEscape).join(",");
  }).join("\n");
  writeAuditLog({
    actorTerminalCode: actor.terminal_code,
    actorTerminalType: actor.terminal_type,
    action: "admin_audit_logs_exported",
    targetType: "audit_log",
    targetId: "",
    targetLabel: "audit_logs_csv",
    status: "success",
    afterData: { row_count: exportRows.length, filters: filters },
    requestData: filters
  });
  var fromDate = filters.from_date || today();
  var toDate = filters.to_date || today();
  return ok({ contentType: "text/csv; charset=utf-8", filename: "audit-logs-" + fromDate + "-" + toDate + ".csv", csv: csv });
}

function adminGetOrderDetail() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.order_id, "order_id");
  return ok({ order: getAdminOrderDetail(input.order_id) });
}

function adminCancelOrderItem() {
  var input = params();
  var detail = null;
  var context = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.order_item_id, "order_item_id");
    context = first(nyanqlGet("order-items/context", { order_item_id: input.order_item_id }));
    if (!context) throw error(404, "注文明細が見つかりません");
    detail = getAdminOrderDetail(context.order_id);
    if (isPaidOrder(detail)) throw error(409, "精算済み注文はキャンセルできません");
    var item = (detail.items || []).filter(function(row) { return row.orderItemId === input.order_item_id; })[0];
    if (!item) throw error(404, "注文明細が見つかりません");
    if (!item.canCancel) throw error(409, "この明細はキャンセルできません");
    var updated = first(nyanqlPost("admin/orders/cancel-item", {
      order_item_id: input.order_item_id,
      cancel_note: input.cancel_note || ""
    }));
    if (!updated) throw error(409, "注文明細をキャンセルできませんでした");
    var after = getAdminOrderDetail(context.order_id);
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_order_item_cancelled", targetType: "order_item", targetId: input.order_item_id, targetLabel: detail.orderNo, status: "success", beforeData: { order: detail, item: item }, afterData: { order: after, cancelledItem: updated }, requestData: input });
    return ok({ order: after });
  } catch (event) {
    auditFailure(input, "admin_order_item_cancelled", "order_item", input.order_item_id || "", detail ? detail.orderNo : "", event, detail);
    throw event;
  }
}

function adminCancelOrder() {
  var input = params();
  var detail = null;
  try {
    var actor = assertAdminTerminal(input);
    requireField(input.order_id, "order_id");
    detail = getAdminOrderDetail(input.order_id);
    if (isPaidOrder(detail)) throw error(409, "精算済み注文はキャンセルできません");
    if (detail.orderStatus === "cancelled") throw error(409, "注文はすでにキャンセル済みです");
    if ((detail.items || []).some(function(item) { return item.status === "ready" || item.status === "served"; })) {
      throw error(409, "提供準備済みまたは提供済み明細があるため注文全体をキャンセルできません");
    }
    if ((detail.items || []).length === 0 || (detail.items || []).every(function(item) { return item.status === "cancelled"; })) {
      throw error(409, "注文はすでにキャンセル済みです");
    }
    var updated = first(nyanqlPost("admin/orders/cancel-order", {
      order_id: input.order_id,
      cancel_note: input.cancel_note || ""
    }));
    if (!updated) throw error(409, "注文をキャンセルできませんでした");
    var after = getAdminOrderDetail(input.order_id);
    writeAuditLog({ actorTerminalCode: actor.terminal_code, actorTerminalType: actor.terminal_type, action: "admin_order_cancelled", targetType: "order", targetId: input.order_id, targetLabel: detail.orderNo, status: "success", beforeData: detail, afterData: after, requestData: input });
    return ok({ order: after });
  } catch (event) {
    auditFailure(input, "admin_order_cancelled", "order", input.order_id || "", detail ? detail.orderNo : "", event, detail);
    throw event;
  }
}

function bootstrap() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  if (!terminal) throw error(404, "terminal not found");
  return ok({ terminal: terminal });
}
