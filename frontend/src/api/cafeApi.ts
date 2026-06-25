import { get, post } from './client';
import type { AdminForceCloseSessionResult, AdminMenuCategory, AdminMenuItem, AdminMenuItemInput, AdminMenuItemOption, AdminMenuOptionChoice, AdminOrderDetail, AdminOrderSummary, AdminTableDetail, AdminTableStatusResult, AdminTableSummary, AdminTerminalSummary, AdminUser, AnalyticsSummary, AuditLogDetail, AuditLogSearchFilters, AuditLogSummary, AuthUser, CheckoutSummary, HallTask, InventoryMovement, ItemRanking, KitchenTicket, MenuCategory, PaymentMethod, PaymentReceipt, PaymentRefund, UserRole } from '../domain/types';

export const terminals = {
  customer: (tableCode: string) => `customer-${tableCode}`,
  kitchen: 'kitchen-main',
  hall: 'hall-main',
  checkout: 'checkout-main',
  analytics: 'analytics-manager'
};

export const cafeApi = {
  login: (input: { loginId: string; password: string; terminalCode: string }) => post<{ user: AuthUser; expiresAt?: string }>('/api/auth/login', input),
  logout: () => post<{ loggedOut: boolean }>('/api/auth/logout', {}),
  me: () => get<{ user: AuthUser }>('/api/auth/me'),
  menu: (tableCode: string) => get<{ categories: MenuCategory[] }>('/api/customer/menu', { terminal_code: terminals.customer(tableCode) }),
  openSession: (tableCode: string) => post<{ session: { id: string; status: string } }>('/api/customer/session/open', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode,
    guest_count: 1
  }),
  currentSession: (tableCode: string) => get<{ session: { id: string; status: string } | null }>('/api/customer/session/current', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode
  }),
  history: (tableCode: string, sessionId: string) => get<{ items: unknown[] }>('/api/customer/order/history', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode,
    session_id: sessionId
  }),
  orderHistory: (tableCode: string, sessionId: string) => get<{ items: unknown[] }>('/api/customer/order/history', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode,
    session_id: sessionId
  }),
  submitOrder: (tableCode: string, items: Array<{ menu_item_id: string; quantity: number; choice_ids: string[]; customer_note: string }>) =>
    post<{ orderNo: string; subtotal: number; taxAmount: number; totalAmount: number }>('/api/customer/order/submit', {
      terminal_code: terminals.customer(tableCode),
      table_code: tableCode,
      items
    }),
  requestPayment: (tableCode: string) => post('/api/customer/payment/request', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode
  }),
  staffCall: (tableCode: string, note: string) => post('/api/customer/staff-call', {
    terminal_code: terminals.customer(tableCode),
    table_code: tableCode,
    note
  }),
  kitchenTickets: () => get<{ tickets: KitchenTicket[] }>('/api/kitchen/tickets', { terminal_code: terminals.kitchen }),
  tickets: () => get<{ tickets: KitchenTicket[] }>('/api/kitchen/tickets', { terminal_code: terminals.kitchen }),
  kitchenStatus: (orderItemId: string, status: string) => post('/api/kitchen/item/status', {
    terminal_code: terminals.kitchen,
    order_item_id: orderItemId,
    status
  }),
  updateItemStatus: (orderItemId: string, status: string) => post('/api/kitchen/item/status', {
    terminal_code: terminals.kitchen,
    order_item_id: orderItemId,
    status
  }),
  hallTasks: () => get<{ tasks: HallTask[] }>('/api/hall/tasks', { terminal_code: terminals.hall }),
  tasks: () => get<{ tasks: HallTask[] }>('/api/hall/tasks', { terminal_code: terminals.hall }),
  hallStatus: (taskId: string, status: string, note = '') => post('/api/hall/task/status', {
    terminal_code: terminals.hall,
    task_id: taskId,
    status,
    note
  }),
  updateTaskStatus: (taskId: string, status: string, note = '') => post('/api/hall/task/status', {
    terminal_code: terminals.hall,
    task_id: taskId,
    status,
    note
  }),
  checkoutSummary: (tableCode: string) => get<{ summary: CheckoutSummary }>('/api/checkout/summary', {
    terminal_code: terminals.checkout,
    table_code: tableCode
  }),
  summary: (tableCode: string) => get<{ summary: CheckoutSummary }>('/api/checkout/summary', {
    terminal_code: terminals.checkout,
    table_code: tableCode
  }),
  settle: (tableCode: string, method: PaymentMethod) => post<{ receiptNo: string }>('/api/checkout/settle', {
    terminal_code: terminals.checkout,
    table_code: tableCode,
    method
  }),
  receipt: (input: { paymentId?: string; paymentNo?: string; reissue?: boolean }) => get<{ receipt: PaymentReceipt }>('/api/checkout/receipt', {
    terminal_code: terminals.checkout,
    payment_id: input.paymentId,
    payment_no: input.paymentNo,
    reissue: input.reissue ? 'true' : undefined
  }),
  refundPayment: (paymentId: string, reason: string) => post<{ refund: PaymentRefund; receipt: PaymentReceipt }>('/api/checkout/refund', {
    terminal_code: terminals.checkout,
    payment_id: paymentId,
    reason
  }),
  analyticsSummary: (fromDate: string, toDate: string) => get<{ summary: AnalyticsSummary }>('/api/analytics/summary', {
    terminal_code: terminals.analytics,
    from_date: fromDate,
    to_date: toDate
  }),
  itemRanking: (fromDate: string, toDate: string) => get<{ items: ItemRanking[] }>('/api/analytics/item-ranking', {
    terminal_code: terminals.analytics,
    from_date: fromDate,
    to_date: toDate
  }),
  exportSalesCsv: (fromDate: string, toDate: string) => get<{ contentType: string; filename: string; csv: string }>('/api/analytics/export-sales-csv', {
    terminal_code: terminals.analytics,
    from_date: fromDate,
    to_date: toDate
  }),
  adminMenuCategories: () => get<{ categories: AdminMenuCategory[] }>('/api/admin/menu/categories', {
    terminal_code: terminals.analytics
  }),
  adminCreateMenuCategory: (input: { name: string; display_order: number; active: boolean }) => post<{ category: AdminMenuCategory }>('/api/admin/menu/categories', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminUpdateMenuCategory: (input: { category_id: string; name: string; display_order: number; active: boolean }) => post<{ category: AdminMenuCategory }>('/api/admin/menu/categories/update', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminToggleMenuCategoryActive: (categoryId: string, active: boolean) => post<{ category: AdminMenuCategory }>('/api/admin/menu/categories/toggle-active', {
    terminal_code: terminals.analytics,
    category_id: categoryId,
    active
  }),
  adminMoveMenuCategory: (categoryId: string, direction: 'up' | 'down') => post<{ category: AdminMenuCategory }>('/api/admin/menu/categories/move', {
    terminal_code: terminals.analytics,
    category_id: categoryId,
    direction
  }),
  adminMenuItems: (filters: { categoryId?: string; keyword?: string; active?: string; soldOut?: string } = {}) => get<{ items: AdminMenuItem[] }>('/api/admin/menu/items', {
    terminal_code: terminals.analytics,
    category_id: filters.categoryId,
    keyword: filters.keyword,
    active: filters.active,
    sold_out: filters.soldOut
  }),
  adminCreateMenuItem: (input: AdminMenuItemInput) => post<{ item: AdminMenuItem }>('/api/admin/menu/items', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminUpdateMenuItem: (input: AdminMenuItemInput & { item_id: string }) => post<{ item: AdminMenuItem }>('/api/admin/menu/items/update', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminToggleMenuItemActive: (itemId: string, active: boolean) => post<{ item: AdminMenuItem }>('/api/admin/menu/items/toggle-active', {
    terminal_code: terminals.analytics,
    item_id: itemId,
    active
  }),
  adminToggleMenuItemSoldOut: (itemId: string, soldOut: boolean) => post<{ item: AdminMenuItem }>('/api/admin/menu/items/toggle-sold-out', {
    terminal_code: terminals.analytics,
    item_id: itemId,
    sold_out: soldOut
  }),
  adminUpdateMenuItemStock: (input: { item_id: string; track_stock: boolean; stock_quantity: number; low_stock_threshold: number }) => post<{ item: AdminMenuItem }>('/api/admin/menu/items/update-stock', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminAdjustMenuItemStock: (input: { item_id: string; delta: number; reason: string }) => post<{ item: AdminMenuItem; movement: InventoryMovement }>('/api/admin/menu/items/adjust-stock', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminMenuItemInventoryMovements: (itemId: string, filters: { movementType?: string; limit?: number; offset?: number } = {}) => get<{ movements: InventoryMovement[] }>('/api/admin/menu/items/inventory-movements', {
    terminal_code: terminals.analytics,
    item_id: itemId,
    movement_type: filters.movementType,
    limit: filters.limit,
    offset: filters.offset
  }),
  adminMoveMenuItem: (itemId: string, direction: 'up' | 'down') => post<{ item: AdminMenuItem }>('/api/admin/menu/items/move', {
    terminal_code: terminals.analytics,
    item_id: itemId,
    direction
  }),
  adminMenuItemOptions: (itemId: string) => get<{ options: AdminMenuItemOption[] }>('/api/admin/menu/items/options', {
    terminal_code: terminals.analytics,
    item_id: itemId
  }),
  adminCreateMenuItemOption: (input: { item_id: string; name: string; required: boolean; multi_select: boolean; min_select: number; max_select: number | null; active: boolean; display_order: number }) =>
    post<{ option: AdminMenuItemOption }>('/api/admin/menu/items/options', {
      terminal_code: terminals.analytics,
      ...input
    }),
  adminUpdateMenuItemOption: (input: { option_id: string; item_id: string; name: string; required: boolean; multi_select: boolean; min_select: number; max_select: number | null; active: boolean; display_order: number }) =>
    post<{ option: AdminMenuItemOption }>('/api/admin/menu/items/options/update', {
      terminal_code: terminals.analytics,
      ...input
    }),
  adminToggleMenuItemOptionActive: (optionId: string, active: boolean) => post<{ option: AdminMenuItemOption }>('/api/admin/menu/items/options/toggle-active', {
    terminal_code: terminals.analytics,
    option_id: optionId,
    active
  }),
  adminMoveMenuItemOption: (optionId: string, direction: 'up' | 'down') => post<{ option: AdminMenuItemOption }>('/api/admin/menu/items/options/move', {
    terminal_code: terminals.analytics,
    option_id: optionId,
    direction
  }),
  adminCreateMenuOptionChoice: (input: { option_id: string; name: string; price_delta: number; active: boolean; display_order: number }) =>
    post<{ choice: AdminMenuOptionChoice }>('/api/admin/menu/items/options/choices', {
      terminal_code: terminals.analytics,
      ...input
    }),
  adminUpdateMenuOptionChoice: (input: { choice_id: string; option_id: string; name: string; price_delta: number; active: boolean; display_order: number }) =>
    post<{ choice: AdminMenuOptionChoice }>('/api/admin/menu/items/options/choices/update', {
      terminal_code: terminals.analytics,
      ...input
    }),
  adminToggleMenuOptionChoiceActive: (choiceId: string, active: boolean) => post<{ choice: AdminMenuOptionChoice }>('/api/admin/menu/items/options/choices/toggle-active', {
    terminal_code: terminals.analytics,
    choice_id: choiceId,
    active
  }),
  adminMoveMenuOptionChoice: (choiceId: string, direction: 'up' | 'down') => post<{ choice: AdminMenuOptionChoice }>('/api/admin/menu/items/options/choices/move', {
    terminal_code: terminals.analytics,
    choice_id: choiceId,
    direction
  }),
  adminTables: (filters: { status?: string; keyword?: string } = {}) => get<{ tables: AdminTableSummary[] }>('/api/admin/tables', {
    terminal_code: terminals.analytics,
    status: filters.status,
    keyword: filters.keyword
  }),
  adminTableDetail: (tableCode: string) => get<{ table: AdminTableDetail }>('/api/admin/tables/detail', {
    terminal_code: terminals.analytics,
    table_code: tableCode
  }),
  adminUpdateTableStatus: (tableCode: string, status: 'available' | 'disabled') => post<{ table: AdminTableStatusResult | AdminForceCloseSessionResult }>('/api/admin/tables/update-status', {
    terminal_code: terminals.analytics,
    table_code: tableCode,
    status
  }),
  adminForceCloseSession: (sessionId: string) => post<{ session: AdminForceCloseSessionResult }>('/api/admin/tables/force-close-session', {
    terminal_code: terminals.analytics,
    session_id: sessionId
  }),
  adminTerminals: (keyword = '') => get<{ terminals: AdminTerminalSummary[] }>('/api/admin/terminals', {
    terminal_code: terminals.analytics,
    keyword
  }),
  adminUpdateTerminalActive: (targetTerminalCode: string, active: boolean) => post<{ terminal: AdminTerminalSummary }>('/api/admin/terminals/update-active', {
    terminal_code: terminals.analytics,
    target_terminal_code: targetTerminalCode,
    active
  }),
  adminOrders: (filters: { fromDate?: string; toDate?: string; tableCode?: string; orderNo?: string; orderStatus?: string; paymentStatus?: string } = {}) => get<{ orders: AdminOrderSummary[] }>('/api/admin/orders', {
    terminal_code: terminals.analytics,
    from_date: filters.fromDate,
    to_date: filters.toDate,
    table_code: filters.tableCode,
    order_no: filters.orderNo,
    order_status: filters.orderStatus,
    payment_status: filters.paymentStatus
  }),
  adminOrderDetail: (orderId: string) => get<{ order: AdminOrderDetail }>('/api/admin/orders/detail', {
    terminal_code: terminals.analytics,
    order_id: orderId
  }),
  adminCancelOrderItem: (orderItemId: string, cancelNote = '') => post<{ order: AdminOrderDetail }>('/api/admin/orders/cancel-item', {
    terminal_code: terminals.analytics,
    order_item_id: orderItemId,
    cancel_note: cancelNote
  }),
  adminCancelOrder: (orderId: string, cancelNote = '') => post<{ order: AdminOrderDetail }>('/api/admin/orders/cancel-order', {
    terminal_code: terminals.analytics,
    order_id: orderId,
    cancel_note: cancelNote
  }),
  adminAuditLogs: (filters: AuditLogSearchFilters = {}) => get<{ logs: AuditLogSummary[] }>('/api/admin/audit-logs', {
    terminal_code: terminals.analytics,
    from_date: filters.fromDate,
    to_date: filters.toDate,
    action: filters.action,
    target_type: filters.targetType,
    target_label: filters.targetLabel,
    actor_terminal_code: filters.actorTerminalCode,
    actor_user_id: filters.actorUserId,
    actor_user_role: filters.actorUserRole,
    status: filters.status,
    keyword: filters.keyword
  }),
  adminAuditLogsExportCsv: (filters: AuditLogSearchFilters = {}) => get<{ contentType: string; filename: string; csv: string }>('/api/admin/audit-logs/export-csv', {
    terminal_code: terminals.analytics,
    from_date: filters.fromDate,
    to_date: filters.toDate,
    action: filters.action,
    target_type: filters.targetType,
    target_label: filters.targetLabel,
    actor_terminal_code: filters.actorTerminalCode,
    actor_user_id: filters.actorUserId,
    actor_user_role: filters.actorUserRole,
    status: filters.status,
    keyword: filters.keyword
  }),
  adminAuditLogDetail: (auditLogId: string) => get<{ log: AuditLogDetail }>('/api/admin/audit-logs/detail', {
    terminal_code: terminals.analytics,
    id: auditLogId
  }),
  adminUsers: (keyword = '') => get<{ users: AdminUser[] }>('/api/admin/users', {
    terminal_code: terminals.analytics,
    keyword
  }),
  adminCreateUser: (input: { login_id: string; display_name: string; password: string; role: UserRole; active: boolean }) => post<{ user: AdminUser }>('/api/admin/users', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminUpdateUser: (input: { id: string; display_name: string; password?: string; role: UserRole }) => post<{ user: AdminUser }>('/api/admin/users/update', {
    terminal_code: terminals.analytics,
    ...input
  }),
  adminToggleUserActive: (id: string, active: boolean) => post<{ user: AdminUser }>('/api/admin/users/toggle-active', {
    terminal_code: terminals.analytics,
    id,
    active
  })
};
