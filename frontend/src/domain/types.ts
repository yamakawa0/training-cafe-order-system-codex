export type TerminalType = 'customer' | 'kitchen' | 'hall' | 'checkout' | 'analytics';
export type OrderItemStatus = 'ordered' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type HallTaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'qr';

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
  updatedAt: string;
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

export interface AdminTerminalSummary {
  terminalId: string;
  terminalCode: string;
  terminalType: TerminalType;
  tableCode: string | null;
  active: boolean;
  description: string | null;
  updatedAt: string | null;
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
