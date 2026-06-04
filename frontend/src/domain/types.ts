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
