export type TerminalType = 'customer' | 'kitchen' | 'hall' | 'checkout' | 'analytics';
export type UserRole = 'manager' | 'cashier' | 'kitchen' | 'hall' | 'viewer';
export type OrderItemStatus = 'ordered' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type HallTaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qr';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refunded' | 'cancelled';
export type PaymentAttemptStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PaymentProvider = 'internal' | 'mock';

export interface ApiResponse<T> {
  success: boolean;
  status: number;
  result: T | null;
  message?: string;
}

export interface Terminal {
  id: string;
  terminal_code: string;
  terminal_type: TerminalType;
  display_name: string;
  table_code?: string;
  table_name?: string;
}

export interface AuthUser {
  id: string;
  loginId: string;
  displayName: string;
  role: UserRole;
  active?: boolean;
}

export interface AdminUser extends AuthUser {
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MenuOptionChoice {
  id: string;
  optionId?: string;
  name: string;
  priceDelta: number;
  displayOrder?: number;
  active?: boolean;
}

export interface MenuItemOption {
  id: string;
  itemId?: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder?: number;
  active?: boolean;
  choices: MenuOptionChoice[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  taxRate: number;
  imageUrl?: string;
  soldOut: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  lowStock?: boolean;
  allergyNote: string;
  options: MenuItemOption[];
}

export interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  items: MenuItem[];
}

export interface TableSession {
  id: string;
  tableId: string;
  tableCode?: string;
  tableName?: string;
  status: string;
  guestCount?: number;
  openedAt?: string;
  paymentRequestedAt?: string | null;
  closedAt?: string | null;
}

export interface Order {
  id: string;
  orderNo: string;
  sessionId: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  submittedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemName: string;
  quantity: number;
  status: OrderItemStatus;
  unitPrice: number;
  customerNote?: string;
  allergyNote?: string;
}

export interface Payment {
  id: string;
  paymentNo: string;
  method: PaymentMethod;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  provider?: PaymentProvider;
  externalPaymentId?: string | null;
  idempotencyKey?: string | null;
  providerStatus?: string | null;
  paidAt: string;
}

export interface PaymentRefund {
  refundId: string;
  refundNo: string;
  amount: number;
  reason: string;
  status: string;
  refundedAt: string;
  actorUserId?: string | null;
  actorUserDisplayName?: string | null;
  actorUserRole?: string | null;
  actorTerminalCode?: string | null;
  provider?: PaymentProvider;
  externalRefundId?: string | null;
  idempotencyKey?: string | null;
  providerStatus?: string | null;
}

export interface PaymentReceipt {
  paymentId: string;
  paymentNo: string;
  sessionId: string;
  tableCode: string;
  tableName: string;
  paidAt: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider: PaymentProvider;
  externalPaymentId: string | null;
  idempotencyKey: string | null;
  providerStatus: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  refundTotal: number;
  refundRemaining: number;
  refundStatus: 'none' | 'partial_refunded' | 'refunded';
  refundCount: number;
  refunds: PaymentRefund[];
  orders: Array<{ orderId: string; orderNo: string; status: string; subtotal: number; taxAmount: number; totalAmount: number; submittedAt: string }>;
  items: Array<{
    orderItemId: string;
    orderId: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    status: OrderItemStatus;
    optionTotal: number;
    optionsText: string;
    lineSubtotal: number;
    lineTax: number;
    lineTotal: number;
  }>;
}

export interface PaymentAttempt {
  attemptId: string;
  sessionId: string;
  paymentId: string | null;
  paymentNo: string | null;
  attemptNo: string;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amount: number;
  failureReason: string;
  cancelReason: string;
  provider: PaymentProvider;
  externalAttemptId?: string | null;
  idempotencyKey?: string | null;
  providerStatus?: string | null;
  terminalCode?: string | null;
  actorUserId?: string | null;
  actorUserDisplayName?: string | null;
  actorUserRole?: string | null;
  attemptedAt: string | null;
  cancelledAt: string | null;
  tableCode?: string | null;
  tableName?: string | null;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentProvider;
  externalEventId: string;
  eventType: string;
  externalPaymentId: string | null;
  externalRefundId: string | null;
  paymentId: string | null;
  refundId: string | null;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  payload?: unknown;
  receivedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

export interface AnalyticsSummary {
  [key: string]: number | undefined;
  sales_total?: number;
  gross_sales_total?: number;
  refund_total?: number;
  net_sales_total?: number;
  cost_total?: number;
  gross_profit?: number;
  gross_margin_rate?: number;
  payment_count?: number;
  average_spend?: number;
  table_turns?: number;
  cash_total?: number;
  card_total?: number;
  qr_total?: number;
  cash_count?: number;
  card_count?: number;
  qr_count?: number;
  average_cooking_seconds?: number;
}

export interface DailyCashClosure {
  id: string | null;
  businessDate: string;
  status: 'closed' | 'reopened' | null;
  periodStartedAt: string | null;
  periodEndedAt: string | null;
  grossSalesTotal: number;
  refundTotal: number;
  netSalesTotal: number;
  taxTotal: number;
  costTotal: number;
  grossProfit: number;
  cashTotal: number;
  cardTotal: number;
  qrTotal: number;
  internalProviderTotal: number;
  mockProviderTotal: number;
  paidCount: number;
  partialRefundedCount: number;
  refundedCount: number;
  failedCount: number;
  cancelledCount: number;
  refundCount: number;
  alreadyClosed: boolean;
  closureStatus: 'closed' | 'reopened' | null;
  closureId: string | null;
  closedByUserId: string | null;
  closedByUserDisplayName: string | null;
  closedByUserRole: string | null;
  closedByTerminalCode: string | null;
  closedAt: string | null;
  reopenedByUserId: string | null;
  reopenedByUserDisplayName: string | null;
  reopenedByUserRole: string | null;
  reopenedByTerminalCode: string | null;
  reopenedAt: string | null;
  reopenReason: string;
  note: string;
}

export interface ItemRanking {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  sales_total: number;
  cost_total?: number;
  gross_profit?: number;
  gross_margin_rate?: number;
}

export interface AdminMenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  itemCount: number;
  updatedAt: string | null;
}

export interface AdminMenuOptionChoice {
  id: string;
  optionId: string;
  name: string;
  priceDelta: number;
  displayOrder: number;
  active: boolean;
  updatedAt: string | null;
}

export interface AdminMenuItemOption {
  id: string;
  itemId: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number | null;
  displayOrder: number;
  active: boolean;
  updatedAt: string | null;
  choices: AdminMenuOptionChoice[];
}

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  grossProfit: number;
  grossMarginRate: number;
  taxRate: number;
  imageUrl: string;
  displayOrder: number;
  active: boolean;
  soldOut: boolean;
  trackStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  lowStock?: boolean;
  allergyNote: string | null;
  updatedAt: string | null;
}

export interface InventoryMovement {
  id: string;
  menuItemId: string;
  itemName: string;
  movementType: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  orderId?: string;
  orderNo?: string;
  orderItemId?: string;
  actorUserId?: string;
  actorUserDisplayName?: string;
  actorUserRole?: string;
  actorTerminalCode?: string;
  occurredAt: string;
  createdAt?: string;
}

export type AdminMenuItemInput = {
  item_id?: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  cost_price: number;
  tax_rate: number;
  image_url: string;
  display_order: number;
  active: boolean;
  sold_out: boolean;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  allergy_note: string;
};

export interface AdminTableSummary {
  tableId: string;
  tableCode: string;
  tableName: string;
  status: string;
  customerTerminalCode: string | null;
  currentSessionId: string | null;
  sessionStatus: string | null;
  orderCount: number;
  unpaidOrderCount: number;
  unservedItemCount: number;
  openTaskCount: number;
  updatedAt: string | null;
}

export interface AdminTableDetail extends AdminTableSummary {
  sessionOpenedAt: string | null;
  paymentRequestedAt: string | null;
  closedAt: string | null;
  orders: Array<{ orderId: string; orderNo: string; status: string; subtotal: number; taxAmount: number; totalAmount: number; submittedAt: string }>;
  orderItems: Array<{ orderItemId: string; orderNo: string; itemName: string; quantity: number; status: string; unitPrice: number; customerNote: string; allergyNote: string }>;
  payments: Array<{ paymentId: string; paymentNo: string; method: string; status: string; totalAmount: number; paidAt: string }>;
  hallTasks: Array<{ taskId: string; taskType: string; title: string; note: string; status: string; createdAt: string }>;
}

export interface AdminTableStatusResult {
  table_id?: string;
  table_code?: string;
  table_status?: string;
  session_id?: string | null;
}

export interface AdminForceCloseSessionResult {
  session_id: string;
  session_status: string;
  table_id: string;
  table_code: string;
  table_status: string;
}

export interface AdminTerminalSummary {
  terminalId: string;
  terminalCode: string;
  terminalType: TerminalType;
  tableCode: string | null;
  active: boolean;
  description: string | null;
  updatedAt: string | null;
}

export interface AdminOrderSummary {
  orderId: string;
  orderNo: string;
  sessionId: string;
  tableCode: string;
  tableName: string;
  orderStatus: string;
  itemCount: number;
  cancelledItemCount: number;
  unservedItemCount: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  submittedAt: string;
  paidAt: string | null;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  sessionStatus: string | null;
  sessionOpenedAt: string | null;
  paymentRequestedAt: string | null;
  closedAt: string | null;
  items: Array<{
    orderItemId: string;
    menuItemId?: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    unitCostPrice: number;
    optionTotal: number;
    optionsText: string;
    lineSubtotal: number;
    lineCostTotal: number;
    lineGrossProfit: number;
    lineGrossMarginRate: number;
    lineTax: number;
    status: OrderItemStatus;
    customerNote: string | null;
    allergyNote: string | null;
    canCancel: boolean;
  }>;
  payments: Array<{
    paymentId: string;
    paymentNo: string;
    method: string;
    status: string;
    provider?: PaymentProvider;
    externalPaymentId?: string | null;
    idempotencyKey?: string | null;
    providerStatus?: string | null;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    refundTotal?: number;
    refundRemaining?: number;
    refundStatus?: string;
    paidAt: string | null;
    refunds?: PaymentRefund[];
  }>;
  paymentAttempts: PaymentAttempt[];
  hallTasks: Array<{
    taskId: string;
    taskType: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

export interface AuditLogSummary {
  id: string;
  occurredAt: string;
  actorTerminalCode: string | null;
  actorTerminalType: string | null;
  actorUserId: string | null;
  actorUserDisplayName: string | null;
  actorUserRole: UserRole | null;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  status: 'success' | 'failure';
  errorMessage: string | null;
}

export interface AuditLogDetail extends AuditLogSummary {
  beforeData: unknown;
  afterData: unknown;
  requestData: unknown;
  createdAt: string;
}

export interface AuditLogSearchFilters {
  fromDate?: string;
  toDate?: string;
  action?: string;
  targetType?: string;
  targetLabel?: string;
  actorTerminalCode?: string;
  actorUserId?: string;
  actorUserRole?: UserRole | '';
  status?: 'success' | 'failure' | '';
  keyword?: string;
}

export interface CartItem {
  localId: string;
  menuItem: MenuItem;
  quantity: number;
  choiceIds: string[];
  customerNote: string;
}

export interface KitchenTicket {
  order_item_id: string;
  order_no: string;
  table_code: string;
  table_name: string;
  item_name: string;
  quantity: number;
  status: OrderItemStatus;
  allergy_note: string;
  customer_note: string;
  options_text: string;
  elapsed_seconds: number;
}

export interface HallTask {
  id: string;
  task_type: 'serve_item' | 'staff_call' | 'checkout_support' | 'clean_table';
  table_code: string;
  title: string;
  note: string;
  status: HallTaskStatus;
  priority: number;
  item_name?: string;
  quantity?: number;
  elapsed_seconds: number;
}

export interface CheckoutItem {
  orderItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  status: OrderItemStatus;
  optionTotal: number;
  optionsText: string;
  lineSubtotal: number;
  lineTax: number;
}

export interface CheckoutSummary {
  sessionId: string | null;
  tableCode: string | null;
  tableName: string | null;
  sessionStatus: string | null;
  latestAttempt?: PaymentAttempt | null;
  items: CheckoutItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}
