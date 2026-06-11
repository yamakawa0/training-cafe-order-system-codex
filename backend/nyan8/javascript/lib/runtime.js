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
}

function assertAdminTerminal(input) {
  requireField(input.terminal_code, "terminal_code");
  if (input.terminal_code !== "analytics-manager") throw error(403, "管理者端末ではありません");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  if (!terminal || terminal.terminal_type !== "analytics") throw error(403, "管理者端末ではありません");
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
  return nyanqlPost("audit-logs", {
    id: newId("audit"),
    actor_type: input.actorType,
    actor_id: input.actorId || "",
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    payload: JSON.stringify(input.payload || {})
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
    if (option.required && selected.length === 0) throw error(400, item.name + ": required option " + option.name + " is missing");
    if (!option.multiSelect && selected.length > 1) throw error(400, item.name + ": option " + option.name + " allows one choice");
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
        option = { id: row.option_id, name: row.option_name, required: Boolean(row.required), multiSelect: Boolean(row.multi_select), choices: [] };
        item.options.push(option);
      }
      if (row.choice_id && option.choices.filter(function(choice) { return choice.id === row.choice_id; }).length === 0) {
        option.choices.push({ id: row.choice_id, name: row.choice_name, priceDelta: Number(row.price_delta) });
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
  audit({ actorType: "terminal", actorId: terminal.id, action: "customer.order.submit", targetType: "order", targetId: order.id, payload: { tableCode: input.table_code, totals: totals } });
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
  audit({ actorType: "terminal", actorId: terminal.id, action: "customer.payment.request", targetType: "session", targetId: session.id, payload: {} });
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
  audit({ actorType: "terminal", actorId: terminal.id, action: "customer.staff_call", targetType: "hall_task", targetId: task.id, payload: { note: input.note || "" } });
  return ok({ task: task });
}

function kitchenTickets() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "kitchen");
  return ok({ tickets: rows(nyanqlGet("kitchen/tickets")) });
}

function kitchenUpdateItemStatus() {
  var input = params();
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
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "hall");
  return ok({ tasks: rows(nyanqlGet("hall/tasks/list")) });
}

function hallUpdateTaskStatus() {
  var input = params();
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
    return { orderItemId: row.order_item_id, itemName: row.item_name, unitPrice: Number(row.unit_price), quantity: Number(row.quantity), status: row.item_status, optionTotal: Number(row.option_total || 0), lineSubtotal: Number(row.line_subtotal || 0), lineTax: Number(row.line_tax || 0) };
  });
  var subtotal = items.reduce(function(sum, item) { return sum + item.lineSubtotal; }, 0);
  var taxAmount = items.reduce(function(sum, item) { return sum + item.lineTax; }, 0);
  return { sessionId: rawRows[0] ? rawRows[0].session_id : null, tableCode: rawRows[0] ? rawRows[0].table_code : null, tableName: rawRows[0] ? rawRows[0].table_name : null, sessionStatus: rawRows[0] ? rawRows[0].session_status : null, items: items, subtotal: subtotal, taxAmount: taxAmount, totalAmount: subtotal + taxAmount };
}

function checkoutSummary() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "checkout");
  if (!first(nyanqlGet("tables/detail", { table_code: input.table_code }))) throw error(404, "table not found");
  return ok({ summary: summarizeCheckout(rows(nyanqlGet("checkout/summary", { table_code: input.table_code }))) });
}

function checkoutSettle() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  requireField(input.table_code, "table_code");
  requireField(input.method, "method");
  if (["cash", "card", "qr"].indexOf(input.method) < 0) throw error(400, "invalid payment method");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  assertTerminal(terminal, "checkout");
  var rawRows = rows(nyanqlGet("checkout/summary", { table_code: input.table_code }));
  if (rawRows.length === 0) throw error(404, "checkout target not found");
  if (rawRows[0].session_status !== "payment_requested") throw error(409, "payment has not been requested or is already settled");
  var subtotal = rawRows.reduce(function(sum, row) { return sum + Number(row.line_subtotal || 0); }, 0);
  var taxAmount = rawRows.reduce(function(sum, row) { return sum + Number(row.line_tax || 0); }, 0);
  var sessionId = rawRows[0].session_id;
  var payment = first(nyanqlPost("payments", { id: newId("pay"), session_id: sessionId, payment_no: businessNo("PAY"), method: input.method, subtotal: subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount }));
  var closed = first(nyanqlPost("sessions/close", { session_id: sessionId }));
  if (!closed) throw error(409, "session is already settled");
  nyanqlPost("hall/tasks", { id: newId("task"), task_type: "clean_table", session_id: sessionId, table_id: closed.table_id, order_item_id: null, priority: 30, title: input.table_code + " 片付け", note: "精算完了後の片付け" });
  audit({ actorType: "terminal", actorId: terminal.id, action: "checkout.settle", targetType: "payment", targetId: payment.id, payload: { tableCode: input.table_code, method: input.method, totalAmount: subtotal + taxAmount } });
  return ok({ receiptNo: payment.payment_no, payment: payment });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function analyticsSummary() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "analytics");
  return ok({ summary: first(nyanqlGet("analytics/summary", { from_date: input.from_date || today(), to_date: input.to_date || today() })) });
}

function analyticsItemRanking() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  assertTerminal(first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code })), "analytics");
  return ok({ items: rows(nyanqlGet("analytics/item-ranking", { from_date: input.from_date || today(), to_date: input.to_date || today(), limit: input.limit || 10 })) });
}

function analyticsExportSalesCsv() {
  var input = params();
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

function adminCategory(row) {
  return {
    id: row.id,
    name: row.name,
    displayOrder: Number(row.display_order),
    active: Boolean(row.active)
  };
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
  assertAdminTerminal(input);
  var values = validateAdminMenuItemInput(input, false);
  values.id = newId("item");
  var item = first(nyanqlPost("admin/menu/items/create", values));
  if (!item) throw error(409, "商品を作成できませんでした");
  return ok({ item: adminMenuItem(item) });
}

function adminUpdateMenuItem() {
  var input = params();
  assertAdminTerminal(input);
  var values = validateAdminMenuItemInput(input, true);
  var item = first(nyanqlPost("admin/menu/items/update", values));
  if (!item) throw error(404, "商品が見つかりません");
  return ok({ item: adminMenuItem(item) });
}

function adminToggleMenuItemActive() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.item_id, "item_id");
  var item = first(nyanqlPost("admin/menu/items/toggle-active", {
    item_id: input.item_id,
    active: input.active === undefined ? null : booleanValue(input.active, false)
  }));
  if (!item) throw error(404, "商品が見つかりません");
  return ok({ item: adminMenuItem(item) });
}

function adminToggleMenuItemSoldOut() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.item_id, "item_id");
  var item = first(nyanqlPost("admin/menu/items/toggle-sold-out", {
    item_id: input.item_id,
    sold_out: input.sold_out === undefined ? null : booleanValue(input.sold_out, false)
  }));
  if (!item) throw error(404, "商品が見つかりません");
  return ok({ item: adminMenuItem(item) });
}

function adminMoveMenuItem() {
  var input = params();
  assertAdminTerminal(input);
  requireField(input.item_id, "item_id");
  requireField(input.direction, "direction");
  if (["up", "down"].indexOf(input.direction) < 0) throw error(400, "direction must be up or down");
  var item = first(nyanqlPost("admin/menu/items/move", { item_id: input.item_id, direction: input.direction }));
  if (!item) throw error(404, "商品が見つかりません");
  return ok({ item: adminMenuItem(item) });
}

function bootstrap() {
  var input = params();
  requireField(input.terminal_code, "terminal_code");
  var terminal = first(nyanqlGet("bootstrap", { terminal_code: input.terminal_code }));
  if (!terminal) throw error(404, "terminal not found");
  return ok({ terminal: terminal });
}
