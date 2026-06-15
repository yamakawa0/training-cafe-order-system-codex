export type TerminalType = 'customer' | 'kitchen' | 'hall' | 'checkout' | 'analytics';
export type OrderItemStatus = 'ordered' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type HallTaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qr';

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

export interface MenuOptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface MenuItemOption {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
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
  paidAt: string;
}

export interface AnalyticsSummary {
  sales_total?: number;
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

export interface ItemRanking {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  sales_total: number;
}

export interface AdminMenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  taxRate: number;
  displayOrder: number;
  active: boolean;
  soldOut: boolean;
  allergyNote: string | null;
  updatedAt: string | null;
}

export type AdminMenuItemInput = {
  item_id?: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  tax_rate: number;
  display_order: number;
  active: boolean;
  sold_out: boolean;
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
    itemName: string;
    quantity: number;
    unitPrice: number;
    optionTotal: number;
    lineSubtotal: number;
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
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    paidAt: string | null;
  }>;
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
  lineSubtotal: number;
  lineTax: number;
}

export interface CheckoutSummary {
  sessionId: string | null;
  tableCode: string | null;
  tableName: string | null;
  sessionStatus: string | null;
  items: CheckoutItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}
